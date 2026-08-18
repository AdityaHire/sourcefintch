"""
RAG Orchestration Service.

Coordinates:
1. Four-way repository existence and status verification via Node backend:
   - Node unreachable → HTTP 502
   - Repository does not exist → HTTP 404
   - Repository still mid-indexing (pending, cloning, scanning, storing, embedding) → HTTP 409
   - Repository indexing failed → HTTP 422
2. Vector retrieval from Qdrant via retrieval_service with RAG_MIN_SCORE filtering.
3. Zero-evidence short-circuit (returns exact spec fallback with sources: [] without calling LLM).
4. Total context-size cap (RAG_MAX_CONTEXT_CHARS) with priority-based chunk dropping.
5. System prompt construction adhering strictly to Spec §35 hallucination-control rules.
6. LLM answer generation and traceable sources response formatting.
"""

import logging
from typing import Optional

from fastapi import HTTPException
import httpx

from app.config import settings
from app.services.llm_service import get_llm_provider
from app.services.retrieval_service import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

FALLBACK_NO_EVIDENCE = (
    "I couldn't find enough evidence in the indexed repository to answer this confidently."
)

SYSTEM_PROMPT = """You are an expert AI code assistant analyzing a software repository for Sourcefinch.
Answer the user's question based ONLY on the provided code context.

STRICT RULES:
1. Grounding: Answer strictly using the provided code snippets. Do not extrapolate beyond what is present in the context.
2. Citations: For every fact, function, class, or logic you describe, cite the source file and line range using the exact format [file_path:start_line-end_line].
3. No Inventions: Never invent file names, function names, classes, or dependencies not present in the context.
4. Missing Information: If the provided context does not contain enough information to answer completely or confidently, state clearly what is missing.
5. Distinguish Facts from Assumptions: Clearly separate direct facts found in the code from assumptions.
6. Security: Never expose or suggest committing secrets, API keys, or credentials.
7. Technical Precision: Keep explanations clear, structured, accurate, and concise."""


async def get_repository_info(repository_id: int) -> dict:
    """Fetch repository metadata and status from the Node backend.

    Distinguishes upstream connection failures (502) from missing repositories (404).

    Raises:
        HTTPException(404): If the repository does not exist in MySQL.
        HTTPException(502): If the Node backend is unreachable or returns an error.
    """
    url = f"{settings.node_api_url}/api/repositories/{repository_id}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as exc:
        logger.error("Failed to reach Node backend at %s: %s", url, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Node backend is unreachable: {exc}",
        )

    if response.status_code == 404:
        logger.warning("Repository %d not found in Node API (404)", repository_id)
        raise HTTPException(status_code=404, detail="Repository not found")

    if response.status_code != 200:
        logger.error("Node API returned %s for %s: %s", response.status_code, url, response.text[:200])
        raise HTTPException(
            status_code=502,
            detail=f"Node API returned status {response.status_code}",
        )

    return response.json()


def build_user_prompt(question: str, chunks: list[dict]) -> str:
    """Format retrieved code chunks into clearly delimited context blocks."""
    context_blocks = []
    for c in chunks:
        header = f"--- [{c['file_path']}:{c['start_line']}-{c['end_line']}] (language: {c['language']}) ---"
        context_blocks.append(f"{header}\n{c['content']}\n---")

    context_str = "\n\n".join(context_blocks)
    return (
        f"Here is the relevant code context retrieved from the repository:\n\n"
        f"{context_str}\n\n"
        f"Question: {question}\n\n"
        f"Provide a clear, grounded answer citing the relevant files and line ranges:"
    )


def apply_context_cap(chunks: list[dict], max_chars: int) -> tuple[list[dict], int]:
    """Sort chunks by score descending and cap total character length.

    Returns:
        A tuple of (retained_chunks, dropped_count).
    """
    sorted_chunks = sorted(chunks, key=lambda c: c.get("score", 0.0), reverse=True)
    retained = []
    current_chars = 0
    dropped = 0

    for chunk in sorted_chunks:
        content_len = len(chunk.get("content", ""))
        if current_chars + content_len <= max_chars or not retained:
            retained.append(chunk)
            current_chars += content_len
        else:
            dropped += 1

    return retained, dropped


async def answer_question(repository_id: int, question: str) -> dict:
    """Execute the full RAG pipeline for a user question.

    Returns:
        A dict with { "answer": str, "sources": list[dict] }.
    """
    # ── Step 1: Verify repository existence and status in MySQL ──────
    repo_info = await get_repository_info(repository_id)
    status = repo_info.get("status", "").lower()

    if status in ("pending", "cloning", "scanning", "storing", "embedding"):
        logger.warning("Repository %d is mid-indexing (status: '%s')", repository_id, status)
        raise HTTPException(
            status_code=409,
            detail=f"Repository {repository_id} is currently indexing (status: '{status}'). Please wait for indexing to complete.",
        )

    if status == "failed":
        logger.warning("Repository %d status is 'failed'", repository_id)
        raise HTTPException(
            status_code=422,
            detail=f"Repository {repository_id} indexing failed and cannot be queried.",
        )

    # ── Step 2: Retrieve relevant chunks from Qdrant ─────────────────
    # NOTE ON MULTI-TURN CONTEXT LIMITATION:
    # Each question is currently embedded and retrieved independently of prior
    # conversation turns. Follow-up questions that rely on pronouns or context
    # from earlier in the conversation (e.g. "how do I run it?") may retrieve poorly
    # or trigger the zero-evidence fallback, since "it" has no resolvable meaning
    # at embedding time. Multi-turn context injection is tracked as future work,
    # not handled in Phase 7.
    candidate_chunks = retrieve_relevant_chunks(
        repository_id=repository_id,
        query=question,
        top_k=settings.rag_top_k,
        min_score=settings.rag_min_score,
    )

    # ── Step 3: Zero-evidence short-circuit ──────────────────────────
    if not candidate_chunks:
        logger.info(
            "No chunks met similarity threshold (min_score=%.2f) for repo %d. Short-circuiting LLM call.",
            settings.rag_min_score,
            repository_id,
        )
        return {
            "answer": FALLBACK_NO_EVIDENCE,
            "sources": [],
        }

    # ── Step 4: Apply context-size cap ───────────────────────────────
    retained_chunks, dropped_count = apply_context_cap(
        candidate_chunks,
        max_chars=settings.rag_max_context_chars,
    )
    if dropped_count > 0:
        logger.info(
            "Dropped %d lower-scoring chunks due to context cap (%d chars max)",
            dropped_count,
            settings.rag_max_context_chars,
        )

    # ── Step 5: Format prompts ───────────────────────────────────────
    user_prompt = build_user_prompt(question, retained_chunks)
    logger.debug("Prompt constructed for repo %d:\nSystem: %s\nUser: %s", repository_id, SYSTEM_PROMPT, user_prompt[:200])

    # ── Step 6: Call LLM Provider ────────────────────────────────────
    llm_provider = get_llm_provider()
    logger.info("Calling LLM provider '%s' for repository %d...", settings.llm_provider, repository_id)
    answer_text = await llm_provider.generate_answer(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    # ── Step 7: Build traceable sources array ────────────────────────
    sources = [
        {
            "file_path": c["file_path"],
            "start_line": c["start_line"],
            "end_line": c["end_line"],
            "code_chunk_id": c.get("code_chunk_id"),
            "score": round(float(c.get("score", 0.0)), 4),
            "content": c.get("content", ""),
        }
        for c in retained_chunks
    ]

    return {
        "answer": answer_text,
        "sources": sources,
    }

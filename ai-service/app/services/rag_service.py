"""
RAG Orchestration Service.

Coordinates:
1. Four-way repository existence and status verification via Node backend:
   - Node unreachable → HTTP 502
   - Repository does not exist → HTTP 404
   - Repository still mid-indexing (pending, cloning, scanning, storing, embedding) → HTTP 409
   - Repository indexing failed → HTTP 422
2. Query rewriting using conversation history via Groq (llama-3.1-8b-instant).
3. Vector retrieval from Qdrant via retrieval_service with RAG_MIN_SCORE filtering.
4. Zero-evidence short-circuit (returns exact spec fallback with sources: [] without calling LLM).
5. Total context-size cap (RAG_MAX_CONTEXT_CHARS) with priority-based chunk dropping.
6. System prompt construction adhering strictly to Spec §35 hallucination-control rules.
7. LLM answer generation and traceable sources response formatting.
"""

import json
import logging
from typing import Optional

from fastapi import HTTPException
import httpx

from app.config import settings
from app.services.llm_service import get_llm_provider
from app.services.node_internal_client import async_internal_get
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

QUERY_REWRITE_MODEL = "llama-3.1-8b-instant"
QUERY_REWRITE_URL = "https://api.groq.com/openai/v1/chat/completions"
QUERY_REWRITE_SYSTEM = (
    "You are a query rewriting assistant for a code-search RAG system. "
    "Given a conversation history and a new user question, rewrite the new question into a "
    "single, standalone, fully self-contained search query. Resolve pronouns and references "
    "(e.g. 'it', 'that function', 'this file') using the conversation context. Do not answer the question. "
    "Output only the rewritten query."
)


async def get_repository_info(repository_id: int) -> dict:
    """Fetch repository metadata and status from the Node backend.

    Distinguishes upstream connection failures (502) from missing repositories (404).

    Raises:
        HTTPException(404): If the repository does not exist in MySQL.
        HTTPException(502): If the Node backend is unreachable or returns an error.
    """
    url = f"{settings.node_api_url}/api/repositories/{repository_id}"

    try:
        response = await async_internal_get(url)
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


async def rewrite_query(question: str, conversation_history: Optional[list]) -> str:
    """Rewrite a user question into a standalone search query using Groq.

    If no history is provided or the Groq call fails, returns the original
    question unchanged so retrieval still works.
    """
    if not settings.effective_groq_api_key:
        return question

    history_block = ""
    if conversation_history:
        recent = conversation_history[-6:]
        history_block = "\n".join(
            f"{h.get('role', 'user')}: {h.get('content', '')}" for h in recent if isinstance(h, dict)
        )

    if not history_block:
        return question

    user_content = (
        f"Conversation history:\n{history_block}\n\n"
        f"New question:\n{question}\n\n"
        f"Rewritten standalone query:"
    )

    try:
        llm = get_llm_provider()
        rewritten = await llm.generate_answer(
            system_prompt=QUERY_REWRITE_SYSTEM,
            user_prompt=user_content,
        )
        if rewritten:
            return rewritten
        return question
    except Exception as exc:
        logger.warning("Query rewrite failed; using original question: %s", exc)
        return question


async def answer_question(repository_id: int, question: str, conversation_history: Optional[list] = None) -> dict:
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

    # ── Step 2: Rewrite query using conversation history ──────────────
    retrieval_query = await rewrite_query(question, conversation_history)

    # ── Step 3: Retrieve relevant chunks from Qdrant ─────────────────
    candidate_chunks = retrieve_relevant_chunks(
        repository_id=repository_id,
        query=retrieval_query,
        top_k=settings.rag_top_k,
        min_score=settings.rag_min_score,
    )

    # ── Step 4: Zero-evidence short-circuit ──────────────────────────
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

    # ── Step 5: Apply context-size cap ───────────────────────────────
    context_len = sum(len(c.get("content", "")) for c in candidate_chunks)
    logger.info(
        "Context size for repo %d query '%s': %d chars (cap=%d, chunks=%d)",
        repository_id,
        retrieval_query[:50],
        context_len,
        settings.rag_max_context_chars,
        len(candidate_chunks),
    )
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

    retained_context_len = sum(len(c.get("content", "")) for c in retained_chunks)
    logger.info(
        "Retained context for repo %d: %d chars from %d chunks (top score=%.4f, min retained score=%.4f)",
        repository_id,
        retained_context_len,
        len(retained_chunks),
        retained_chunks[0].get("score", 0.0) if retained_chunks else 0.0,
        retained_chunks[-1].get("score", 0.0) if retained_chunks else 0.0,
    )

    # ── Step 6: Format prompts ───────────────────────────────────────
    user_prompt = build_user_prompt(question, retained_chunks)
    logger.debug("Prompt constructed for repo %d:\nSystem: %s\nUser: %s", repository_id, SYSTEM_PROMPT, user_prompt[:200])

    # ── Step 7: Call LLM Provider (with empty-answer retry) ──────────
    llm_provider = get_llm_provider()
    logger.info("Calling LLM provider '%s' for repository %d...", settings.llm_provider, repository_id)

    def _build_sources(chunks):
        return [
            {
                "file_path": c["file_path"],
                "start_line": c["start_line"],
                "end_line": c["end_line"],
                "code_chunk_id": c.get("code_chunk_id"),
                "score": round(float(c.get("score", 0.0)), 4),
                "content": c.get("content", ""),
            }
            for c in chunks
        ]

    def _call_llm(chunks):
        prompt = build_user_prompt(question, chunks)
        return llm_provider.generate_answer(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )

    answer_text = await _call_llm(retained_chunks)
    logger.info(
        "LLM returned answer for repo %d: length=%d, empty=%s",
        repository_id,
        len(answer_text),
        not bool(answer_text.strip()),
    )

    # Retry once with fewer chunks if the model returned an empty response
    # (common with `finish_reason=length` on smaller context windows).
    if not answer_text or not answer_text.strip():
        logger.warning(
            "LLM returned empty answer for repo %d (query='%s'). Retrying with fewer chunks...",
            repository_id,
            retrieval_query[:80],
        )
        reduced_chunks = retained_chunks[: max(1, len(retained_chunks) // 2)]
        answer_text = await _call_llm(reduced_chunks)
        logger.info(
            "LLM retry for repo %d: length=%d, empty=%s",
            repository_id,
            len(answer_text),
            not bool(answer_text.strip()),
        )
        if answer_text and answer_text.strip():
            retained_chunks = reduced_chunks

    if not answer_text or not answer_text.strip():
        logger.warning(
            "LLM retry also returned empty answer for repo %d (query='%s'). Returning fallback.",
            repository_id,
            retrieval_query[:80],
        )
        return {
            "answer": FALLBACK_NO_EVIDENCE,
            "sources": _build_sources(retained_chunks),
        }

    # ── Step 8: Build traceable sources array ────────────────────────
    sources = _build_sources(retained_chunks)

    return {
        "answer": answer_text,
        "sources": sources,
    }

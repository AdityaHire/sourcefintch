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

import asyncio
import json
import logging
from typing import AsyncGenerator, Optional

import tiktoken
from fastapi import HTTPException
import httpx

from app.config import settings
from app.services.llm_service import get_llm_provider
from app.services.llm_service import GroqAPIError, LLMResult
from app.services.node_internal_client import async_internal_get
from app.services.retrieval_service import retrieve_relevant_chunks

logger = logging.getLogger(__name__)

_encoding = tiktoken.get_encoding("cl100k_base")


def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in *text* using tiktoken's cl100k_base encoding.

    Cached at module load — the encoding object is created once and reused
    across all calls, avoiding repeated lookup overhead.
    """
    return len(_encoding.encode(text))


def estimate_full_prompt_tokens(
    system_prompt: str,
    question: str,
    chunks: list[dict],
    conversation_history: Optional[list] = None,
) -> int:
    """Estimate the total token count of the full assembled prompt sent to the LLM.

    Mirrors exactly what Groq receives: system prompt + conversation history
    (if any) + context chunks + user question.  This is NOT just the raw
    question — it includes all retrieved context so the estimate reflects the
    actual API payload size.
    """
    user_prompt = build_user_prompt(question, chunks)

    history_block = ""
    if conversation_history:
        recent = conversation_history[-6:]
        history_block = "\n".join(
            f"{h.get('role', 'user')}: {h.get('content', '')}"
            for h in recent
            if isinstance(h, dict)
        )

    full_prompt = system_prompt
    if history_block:
        full_prompt += "\n" + history_block
    full_prompt += "\n" + user_prompt
    return estimate_tokens(full_prompt)

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
        result = await llm.generate_answer(
            system_prompt=QUERY_REWRITE_SYSTEM,
            user_prompt=user_content,
        )
        if result and result.answer:
            return result.answer
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

    # ── Step 6: Format prompts & pre-flight token estimation ────────────
    user_prompt = build_user_prompt(question, retained_chunks)

    estimated_tokens = estimate_full_prompt_tokens(
        SYSTEM_PROMPT, question, retained_chunks, conversation_history,
    )
    logger.info(
        "Pre-flight token estimate | repo=%d | threshold=%d | "
        "estimated_prompt_tokens=%d | chunks=%d",
        repository_id,
        settings.rag_max_estimated_tokens,
        estimated_tokens,
        len(retained_chunks),
    )

    # Pre-flight trimming: if the estimate exceeds the safe threshold
    # (Groq's 8k TPM limit), proactively halve the chunks (highest-scoring
    # first — they are already sorted by score descending from apply_context_cap)
    # *before* the first API call. Do not wait for a 413.
    pre_flight_trimmed = False
    while estimated_tokens > settings.rag_max_estimated_tokens and len(retained_chunks) > 1:
        new_len = max(1, len(retained_chunks) // 2)
        logger.warning(
            "Estimated tokens %d exceeds threshold %d — pre-flight trimming "
            "chunks from %d to %d (highest-scored retained first)",
            estimated_tokens,
            settings.rag_max_estimated_tokens,
            len(retained_chunks),
            new_len,
        )
        retained_chunks = retained_chunks[:new_len]
        estimated_tokens = estimate_full_prompt_tokens(
            SYSTEM_PROMPT, question, retained_chunks, conversation_history,
        )
        pre_flight_trimmed = True
        logger.info(
            "After pre-flight trim | chunks=%d | estimated_prompt_tokens=%d",
            len(retained_chunks),
            estimated_tokens,
        )

    if pre_flight_trimmed:
        logger.info(
            "Pre-flight trimming applied for repo %d: %d chunks retained, "
            "estimated %d tokens (below threshold %d)",
            repository_id,
            len(retained_chunks),
            estimated_tokens,
            settings.rag_max_estimated_tokens,
        )

    logger.debug("Prompt constructed for repo %d:\nSystem: %s\nUser: %s", repository_id, SYSTEM_PROMPT, user_prompt[:200])

    # ── Step 7: Call LLM Provider (with pre-flight trimming + retry) ──
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

    async def _call_llm(chunks):
        prompt = build_user_prompt(question, chunks)
        result = await llm_provider.generate_answer(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=prompt,
        )
        # Log estimated vs actual token usage for accuracy tracking.
        actual_prompt = None
        actual_completion = None
        if result.usage:
            actual_prompt = result.usage.get("prompt_tokens")
            actual_completion = result.usage.get("completion_tokens")
        logger.info(
            "Token usage | repo=%d | estimated_prompt=%d | "
            "actual_prompt=%s | actual_completion=%s | chunks=%d",
            repository_id,
            estimate_full_prompt_tokens(
                SYSTEM_PROMPT, question, chunks, conversation_history,
            ),
            actual_prompt,
            actual_completion,
            len(chunks),
        )
        return result

    async def _call_llm_with_retry(chunks):
        """Call the LLM with a 413/429 retry safety net.

        - 413 (payload too large): immediately retry once with halved chunks.
        - 429 (rate limited / TPM): wait ~60 s for the TPM window to reset,
          then retry once.
        If the second attempt also fails, raise a clear user-facing error
        rather than surfacing the raw API exception.
        """
        try:
            return await _call_llm(chunks)
        except GroqAPIError as exc:
            if exc.status_code == 413:
                reduced = max(1, len(chunks) // 2)
                logger.warning(
                    "Groq 413 (payload too large) for repo %d. "
                    "Retrying once with %d chunks (was %d)...",
                    repository_id,
                    reduced,
                    len(chunks),
                )
                retry_chunks = chunks[:reduced]
                try:
                    return await _call_llm(retry_chunks)
                except GroqAPIError:
                    logger.error(
                        "Groq 413 retry also failed for repo %d. Prompt too large.",
                        repository_id,
                    )
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "The context was too large even after automatic trimming. "
                            "Try a more specific question or a smaller repository."
                        ),
                    )
                except Exception:
                    raise
            elif exc.status_code == 429:
                logger.warning(
                    "Groq 429 (rate limited / TPM) for repo %d. "
                    "Waiting 60 s for TPM window reset, then retrying once...",
                    repository_id,
                )
                await asyncio.sleep(60)
                try:
                    return await _call_llm(chunks)
                except GroqAPIError:
                    logger.error(
                        "Groq 429 retry also failed for repo %d.",
                        repository_id,
                    )
                    raise HTTPException(
                        status_code=429,
                        detail=(
                            "Rate limit exceeded. The LLM provider rejected the "
                            "request even after waiting for the TPM window to reset. "
                            "Please try again in a minute."
                        ),
                    )
                except Exception:
                    raise
            else:
                raise

    result = await _call_llm_with_retry(retained_chunks)
    answer_text = result.answer
    actual_prompt_tokens = result.usage.get("prompt_tokens") if result.usage else None
    actual_completion_tokens = result.usage.get("completion_tokens") if result.usage else None
    logger.info(
        "LLM returned answer for repo %d: length=%d, empty=%s | "
        "estimated_prompt_tokens=%d | actual_prompt_tokens=%s | actual_completion_tokens=%s",
        repository_id,
        len(answer_text),
        not bool(answer_text.strip()),
        estimated_tokens,
        actual_prompt_tokens,
        actual_completion_tokens,
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
        result = await _call_llm_with_retry(reduced_chunks)
        answer_text = result.answer
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


FOLLOW_UP_SYSTEM = (
    "You generate concise follow-up questions for a code-analysis AI assistant. "
    "Given the user's original question and the AI's answer about a software repository, "
    "suggest exactly 3 short, natural follow-up questions the user might want to ask next. "
    "Each question should be specific, actionable, and different from the others. "
    "Output ONLY a JSON array of 3 strings, nothing else. Example: "
    '[\"How is error handling done in this module?\", \"What tests cover this function?\", \"Are there any performance concerns?\"]'
)


async def _generate_follow_up_suggestions(question: str, answer: str) -> list[str]:
    """Generate 3 context-aware follow-up questions using a fast LLM call.

    Returns a list of up to 3 question strings, or an empty list on failure.
    This is best-effort — failures are logged but never propagated.
    """
    if not answer or not answer.strip():
        return []

    # Truncate long answers to keep the suggestion call fast and cheap
    truncated_answer = answer[:2000] if len(answer) > 2000 else answer

    user_content = (
        f"User's question:\n{question}\n\n"
        f"AI's answer:\n{truncated_answer}\n\n"
        f"Generate 3 follow-up questions:"
    )

    try:
        llm = get_llm_provider()
        result = await llm.generate_answer(
            system_prompt=FOLLOW_UP_SYSTEM,
            user_prompt=user_content,
        )
        if result and result.answer:
            # Parse JSON array from the response
            raw = result.answer.strip()
            # Handle cases where model wraps in markdown code block
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                # Take up to 3, ensure they're strings
                return [str(q).strip() for q in parsed[:3] if q and str(q).strip()]
        return []
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse follow-up suggestions JSON: %s", exc)
        return []
    except Exception as exc:
        logger.warning("Follow-up suggestion generation failed (non-fatal): %s", exc)
        return []


async def stream_question(
    repository_id: int,
    question: str,
    conversation_history: Optional[list] = None,
) -> AsyncGenerator[dict, None]:
    """Execute the RAG pipeline and stream the answer token by token.

    Yields:
        {"type": "citations", "sources": [...]}
        {"type": "token", "content": "..."}
        {"type": "done"}
    """
    # Step 1: Verify repository status
    repo_info = await get_repository_info(repository_id)
    status = repo_info.get("status", "").lower()

    if status in ("pending", "cloning", "scanning", "storing", "embedding"):
        raise HTTPException(
            status_code=409,
            detail=f"Repository {repository_id} is currently indexing (status: '{status}'). Please wait for indexing to complete.",
        )
    if status == "failed":
        raise HTTPException(
            status_code=422,
            detail=f"Repository {repository_id} indexing failed and cannot be queried.",
        )

    # Step 2: Rewrite query
    retrieval_query = await rewrite_query(question, conversation_history)

    # Step 3: Retrieve relevant chunks
    candidate_chunks = retrieve_relevant_chunks(
        repository_id=repository_id,
        query=retrieval_query,
        top_k=settings.rag_top_k,
        min_score=settings.rag_min_score,
    )

    # Step 4: Zero-evidence short-circuit
    if not candidate_chunks:
        yield {"type": "citations", "sources": []}
        yield {"type": "token", "content": FALLBACK_NO_EVIDENCE}
        yield {"type": "done"}
        return

    # Step 5: Apply context-size cap
    retained_chunks, dropped_count = apply_context_cap(
        candidate_chunks,
        max_chars=settings.rag_max_context_chars,
    )

    # Step 6: Pre-flight trimming
    estimated_tokens = estimate_full_prompt_tokens(
        SYSTEM_PROMPT, question, retained_chunks, conversation_history,
    )
    while estimated_tokens > settings.rag_max_estimated_tokens and len(retained_chunks) > 1:
        new_len = max(1, len(retained_chunks) // 2)
        retained_chunks = retained_chunks[:new_len]
        estimated_tokens = estimate_full_prompt_tokens(
            SYSTEM_PROMPT, question, retained_chunks, conversation_history,
        )

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

    # First event: citations
    yield {"type": "citations", "sources": sources}

    # Step 7: Stream tokens
    user_prompt = build_user_prompt(question, retained_chunks)
    llm_provider = get_llm_provider()
    full_answer_tokens: list[str] = []
    try:
        async for token in llm_provider.stream_answer(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt):
            full_answer_tokens.append(token)
            yield {"type": "token", "content": token}
    except Exception as exc:
        logger.error("Error during streaming generation for repo %d: %s", repository_id, exc)
        yield {"type": "error", "content": str(exc)}
        return

    yield {"type": "done"}

    # Step 8: Generate follow-up suggestions (fire-and-forget, non-blocking)
    full_answer = "".join(full_answer_tokens)
    suggestions = await _generate_follow_up_suggestions(question, full_answer)
    if not suggestions:
        suggestions = _fallback_follow_up_suggestions(question)
    yield {"type": "suggestions", "questions": suggestions}


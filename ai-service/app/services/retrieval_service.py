"""
Retrieval service for RAG.

Given a repository ID and a natural language question:
1. Embeds the question using the same embedding model (all-MiniLM-L6-v2) used during indexing.
2. Queries Qdrant for the most similar chunks scoped to this repository_id.
3. Filters out any chunks with similarity scores below RAG_MIN_SCORE.
4. Returns the structured chunk list with metadata and payload details.
"""

import logging
from typing import Any, Optional

from app.config import settings
from app.services.bm25_service import BM25Index
from app.services.embedding_service import embed_texts, get_active_collection_name
from app.services.vector_service import (
    scroll_repository_chunks,
    search_points,
)

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    repository_id: int,
    query: str,
    top_k: Optional[int] = None,
    min_score: Optional[float] = None,
) -> list[dict]:
    """Retrieve top-K relevant code chunks using Hybrid Search (Dense + BM25 via RRF).

    Combines cosine similarity dense vector retrieval with code-aware BM25 lexical
    matching via Reciprocal Rank Fusion. This guarantees high recall for semantic
    questions while ensuring exact symbol, function, and file names rank at the top.

    Args:
        repository_id: MySQL repository ID to filter points.
        query: Natural language question from the user.
        top_k: Max chunks to retrieve (defaults to settings.rag_top_k).
        min_score: Minimum similarity score threshold (defaults to settings.rag_min_score).

    Returns:
        A list of dicts with keys:
            - id: Qdrant UUID
            - score: Fused similarity score (float)
            - file_path: Relative path to source file
            - language: Language identifier
            - start_line: 1-indexed start line
            - end_line: 1-indexed end line
            - content: Raw text chunk content
            - code_chunk_id: MySQL code_chunks ID
            - repository_id: Repository ID
    """
    limit = top_k if top_k is not None else settings.rag_top_k
    threshold = min_score if min_score is not None else settings.rag_min_score
    collection_name = get_active_collection_name()

    # ── Step 1: Dense Vector Retrieval ──────────────────────────────
    dense_fetch_limit = max(limit * 3, 20)
    query_vectors = embed_texts([query])
    query_vector = query_vectors[0]

    raw_dense_results = search_points(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=dense_fetch_limit,
        repository_id=repository_id,
    )

    # If hybrid search is disabled, fall back to pure dense retrieval
    if not getattr(settings, "hybrid_search_enabled", True):
        filtered_chunks = []
        for hit in raw_dense_results:
            score = hit.get("score", 0.0)
            if score < threshold:
                continue
            payload = hit.get("payload", {})
            filtered_chunks.append({
                "id": hit.get("id"),
                "score": score,
                "file_path": payload.get("file_path", ""),
                "language": payload.get("language", "unknown"),
                "start_line": payload.get("start_line", 1),
                "end_line": payload.get("end_line", 1),
                "content": payload.get("content", ""),
                "code_chunk_id": payload.get("code_chunk_id"),
                "repository_id": payload.get("repository_id", repository_id),
                "file_id": payload.get("file_id"),
            })
        return filtered_chunks[:limit]

    # ── Step 2: Lexical BM25 Retrieval ───────────────────────────────
    scrolled_points = scroll_repository_chunks(
        collection_name=collection_name,
        repository_id=repository_id,
        limit=1000,
    )

    bm25_chunks = []
    for pt in scrolled_points:
        p = pt.get("payload", {})
        bm25_chunks.append({
            "id": pt.get("id"),
            "file_path": p.get("file_path", ""),
            "language": p.get("language", "unknown"),
            "start_line": p.get("start_line", 1),
            "end_line": p.get("end_line", 1),
            "content": p.get("content", ""),
            "code_chunk_id": p.get("code_chunk_id"),
            "repository_id": p.get("repository_id", repository_id),
            "file_id": p.get("file_id"),
        })

    bm25_results: list[tuple[dict[str, Any], float]] = []
    if bm25_chunks:
        try:
            bm25_index = BM25Index(bm25_chunks)
            bm25_results = bm25_index.search(query, top_k=dense_fetch_limit)
        except Exception as exc:
            logger.warning("BM25 indexing/search failed for repo %d: %s", repository_id, exc)
            bm25_results = []

    # ── Step 3: Reciprocal Rank Fusion (RRF) ─────────────────────────
    rrf_k = getattr(settings, "hybrid_rrf_k", 60)
    w_dense = getattr(settings, "hybrid_dense_weight", 1.0)
    w_bm25 = getattr(settings, "hybrid_bm25_weight", 1.0)

    # Max possible RRF score (rank 1 in both): w_dense/(k+1) + w_bm25/(k+1)
    max_rrf = (w_dense / (rrf_k + 1)) + (w_bm25 / (rrf_k + 1))

    # Map chunk identifier to accumulated score and data
    chunk_map: dict[str, dict] = {}
    rrf_scores: dict[str, float] = {}
    dense_scores: dict[str, float] = {}

    # Rank dense results (1-indexed)
    for rank, hit in enumerate(raw_dense_results, start=1):
        c_id = str(hit.get("id"))
        payload = hit.get("payload", {})
        chunk_map[c_id] = {
            "id": hit.get("id"),
            "file_path": payload.get("file_path", ""),
            "language": payload.get("language", "unknown"),
            "start_line": payload.get("start_line", 1),
            "end_line": payload.get("end_line", 1),
            "content": payload.get("content", ""),
            "code_chunk_id": payload.get("code_chunk_id"),
            "repository_id": payload.get("repository_id", repository_id),
            "file_id": payload.get("file_id"),
        }
        score = float(hit.get("score", 0.0))
        dense_scores[c_id] = score
        rrf_scores[c_id] = rrf_scores.get(c_id, 0.0) + (w_dense / (rrf_k + rank))

    # Rank BM25 results (1-indexed)
    for rank, (chunk_data, bm_score) in enumerate(bm25_results, start=1):
        c_id = str(chunk_data.get("id"))
        if c_id not in chunk_map:
            chunk_map[c_id] = chunk_data
        rrf_scores[c_id] = rrf_scores.get(c_id, 0.0) + (w_bm25 / (rrf_k + rank))

    # ── Step 4: Final Score Calibration & Thresholding ───────────────
    fused_chunks = []
    for c_id, rrf_score in rrf_scores.items():
        chunk = chunk_map[c_id]
        normalized_rrf = min(1.0, rrf_score / max_rrf) if max_rrf > 0 else 0.0
        d_score = dense_scores.get(c_id)

        if d_score is not None:
            # Appeared in dense search: combine dense cosine score and RRF rank
            final_score = (d_score * 0.5) + (normalized_rrf * 0.5)
        else:
            # Pure BM25 match (e.g. rare symbol/identifier): scale normalized RRF
            final_score = normalized_rrf * 0.85

        if final_score < threshold:
            continue

        chunk_copy = dict(chunk)
        chunk_copy["score"] = round(final_score, 4)
        fused_chunks.append(chunk_copy)

    fused_chunks.sort(key=lambda x: x["score"], reverse=True)
    logger.info(
        "Hybrid search for repo %d (query='%s'): %d dense hits, %d BM25 hits → %d fused chunks (threshold=%.2f)",
        repository_id,
        query[:50],
        len(raw_dense_results),
        len(bm25_results),
        len(fused_chunks[:limit]),
        threshold,
    )
    return fused_chunks[:limit]


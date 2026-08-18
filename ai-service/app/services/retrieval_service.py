"""
Retrieval service for RAG.

Given a repository ID and a natural language question:
1. Embeds the question using the same embedding model (all-MiniLM-L6-v2) used during indexing.
2. Queries Qdrant for the most similar chunks scoped to this repository_id.
3. Filters out any chunks with similarity scores below RAG_MIN_SCORE.
4. Returns the structured chunk list with metadata and payload details.
"""

import logging
from typing import Optional

from app.config import settings
from app.services.embedding_service import embed_texts
from app.services.vector_service import search_points

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(
    repository_id: int,
    query: str,
    top_k: Optional[int] = None,
    min_score: Optional[float] = None,
) -> list[dict]:
    """Retrieve top-K relevant code chunks for a query from Qdrant.

    Args:
        repository_id: MySQL repository ID to filter points.
        query: Natural language question from the user.
        top_k: Max chunks to retrieve (defaults to settings.rag_top_k).
        min_score: Minimum similarity score threshold (defaults to settings.rag_min_score).

    Returns:
        A list of dicts with keys:
            - id: Qdrant UUID
            - score: Cosine similarity score (float)
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

    # 1. Embed query in the same vector space
    query_vectors = embed_texts([query])
    query_vector = query_vectors[0]

    # 2. Search Qdrant filtered by repository_id
    raw_results = search_points(
        collection_name=settings.qdrant_collection_name,
        query_vector=query_vector,
        limit=limit,
        repository_id=repository_id,
    )

    # 3. Filter by similarity threshold
    filtered_chunks = []
    for hit in raw_results:
        score = hit.get("score", 0.0)
        if score < threshold:
            logger.debug(
                "Chunk %s score %.4f below threshold %.4f — filtered out",
                hit.get("id"),
                score,
                threshold,
            )
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

    logger.info(
        "Retrieved %d/%d chunks for repo %d (min_score=%.2f, query='%s')",
        len(filtered_chunks),
        len(raw_results),
        repository_id,
        threshold,
        query[:50],
    )
    return filtered_chunks

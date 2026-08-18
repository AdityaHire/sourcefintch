"""
Vector service — wrapper around Qdrant vector database.

DESIGN PRINCIPLES:
1. Single Collection Architecture: All repositories share a single Qdrant
   collection (`sourcefinch_chunks`), indexed and isolated via `repository_id`
   payload metadata filters.
2. Cosine Distance: Matches sentence-transformers' normalized output vectors.
3. Payload Schema:
   - repository_id: int (filter key)
   - file_id: int
   - code_chunk_id: int (MySQL row ID for cross-reference)
   - file_path: str
   - language: str
   - start_line: int
   - end_line: int
   - content: str (full chunk text, stored ONLY in Qdrant)
4. Idempotency & Clean Rollback: Filter-based deletions by repository_id.
"""

import logging
from typing import Any, Optional

from qdrant_client import QdrantClient, models
from qdrant_client.http.exceptions import UnexpectedResponse

from app.config import settings

logger = logging.getLogger(__name__)

# Global singleton client
_client_instance: Optional[QdrantClient] = None


def get_qdrant_client() -> QdrantClient:
    """Return or initialize the singleton QdrantClient."""
    global _client_instance
    if _client_instance is None:
        logger.info("Connecting to Qdrant at %s ...", settings.qdrant_url)
        _client_instance = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=15.0,
            check_compatibility=False,
        )
    return _client_instance


def ensure_collection(collection_name: str, vector_size: Optional[int] = None) -> None:
    """Create the Qdrant collection if it does not already exist, or verify dimension match.

    Args:
        collection_name: Name of the collection (e.g., 'sourcefinch_chunks').
        vector_size: Dimensionality of vectors (e.g., 384 for all-MiniLM-L6-v2).
                     If None, it is dynamically retrieved from embedding_service.
    """
    if vector_size is None:
        from app.services.embedding_service import get_vector_dimension

        vector_size = get_vector_dimension()

    client = get_qdrant_client()
    exists = client.collection_exists(collection_name)
    if not exists:
        logger.info(
            "Collection '%s' does not exist. Creating with vector size %d and Cosine distance...",
            collection_name,
            vector_size,
        )
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size,
                distance=models.Distance.COSINE,
            ),
        )
        logger.info("Collection '%s' created successfully.", collection_name)
    else:
        # Collection already exists: verify vector dimension match
        collection_info = client.get_collection(collection_name=collection_name)
        existing_size = None
        vectors_config = collection_info.config.params.vectors

        if hasattr(vectors_config, "size"):
            existing_size = vectors_config.size
        elif isinstance(vectors_config, dict):
            first_val = next(iter(vectors_config.values()), None)
            if hasattr(first_val, "size"):
                existing_size = first_val.size
            elif isinstance(first_val, dict):
                existing_size = first_val.get("size")

        if existing_size is not None and existing_size != vector_size:
            error_msg = (
                f"Vector dimension mismatch for Qdrant collection '{collection_name}': "
                f"existing collection is configured for {existing_size} dimensions, "
                f"but current embedding model produces {vector_size} dimensions. "
                f"To resolve, delete the existing collection or revert EMBEDDING_MODEL / EMBEDDING_PROVIDER."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)


def delete_by_repository_id(collection_name: str, repository_id: int) -> None:
    """Delete all points associated with a repository_id from Qdrant.

    Used before re-indexing to prevent duplicate points and on compensating
    cleanup if indexing fails.
    """
    client = get_qdrant_client()
    if not client.collection_exists(collection_name):
        return

    logger.info(
        "Deleting Qdrant points for repository_id=%d in collection '%s' ...",
        repository_id,
        collection_name,
    )
    client.delete(
        collection_name=collection_name,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="repository_id",
                        match=models.MatchValue(value=repository_id),
                    )
                ]
            )
        ),
        wait=True,
    )
    logger.info("Deleted Qdrant points for repository_id=%d.", repository_id)


def upsert_points(collection_name: str, points: list[models.PointStruct]) -> None:
    """Upsert a list of PointStruct objects into Qdrant.

    Args:
        collection_name: Target collection.
        points: List of PointStruct(id=..., vector=..., payload=...).
    """
    if not points:
        return

    client = get_qdrant_client()
    logger.info(
        "Upserting %d points into Qdrant collection '%s' ...",
        len(points),
        collection_name,
    )
    client.upsert(
        collection_name=collection_name,
        points=points,
        wait=True,
    )
    logger.info("Successfully upserted %d points.", len(points))


def count_points(collection_name: str, repository_id: Optional[int] = None) -> int:
    """Count the number of points in the collection, optionally filtered by repository_id."""
    client = get_qdrant_client()
    if not client.collection_exists(collection_name):
        return 0

    filter_condition = None
    if repository_id is not None:
        filter_condition = models.Filter(
            must=[
                models.FieldCondition(
                    key="repository_id",
                    match=models.MatchValue(value=repository_id),
                )
            ]
        )

    result = client.count(
        collection_name=collection_name,
        count_filter=filter_condition,
        exact=True,
    )
    return result.count


def search_points(
    collection_name: str,
    query_vector: list[float],
    limit: int = 5,
    repository_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Search for the nearest vector neighbors in Qdrant.

    Used for sanity checking vector retrieval in Phase 5.
    """
    client = get_qdrant_client()
    if not client.collection_exists(collection_name):
        return []

    filter_condition = None
    if repository_id is not None:
        filter_condition = models.Filter(
            must=[
                models.FieldCondition(
                    key="repository_id",
                    match=models.MatchValue(value=repository_id),
                )
            ]
        )

    # Use client.query_points (or client.search)
    try:
        response = client.query_points(
            collection_name=collection_name,
            query=query_vector,
            query_filter=filter_condition,
            limit=limit,
            with_payload=True,
        )
        points = response.points
    except Exception:
        # Fallback to search if older client
        points = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=filter_condition,
            limit=limit,
            with_payload=True,
        )

    return [
        {
            "id": point.id,
            "score": point.score,
            "payload": point.payload,
        }
        for point in points
    ]

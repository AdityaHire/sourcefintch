"""
Code parser orchestration service — coordinates the full parse and indexing pipeline:

1. Fetch the file list from Node's API (MySQL is the source of truth for
   which files to parse — Python never re-walks or re-filters the clone).
2. Clone the repository into a Python-side temp directory.
3. Read each file's content and run it through the chunking service.
4. Update repository status to "embedding" via Node's PATCH /api/repositories/:id/status.
5. Dual Idempotency Cleanup:
   - Delete existing Qdrant vectors for this repository_id.
   - Delete existing MySQL code_chunks rows for this repository_id.
6. Generate embeddings (batched) via sentence-transformers.
7. Bulk-insert chunk metadata into MySQL via Node's POST /api/chunks/batch.
8. Upsert vectors and full content payload into Qdrant.
   (Compensating rollback: If Qdrant upsert fails, delete the inserted MySQL rows).
9. Update repository status to "completed" (or "failed" on error).
10. Clean up the temp directory in a finally block.

ENCODING SAFETY
===============
Files are read as UTF-8 with ``errors="replace"``.

SECURITY
========
Logs contain metadata only (file path, language, line range, parser used,
content length) — never full chunk content, since source files can contain
hardcoded secrets.
"""

import logging
import os
import shutil
import stat
import subprocess
import tempfile
import uuid
from typing import Any

import httpx
from fastapi import HTTPException
from qdrant_client import models

from app.config import settings
from app.services.chunking_service import chunk_file
from app.services.embedding_service import embed_texts, get_vector_dimension, get_active_collection_name
from app.services.node_internal_client import (
    async_internal_delete,
    async_internal_patch,
    async_internal_post,
    async_internal_get,
)
from app.services.vector_service import (
    delete_by_repository_id,
    ensure_collection,
    upsert_points,
)

logger = logging.getLogger(__name__)


def _remove_readonly(func, path, excinfo):
    """Clear read-only bit (common on Windows git files) and retry removal."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def _cleanup_dir(path: str) -> None:
    """Safely remove a directory even with read-only files on Windows."""
    if os.path.exists(path):
        shutil.rmtree(path, onerror=_remove_readonly)


async def fetch_file_list(repository_id: int) -> list[dict]:
    """Fetch the file list from Node's GET /api/repositories/:id/files.

    Returns:
        A list of file dicts with keys: id, file_path, language, file_size.

    Raises:
        HTTPException(502) if Node's API is unreachable or returns non-2xx.
    """
    url = f"{settings.node_api_url}/api/repositories/{repository_id}/files"

    try:
        response = await async_internal_get(url)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.error("Failed to reach Node API at %s: %s", url, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch file list from Node API: {exc}",
        )

    if response.status_code != 200:
        logger.error(
            "Node API returned %s for %s: %s",
            response.status_code,
            url,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Node API returned status {response.status_code}",
        )

    return response.json()


async def update_repository_status(repository_id: int, status: str) -> None:
    """Update the repository status in Node's backend.

    Raises:
        HTTPException(502) if Node's API is unreachable or returns non-2xx.
    """
    url = f"{settings.node_api_url}/api/repositories/{repository_id}/status"

    try:
        response = await async_internal_patch(url, json={"status": status})
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.error("Failed to reach Node API to update status for repo %d: %s", repository_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to update repository status on Node API: {exc}",
        )

    if response.status_code != 200:
        logger.error(
            "Node API returned %s updating status for repo %d: %s",
            response.status_code,
            repository_id,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Node API returned status {response.status_code} while updating repository status",
        )


async def delete_repository_chunks(repository_id: int) -> None:
    """Delete all MySQL code_chunks for a repository via Node's DELETE /api/repositories/:id/chunks."""
    url = f"{settings.node_api_url}/api/repositories/{repository_id}/chunks"

    try:
        response = await async_internal_delete(url)
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.error("Failed to reach Node API to delete chunks for repo %d: %s", repository_id, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to delete code chunks on Node API: {exc}",
        )

    if response.status_code != 200:
        logger.error(
            "Node API returned %s deleting chunks for repo %d: %s",
            response.status_code,
            repository_id,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Node API returned status {response.status_code} while deleting code chunks",
        )


async def insert_chunks_batch(chunks: list[dict]) -> list[dict]:
    """Bulk-insert chunks into MySQL via Node's POST /api/chunks/batch.

    Guarantees returned list matches the input array order and includes
    the assigned MySQL 'id' and 'qdrant_point_id'.
    """
    if not chunks:
        return []

    url = f"{settings.node_api_url}/api/chunks/batch"

    try:
        response = await async_internal_post(url, json={"chunks": chunks})
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.error("Failed to reach Node API to batch-insert chunks: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to insert code chunks on Node API: {exc}",
        )

    if response.status_code != 201:
        logger.error("Node API returned %s inserting chunks batch: %s", response.status_code, response.text[:200])
        raise HTTPException(
            status_code=502,
            detail=f"Node API returned status {response.status_code} while batch inserting chunks",
        )

    data = response.json()
    return data.get("chunks", [])


def clone_repository(github_url: str, branch: str, clone_dir: str) -> None:
    """Clone a repository into the given directory."""
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", "--branch", branch, github_url, clone_dir],
            capture_output=True,
            text=True,
            timeout=settings.clone_timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        logger.error(
            "Git clone timed out after %ds for %s",
            settings.clone_timeout_seconds,
            github_url,
        )
        raise HTTPException(
            status_code=504,
            detail=f"Git clone timed out after {settings.clone_timeout_seconds}s",
        )

    if result.returncode != 0:
        error_msg = result.stderr.strip() or result.stdout.strip() or "Unknown git error"
        logger.error("Git clone failed for %s: %s", github_url, error_msg)
        raise HTTPException(
            status_code=502,
            detail=f"Git clone failed: {error_msg}",
        )


async def parse_repository(
    repository_id: int, github_url: str, branch: str
) -> dict:
    """Orchestrate the full parse and indexing pipeline for a repository.

    Returns a dict with: repository_id, files_parsed, files_skipped,
    total_chunks, total_chunks_embedded, chunks.
    """
    # 1. Fetch the file list from Node
    file_list = await fetch_file_list(repository_id)
    file_path_to_id = {f["file_path"]: f["id"] for f in file_list}

    logger.info(
        "Fetched %d files for repository %d from Node API",
        len(file_list),
        repository_id,
    )

    # 2. Create a temp directory scoped to this repository
    clone_dir = tempfile.mkdtemp(prefix=f"sourcefinch-ai-{repository_id}-")

    try:
        # 3. Clone the repo
        clone_repository(github_url, branch, clone_dir)
        logger.info(
            "Cloned %s (branch: %s) into %s", github_url, branch, clone_dir
        )

        # 4. Read and chunk each file
        all_chunks = []
        files_parsed = 0
        files_skipped = 0

        for file_info in file_list:
            file_path = file_info.get("file_path", "")
            language = file_info.get("language") or "unknown"
            full_path = os.path.join(clone_dir, file_path)

            # Read file content with encoding safety
            try:
                with open(full_path, encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except (FileNotFoundError, OSError, PermissionError) as exc:
                logger.warning(
                    "Skipping unreadable file %s: %s", file_path, exc
                )
                files_skipped += 1
                continue

            # Chunk the file
            chunks = chunk_file(file_path, language, content)
            all_chunks.extend(chunks)
            files_parsed += 1

            for chunk in chunks:
                logger.debug(
                    "Chunk: %s [%s] lines %d-%d (%s, %d chars)",
                    chunk.file_path,
                    chunk.language,
                    chunk.start_line,
                    chunk.end_line,
                    chunk.parser_used,
                    len(chunk.content),
                )

        logger.info(
            "Parsed repository %d: %d files parsed, %d skipped, %d chunks",
            repository_id,
            files_parsed,
            files_skipped,
            len(all_chunks),
        )

        # ── 5. Advance status to 'embedding' ──────────────────────────
        await update_repository_status(repository_id, "embedding")

        # ── 6. Ensure Qdrant collection & Dual Idempotency Cleanup ───
        collection_name = get_active_collection_name()
        ensure_collection(collection_name, get_vector_dimension())
        delete_by_repository_id(collection_name, repository_id)
        await delete_repository_chunks(repository_id)

        # ── 7. Handle 0-chunk edge case gracefully ────────────────────
        if len(all_chunks) == 0:
            await update_repository_status(repository_id, "completed")
            return {
                "repository_id": repository_id,
                "files_parsed": files_parsed,
                "files_skipped": files_skipped,
                "total_chunks": 0,
                "total_chunks_embedded": 0,
                "chunks": [],
            }

        # ── 8. Batch embedding generation ────────────────────────────
        chunk_texts = [c.content for c in all_chunks]
        vectors = embed_texts(chunk_texts, batch_size=32)

        # ── 9. Generate UUID point IDs and bulk insert into MySQL ────
        qdrant_point_ids = [str(uuid.uuid4()) for _ in all_chunks]

        batch_payload = [
            {
                "file_id": file_path_to_id.get(chunk.file_path),
                "qdrant_point_id": qdrant_point_ids[i],
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "language": chunk.language,
            }
            for i, chunk in enumerate(all_chunks)
        ]

        # Insert chunks batch into MySQL
        mysql_chunks = await insert_chunks_batch(batch_payload)

        # Map MySQL IDs by matching index / qdrant_point_id
        qdrant_points = []
        for i, chunk in enumerate(all_chunks):
            mysql_chunk_id = (
                mysql_chunks[i]["id"] if i < len(mysql_chunks) else None
            )
            qdrant_points.append(
                models.PointStruct(
                    id=qdrant_point_ids[i],
                    vector=vectors[i],
                    payload={
                        "repository_id": repository_id,
                        "file_id": file_path_to_id.get(chunk.file_path),
                        "code_chunk_id": mysql_chunk_id,
                        "file_path": chunk.file_path,
                        "language": chunk.language,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "content": chunk.content,
                    },
                )
            )

        # ── 10. Upsert points into Qdrant with Compensating Rollback ──
        try:
            upsert_points(collection_name, qdrant_points)
        except Exception as qdrant_exc:
            logger.error(
                "Qdrant upsert failed for repository %d: %s. Performing compensating MySQL cleanup...",
                repository_id,
                qdrant_exc,
            )
            try:
                await delete_repository_chunks(repository_id)
            except Exception as rollback_err:
                logger.error("Compensating rollback failed: %s", rollback_err)

            await update_repository_status(repository_id, "failed")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upsert vector embeddings into Qdrant: {qdrant_exc}",
            )

        # ── 11. Mark repository status as 'completed' ─────────────────
        await update_repository_status(repository_id, "completed")

        return {
            "repository_id": repository_id,
            "files_parsed": files_parsed,
            "files_skipped": files_skipped,
            "total_chunks": len(all_chunks),
            "total_chunks_embedded": len(all_chunks),
            "chunks": all_chunks,
        }

    except HTTPException:
        # Re-raise explicit HTTPExceptions (e.g. 502, 504) after setting failed status
        try:
            await update_repository_status(repository_id, "failed")
        except Exception:
            pass
        raise
    except Exception as exc:
        logger.exception("Unexpected error parsing repository %d: %s", repository_id, exc)
        try:
            await update_repository_status(repository_id, "failed")
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse and index repository: {exc}",
        )
    finally:
        _cleanup_dir(clone_dir)
        logger.info("Cleaned up temp directory: %s", clone_dir)

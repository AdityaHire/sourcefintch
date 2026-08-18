"""
Indexing router — POST /ai/parse endpoint for code parsing + chunking.

This endpoint is called by Node's ingestionService after a repository
reaches "completed" status.  It clones the repo independently, reads
file content for the exact files Node stored in MySQL, and splits them
into semantic chunks using tree-sitter or the generic fallback parser.

STATUS CODES
============
200 — Success (even if some files were skipped — files_skipped communicates that)
422 — Request validation failure (missing/invalid fields, via Pydantic)
502 — Node's file-list endpoint unreachable/error, or git clone non-timeout failure
504 — Git clone timed out
500 — Any other unhandled/unexpected failure (caught by global handler)
"""

import logging
from dataclasses import asdict

from fastapi import APIRouter

from app.schemas.indexing import ParseRequest
from app.services.code_parser import parse_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["indexing"])


@router.post("/parse")
async def parse_code(request: ParseRequest):
    """Parse and chunk a repository's source files.

    Accepts a repository_id, github_url, and branch.  Returns a summary
    with sample chunks.  A response with files_skipped > 0 is still a
    normal 200 — files_skipped already communicates partial results.
    """
    logger.info(
        "Parse request received: repository_id=%d, url=%s, branch=%s",
        request.repository_id,
        request.github_url,
        request.branch,
    )

    result = await parse_repository(
        repository_id=request.repository_id,
        github_url=request.github_url,
        branch=request.branch,
    )

    # Build sample_chunks from the first 5 chunks (as dicts for JSON)
    all_chunks = result.pop("chunks", [])
    sample_chunks = [asdict(chunk) for chunk in all_chunks[:5]]

    return {
        "repository_id": result["repository_id"],
        "files_parsed": result["files_parsed"],
        "files_skipped": result["files_skipped"],
        "total_chunks": result["total_chunks"],
        "total_chunks_embedded": result.get("total_chunks_embedded", result["total_chunks"]),
        "sample_chunks": sample_chunks,
    }

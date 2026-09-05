"""
Report router — POST /ai/repository/report for full repository intelligence reports.

Analyzes codebase structure, languages, package manifests, and dependencies,
and synthesizes deep architectural intelligence via LLM.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.report_service import generate_repository_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["report"])


class ReportRequest(BaseModel):
    repository_id: int = Field(..., gt=0, description="The ID of the indexed repository to analyze")
    force_refresh: Optional[bool] = Field(False, description="Whether to bypass caches and force a fresh analysis")


@router.post("/repository/report")
async def get_repository_report_endpoint(request: ReportRequest):
    """Generate a comprehensive repository intelligence report."""
    logger.info("Intelligence report requested for repository_id=%d", request.repository_id)
    try:
        report = await generate_repository_report(request.repository_id)
        return report
    except Exception as exc:
        logger.error("Failed to generate repository report for %d: %s", request.repository_id, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate repository intelligence report: {str(exc)}",
        )

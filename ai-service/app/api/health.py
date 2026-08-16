"""
Health-check router for the AI service.

FastAPI's APIRouter is like Express's Router() — you define endpoints on it,
then include it in the main app.  This keeps the main.py file clean as you
add more routers (e.g., /embed, /query, /parse).
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Return service status — used by the frontend dashboard and monitoring."""
    return {
        "status": "ok",
        "service": "sourcefinch-ai",
    }

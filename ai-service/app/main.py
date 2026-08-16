"""
FastAPI application entry point.

Similar to Express's app.js — creates the app, adds middleware, and
includes all routers.  FastAPI has some nice extras built in:
  - Auto-generated API docs at /docs (Swagger UI) and /redoc
  - Request/response validation from Python type hints
  - Async support by default
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.health import router as health_router

app = FastAPI(
    title="Sourcefinch AI Service",
    description="AI-powered code analysis — embeddings, parsing, and RAG queries",
    version="0.1.0",
)

# ── CORS ────────────────────────────────────────────
# Allow the frontend (and Node backend) to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────
app.include_router(health_router)

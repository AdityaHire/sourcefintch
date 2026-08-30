"""
FastAPI application entry point.

Similar to Express's app.js — creates the app, adds middleware, and
includes all routers.  FastAPI has some nice extras built in:
  - Auto-generated API docs at /docs (Swagger UI) and /redoc
  - Request/response validation from Python type hints
  - Async support by default

GLOBAL ERROR HANDLERS
=====================
Every error response matches Node's exact shape:
    { "status": "error", "statusCode": <num>, "message": "<text>" }

Three handlers cover all cases:
  - HTTPException       → uses exc.status_code (e.g. 502, 504)
  - RequestValidationError → 422 with human-readable field errors
  - Exception (catch-all) → 500 internal server error
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.health import router as health_router
from app.api.indexing import router as indexing_router
from app.api.chat import router as chat_router

# Configure logging for the whole app
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler."""
    logger = logging.getLogger(__name__)
    try:
        from app.services.vector_service import ensure_collection
        from app.services.embedding_service import get_vector_dimension, get_active_collection_name
        ensure_collection(get_active_collection_name(), get_vector_dimension())
        logger.info("Startup vector dimension check passed for collection '%s'.", get_active_collection_name())
    except ValueError as val_err:
        logger.error("Vector dimension mismatch on startup: %s", val_err)
        raise
    except Exception as exc:
        logger.warning("Qdrant connection or check on startup: %s", exc)
    yield


app = FastAPI(
    title="Sourcefinch AI Service",
    description="AI-powered code analysis — embeddings, parsing, and RAG queries",
    version="0.1.0",
    lifespan=lifespan,
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


# ── Global exception handlers ──────────────────────
# These ensure EVERY error response matches Node's shape:
# { "status": "error", "statusCode": <num>, "message": "<text>" }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTPException (raised explicitly in our code).

    Uses exc.status_code for both the HTTP response code and the
    statusCode field in the JSON body.  The 'detail' field from
    HTTPException becomes 'message'.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "statusCode": exc.status_code,
            "message": str(exc.detail),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors (422).

    Builds a human-readable message from the validation errors so the
    caller doesn't need to parse FastAPI's default error array.
    """
    errors = exc.errors()
    messages = []
    for err in errors:
        loc_parts = [
            str(loc)
            for loc in err.get("loc", [])
            if loc not in ("body", "query", "path", "header", "__root__")
        ]
        field = ".".join(loc_parts) if loc_parts else "body"
        msg = err.get("msg", "Invalid value")
        messages.append(f"{field}: {msg}")

    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "statusCode": 422,
            "message": "; ".join(messages),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected errors (500).

    Logs the full traceback server-side but returns a generic message
    to the caller — never leak internal details.
    """
    logger = logging.getLogger(__name__)
    logger.exception("Unhandled exception on %s %s", request.method, request.url)

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "statusCode": 500,
            "message": "Internal server error",
        },
    )


# ── Routers ─────────────────────────────────────────
app.include_router(health_router)
app.include_router(indexing_router)
app.include_router(chat_router)


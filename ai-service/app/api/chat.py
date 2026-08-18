"""
Chat / RAG query endpoint.

Accepts natural language questions about an indexed repository, executes
vector retrieval against Qdrant, and generates grounded, citation-backed
answers via the configured LLM provider.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.rag_service import answer_question

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["chat"])


class ChatRequest(BaseModel):
    """Request payload for the POST /ai/chat endpoint."""

    repository_id: int = Field(..., description="MySQL repository ID", example=1)
    message: str = Field(..., min_length=1, description="User question or prompt", example="What does this repository do?")


class SourceCitation(BaseModel):
    """Traceable citation pointing to the exact source chunk used in the answer."""

    file_path: str
    start_line: int
    end_line: int
    code_chunk_id: Any = None
    score: float
    content: Optional[str] = None


class ChatResponse(BaseModel):
    """Response payload returned by POST /ai/chat."""

    answer: str
    sources: list[SourceCitation]


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> dict:
    """Handle a user question against an indexed repository.

    Validates input, checks repository status, retrieves relevant context from Qdrant,
    and returns a grounded answer with traceable citations.
    """
    cleaned_message = request.message.strip() if request.message else ""
    if not cleaned_message:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty or whitespace",
        )

    logger.info("Received chat question for repository %d: '%s'", request.repository_id, cleaned_message[:60])
    result = await answer_question(request.repository_id, cleaned_message)
    return result

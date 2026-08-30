"""
Pydantic schemas for the chat endpoint.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request payload for POST /ai/chat."""

    repository_id: int = Field(..., description="MySQL repository ID", example=1)
    message: str = Field(..., min_length=1, description="User question or prompt", example="What does this repository do?")
    conversation_id: Optional[int] = Field(None, description="MySQL conversation ID for multi-turn context", example=1)


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
    sources: list[Any]
    persistence_warning: Optional[bool] = None

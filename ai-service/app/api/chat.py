"""
Chat / RAG query endpoint.

Accepts natural language questions about an indexed repository, executes
vector retrieval against Qdrant, and generates grounded, citation-backed
answers via the configured LLM provider.
"""

import json
import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.config import settings
from app.schemas.chat import ChatRequest, ChatResponse, SourceCitation
from app.services.message_router import route_message, route_message_stream
from app.services.node_internal_client import async_internal_get

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> dict:
    """Handle a user question against an indexed repository.

    Validates input, checks repository status, retrieves relevant context from Qdrant,
    and returns a grounded answer with traceable citations.
    """
    cleaned_message = request.message.strip() if request.message else ""
    logger.info(
        "Received chat question for repository %d (conversation_id=%s): '%s'",
        request.repository_id,
        request.conversation_id,
        cleaned_message[:60],
    )

    conversation_history = None
    if request.conversation_id:
        try:
            conversation_history = await _fetch_conversation_history(
                request.conversation_id
            )
        except Exception as exc:
            logger.warning(
                "Failed to fetch conversation history for %s: %s",
                request.conversation_id,
                exc,
            )

    result = await route_message(
        request.repository_id,
        request.message,
        conversation_history=conversation_history,
    )
    return result


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Handle a user question with Server-Sent Events (SSE) streaming."""
    cleaned_message = request.message.strip() if request.message else ""
    logger.info(
        "Received streaming chat question for repository %d (conversation_id=%s): '%s'",
        request.repository_id,
        request.conversation_id,
        cleaned_message[:60],
    )

    conversation_history = None
    if request.conversation_id:
        try:
            conversation_history = await _fetch_conversation_history(
                request.conversation_id
            )
        except Exception as exc:
            logger.warning(
                "Failed to fetch conversation history for %s: %s",
                request.conversation_id,
                exc,
            )

    async def event_generator():
        try:
            async for event in route_message_stream(
                request.repository_id,
                request.message,
                conversation_history=conversation_history,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except HTTPException as exc:
            err_data = {"type": "error", "content": exc.detail}
            yield f"data: {json.dumps(err_data)}\n\n"
        except Exception as exc:
            logger.error("SSE stream error: %s", exc)
            err_data = {"type": "error", "content": str(exc)}
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _fetch_conversation_history(conversation_id: int) -> Optional[list]:
    """Fetch the last few messages for a conversation from the Node backend.

    Returns a list of message dicts with at least ``role`` and ``content``
    keys, ordered oldest-first.  Returns None on failure.
    """
    url = f"{settings.node_api_url}/api/conversations/{conversation_id}"

    try:
        response = await async_internal_get(url)
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as exc:
        logger.warning("Failed to reach Node backend for conversation history: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning(
            "Node API returned %s fetching conversation %s", response.status_code, conversation_id
        )
        return None

    data = response.json()
    messages = data.get("messages", [])
    if not messages:
        return []

    # Return last 6 messages (up to 3 turns) as role/content pairs
    recent = messages[-6:]
    return [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in recent]

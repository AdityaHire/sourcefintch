"""
Message Router — classifies incoming chat messages and dispatches to the correct handler.

This sits in front of the RAG pipeline so that ANY message type is handled
deliberately, not just code questions that happen to retrieve evidence.

Categories (produced by classify_message):
  - conversational : greetings, thanks, farewells, "who are you" / "what can you do"
  - code_query     : questions about the indexed repository (existing RAG pipeline)
  - off_topic      : general-knowledge / unrelated questions (capital of France, poem, math)
  - ambiguous      : vague / underspecified messages lacking repo context ("explain this")
  - meta_command   : UI-handled actions (switch repo, new chat, show code)

Empty / malformed input is intercepted by a cheap rule-based check BEFORE any
LLM call, so it is never forwarded to retrieval or generation.
"""

import logging
from enum import Enum
from typing import AsyncGenerator, Optional

import httpx
from fastapi import HTTPException

from app.config import settings
from app.services.llm_service import get_llm_provider
from app.services.rag_service import answer_question, get_repository_info, stream_question

logger = logging.getLogger(__name__)


class MessageCategory(str, Enum):
    """Classification labels returned by classify_message()."""

    CONVERSATIONAL = "conversational"
    CODE_QUERY = "code_query"
    OFF_TOPIC = "off_topic"
    AMBIGUOUS = "ambiguous"
    META_COMMAND = "meta_command"


# ── System prompts per category ──────────────────────────────────────────────

# 1. CONVERSATIONAL — assistant identity, no retrieval.
ASSISTANT_IDENTITY_PROMPT = """You are the conversational assistant for Sourcefinch, an AI-powered codebase intelligence tool.
Sourcefinch connects a GitHub repository, indexes its source code, and answers natural-language questions about that code with file and line citations.
You handle small talk, gratitude, and questions about what Sourcefinch is or what it can do.

Rules:
- Be friendly, concise, and on-brand (1-3 sentences).
- If the user asks something about the codebase, encourage them to ask a specific, concrete question (e.g. "How is authentication implemented?").
- Never invent details about a repository you have not been given.
- Do not call tools or retrieve code — this is a chat-only turn."""

# 3. OFF_TOPIC — handled with a static redirect (never forwarded to the LLM or retrieval).
OFF_TOPIC_REDIRECT = (
    "I'm focused on helping you understand THIS indexed codebase, so I don't answer general-knowledge "
    "questions. Ask me about the repository instead — for example: 'What does the authentication flow do?', "
    "'Where is the database connection configured?', or 'How are background jobs scheduled?'."
)

# 4. AMBIGUOUS — handled with a static clarifying question (no retrieval).
AMBIGUOUS_CLARIFY = (
    "Your message is a bit vague for me to answer confidently without more context. "
    "Could you clarify what part of {repo} you'd like me to explain? For example: "
    "'How does the main entry point work in {repo}?' or 'Where is error handling implemented in {repo}?'."
)

# ── Classification prompt (compact Groq call) ─────────────────────────────────

_CLASSIFY_MODEL = settings.llm_model
_CLASSIFY_URL = "https://api.groq.com/openai/v1/chat/completions"

_CLASSIFY_SYSTEM = """You are the message router for Sourcefinch, an AI codebase assistant.
Classify the user's latest message into EXACTLY ONE of these categories:
- conversational: greetings, thanks, farewells, or questions about Sourcefinch / the assistant itself (who are you, what can you do).
- code_query: a question about the indexed repository's code, architecture, files, or behavior.
- off_topic: general-knowledge or unrelated questions (e.g. capital of France, write a poem, what is 2+2).
- ambiguous: vague / underspecified messages lacking repository context (e.g. "explain this", "what does this mean", "help").
- meta_command: requests for UI actions the app already handles (e.g. switch repo, new chat, show me the code).

Respond with ONLY the lowercase category name. Nothing else."""


# ── Rule-based guards (instant, no LLM) ───────────────────────────────────────

def is_empty_or_malformed(message: object) -> bool:
    """Return True for blank, whitespace-only, or non-text input.

    Cheap check applied BEFORE any LLM call so malformed input is never
    forwarded to retrieval or generation.
    """
    if message is None:
        return True
    if not isinstance(message, str):
        return True
    stripped = message.strip()
    if not stripped:
        return True
    # Guard against absurdly large payloads that aren't a real chat message.
    if len(stripped) > 20000:
        return True
    return False


# ── Classifier ───────────────────────────────────────────────────────────────

async def classify_message(
    message: str,
    conversation_history: Optional[list] = None,
) -> MessageCategory:
    """Classify a (non-empty) message into a MessageCategory.

    Uses a compact Groq call when a key is configured, and falls back to a
    rule-based heuristic otherwise (or if the LLM call fails).
    """
    if settings.effective_groq_api_key:
        try:
            return await _classify_via_groq(message, conversation_history)
        except Exception as exc:  # noqa: BLE001 - any failure → safe fallback
            logger.warning(
                "Groq classification failed (%s); falling back to rule-based classifier.", exc
            )
    return _rule_based_classify(message)


async def _classify_via_groq(message: str, conversation_history: Optional[list]) -> MessageCategory:
    """Call Groq (llama-3.1-8b-instant) and parse a single category label."""
    history_block = ""
    if conversation_history:
        recent = conversation_history[-6:]
        history_block = "\n".join(
            f"{h.get('role', 'user')}: {h.get('content', '')}" for h in recent if isinstance(h, dict)
        )
    user_content = message
    if history_block:
        user_content = (
            f"Recent conversation:\n{history_block}\n\nLatest message to classify:\n{message}"
        )

    payload = {
        "model": _CLASSIFY_MODEL,
        "messages": [
            {"role": "system", "content": _CLASSIFY_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.0,
        "max_tokens": 10,
    }
    headers = {
        "Authorization": f"Bearer {settings.effective_groq_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        response = await client.post(_CLASSIFY_URL, headers=headers, json=payload)
        response.raise_for_status()
        label = response.json()["choices"][0]["message"]["content"].strip().lower()

    try:
        return MessageCategory(label)
    except ValueError:
        logger.warning("Unrecognized classification label '%s'; using rule-based fallback.", label)
        return _rule_based_classify(message)


def _rule_based_classify(message: str) -> MessageCategory:
    """Heuristic fallback classifier (used offline or when LLM is unavailable)."""
    text = message.strip().lower()

    # meta_command: explicit UI-action phrasing.
    if any(k in text for k in (
        "switch to", "switch repo", "change repo", "change repository", "select repo",
        "select repository", "new chat", "start a new chat", "start new chat", "reset chat",
        "clear chat", "show me the code", "show code", "open the file", "view the file",
        "browse files", "re-index", "reindex", "re-ingest", "re ingest",
    )):
        return MessageCategory.META_COMMAND

    # conversational: greetings / thanks / identity.
    if any(text.startswith(k) for k in ("hi", "hello", "hey", "thanks", "thank you", "yo", "sup")) or text in (
        "who are you", "what are you", "what can you do", "what do you do", "help me", "bye", "goodbye",
    ):
        return MessageCategory.CONVERSATIONAL

    # off_topic: clearly general-knowledge.
    if any(k in text for k in (
        "capital of", "write me a poem", "write a poem", "what is 2+2", "what's 2+2",
        "weather", "who won", "recipe for",
    )):
        return MessageCategory.OFF_TOPIC

    # ambiguous: very short, context-free vagueness.
    if text in ("explain this", "what does this mean", "what does that mean", "help", "explain", "clarify") or len(text.split()) <= 2:
        return MessageCategory.AMBIGUOUS

    # default: treat as a code question.
    return MessageCategory.CODE_QUERY


# ── Handlers (one per category, fully isolated) ───────────────────────────────

def handle_empty() -> dict:
    """Graceful validation response for empty / malformed input. No LLM, no retrieval."""
    return {
        "answer": (
            "It looks like your message was empty. Ask me a specific question about this repository — "
            "for example, 'What does the authentication module do?' or 'How are the API routes structured?'."
        ),
        "sources": [],
    }


async def handle_conversational(message: str) -> dict:
    """Direct Groq reply using the assistant-identity prompt. No retrieval."""
    llm = get_llm_provider()
    result = await llm.generate_answer(
        system_prompt=ASSISTANT_IDENTITY_PROMPT,
        user_prompt=message,
    )
    return {"answer": result.answer, "sources": []}


async def handle_code_query(repository_id: int, message: str, conversation_history: Optional[list] = None) -> dict:
    """Delegate to the existing RAG pipeline (retrieval + min-score + guardrail)."""
    return await answer_question(repository_id, message, conversation_history=conversation_history)


def handle_off_topic() -> dict:
    """Static polite redirect. Never retrieves or calls the LLM for general knowledge."""
    return {"answer": OFF_TOPIC_REDIRECT, "sources": []}


async def handle_ambiguous(repository_id: int, message: str) -> dict:
    """Ask a brief clarifying question anchored to the current repo. No retrieval."""
    repo_name = await _safe_repo_name(repository_id)
    return {"answer": AMBIGUOUS_CLARIFY.format(repo=repo_name), "sources": []}


def handle_meta_command(message: str) -> dict:
    """Map UI-action intents to guidance on the corresponding dashboard control."""
    text = message.strip().lower()

    if any(k in text for k in ("switch", "change repo", "change repository", "select repo", "select repository")):
        answer = (
            "To switch repositories, use the repository selector in the top-left of the dashboard — "
            "pick the repo you want to query and the conversation context updates to it."
        )
    elif any(k in text for k in ("new chat", "reset chat", "clear chat")):
        answer = (
            "To start a fresh conversation, click the 'New chat' button (top-right of the chat panel). "
            "This clears the current thread without deleting any indexed repositories."
        )
    elif any(k in text for k in ("show me the code", "show code", "open the file", "view the file", "browse files")):
        answer = (
            "You can browse the source files in the file explorer panel on the left. Open any file there "
            "to view its contents alongside the chat."
        )
    elif any(k in text for k in ("re-index", "reindex", "re-ingest", "re ingest", "sync")):
        answer = (
            "To re-index a repository, open its settings in the dashboard and choose 'Re-index'. "
            "This re-clones and re-embeds the repository."
        )
    else:
        answer = (
            "That looks like a UI action rather than a code question. Use the corresponding control in the "
            "Sourcefinch dashboard (repository selector, file explorer, or 'New chat' button) to do that."
        )

    return {"answer": answer, "sources": []}


async def _safe_repo_name(repository_id: int) -> str:
    """Best-effort repository display name; never raises."""
    try:
        info = await get_repository_info(repository_id)
        name = info.get("name") or info.get("full_name")
        if name:
            return name
    except HTTPException:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("Could not fetch repo name for %s: %s", repository_id, exc)
    return "this repository"


# ── Router (single entry point) ──────────────────────────────────────────────

async def route_message(
    repository_id: int,
    message: str,
    conversation_history: Optional[list] = None,
) -> dict:
    """Classify once, then dispatch to the isolated handler for that category.

    Empty / malformed input short-circuits before any classification or LLM call.
    """
    if is_empty_or_malformed(message):
        return handle_empty()

    category = await classify_message(message, conversation_history)
    logger.info("Routed message for repo %d → category=%s", repository_id, category.value)

    if category == MessageCategory.CONVERSATIONAL:
        return await handle_conversational(message)
    if category == MessageCategory.CODE_QUERY:
        return await handle_code_query(repository_id, message, conversation_history)
    if category == MessageCategory.OFF_TOPIC:
        return handle_off_topic()
    if category == MessageCategory.AMBIGUOUS:
        return await handle_ambiguous(repository_id, message)
    if category == MessageCategory.META_COMMAND:
        return handle_meta_command(message)

    # Safety fallback: anything unrecognized is treated as a code question.
    return await handle_code_query(repository_id, message)


async def route_message_stream(
    repository_id: int,
    message: str,
    conversation_history: Optional[list] = None,
) -> AsyncGenerator[dict, None]:
    """Classify incoming message and stream back tokens and citations."""
    if is_empty_or_malformed(message):
        yield {"type": "citations", "sources": []}
        yield {"type": "token", "content": handle_empty()["answer"]}
        yield {"type": "done"}
        return

    category = await classify_message(message, conversation_history)
    logger.info("Routed message stream for repo %d → category=%s", repository_id, category.value)

    if category == MessageCategory.CONVERSATIONAL:
        yield {"type": "citations", "sources": []}
        llm = get_llm_provider()
        try:
            async for token in llm.stream_answer(system_prompt=ASSISTANT_IDENTITY_PROMPT, user_prompt=message):
                yield {"type": "token", "content": token}
        except Exception as exc:
            logger.error("Error streaming conversational answer: %s", exc)
            yield {"type": "error", "content": str(exc)}
            return
        yield {"type": "done"}
        return

    if category == MessageCategory.CODE_QUERY:
        async for event in stream_question(repository_id, message, conversation_history):
            yield event
        return

    if category == MessageCategory.OFF_TOPIC:
        yield {"type": "citations", "sources": []}
        yield {"type": "token", "content": OFF_TOPIC_REDIRECT}
        yield {"type": "done"}
        return

    if category == MessageCategory.AMBIGUOUS:
        repo_name = await _safe_repo_name(repository_id)
        yield {"type": "citations", "sources": []}
        yield {"type": "token", "content": AMBIGUOUS_CLARIFY.format(repo=repo_name)}
        yield {"type": "done"}
        return

    if category == MessageCategory.META_COMMAND:
        yield {"type": "citations", "sources": []}
        yield {"type": "token", "content": handle_meta_command(message)["answer"]}
        yield {"type": "done"}
        return

    # Fallback to code query stream
    async for event in stream_question(repository_id, message, conversation_history):
        yield event


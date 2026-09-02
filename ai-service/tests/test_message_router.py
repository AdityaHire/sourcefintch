"""
Regression suite for the message router.

Covers every category with at least 2 messages each (10 routed cases) plus
empty/malformed input, asserting each message hits the correct handler and
produces the appropriate response shape (with/without references, redirect vs
direct reply, clarifying question, etc.).

Run with: pytest tests/test_message_router.py
"""

import asyncio
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm_service import LLMResult
from app.services.message_router import (
    AMBIGUOUS_CLARIFY,
    OFF_TOPIC_REDIRECT,
    MessageCategory,
    classify_message,
    handle_ambiguous,
    handle_code_query,
    handle_conversational,
    handle_empty,
    handle_meta_command,
    handle_off_topic,
    is_empty_or_malformed,
    route_message,
)

REPO_ID = 45


class TestEmptyAndMalformed(IsolatedAsyncioTestCase):
    """Category 5: empty / malformed input never reaches retrieval or the LLM."""

    def test_blank_and_whitespace_detected(self):
        for bad in ("", "   ", "\t\n", None, 123, ["not", "text"]):
            self.assertTrue(is_empty_or_malformed(bad), f"expected malformed: {bad!r}")

    async def test_empty_returns_graceful_validation_response(self):
        with patch("app.services.message_router.classify_message") as classify, \
             patch("app.services.message_router.answer_question") as answer:
            result = await route_message(REPO_ID, "   ")
            self.assertEqual(result["sources"], [])
            self.assertTrue(len(result["answer"]) > 0)
            classify.assert_not_called()
            answer.assert_not_called()


class TestRouterDispatch(IsolatedAsyncioTestCase):
    """Assert each classified category is routed to its dedicated handler.

    The classifier and candidate handlers are stubbed so we test ONLY the
    dispatch logic (which handler is selected), not the handlers themselves.
    """

    async def _assert_dispatch(self, category: MessageCategory, message: str):
        # Async handlers (awaited by the router) vs sync handlers (called directly).
        # Each handler gets its OWN mock instance so per-handler call assertions hold.
        stubs = {
            "handle_conversational": AsyncMock(return_value={"answer": "stub-conv", "sources": []}),
            "handle_code_query": AsyncMock(return_value={"answer": "stub-code", "sources": []}),
            "handle_ambiguous": AsyncMock(return_value={"answer": "stub-ambig", "sources": []}),
            "handle_off_topic": MagicMock(return_value={"answer": "stub-off", "sources": []}),
            "handle_meta_command": MagicMock(return_value={"answer": "stub-meta", "sources": []}),
        }

        with patch("app.services.message_router.classify_message", AsyncMock(return_value=category)), \
             patch("app.services.message_router.handle_conversational", stubs["handle_conversational"]), \
             patch("app.services.message_router.handle_code_query", stubs["handle_code_query"]), \
             patch("app.services.message_router.handle_off_topic", stubs["handle_off_topic"]), \
             patch("app.services.message_router.handle_ambiguous", stubs["handle_ambiguous"]), \
             patch("app.services.message_router.handle_meta_command", stubs["handle_meta_command"]):
            result = await route_message(REPO_ID, message)
            self.assertEqual(result["answer"], stubs[f"handle_{category.value}"].return_value["answer"])

            for name, stub in stubs.items():
                if name == f"handle_{category.value}":
                    stub.assert_called_once()
                else:
                    stub.assert_not_called()

    async def test_conversational_dispatch(self):
        await self._assert_dispatch(MessageCategory.CONVERSATIONAL, "hello there")

    async def test_code_query_dispatch(self):
        await self._assert_dispatch(MessageCategory.CODE_QUERY, "how is auth implemented?")

    async def test_off_topic_dispatch(self):
        await self._assert_dispatch(MessageCategory.OFF_TOPIC, "what is the capital of France?")

    async def test_ambiguous_dispatch(self):
        await self._assert_dispatch(MessageCategory.AMBIGUOUS, "explain this")

    async def test_meta_command_dispatch(self):
        await self._assert_dispatch(MessageCategory.META_COMMAND, "switch to the crm repo")


class TestConversationalHandler(IsolatedAsyncioTestCase):
    """Category 1: direct Groq reply, no retrieval, no sources."""

    async def test_greeting_returns_direct_reply(self):
        with patch("app.services.message_router.get_llm_provider") as get_llm:
            get_llm.return_value.generate_answer = AsyncMock(return_value=LLMResult(answer="Hello! I'm Sourcefinch's assistant."))
            result = await handle_conversational("hi, who are you?")
            self.assertEqual(result["sources"], [])
            self.assertIn("Sourcefinch", result["answer"])
            get_llm.return_value.generate_answer.assert_awaited_once()

    async def test_thanks_returns_direct_reply(self):
        with patch("app.services.message_router.get_llm_provider") as get_llm:
            get_llm.return_value.generate_answer = AsyncMock(return_value=LLMResult(answer="You're welcome!"))
            result = await handle_conversational("thanks for the help")
            self.assertEqual(result["sources"], [])
            self.assertTrue(result["answer"])


class TestOffTopicHandler(IsolatedAsyncioTestCase):
    """Category 3: static redirect, no LLM, no retrieval."""

    def test_poem_request_redirects(self):
        result = handle_off_topic()
        self.assertEqual(result["sources"], [])
        self.assertEqual(result["answer"], OFF_TOPIC_REDIRECT)
        self.assertIn("indexed codebase", result["answer"])

    def test_math_request_redirects(self):
        result = handle_off_topic()
        self.assertEqual(result["sources"], [])
        self.assertIn("repository", result["answer"])


class TestAmbiguousHandler(IsolatedAsyncioTestCase):
    """Category 4: clarifying question anchored to the current repo."""

    async def test_clarifying_question_references_repo(self):
        with patch("app.services.message_router._safe_repo_name", AsyncMock(return_value="demo-repo")):
            result = await handle_ambiguous(REPO_ID, "what does this mean?")
            self.assertEqual(result["sources"], [])
            self.assertIn("demo-repo", result["answer"])
            self.assertIn("clarify", result["answer"].lower())

    async def test_clarifying_question_without_repo_name(self):
        with patch("app.services.message_router._safe_repo_name", AsyncMock(return_value="this repository")):
            result = await handle_ambiguous(REPO_ID, "help")
            self.assertEqual(result["sources"], [])
            self.assertEqual(result["answer"], AMBIGUOUS_CLARIFY.format(repo="this repository"))


class TestMetaCommandHandler(IsolatedAsyncioTestCase):
    """Category 6: UI-action intents map to dashboard guidance, no sources."""

    def test_switch_repo_guidance(self):
        result = handle_meta_command("switch to the crm repo")
        self.assertEqual(result["sources"], [])
        self.assertIn("repository selector", result["answer"])

    def test_new_chat_guidance(self):
        result = handle_meta_command("start a new chat")
        self.assertEqual(result["sources"], [])
        self.assertIn("New chat", result["answer"])

    def test_show_code_guidance(self):
        result = handle_meta_command("show me the code")
        self.assertEqual(result["sources"], [])
        self.assertIn("file explorer", result["answer"])


class TestCodeQueryHandler(IsolatedAsyncioTestCase):
    """Category 2: delegates to the existing RAG pipeline."""

    async def test_code_query_delegates_to_rag(self):
        fake = {"answer": "from [auth.py:1-10] ...", "sources": [{"file_path": "auth.py"}]}
        with patch("app.services.message_router.answer_question", AsyncMock(return_value=fake)):
            result = await handle_code_query(REPO_ID, "how is authentication implemented?")
            self.assertEqual(result, fake)
            # RAG path may attach sources.
            self.assertIn("sources", result)


class TestRuleBasedClassifier(IsolatedAsyncioTestCase):
    """Fallback classifier used when no Groq key is configured."""

    def test_greeting_classified_conversational(self):
        self.assertEqual(asyncio.run(classify_message("hello!")), MessageCategory.CONVERSATIONAL)

    async def test_generic_knowledge_classified_off_topic(self):
        self.assertEqual(await classify_message("what is the capital of France?"), MessageCategory.OFF_TOPIC)

    async def test_vague_message_classified_ambiguous(self):
        self.assertEqual(await classify_message("explain this"), MessageCategory.AMBIGUOUS)

    async def test_switch_repo_classified_meta_command(self):
        self.assertEqual(await classify_message("switch to the crm repo"), MessageCategory.META_COMMAND)

    async def test_code_question_classified_code_query(self):
        self.assertEqual(
            await classify_message("where is the database connection configured?"),
            MessageCategory.CODE_QUERY,
        )

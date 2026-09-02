"""
Regression tests for multi-turn conversation handling and query rewriting.

Covers:
1. AI service query rewriting leaves self-contained questions unchanged.
2. AI service query rewriting resolves pronouns using recent history.
3. AI service query rewriting falls back to original question on Groq failure.
4. AI service query rewriting falls back when no Groq key is configured.
"""

from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm_service import LLMResult
from app.services.rag_service import rewrite_query


class TestQueryRewriting(IsolatedAsyncioTestCase):
    """Assert standalone questions pass through and pronouns are resolved."""

    async def test_self_contained_question_is_unchanged(self):
        question = "What does the authentication module do?"
        rewritten = await rewrite_query(question, None)
        self.assertEqual(rewritten, question)

    async def test_self_contained_question_with_empty_history(self):
        question = "How is routing implemented?"
        rewritten = await rewrite_query(question, [])
        self.assertEqual(rewritten, question)

    async def test_pronoun_resolved_with_history(self):
        question = "Where is it defined?"
        history = [
            {"role": "user", "content": "What is the main entry point?"},
            {"role": "assistant", "content": "The main entry point is src/index.js."},
        ]
        with patch("app.services.rag_service.settings") as mock_settings, \
             patch("app.services.rag_service.get_llm_provider") as get_llm:
            mock_settings.effective_groq_api_key = "fake-key"
            mock_settings.llm_timeout_seconds = 30
            provider = MagicMock()
            provider.generate_answer = AsyncMock(return_value=LLMResult(answer="Where is src/index.js defined?"))
            get_llm.return_value = provider
            rewritten = await rewrite_query(question, history)
        self.assertIn("src/index.js", rewritten)

    async def test_fallback_to_original_on_groq_failure(self):
        question = "Where is it defined?"
        history = [{"role": "user", "content": "What is the main entry point?"}]
        with patch("httpx.AsyncClient.post", AsyncMock(side_effect=Exception("network boom"))):
            rewritten = await rewrite_query(question, history)
        self.assertEqual(rewritten, question)

    async def test_no_rewrite_without_groq_key(self):
        question = "Where is it defined?"
        history = [{"role": "user", "content": "What is the main entry point?"}]
        with patch("app.services.rag_service.settings") as mock_settings:
            mock_settings.effective_groq_api_key = ""
            mock_settings.llm_timeout_seconds = 30
            rewritten = await rewrite_query(question, history)
        self.assertEqual(rewritten, question)

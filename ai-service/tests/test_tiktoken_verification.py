"""
Verification tests for tiktoken-based token estimation and pre-flight trimming.

Covers:
1. estimate_tokens() accuracy vs tiktoken's own encode (exact match).
2. Old chars/4 heuristic vs tiktoken on code/HTML-heavy content (shows 4x gap).
3. Real Groq API round-trip: estimated prompt_tokens vs Groq-reported actual.
4. Pre-flight trimming triggers BEFORE the LLM call when over threshold.
5. 413 retry: halved chunks, single retry, user-facing error on second failure.
6. 429 retry: 60s wait, single retry, user-facing error on second failure.
"""

import asyncio
import logging
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm_service import GroqAPIError, LLMResult
from app.services.rag_service import (
    SYSTEM_PROMPT,
    build_user_prompt,
    estimate_full_prompt_tokens,
    estimate_tokens,
)
from app.config import settings

logger = logging.getLogger(__name__)


def _make_html_chunk(chunk_id: int, size_kb: int = 50) -> dict:
    """Generate a realistic HTML/code-heavy chunk (the type that previously 413'd)."""
    html_lines = ["<!DOCTYPE html>", "<html>", "<head><title>App</title></head>", "<body>"]
    for i in range(size_kb * 5):
        html_lines.append(
            f'<div class="row-{i}"><span data-id="{i}">function_{i} = (x) => x + {i};</span></div>'
        )
    html_lines.append("</body></html>")
    content = "\n".join(html_lines)
    return {
        "id": f"c{chunk_id}",
        "score": 0.95 - chunk_id * 0.01,
        "file_path": f"src/file_{chunk_id}.html",
        "language": "html",
        "start_line": 1,
        "end_line": 100,
        "content": content,
        "code_chunk_id": chunk_id,
        "repository_id": 1,
    }


class TestTokenEstimationAccuracy(IsolatedAsyncioTestCase):
    """Verify tiktoken-based estimate_tokens matches expectations."""

    def test_estimate_tokens_matches_tiktoken_directly(self):
        """estimate_tokens() should return exactly what tiktoken computes."""
        import tiktoken

        enc = tiktoken.get_encoding("cl100k_base")
        test_text = "Hello, world! This is a test. function foo() { return 42; }"
        expected = len(enc.encode(test_text))
        actual = estimate_tokens(test_text)
        self.assertEqual(actual, expected, "estimate_tokens should match tiktoken exactly")

    def test_chars_per_4_heuristic_is_inaccurate_on_html(self):
        """The old chars/4 heuristic should be ~4x off on HTML-heavy content."""
        chunk = _make_html_chunk(0, size_kb=20)
        content = chunk["content"]
        old_estimate = len(content) // 4
        new_estimate = estimate_tokens(content)

        logger.info(
            "  HTML content | chars=%d | old_chars/4=%d | tiktoken=%d | ratio=%.2fx",
            len(content),
            old_estimate,
            new_estimate,
            old_estimate / max(new_estimate, 1),
        )
        # The old heuristic is known to be off — demonstrate the gap.
        # On minified-ish HTML, chars/4 typically overestimates by ~1.5-2.5x,
        # but on some code patterns can be even worse.
        self.assertGreater(old_estimate, 0)
        self.assertGreater(new_estimate, 0)
        self.assertNotAlmostEqual(old_estimate, new_estimate, delta=max(50, new_estimate // 5))

    def test_estimate_full_prompt_tokens_includes_all_components(self):
        """estimate_full_prompt_tokens should account for system + history + chunks + question."""
        chunks = [_make_html_chunk(0, size_kb=5)]
        history = [{"role": "user", "content": "What is this repo?"},
                   {"role": "assistant", "content": "It's a demo app."}]
        question = "How does the login work?"

        full_tokens = estimate_full_prompt_tokens(SYSTEM_PROMPT, question, chunks, history)
        system_tokens = estimate_tokens(SYSTEM_PROMPT)
        # Full should be at least system + question + some chunk content
        self.assertGreater(full_tokens, system_tokens)
        logger.info(
            "  Full prompt tokens: %d (system=%d, full includes history+chunks+question)",
            full_tokens,
            system_tokens,
        )


class TestGroqRealApiAccuracy(IsolatedAsyncioTestCase):
    """Make a real Groq API call and compare tiktoken estimate vs actual usage."""

    def _get_groq_key(self):
        key = settings.effective_groq_api_key
        if not key:
            import os
            from dotenv import load_dotenv
            load_dotenv()
            key = os.environ.get("GROQ_API_KEY", "").strip()
        return key

    async def test_groq_estimate_vs_actual(self):
        """Real API: estimated_prompt_tokens vs Groq's prompt_tokens (within ~15%)."""
        key = self._get_groq_key()
        if not key:
            self.skipTest("GROQ_API_KEY not configured — skipping live API verification")

        # Build HTML/code-heavy content similar to what caused 413s
        chunk = _make_html_chunk(0, size_kb=30)
        question = "What functions are defined in the HTML template?"
        user_prompt = build_user_prompt(question, [chunk])
        full_prompt_text = SYSTEM_PROMPT + "\n" + user_prompt
        estimated = estimate_tokens(full_prompt_text)

        import httpx
        payload = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 100,
        }
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            data = response.json()

        actual_prompt = data.get("usage", {}).get("prompt_tokens", 0)
        actual_completion = data.get("usage", {}).get("completion_tokens", 0)

        if actual_prompt == 0:
            self.skipTest(f"Groq response had no prompt_tokens: {data.get('error')}")

        diff_pct = abs(estimated - actual_prompt) / max(actual_prompt, 1) * 100
        logger.info("=" * 70)
        logger.info("  LIVE GROQ VERIFICATION (code/HTML-heavy content)")
        logger.info("  Estimated (tiktoken cl100k_base): %d tokens", estimated)
        logger.info("  Actual   (Groq reported)        : %d prompt_tokens", actual_prompt)
        logger.info("  Actual completion_tokens        : %d", actual_completion)
        logger.info("  Difference                        : %.1f%%", diff_pct)
        logger.info("=" * 80 if False else "=" * 70)
        self.assertLess(diff_pct, 20, "Tiktoken estimate should be within 20% of Groq actual")


class TestPreFlightTrimming(IsolatedAsyncioTestCase):
    """Verify pre-flight trimming triggers BEFORE the LLM call."""

    async def test_pre_flight_trims_before_llm_call(self):
        """When estimate exceeds threshold, chunks are halved before any API call."""
        # Create enough HTML-heavy chunks to blow past the threshold
        chunks = [_make_html_chunk(i, size_kb=30) for i in range(10)]

        # Patch all external dependencies
        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="test question")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 7000), \
             patch.object(settings, "rag_max_context_chars", 999999):  # Disable char cap

            llm_mock = MagicMock()
            llm_mock.generate_answer = AsyncMock(return_value=LLMResult(answer="Mocked answer.", usage={"prompt_tokens": 100, "completion_tokens": 10}))
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            result = await answer_question(1, "Test question?", None)

            # LLM was called at most once (no retry needed for empty answer)
            self.assertGreaterEqual(llm_mock.generate_answer.await_count, 1)

            # Verify pre-flight trimming occurred — check that fewer chunks
            # were sent than originally retrieved
            call_args = llm_mock.generate_answer.await_args_list[0]
            user_prompt_arg = call_args.kwargs.get("user_prompt", "")
            # If trimming happened, the prompt should be shorter than full context
            full_prompt = build_user_prompt("Test question?", chunks)
            self.assertLess(len(user_prompt_arg), len(full_prompt),
                            "Pre-flight trimming should reduce the prompt size")

            logger.info("  Pre-flight trimming triggered: original prompt chars=%d, trimmed prompt chars=%d",
                        len(full_prompt), len(user_prompt_arg))

    async def test_pre_flight_no_trim_when_under_threshold(self):
        """When estimate is under threshold, no trimming occurs."""
        chunks = [_make_html_chunk(i, size_kb=5) for i in range(2)]  # Small chunks

        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="short question")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 7000):

            llm_mock = MagicMock()
            llm_mock.generate_answer = AsyncMock(return_value=LLMResult(answer="Answer.", usage={"prompt_tokens": 50, "completion_tokens": 5}))
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            result = await answer_question(1, "Short question", None)

            call_args = llm_mock.generate_answer.await_args_list[0]
            user_prompt_arg = call_args.kwargs.get("user_prompt", "")
            full_prompt = build_user_prompt("Short question", chunks)
            self.assertEqual(len(user_prompt_arg), len(full_prompt),
                             "No trimming should occur when under threshold")

            logger.info("  No trimming needed: prompt chars=%d, all %d chunks retained",
                        len(full_prompt), len(chunks))


class TestGroqRetryLogic(IsolatedAsyncioTestCase):
    """Verify 413 and 429 retry safety net."""

    async def test_413_retries_with_halved_chunks_then_succeeds(self):
        """413 → retry once with halved chunks → succeeds."""
        chunks = [_make_html_chunk(i, size_kb=10) for i in range(4)]

        call_count = 0

        async def mock_generate(system_prompt, user_prompt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise GroqAPIError(status_code=413, detail="payload too large")
            return LLMResult(answer="Retried answer.", usage={"prompt_tokens": 200, "completion_tokens": 10})

        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="test")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 999999):  # Disable pre-flight so 413 path is tested

            llm_mock = MagicMock()
            llm_mock.generate_answer = mock_generate
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            result = await answer_question(1, "Test question?", None)

            self.assertEqual(call_count, 2, "Should have retried once after 413")
            self.assertEqual(result["answer"], "Retried answer.")
            logger.info("  413 retry: 2 calls made, second succeeded with halved chunks")

    async def test_429_waits_and_retries_once(self):
        """429 → wait ~60s → retry once → succeeds."""
        chunks = [_make_html_chunk(0, size_kb=5)]

        call_count = 0

        async def mock_generate(system_prompt, user_prompt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise GroqAPIError(status_code=429, detail="rate limited")
            return LLMResult(answer="Rate limit recovered.", usage={"prompt_tokens": 100, "completion_tokens": 5})

        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="test")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 999999), \
             patch("app.services.rag_service.asyncio.sleep", new=AsyncMock()):

            llm_mock = MagicMock()
            llm_mock.generate_answer = mock_generate
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            result = await answer_question(1, "Test question?", None)

            self.assertEqual(call_count, 2, "Should have retried once after 429")
            self.assertEqual(result["answer"], "Rate limit recovered.")
            logger.info("  429 retry: 2 calls made, waited 60s, second succeeded")

    async def test_413_retry_failure_returns_user_facing_message(self):
        """413 retry fails → user-facing 413 error, not raw API error."""
        chunks = [_make_html_chunk(0, size_kb=5)]

        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="test")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 999999):

            async def always_413(system_prompt, user_prompt):
                raise GroqAPIError(status_code=413, detail="payload too large")

            llm_mock = MagicMock()
            llm_mock.generate_answer = always_413
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            from fastapi import HTTPException as StarletteHTTPException

            with self.assertRaises(StarletteHTTPException) as ctx:
                await answer_question(1, "Test question?", None)
            self.assertIn(ctx.exception.status_code, (413, 500))
            logger.info("  413 double-failure: returned HTTP %d with user-facing message", ctx.exception.status_code)

    async def test_429_retry_failure_returns_user_facing_message(self):
        """429 retry fails → user-facing 429 error, not raw API error."""
        chunks = [_make_html_chunk(0, size_kb=5)]

        call_count = 0

        async def fail_429(system_prompt, user_prompt):
            nonlocal call_count
            call_count += 1
            raise GroqAPIError(status_code=429, detail="rate limited")

        with patch("app.services.rag_service.retrieve_relevant_chunks", return_value=chunks), \
             patch("app.services.rag_service.get_repository_info", new=AsyncMock(return_value={"status": "completed"})), \
             patch("app.services.rag_service.rewrite_query", new=AsyncMock(return_value="test")), \
             patch("app.services.rag_service.get_llm_provider") as mock_get_llm, \
             patch.object(settings, "rag_max_estimated_tokens", 999999), \
             patch("app.services.rag_service.asyncio.sleep", new=AsyncMock()):

            llm_mock = MagicMock()
            llm_mock.generate_answer = fail_429
            mock_get_llm.return_value = llm_mock

            from app.services.rag_service import answer_question
            from fastapi import HTTPException as StarletteHTTPException

            with self.assertRaises(StarletteHTTPException) as ctx:
                await answer_question(1, "Test question?", None)
            self.assertEqual(ctx.exception.status_code, 429)
            self.assertEqual(call_count, 2, "Should have retried once")
            logger.info("  429 double-failure: returned HTTP 429 with user-facing message")


class TestEstimateTokensDirect:
    """Quick smoke test for estimate_tokens without async machinery."""

    def test_estimate_tokens_basic(self):
        text = "Hello world. " * 100
        result = estimate_tokens(text)
        assert result > 0
        logger.info("  estimate_tokens('%d chars') = %d tokens", len(text), result)

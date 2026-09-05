"""
LLM Provider Abstraction and Implementations.

Defines a clean interface for LLM calls so that providers (Groq, Ollama,
Gemini, OpenAI) can be swapped via LLM_PROVIDER in .env without modifying
retrieval, prompt construction, or RAG orchestration.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncGenerator, Optional, Protocol

from fastapi import HTTPException
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class GroqAPIError(Exception):
    """Raised when Groq returns a 413 (payload too large) or 429 (rate limited).

    Carries the original ``status_code`` so the RAG orchestrator can implement
    provider-specific retry logic (halve chunks on 413, wait on 429) instead of
    a generic 502 that loses the signal.
    """

    def __init__(self, status_code: int, detail: str = ""):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


@dataclass
class LLMResult:
    """Result of an LLM generation call.

    Attributes:
        answer: The generated response text.
        usage: Raw ``usage`` dict from the provider (contains
            ``prompt_tokens``, ``completion_tokens``, etc.) or ``None``
            if the provider did not report usage.
    """

    answer: str
    usage: Optional[dict] = None


class LLMProvider(Protocol):
    """Protocol defining the interface for all LLM providers."""

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> LLMResult:
        """Generate a natural language answer from system and user prompts."""
        ...

    async def stream_answer(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        """Stream generated text tokens from system and user prompts."""
        ...


class GroqProvider:
    """Groq API provider using their OpenAI-compatible endpoint."""

    API_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str = "", model: str = "llama-3.1-8b-instant", timeout_seconds: float = 30.0):
        self.api_key = api_key or settings.effective_groq_api_key
        self.model = model or settings.llm_model
        self.timeout_seconds = timeout_seconds or settings.llm_timeout_seconds

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> LLMResult:
        if not self.api_key:
            logger.error("Groq API key is not configured.")
            raise HTTPException(
                status_code=500,
                detail="GROQ_API_KEY is not configured. Please set GROQ_API_KEY in .env",
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 8192,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.API_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                prompt_tokens = data.get("usage", {}).get("prompt_tokens")
                completion_tokens = data.get("usage", {}).get("completion_tokens")
                logger.info(
                    "Groq API Response | Status: %s | Model: %s | ID: %s | Prompt Tokens: %s, Completion Tokens: %s",
                    response.status_code,
                    data.get("model"),
                    data.get("id"),
                    prompt_tokens,
                    completion_tokens,
                )
                logger.debug("Groq raw response JSON: %s", data)
                choice = data.get("choices", [{}])[0] if data.get("choices") else {}
                finish_reason = choice.get("finish_reason", "unknown")
                content = choice.get("message", {}).get("content")
                logger.info(
                    "Groq completion | finish_reason=%s | content_length=%d | content_preview=%r",
                    finish_reason,
                    len(content) if content is not None else -1,
                    (content or "")[:200],
                )
                if content is None:
                    logger.error("Groq returned null/empty content. Full response: %s", data)
                    return LLMResult(answer="", usage=data.get("usage"))
                return LLMResult(answer=content.strip(), usage=data.get("usage"))
        except httpx.TimeoutException as exc:
            logger.error("Groq API call timed out after %ss: %s", self.timeout_seconds, exc)
            raise HTTPException(
                status_code=504,
                detail=f"LLM provider request timed out after {self.timeout_seconds}s",
            )
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            err_text = exc.response.text
            logger.error("Groq API returned HTTP %s: %s", status, err_text[:200])
            if status in (413, 429):
                raise GroqAPIError(status_code=status, detail=err_text) from exc
            raise HTTPException(
                status_code=502,
                detail=f"Groq API error ({status}): {err_text}",
            ) from exc
        except httpx.RequestError as exc:
            logger.error("Failed to reach Groq API: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to LLM provider: {exc}",
            )

    async def stream_answer(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        if not self.api_key:
            logger.error("Groq API key is not configured.")
            raise HTTPException(
                status_code=500,
                detail="GROQ_API_KEY is not configured. Please set GROQ_API_KEY in .env",
            )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 8192,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream("POST", self.API_URL, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_text = err_body.decode(errors="replace")
                        logger.error("Groq stream returned status %s: %s", response.status_code, err_text[:200])
                        if response.status_code in (413, 429):
                            raise GroqAPIError(status_code=response.status_code, detail=err_text)
                        raise HTTPException(status_code=502, detail=f"Groq API error ({response.status_code}): {err_text}")

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choice = data.get("choices", [{}])[0] if data.get("choices") else {}
                            delta = choice.get("delta", {})
                            content = delta.get("content")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
        except httpx.TimeoutException as exc:
            logger.error("Groq stream timed out: %s", exc)
            raise HTTPException(status_code=504, detail=f"LLM stream timed out after {self.timeout_seconds}s")
        except (GroqAPIError, HTTPException):
            raise
        except Exception as exc:
            logger.error("Groq stream unexpected error: %s", exc)
            raise HTTPException(status_code=502, detail=f"Failed to stream from LLM: {exc}")


class OllamaProvider:
    """Local Ollama provider (for 100% offline, zero-network setups)."""

    API_URL = "http://localhost:11434/api/chat"

    def __init__(self, model: str = "llama3.1", timeout_seconds: float = 60.0):
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> LLMResult:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.1},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.API_URL, json=payload)
                response.raise_for_status()
                data = response.json()
                return LLMResult(
                    answer=data.get("message", {}).get("content", "").strip(),
                    usage=data.get("eval_count"),
                )
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail=f"Ollama request timed out after {self.timeout_seconds}s")
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to reach Ollama: {exc}")

    async def stream_answer(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
            "options": {"temperature": 0.1},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream("POST", self.API_URL, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail=f"Ollama request timed out after {self.timeout_seconds}s")
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to stream from Ollama: {exc}")


class MockLLMProvider:
    """Deterministic mock provider for offline tests and verification."""

    def __init__(self, default_response: str = "Based on the repository context in [README:1-1], this repository is a demonstration project containing 'Hello World!'."):
        self.default_response = default_response

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> LLMResult:
        if "README" in user_prompt:
            return LLMResult(
                answer="According to [README:1-1], this repository is a sample Hello World project containing the text 'Hello World!'.",
                usage=None,
            )
        return LLMResult(answer=self.default_response, usage=None)

    async def stream_answer(self, system_prompt: str, user_prompt: str) -> AsyncGenerator[str, None]:
        res = await self.generate_answer(system_prompt, user_prompt)
        words = res.answer.split(" ")
        for i, word in enumerate(words):
            token = word if i == len(words) - 1 else word + " "
            yield token
            await asyncio.sleep(0.01)


def get_llm_provider() -> LLMProvider:
    """Factory returning the configured LLM provider."""
    provider_name = settings.llm_provider.lower().strip()
    if provider_name == "groq":
        if not settings.effective_groq_api_key:
            logger.info("GROQ_API_KEY not configured — using MockLLMProvider for grounded responses.")
            return MockLLMProvider()
        return GroqProvider(
            api_key=settings.effective_groq_api_key,
            model=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    elif provider_name == "ollama":
        return OllamaProvider(
            model=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    elif provider_name == "mock":
        return MockLLMProvider()
    else:
        logger.warning("Unknown LLM_PROVIDER '%s', defaulting to Groq.", provider_name)
        if not settings.effective_groq_api_key:
            return MockLLMProvider()
        return GroqProvider(
            api_key=settings.effective_groq_api_key,
            model=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )

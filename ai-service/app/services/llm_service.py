"""
LLM Provider Abstraction and Implementations.

Defines a clean interface for LLM calls so that providers (Groq, Ollama,
Gemini, OpenAI) can be swapped via LLM_PROVIDER in .env without modifying
retrieval, prompt construction, or RAG orchestration.
"""

import logging
from typing import Protocol

from fastapi import HTTPException
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    """Protocol defining the interface for all LLM providers."""

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a natural language answer from system and user prompts.

        Args:
            system_prompt: High-level instructions, rules, and citation constraints.
            user_prompt: User question and retrieved context blocks.

        Returns:
            The generated response text.

        Raises:
            HTTPException(504): If the provider call times out.
            HTTPException(502): If the provider API returns an error or is unreachable.
        """
        ...


class GroqProvider:
    """Groq API provider using their OpenAI-compatible endpoint."""

    API_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str = "", model: str = "llama-3.1-8b-instant", timeout_seconds: float = 30.0):
        self.api_key = api_key or settings.effective_groq_api_key
        self.model = model or settings.llm_model
        self.timeout_seconds = timeout_seconds or settings.llm_timeout_seconds

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> str:
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
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.API_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                logger.info(
                    "Groq API Response | Status: %s | Model: %s | ID: %s | Prompt Tokens: %s, Completion Tokens: %s",
                    response.status_code,
                    data.get("model"),
                    data.get("id"),
                    data.get("usage", {}).get("prompt_tokens"),
                    data.get("usage", {}).get("completion_tokens"),
                )
                content = data["choices"][0]["message"]["content"]
                return content.strip()
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
            raise HTTPException(
                status_code=502,
                detail=f"Groq API error ({status}): {err_text}",
            )
        except httpx.RequestError as exc:
            logger.error("Failed to reach Groq API: %s", exc)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to LLM provider: {exc}",
            )


class OllamaProvider:
    """Local Ollama provider (for 100% offline, zero-network setups)."""

    API_URL = "http://localhost:11434/api/chat"

    def __init__(self, model: str = "llama3.1", timeout_seconds: float = 60.0):
        self.model = model
        self.timeout_seconds = timeout_seconds

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> str:
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
                return data.get("message", {}).get("content", "").strip()
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail=f"Ollama request timed out after {self.timeout_seconds}s")
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to reach Ollama: {exc}")


class MockLLMProvider:
    """Deterministic mock provider for offline tests and verification."""

    def __init__(self, default_response: str = "Based on the repository context in [README:1-1], this repository is a demonstration project containing 'Hello World!'."):
        self.default_response = default_response

    async def generate_answer(self, system_prompt: str, user_prompt: str) -> str:
        if "README" in user_prompt:
            return "According to [README:1-1], this repository is a sample Hello World project containing the text 'Hello World!'."
        return self.default_response


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

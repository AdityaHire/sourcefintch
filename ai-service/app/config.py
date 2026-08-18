"""
Centralized configuration for the AI service.

Uses Pydantic's BaseSettings:
  - Automatically reads from .env files
  - Validates types
  - Provides defaults so the app runs without any .env file at all
  - Gives clear error messages if a required var is missing or wrong type
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Server ──────────────────────────────────────
    port: int = 8000

    # ── LLM Provider ─────────────────────────────────
    llm_provider: str = "groq"
    llm_api_key: str = ""  # General LLM key
    groq_api_key: str = ""  # Groq-specific key
    llm_model: str = "llama-3.1-8b-instant"
    llm_timeout_seconds: float = 30.0

    # ── RAG Parameters ──────────────────────────────
    rag_top_k: int = 5
    rag_min_score: float = 0.3
    rag_max_context_chars: int = 12000

    # ── Embeddings ──────────────────────────────────
    embedding_provider: str = "local"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_api_key: str = ""

    # ── Qdrant Vector DB ────────────────────────────
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection_name: str = "sourcefinch_chunks"
    qdrant_api_key: str = ""

    # ── CORS ────────────────────────────────────────
    cors_origin: str = "http://localhost:5173"

    # ── Node API ────────────────────────────────────
    node_api_url: str = "http://localhost:3001"

    # ── Clone settings ──────────────────────────────
    clone_timeout_seconds: int = 120

    @property
    def effective_groq_api_key(self) -> str:
        """Return the configured Groq API key from groq_api_key or llm_api_key."""
        return self.groq_api_key or self.llm_api_key or ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Single shared instance — import this everywhere
settings = Settings()

"""
Centralized configuration for the AI service.

Uses Pydantic's BaseSettings, which is like a supercharged version of dotenv:
  - Automatically reads from .env files
  - Validates types (e.g., port must be an int)
  - Provides defaults so the app runs without any .env file at all
  - Gives clear error messages if a required var is missing or wrong type

HOW TO USE:
    from app.config import settings
    print(settings.port)          # 8000
    print(settings.llm_provider)  # "groq"
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Server ──────────────────────────────────────
    port: int = 8000

    # ── LLM ─────────────────────────────────────────
    llm_provider: str = "groq"
    llm_api_key: str = ""  # Only needed for cloud providers

    # ── Embeddings ──────────────────────────────────
    embedding_provider: str = "sentence-transformers"
    embedding_api_key: str = ""  # Only needed for cloud providers

    # ── CORS ────────────────────────────────────────
    cors_origin: str = "http://localhost:5173"

    # Tell Pydantic where to find the .env file and that env var names
    # are case-insensitive (so PORT and port both work).
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Single shared instance — import this everywhere
settings = Settings()

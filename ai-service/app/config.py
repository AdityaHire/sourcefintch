"""
Centralized configuration for the AI service.

Uses Pydantic's BaseSettings:
  - Automatically reads from .env files
  - Validates types
  - Provides defaults so the app runs without any .env file at all
  - Gives clear error messages if a required var is missing or wrong type
"""

from typing import Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    # ── Server ──────────────────────────────────────
    port: int = 8000

    # ── LLM Provider ─────────────────────────────────
    llm_provider: str = "groq"
    llm_api_key: str = ""  # General LLM key
    groq_api_key: str = ""  # Groq-specific key
    # openai/gpt-oss-20b is the current recommended Groq model.
    # llama-3.3-70b-versatile was removed from Groq and will cause 404 errors.
    llm_model: str = "openai/gpt-oss-20b"
    llm_timeout_seconds: float = 30.0

    # ── Report LLM (Gemini for long-form report synthesis) ────────
    report_llm_provider: str = "gemini"
    report_llm_model: str = "gemini-2.5-flash"
    report_gemini_model: str = "gemini-2.5-flash"
    report_gemini_api_key: str = ""
    report_llm_timeout_seconds: float = 60.0

    # ── RAG Parameters ──────────────────────────────
    rag_top_k: int = 5
    rag_min_score: float = 0.20
    rag_max_context_chars: int = 12000
    # Safe token estimate threshold for pre-flight trimming (Groq 8k TPM limit).
    # Leaves margin so we proactively trim before hitting a 413.
    rag_max_estimated_tokens: int = 7000

    # ── Hybrid Search (BM25 + Dense RRF) ────────────
    hybrid_search_enabled: bool = True
    hybrid_rrf_k: int = 60
    hybrid_dense_weight: float = 1.0
    hybrid_bm25_weight: float = 1.0

    # ── Embeddings ──────────────────────────────────
    # Gemini is the recommended provider for Render deployments — the local
    # SentenceTransformer model (90 MB) OOMs on Render's 512 MiB Starter plan.
    embedding_provider: str = "gemini"
    embedding_model: str = "all-MiniLM-L6-v2"  # Only used when embedding_provider=local
    embedding_api_key: str = ""
    # Gemini embedding provider (optional alternative to local)
    gemini_api_key: str = ""
    gemini_embedding_model: str = "gemini-embedding-001"
    # MRL truncation target for gemini-embedding-001 (native dim is 3072).
    # Keep this consistent per-provider so Qdrant collection dimensions match.
    gemini_embedding_dimension: int = 768

    # ── Qdrant Vector DB ────────────────────────────
    qdrant_url: str = "https://1ffa6d2b-9049-483c-bfb0-20ab52326d39.australia-southeast1-0.gcp.cloud.qdrant.io"
    qdrant_collection_name: str = "sourcefinch_chunks"
    qdrant_api_key: str = ""

    # ── CORS ────────────────────────────────────────
    cors_origin: str = "https://sourcefintch.vercel.app,https://*.vercel.app,http://localhost:5173"

    # ── Node API ────────────────────────────────────
    node_api_url: str = "https://sourcefintch-backend-deployent.onrender.com"
    # Shared secret for server-to-server calls — must match backend INTERNAL_API_SECRET.
    internal_api_secret: str = "bda7cdb388aae2a90b4e5b6316876a1c8c5ae59c5bc435c0abe8ba5df89eef34"

    # ── Clone settings ──────────────────────────────
    clone_timeout_seconds: int = 120

    @field_validator("node_api_url", mode="before")
    @classmethod
    def ensure_node_api_url_scheme(cls, v: str) -> str:
        """Ensure node_api_url always has a URL scheme.

        Render's `fromService.property: host` (legacy) returns a bare hostname
        (e.g. 'sourcefinch-backend.onrender.com') without https://.  When that
        is passed to httpx it raises ConnectError, which cascades into a false
        HTTP 502 / 404 'Repository not found' error on the chatbot.

        Using `property: hostWithScheme` in render.yaml is the primary fix, but
        this validator acts as a second safety net.
        """
        if v and not v.startswith(("http://", "https://")):
            v = f"https://{v}"
        # Strip trailing slash for clean URL construction
        return v.rstrip("/")

    @field_validator("cors_origin", mode="before")
    @classmethod
    def strip_cors_trailing_slash(cls, v: str) -> str:
        """Strip trailing slashes from CORS origins for consistent matching."""
        if v:
            return ",".join(o.rstrip("/") for o in v.split(","))
        return v

    @property
    def effective_groq_api_key(self) -> str:
        """Return the configured Groq API key from groq_api_key or llm_api_key."""
        return self.groq_api_key or self.llm_api_key or ""

    @property
    def effective_report_gemini_api_key(self) -> str:
        """Return the Gemini API key for report generation.

        Falls back through: report_gemini_api_key → gemini_api_key → empty.
        """
        return self.report_gemini_api_key or self.gemini_api_key or ""

    @property
    def effective_report_llm_model(self) -> str:
        """Return the model name for report generation.

        Falls back through: report_gemini_model → report_llm_model → empty.
        """
        return self.report_gemini_model or self.report_llm_model or ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Single shared instance — import this everywhere
settings = Settings()

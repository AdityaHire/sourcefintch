"""
Embedding service — generates vector embeddings for code chunks.

DESIGN PRINCIPLES:
1. Local-First & Zero-Cost: Defaults to sentence-transformers with
   all-MiniLM-L6-v2 (384 dimensions), running locally on CPU/GPU with
   ₹0 cost and zero external API dependencies.
2. Provider Swappable: EMBEDDING_PROVIDER selects the implementation
   (local | gemini). Each provider exposes the same `embed(texts)`
   interface, so ingestion, retrieval, and the RAG pipeline are unchanged.
3. Singleton Provider: The selected provider is constructed once and reused.
4. Separate Collections Per Provider: Local (384-d) and Gemini (e.g. 768-d via
   MRL truncation) vectors must NEVER share a Qdrant collection, because their
   dimensions differ. get_active_collection_name() returns a provider-scoped
   collection name so retrieval always targets the collection a repo was
   indexed with. Switching a repo's provider requires re-ingestion.

Gemini notes:
- Model: gemini-embedding-001 (text-embedding-004 is deprecated Jan 2026).
- Native output dimension is 3072; we use MRL output_dimensionality truncation
  (GEMINI_EMBEDDING_DIMENSION, default 768) to keep vectors compact.
- The Gemini embed API accepts a single input text per request, so we embed
  per-text with exponential backoff on 429 (free-tier rate limits).
"""

from __future__ import annotations

import logging
import time
from typing import Optional, Protocol

from app.config import settings

logger = logging.getLogger(__name__)


# Known output dimensions for the local sentence-transformers models we ship.
# Used at startup to verify the Qdrant collection dimension WITHOUT actually
# loading the model into memory (which would OOM on Render's 512 MiB plan).
KNOWN_LOCAL_DIMENSION: dict[str, int] = {
    "all-MiniLM-L6-v2": 384,
    "all-MiniLM-L12-v2": 384,
    "all-mpnet-base-v2": 768,
    "default": 384,
}


class EmbeddingProvider(Protocol):
    """Interface every embedding provider must implement."""

    @property
    def dimension(self) -> int:
        """Output vector dimension produced by this provider."""
        ...

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts into a list of float vectors (input order preserved)."""
        ...


# ── Local (sentence-transformers) provider ───────────────────────────────────

class LocalEmbeddingProvider:
    """Default provider — runs all-MiniLM-L6-v2 locally, zero cost."""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.embedding_model or "all-MiniLM-L6-v2"
        self._model = None
        self._dimension: Optional[int] = None

    def _load_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading local embedding model: %s on cpu ...", self.model_name)
            # device="cpu" is mandatory on Render's 512MiB plan — there is no GPU
            # and the CUDA wheels have already been blocked at install time.
            self._model = SentenceTransformer(self.model_name, device="cpu")
            # Cache the dimension once so .dimension doesn't trigger another
            # backend call on every retrieval.
            try:
                self._dimension = int(self._model.get_sentence_embedding_dimension())
            except Exception:
                self._dimension = 384
            logger.info(
                "Embedding model '%s' loaded successfully (dimension: %d)",
                self.model_name,
                self._dimension,
            )
        return self._model

    @property
    def dimension(self) -> int:
        if self._dimension is not None:
            return self._dimension
        self._load_model()
        return self._dimension or 384

    def embed(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        if not texts:
            return []
        model = self._load_model()
        # normalize_embeddings=True produces unit vectors for Cosine similarity
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return [vec.tolist() for vec in embeddings]


# ── Google Gemini provider ───────────────────────────────────────────────────

class GeminiEmbeddingProvider:
    """Cloud provider using gemini-embedding-001 with MRL dimension truncation.

    Embeds one text per request (Gemini's per-request input model) and retries
    with exponential backoff on 429 rate-limit errors (free tier).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimension: Optional[int] = None,
        max_retries: int = 5,
        base_backoff_s: float = 1.0,
    ):
        self.api_key = api_key or settings.gemini_api_key
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in .env to use the Gemini embedding provider."
            )
        self.model = model or settings.gemini_embedding_model or "gemini-embedding-001"
        # MRL truncation target; native Gemini dimension is 3072.
        self.dimension = int(dimension if dimension is not None else settings.gemini_embedding_dimension or 768)
        self.max_retries = max_retries
        self.base_backoff_s = base_backoff_s
        self._client = None
        self._types = None

    def _get_client(self):
        if self._client is None:
            # Imported lazily so the SDK is only required when this provider is used.
            from google import genai
            from google.genai import types

            logger.info("Initializing Gemini embedding client (model=%s, dim=%d) ...", self.model, self.dimension)
            self._client = genai.Client(api_key=self.api_key)
            # Cache the types module so _embed_one never imports google directly.
            self._types = types
        return self._client

    @staticmethod
    def _is_rate_limit(exc: Exception) -> bool:
        status = getattr(exc, "status_code", None)
        if status == 429:
            return True
        # google-genai sometimes wraps the code in the message.
        return "429" in str(exc)

    def _embed_one(self, text: str) -> list[float]:
        # self._types is set by _get_client(); fail loudly if client wasn't initialized.
        types = getattr(self, "_types", None)
        if types is None:
            self._get_client()
            types = self._types

        client = self._client
        delay = self.base_backoff_s
        last_exc: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                result = client.models.embed_content(
                    model=self.model,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=self.dimension),
                )
                embedding = result.embeddings[0].values
                return [float(x) for x in embedding]
            except Exception as exc:  # noqa: BLE001 - normalize all failures
                last_exc = exc
                if self._is_rate_limit(exc) and attempt < self.max_retries - 1:
                    logger.warning(
                        "Gemini embedding rate-limited (429) on attempt %d/%d; backing off %.1fs",
                        attempt + 1,
                        self.max_retries,
                        delay,
                    )
                    time.sleep(delay)
                    delay *= 2
                    continue
                logger.error("Gemini embedding failed: %s", exc)
                raise

        raise RuntimeError(f"Gemini embedding failed after {self.max_retries} attempts: {last_exc}")

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return [self._embed_one(t) for t in texts]


# ── Provider selection + backward-compatible helpers ─────────────────────────

_provider_instance: Optional[EmbeddingProvider] = None


def get_embedding_provider() -> EmbeddingProvider:
    """Return (constructing once) the embedding provider for EMBEDDING_PROVIDER."""
    global _provider_instance
    if _provider_instance is None:
        provider = settings.embedding_provider.lower()
        if provider in ("local", "sentence-transformers"):
            _provider_instance = LocalEmbeddingProvider()
        elif provider == "gemini":
            _provider_instance = GeminiEmbeddingProvider()
        else:
            raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")
    return _provider_instance


def reset_provider() -> None:
    """Clear the cached provider (used by tests / config reload)."""
    global _provider_instance
    _provider_instance = None


def get_vector_dimension() -> int:
    """Return the output vector dimension for the configured provider."""
    return get_embedding_provider().dimension


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Generate vector embeddings for a list of text strings (provider-agnostic)."""
    if not texts:
        return []
    provider = get_embedding_provider()
    # Gemini embeds per-text; local batches. Both honor the same interface.
    try:
        return provider.embed(texts, batch_size=batch_size)
    except TypeError:
        # Provider doesn't accept batch_size (e.g. Gemini) — call without it.
        return provider.embed(texts)


def get_active_collection_name() -> str:
    """Return the Qdrant collection name scoped to the active embedding provider.

    Local and Gemini produce different-dimension vectors, so they must live in
    separate collections. Switching providers therefore requires re-ingestion.
    """
    provider = settings.embedding_provider.lower()
    if provider == "gemini":
        return f"{settings.qdrant_collection_name}_gemini"
    return settings.qdrant_collection_name

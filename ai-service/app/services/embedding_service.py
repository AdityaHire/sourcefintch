"""
Embedding service — generates vector embeddings for code chunks.

DESIGN PRINCIPLES:
1. Local-First & Zero-Cost: Defaults to sentence-transformers with
   all-MiniLM-L6-v2 (384 dimensions), running locally on CPU/GPU with
   ₹0 cost and zero external API dependencies.
2. Singleton Model: The model is loaded once on first use (or app startup)
   and reused across requests, avoiding expensive re-initialization.
3. Batched Processing: Generates embeddings in batches for high throughput.
4. Provider Swappable: Structured so future cloud providers (e.g., OpenAI,
   Voyage, Gemini) can be configured via EMBEDDING_PROVIDER.
"""

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Global singleton instance of the model
_model_instance = None


def get_embedding_model():
    """Retrieve or initialize the singleton sentence-transformers model."""
    global _model_instance
    if _model_instance is None:
        provider = settings.embedding_provider.lower()
        if provider in ("local", "sentence-transformers"):
            from sentence_transformers import SentenceTransformer

            model_name = settings.embedding_model or "all-MiniLM-L6-v2"
            logger.info("Loading local embedding model: %s ...", model_name)
            _model_instance = SentenceTransformer(model_name)
            logger.info(
                "Embedding model '%s' loaded successfully (dimension: %d)",
                model_name,
                get_vector_dimension(),
            )
        else:
            raise ValueError(f"Unsupported embedding provider: {settings.embedding_provider}")
    return _model_instance


def get_vector_dimension() -> int:
    """Return the output vector dimension for the configured model."""
    model = get_embedding_model()
    # SentenceTransformer provides get_sentence_embedding_dimension()
    dim = model.get_sentence_embedding_dimension()
    return int(dim) if dim is not None else 384


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Generate vector embeddings for a list of text strings.

    Args:
        texts: List of chunk text strings to embed.
        batch_size: Batch size for model inference.

    Returns:
        List of float vectors, one per input text, matching the input order.
    """
    if not texts:
        return []

    model = get_embedding_model()
    # normalize_embeddings=True produces unit vectors for Cosine similarity
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    # Convert numpy array to list of float lists for JSON / Qdrant serialization
    return [vec.tolist() for vec in embeddings]

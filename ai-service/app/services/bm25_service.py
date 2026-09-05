"""
BM25Okapi service with code-aware tokenization.

Provides lexical keyword retrieval over repository code chunks. Designed to complement
dense semantic vector search via Reciprocal Rank Fusion (RRF) for exact identifiers,
function names, file names, and configuration variables.
"""

import math
import re
from collections import Counter
from typing import Any, Optional

_CAMEL_RE = re.compile(r"([a-z0-9])([A-Z])")
_WORD_RE = re.compile(r"[A-Za-z0-9_]+")


def tokenize_code(text: str) -> list[str]:
    """Tokenize code text, expanding camelCase and snake_case symbols.

    Example:
        'handleChatStream(repo_id)' -> ['handlechatstream', 'handle', 'chat', 'stream', 'repo_id', 'repo', 'id']
    """
    if not text:
        return []

    raw_tokens = _WORD_RE.findall(text)
    tokens: list[str] = []

    for raw in raw_tokens:
        lower = raw.lower()
        tokens.append(lower)

        # Expand snake_case
        if "_" in lower:
            parts = [p for p in lower.split("_") if p and p != lower]
            tokens.extend(parts)

        # Expand camelCase
        expanded = _CAMEL_RE.sub(r"\1 \2", raw)
        if " " in expanded:
            for p in expanded.split():
                p_lower = p.lower()
                if p_lower != lower:
                    tokens.append(p_lower)

    return tokens


class BM25Index:
    """In-memory BM25Okapi index for repository code chunks."""

    def __init__(self, chunks: list[dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        """Build BM25 index over a list of chunk dicts.

        Each chunk dict is expected to have 'content' and 'file_path'.
        """
        self.k1 = k1
        self.b = b
        self.chunks = chunks
        self.corpus_size = len(chunks)

        self.doc_lengths: list[int] = []
        self.doc_term_freqs: list[Counter[str]] = []
        self.df: dict[str, int] = {}

        total_length = 0
        for chunk in chunks:
            content = chunk.get("content", "")
            # Boost file_path by duplicating its tokens
            file_path = chunk.get("file_path", "")
            tokens = tokenize_code(content) + (tokenize_code(file_path) * 2)

            doc_len = len(tokens)
            self.doc_lengths.append(doc_len)
            total_length += doc_len

            tf = Counter(tokens)
            self.doc_term_freqs.append(tf)

            for term in tf.keys():
                self.df[term] = self.df.get(term, 0) + 1

        self.avgdl = (total_length / self.corpus_size) if self.corpus_size > 0 else 0.0

        # Precompute IDF
        self.idf: dict[str, float] = {}
        for term, freq in self.df.items():
            # BM25Okapi IDF formula with +1 smoothing to avoid negative weights
            self.idf[term] = math.log(((self.corpus_size - freq + 0.5) / (freq + 0.5)) + 1.0)

    def search(self, query: str, top_k: int = 10) -> list[tuple[dict[str, Any], float]]:
        """Search the index for a query, returning top-K matches with BM25 scores."""
        if not self.chunks or not query:
            return []

        query_tokens = tokenize_code(query)
        if not query_tokens:
            return []

        scores: list[float] = [0.0] * self.corpus_size

        for term in query_tokens:
            term_idf = self.idf.get(term)
            if term_idf is None:
                continue

            for idx, tf_map in enumerate(self.doc_term_freqs):
                count = tf_map.get(term, 0)
                if count == 0:
                    continue

                doc_len = self.doc_lengths[idx]
                denom = count + self.k1 * (1.0 - self.b + self.b * (doc_len / (self.avgdl or 1.0)))
                scores[idx] += term_idf * ((count * (self.k1 + 1.0)) / denom)

        # Collect results with score > 0
        scored_results: list[tuple[int, float]] = [
            (idx, score) for idx, score in enumerate(scores) if score > 0.0
        ]
        scored_results.sort(key=lambda x: x[1], reverse=True)

        return [(self.chunks[idx], score) for idx, score in scored_results[:top_k]]

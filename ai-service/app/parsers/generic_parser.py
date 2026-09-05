"""
Generic fallback parser — works for any text file, any language.

This parser uses two strategies, tried in order:

1. **Regex boundary detection** — looks for common function/class
   declaration patterns across many languages (def, function, class, fn,
   func, etc.).  When boundaries are found, each chunk spans from one
   boundary to just before the next.

2. **Fixed-line chunking** — when no regex boundaries are found (config
   files, plain text, READMEs, etc.), splits the file into 40-line
   chunks with a 5-line overlap between consecutive chunks.  The overlap
   ensures that code near a chunk boundary isn't split in a way that
   loses context.

Always sets ``parser_used = "generic"``.
"""

import re

from app.parsers.base_parser import BaseParser, Chunk

# Regex patterns that match the start of a function or class definition
# across many common languages.  These are intentionally broad — false
# positives just mean slightly different chunk boundaries, which is fine
# for a fallback parser.
BOUNDARY_PATTERN = re.compile(
    r"^(?:"
    r"(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+"  # JS/TS function
    r"|(?:export\s+)?class\s+\w+"                                 # JS/TS/Python class
    r"|(?:pub\s+)?(?:async\s+)?fn\s+\w+"                          # Rust fn
    r"|func\s+(?:\(.*?\)\s*)?\w+"                                 # Go func
    r"|def\s+\w+"                                                  # Python/Ruby def
    r"|(?:public|private|protected|static|\s)+\s+\w+\s*\("        # Java/C#/C++ method
    r")",
    re.MULTILINE,
)

CHUNK_SIZE = 60    # Lines per chunk when no boundaries are found
OVERLAP = 10       # Lines of overlap between consecutive fixed-size chunks
MAX_CHUNKS_PER_FILE = 20  # Cap to prevent giant non-code files from exploding vector DB


class GenericParser(BaseParser):
    """Fallback parser that works on any text file."""

    def parse(self, file_path: str, language: str, content: str) -> list[Chunk]:
        """Parse content using regex boundaries or fixed-line chunking.

        Line numbers in returned Chunks are 1-indexed.
        """
        if not content or not content.strip():
            return []

        lines = content.splitlines(keepends=True)

        # Try regex-based boundary detection first
        boundary_indices = self._find_boundaries(lines)

        if boundary_indices:
            chunks = self._chunk_by_boundaries(file_path, language, lines, boundary_indices)
        else:
            # No boundaries found — fall back to fixed-line chunking
            chunks = self._chunk_fixed_lines(file_path, language, lines)

        return chunks[:MAX_CHUNKS_PER_FILE]

    def _find_boundaries(self, lines: list[str]) -> list[int]:
        """Find 0-indexed line numbers where function/class definitions start."""
        boundaries = []
        for i, line in enumerate(lines):
            if BOUNDARY_PATTERN.match(line):
                boundaries.append(i)
        return boundaries

    def _chunk_by_boundaries(
        self,
        file_path: str,
        language: str,
        lines: list[str],
        boundaries: list[int],
    ) -> list[Chunk]:
        """Create chunks based on detected function/class boundaries.

        Each chunk runs from one boundary to just before the next.  The
        last chunk runs to the end of the file.  Any lines before the
        first boundary become their own chunk (imports, module-level
        code, etc.) — but only if non-empty.
        """
        chunks = []

        # Lines before the first boundary (imports, comments, etc.)
        if boundaries[0] > 0:
            pre_content = "".join(lines[: boundaries[0]])
            if pre_content.strip():
                chunks.append(
                    Chunk(
                        file_path=file_path,
                        language=language,
                        start_line=1,                     # 1-indexed
                        end_line=boundaries[0],           # 1-indexed (line before first boundary)
                        content=pre_content,
                        parser_used="generic",
                    )
                )

        # Chunks between boundaries
        for i, start_idx in enumerate(boundaries):
            end_idx = boundaries[i + 1] if i + 1 < len(boundaries) else len(lines)
            chunk_content = "".join(lines[start_idx:end_idx])

            if chunk_content.strip():
                chunks.append(
                    Chunk(
                        file_path=file_path,
                        language=language,
                        start_line=start_idx + 1,         # 0-indexed → 1-indexed
                        end_line=end_idx,                  # 1-indexed (inclusive)
                        content=chunk_content,
                        parser_used="generic",
                    )
                )

        return chunks

    def _chunk_fixed_lines(
        self, file_path: str, language: str, lines: list[str]
    ) -> list[Chunk]:
        """Split into fixed-size chunks with overlap.

        Chunks are CHUNK_SIZE lines each, with OVERLAP lines shared
        between consecutive chunks.  The step between chunk starts is
        (CHUNK_SIZE - OVERLAP).
        """
        chunks = []
        step = CHUNK_SIZE - OVERLAP  # = 35 with defaults

        for start_idx in range(0, len(lines), step):
            end_idx = min(start_idx + CHUNK_SIZE, len(lines))
            chunk_content = "".join(lines[start_idx:end_idx])

            if chunk_content.strip():
                chunks.append(
                    Chunk(
                        file_path=file_path,
                        language=language,
                        start_line=start_idx + 1,         # 0-indexed → 1-indexed
                        end_line=end_idx,                  # 1-indexed (inclusive)
                        content=chunk_content,
                        parser_used="generic",
                    )
                )

            # If we've reached the end of the file, stop
            if end_idx >= len(lines):
                break

        return chunks

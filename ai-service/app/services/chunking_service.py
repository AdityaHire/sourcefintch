"""
Chunking service — selects the right parser for each file and handles
per-file fallback when a tree-sitter parser fails.

PARSER SELECTION LOGIC
======================
1. Look up the file's ``language`` in PARSER_MAP.
2. If found → use the tree-sitter parser for that language.
   - If the tree-sitter parser throws an exception on that specific file,
     catch it HERE (this is the ONLY place tree-sitter errors are caught),
     log a warning, and retry with GenericParser.
3. If not found in PARSER_MAP → use GenericParser directly.

WHY "tsx" IS ABSENT FROM PARSER_MAP
====================================
Node's LANGUAGE_MAP maps .tsx files to "tsx" (not "typescript").  Since
"tsx" is not in PARSER_MAP, those files go straight to GenericParser.
This is intentional: tree-sitter-typescript's grammar doesn't handle JSX
syntax reliably, and we'd rather get a usable generic chunk than a
crashed parse.  When tree-sitter-tsx support is added in a later phase,
it can be added to PARSER_MAP then.
"""

import logging

from app.parsers.base_parser import BaseParser, Chunk
from app.parsers.generic_parser import GenericParser
from app.parsers.javascript_parser import JavaScriptParser
from app.parsers.python_parser import PythonParser

logger = logging.getLogger(__name__)

# Maps language identifiers (from MySQL's files.language column) to parser classes.
PARSER_MAP: dict[str, type[BaseParser]] = {
    "python": PythonParser,
    "javascript": JavaScriptParser,
    "typescript": JavaScriptParser,
    "tsx": JavaScriptParser,
}

# Shared instances — parsers are stateless, so we can reuse them.
_parser_instances: dict[str, BaseParser] = {}
_generic_parser = GenericParser()


def _get_parser(language: str) -> BaseParser:
    """Get or create a parser instance for the given language."""
    if language not in PARSER_MAP:
        return _generic_parser

    if language not in _parser_instances:
        _parser_instances[language] = PARSER_MAP[language]()

    return _parser_instances[language]


def chunk_file(file_path: str, language: str, content: str) -> list[Chunk]:
    """Split a file's content into chunks using the appropriate parser.

    If a tree-sitter parser fails on this specific file, falls back to
    GenericParser rather than skipping the file or crashing the batch.

    Args:
        file_path: Relative path within the repository.
        language:  Language identifier (e.g. "python", "javascript", "tsx").
        content:   Full text content of the file.

    Returns:
        A list of Chunk objects with 1-indexed line numbers.
    """
    if language and language in PARSER_MAP:
        try:
            parser = _get_parser(language)
            return parser.parse(file_path, language, content)
        except Exception as exc:
            # This is the ONLY place tree-sitter errors are caught.
            # Log a warning and fall back to generic for this one file.
            logger.warning(
                "tree-sitter-%s failed on %s, falling back to generic parser: %s",
                language,
                file_path,
                exc,
            )

    # Language not in PARSER_MAP or tree-sitter failed — use generic
    return _generic_parser.parse(file_path, language or "unknown", content)

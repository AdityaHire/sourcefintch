"""
Tree-sitter JavaScript/TypeScript parser — handles both languages with
one class, selecting the right grammar based on the ``language`` parameter.

WHY ONE CLASS FOR BOTH?
=======================
JavaScript and TypeScript share nearly identical AST structures (functions,
classes, methods, arrow functions).  The only difference is which grammar
we load.  Using one class avoids duplicating all the node-walking logic.

The ``language`` parameter drives two things:
  1. Which tree-sitter grammar to use (JS vs TS).
  2. The ``parser_used`` field — set dynamically as
     ``f"tree-sitter-{language}"`` so a .ts file correctly reports
     "tree-sitter-typescript", not "tree-sitter-javascript".

IMPORTANT: Tree-sitter uses 0-indexed rows internally.  We convert to
1-indexed at Chunk construction (see base_parser.py module docstring).

NOTE: This parser does NOT handle "tsx".  TSX files are deliberately
routed to the generic parser via Node's LANGUAGE_MAP (which maps .tsx
to "tsx") and Python's PARSER_MAP (which omits "tsx").
"""

import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Parser

from app.parsers.base_parser import BaseParser, Chunk

JS_LANGUAGE = Language(tsjavascript.language())
TS_LANGUAGE = Language(tstypescript.language_typescript())

# Node types to extract as individual chunks.  These cover the most
# common top-level and class-level constructs in JS/TS.
TARGET_NODE_TYPES = {
    "function_declaration",
    "class_declaration",
    "method_definition",
    "arrow_function",
    "lexical_declaration",       # const foo = () => {} at top level
    "export_statement",          # export function/class/const
}


class JavaScriptParser(BaseParser):
    """Tree-sitter parser for JavaScript and TypeScript source files."""

    def __init__(self):
        self._js_parser = Parser(JS_LANGUAGE)
        self._ts_parser = Parser(TS_LANGUAGE)

    def parse(self, file_path: str, language: str, content: str) -> list[Chunk]:
        """Parse JS or TS source into chunks using tree-sitter.

        The ``language`` parameter must be "javascript" or "typescript".
        Line numbers in returned Chunks are 1-indexed.
        """
        if not content or not content.strip():
            return []

        parser = self._ts_parser if language == "typescript" else self._js_parser
        tree = parser.parse(content.encode("utf-8"))
        chunks = []
        lines = content.splitlines(keepends=True)

        self._extract_chunks(tree.root_node, file_path, language, lines, chunks)

        # If no target nodes found, return the whole file as one chunk.
        if not chunks and content.strip():
            chunks.append(
                Chunk(
                    file_path=file_path,
                    language=language,
                    start_line=1,
                    end_line=len(lines),
                    content=content,
                    parser_used=f"tree-sitter-{language}",
                )
            )

        return chunks

    def _extract_chunks(
        self,
        node,
        file_path: str,
        language: str,
        lines: list[str],
        chunks: list[Chunk],
    ) -> None:
        """Recursively extract target nodes from the syntax tree."""
        for child in node.children:
            if child.type in TARGET_NODE_TYPES:
                # tree-sitter rows are 0-indexed → convert to 1-indexed
                start_line = child.start_point[0] + 1
                end_line = child.end_point[0] + 1

                chunk_content = "".join(lines[child.start_point[0] : child.end_point[0] + 1])

                chunks.append(
                    Chunk(
                        file_path=file_path,
                        language=language,
                        start_line=start_line,
                        end_line=end_line,
                        content=chunk_content,
                        parser_used=f"tree-sitter-{language}",
                    )
                )
            elif child.type not in TARGET_NODE_TYPES:
                # Recurse into non-target nodes to find nested functions
                # (e.g. function inside an if-block or module wrapper)
                self._extract_chunks(child, file_path, language, lines, chunks)

"""
Tree-sitter Python parser — uses a real grammar to find function and class
boundaries with high accuracy.

HOW TREE-SITTER WORKS (quick primer)
=====================================
Tree-sitter is a parser framework that builds a concrete syntax tree (CST)
from source code, similar to what a compiler does but much faster and
designed for editor tooling.  Each language has its own "grammar" package
(tree-sitter-python, tree-sitter-javascript, etc.) that teaches
tree-sitter the language's syntax rules.

We query the CST for specific node types (function_definition,
class_definition, decorated_definition) and extract the line ranges.

IMPORTANT: Tree-sitter uses 0-indexed rows internally.  We convert to
1-indexed at Chunk construction to match the project's contract
(see base_parser.py module docstring).
"""

import tree_sitter_python as tspython
from tree_sitter import Language, Parser

from app.parsers.base_parser import BaseParser, Chunk

PY_LANGUAGE = Language(tspython.language())

# Node types we want to extract as individual chunks.
# "decorated_definition" covers @decorator above a function/class.
TARGET_NODE_TYPES = {
    "function_definition",
    "class_definition",
    "decorated_definition",
}


class PythonParser(BaseParser):
    """Tree-sitter based parser for Python source files."""

    def __init__(self):
        self._parser = Parser(PY_LANGUAGE)

    def parse(self, file_path: str, language: str, content: str) -> list[Chunk]:
        """Parse Python source into chunks using tree-sitter.

        Line numbers in returned Chunks are 1-indexed.
        """
        if not content or not content.strip():
            return []

        tree = self._parser.parse(content.encode("utf-8"))
        chunks = []
        lines = content.splitlines(keepends=True)

        # Walk top-level children of the root node
        self._extract_chunks(tree.root_node, file_path, language, lines, chunks)

        # If tree-sitter found no target nodes (e.g. a Python file with
        # only module-level statements), return the whole file as one chunk.
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
            else:
                # Recurse into non-target nodes (e.g. if_statement
                # containing a nested function definition)
                self._extract_chunks(child, file_path, language, lines, chunks)

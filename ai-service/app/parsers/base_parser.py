"""
Base parser interface — defines the Chunk dataclass and BaseParser ABC.

Every parser in Sourcefinch (generic, tree-sitter-python, tree-sitter-js/ts)
inherits from BaseParser and produces a list of Chunk objects.

LINE NUMBER CONTRACT
====================
All line numbers in Chunk objects are **1-indexed** (the first line of a
file is line 1, not line 0).  This matches how humans read source code,
how editors display line numbers, and how source citations work in the
rest of the app.

Tree-sitter internally uses 0-indexed rows.  Every tree-sitter parser is
responsible for converting to 1-indexed at the point each Chunk is
constructed (i.e., ``start_line = node.start_point[0] + 1``).  This is
NOT done in the base class — each parser must do it explicitly so the
conversion is visible in the code that knows about tree-sitter's
representation.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Chunk:
    """A single chunk of source code extracted from a file.

    Attributes:
        file_path:   Relative path within the repository (e.g. "src/utils.py").
        language:    Language identifier (e.g. "python", "javascript", "tsx").
        start_line:  First line of this chunk (1-indexed — see module docstring).
        end_line:    Last line of this chunk (1-indexed, inclusive).
        content:     The actual source code text for this chunk.
        parser_used: Which parser produced this chunk, e.g. "generic",
                     "tree-sitter-python", "tree-sitter-typescript".
    """

    file_path: str
    language: str
    start_line: int
    end_line: int
    content: str
    parser_used: str


class BaseParser(ABC):
    """Abstract base class that every parser must implement.

    Subclasses override ``parse()`` to split a file's content into a list
    of Chunk objects.  The chunking_service calls ``parse()`` and handles
    fallback logic if a tree-sitter parser fails on a specific file.
    """

    @abstractmethod
    def parse(self, file_path: str, language: str, content: str) -> list[Chunk]:
        """Parse a file's content into chunks.

        Args:
            file_path: Relative path within the repository.
            language:  Language identifier (e.g. "python", "javascript").
            content:   Full text content of the file.

        Returns:
            A list of Chunk objects.  Line numbers are 1-indexed.
        """
        ...

"""
Automated tests for Phase 4 — code parsing + chunking.

These tests cover the properties most likely to silently regress when
parsers are modified in later phases:

1. 1-indexed line numbers (not 0-indexed)
2. Dynamic parser_used correctness (tree-sitter-python, tree-sitter-javascript,
   tree-sitter-typescript — not hardcoded)
3. TSX exclusion from PARSER_MAP
4. Generic parser fallback behavior (40-line/5-line-overlap)

All tests are self-contained — no network, no clone, no Node dependency.
They construct known source strings and pass them directly to parsers.
"""

from app.parsers.python_parser import PythonParser
from app.parsers.javascript_parser import JavaScriptParser
from app.parsers.generic_parser import GenericParser
from app.services.chunking_service import PARSER_MAP


# ── Test 1: Python parser — 1-indexed lines + correct parser_used ────

def test_python_parser_1_indexed_lines():
    """A Python function at a known position reports correct 1-indexed
    start_line/end_line and parser_used == 'tree-sitter-python'."""

    source = (
        "# module header\n"
        "import os\n"
        "\n"
        "def greet(name):\n"       # line 4
        "    \"\"\"Say hello.\"\"\"\n"
        "    print(f'Hello, {name}!')\n"
        "    return name\n"         # line 7
        "\n"
        "x = 42\n"
    )

    parser = PythonParser()
    chunks = parser.parse("example.py", "python", source)

    # Find the chunk containing 'greet'
    greet_chunks = [c for c in chunks if "def greet" in c.content]
    assert len(greet_chunks) == 1, f"Expected 1 greet chunk, got {len(greet_chunks)}"

    chunk = greet_chunks[0]

    # Line numbers must be 1-indexed
    assert chunk.start_line == 4, f"Expected start_line=4, got {chunk.start_line}"
    assert chunk.end_line == 7, f"Expected end_line=7, got {chunk.end_line}"

    # parser_used must be dynamic, not hardcoded
    assert chunk.parser_used == "tree-sitter-python"


# ── Test 2: JavaScript parser — 1-indexed lines + correct parser_used ─

def test_js_parser_1_indexed_lines():
    """A JS function at a known position reports correct 1-indexed
    start_line/end_line and parser_used == 'tree-sitter-javascript'."""

    source = (
        "// utils.js\n"
        "const x = 1;\n"
        "\n"
        "function add(a, b) {\n"    # line 4
        "  return a + b;\n"
        "}\n"                        # line 6
        "\n"
        "module.exports = { add };\n"
    )

    parser = JavaScriptParser()
    chunks = parser.parse("utils.js", "javascript", source)

    # Find the chunk containing 'add'
    add_chunks = [c for c in chunks if "function add" in c.content]
    assert len(add_chunks) >= 1, f"Expected at least 1 add chunk, got {len(add_chunks)}"

    chunk = add_chunks[0]

    # Line numbers must be 1-indexed
    assert chunk.start_line == 4, f"Expected start_line=4, got {chunk.start_line}"
    assert chunk.end_line == 6, f"Expected end_line=6, got {chunk.end_line}"

    assert chunk.parser_used == "tree-sitter-javascript"


# ── Test 3: TS parser — parser_used is "tree-sitter-typescript", NOT javascript

def test_ts_parser_uses_typescript_not_javascript():
    """A TypeScript function parsed with language='typescript' must report
    parser_used == 'tree-sitter-typescript', NOT 'tree-sitter-javascript'.

    This guards against someone hardcoding 'tree-sitter-javascript' in
    JavaScriptParser instead of using the dynamic f'tree-sitter-{language}'.
    """

    source = (
        "// greeter.ts\n"
        "\n"
        "function greet(name: string): string {\n"  # line 3 — type annotation makes it TS
        "  return `Hello, ${name}!`;\n"
        "}\n"                                        # line 5
    )

    parser = JavaScriptParser()
    chunks = parser.parse("greeter.ts", "typescript", source)

    assert len(chunks) >= 1, "Expected at least 1 chunk"

    for chunk in chunks:
        assert chunk.parser_used == "tree-sitter-typescript", (
            f"Expected 'tree-sitter-typescript', got '{chunk.parser_used}'"
        )

    # Verify the greet function specifically
    greet_chunks = [c for c in chunks if "function greet" in c.content]
    assert len(greet_chunks) >= 1, "Expected to find the greet function chunk"
    assert greet_chunks[0].start_line == 3


# ── Test 4: TSX absent from PARSER_MAP ────────────────────────────────

def test_tsx_absent_from_parser_map():
    """'tsx' must NOT be in PARSER_MAP.

    TSX is deliberately routed to the generic parser.  This test guards
    against someone adding it without realizing the spec excludes it.
    """
    assert "tsx" not in PARSER_MAP, (
        f"'tsx' should NOT be in PARSER_MAP, but found: {PARSER_MAP.get('tsx')}"
    )


# ── Test 5: Generic parser — fixed-line fallback (no boundaries) ─────

def test_generic_parser_fixed_line_fallback():
    """When no function/class boundaries are found, the generic parser
    falls back to 40-line chunks with 5-line overlap.

    Expected chunk layout for 100 lines:
      Chunk 1: lines 1–40   (40 lines)
      Chunk 2: lines 36–75  (starts at 36 = 40 - 5 + 1)
      Chunk 3: lines 71–100 (starts at 71, ends at file end)
    """
    # 100 lines of plain comments — no function/class boundaries
    lines = [f"# comment line {i + 1}\n" for i in range(100)]
    source = "".join(lines)

    parser = GenericParser()
    chunks = parser.parse("config.txt", "unknown", source)

    # Must produce chunks, not an empty list
    assert len(chunks) > 0, "Expected at least one chunk"

    # All chunks must use "generic" parser
    for chunk in chunks:
        assert chunk.parser_used == "generic", (
            f"Expected parser_used='generic', got '{chunk.parser_used}'"
        )

    # First chunk: lines 1–40
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 40

    # Second chunk: lines 36–75 (overlap of 5 lines)
    assert chunks[1].start_line == 36
    assert chunks[1].end_line == 75

    # Third chunk: lines 71–100 (overlap of 5, ends at file end)
    assert chunks[2].start_line == 71
    assert chunks[2].end_line == 100


# ── Test 6: Generic parser — regex boundary detection ─────────────────

def test_generic_parser_regex_boundaries():
    """When regex boundaries are found (def foo, def bar), the generic
    parser creates boundary-based chunks instead of fixed-line chunks."""

    source = (
        "# imports\n"              # line 1
        "import os\n"              # line 2
        "\n"                       # line 3
        "def foo():\n"             # line 4 — boundary
        "    pass\n"               # line 5
        "\n"                       # line 6
        "def bar():\n"             # line 7 — boundary
        "    return 42\n"          # line 8
    )

    parser = GenericParser()
    chunks = parser.parse("example.py", "python", source)

    # Should find chunks — at least the pre-boundary block and 2 function chunks
    assert len(chunks) >= 2, f"Expected at least 2 chunks, got {len(chunks)}"

    # All chunks must use "generic" parser
    for chunk in chunks:
        assert chunk.parser_used == "generic"

    # Find the foo and bar chunks
    foo_chunks = [c for c in chunks if "def foo" in c.content]
    bar_chunks = [c for c in chunks if "def bar" in c.content]

    assert len(foo_chunks) == 1, "Expected 1 foo chunk"
    assert len(bar_chunks) == 1, "Expected 1 bar chunk"

    # foo starts at line 4 (1-indexed)
    assert foo_chunks[0].start_line == 4
    # bar starts at line 7 (1-indexed)
    assert bar_chunks[0].start_line == 7


# ── Test 7: JS parser — standalone declarations are NOT extracted ──────

def test_js_parser_skips_standalone_declarations():
    """Standalone let/const declarations must NOT be extracted as individual
    chunks.  Only functions, classes, methods, arrow functions, and exports
    should become chunks.

    This guards against the bug where files like script.js returned only
    isolated variable declarations (textIndex, isDeleting, body, tabPanes,
    observerOptions) with no surrounding function logic.
    """

    source = (
        "// script.js\n"
        "let textIndex = 0;\n"           # line 2 — should NOT be a chunk
        "const isDeleting = false;\n"    # line 3 — should NOT be a chunk
        "const body = document.body;\n"  # line 4 — should NOT be a chunk
        "const tabPanes = [];\n"         # line 5 — should NOT be a chunk
        "const observerOptions = {};\n"  # line 6 — should NOT be a chunk
        "\n"
        "function init() {\n"            # line 8 — SHOULD be a chunk
        "  textIndex = 0;\n"
        "  return body;\n"
        "}\n"                            # line 11
        "\n"
        "const refresh = () => {\n"      # line 13 — SHOULD be a chunk
        "  init();\n"
        "};\n"                            # line 15
    )

    parser = JavaScriptParser()
    chunks = parser.parse("script.js", "javascript", source)

    # No declaration-only chunks (simple let/const without function logic)
    for chunk in chunks:
        stripped = chunk.content.strip()
        is_simple_declaration = (
            stripped.startswith("let ") or
            (stripped.startswith("const ") and "=>" not in stripped and "function" not in stripped)
        )
        assert not is_simple_declaration, (
            f"Unexpected simple declaration chunk: {chunk.content!r}"
        )

    # Must find the init function
    init_chunks = [c for c in chunks if "function init" in c.content]
    assert len(init_chunks) == 1, "Expected 1 init function chunk"
    assert init_chunks[0].start_line == 8
    assert init_chunks[0].end_line == 11

    # Must find the refresh arrow function
    refresh_chunks = [c for c in chunks if "const refresh" in c.content]
    assert len(refresh_chunks) == 1, "Expected 1 refresh arrow-function chunk"
    assert refresh_chunks[0].start_line == 13
    assert refresh_chunks[0].end_line == 15


# ── Test 8: JS parser — declarations-only file returns whole file ──────

def test_js_parser_declarations_only_returns_whole_file():
    """When a file contains only let/const declarations and no functions,
    classes, or arrow functions, the parser must return the entire file
    as a single chunk rather than producing empty results.
    """

    source = (
        "// settings.js\n"
        "const API_URL = 'https://api.example.com';\n"
        "const TIMEOUT = 5000;\n"
        "const DEBUG = true;\n"
    )

    parser = JavaScriptParser()
    chunks = parser.parse("settings.js", "javascript", source)

    assert len(chunks) == 1, f"Expected 1 whole-file chunk, got {len(chunks)}"
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 4
    assert chunks[0].parser_used == "tree-sitter-javascript"


# ── Test 9: TS parser — standalone declarations skipped, functions kept ─

def test_ts_parser_skips_standalone_declarations():
    """TypeScript files must behave the same as JavaScript: standalone
    declarations are skipped, functions are extracted.
    """

    source = (
        "// greeter.ts\n"
        "let prefix = 'Hello';\n"
        "\n"
        "function greet(name: string): string {\n"
        "  return `${prefix}, ${name}!`;\n"
        "}\n"
    )

    parser = JavaScriptParser()
    chunks = parser.parse("greeter.ts", "typescript", source)

    # No declaration-only chunks
    for chunk in chunks:
        assert not chunk.content.strip().startswith("let "), (
            f"Unexpected let-declaration chunk in TS: {chunk.content!r}"
        )

    # Must find the greet function
    greet_chunks = [c for c in chunks if "function greet" in c.content]
    assert len(greet_chunks) == 1
    assert greet_chunks[0].start_line == 4
    assert greet_chunks[0].parser_used == "tree-sitter-typescript"


# ── Test 10: JS parser — export statement still extracted ──────────────

def test_js_parser_export_statement_extracted():
    """export statements must still be extracted as individual chunks."""

    source = (
        "function helper() {}\n"
        "\n"
        "export { helper };\n"
    )

    parser = JavaScriptParser()
    chunks = parser.parse("module.js", "javascript", source)

    export_chunks = [c for c in chunks if "export" in c.content]
    assert len(export_chunks) == 1, "Expected 1 export chunk"
    assert export_chunks[0].start_line == 3
    assert export_chunks[0].end_line == 3

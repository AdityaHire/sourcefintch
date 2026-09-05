"""
Repository Intelligence Report Service.

Generates comprehensive, multi-dimensional repository intelligence reports by combining:
1. Deterministic static analysis (file distributions, language metrics, package manifests,
   dependencies, directory structures, entry points, detected APIs).
2. Deep LLM architectural synthesis (executive summary, architecture paradigm,
   data flow explanation, security/performance evaluation, onboarding guide,
   and exploratory question suggestions).
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.config import settings
from app.services.llm_service import get_llm_provider
from app.services.node_internal_client import async_internal_get

logger = logging.getLogger(__name__)

# Known language colors for UI visualization
LANGUAGE_COLORS = {
    "TypeScript": "#3178c6",
    "JavaScript": "#f7df1e",
    "Python": "#3572a5",
    "TSX": "#61dafb",
    "JSX": "#20c997",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "SCSS": "#c6538c",
    "JSON": "#cbcb41",
    "Markdown": "#083fa1",
    "SQL": "#e38c00",
    "Shell": "#89e051",
    "Go": "#00add8",
    "Rust": "#dea584",
    "Java": "#b07219",
    "C++": "#f34b7d",
    "C": "#555555",
    "YAML": "#cb171e",
    "Other": "#71717a",
}

EXTENSION_MAP = {
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".js": "JavaScript",
    ".jsx": "JSX",
    ".py": "Python",
    ".json": "JSON",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cpp": "C++",
    ".c": "C",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
}


def detect_language(file_path: str, explicit_lang: Optional[str] = None) -> str:
    """Infer display language from file path or explicit language column."""
    if explicit_lang and explicit_lang.lower() not in ("unknown", "generic", ""):
        # Capitalize nicely
        lang_lower = explicit_lang.lower()
        for k, v in EXTENSION_MAP.items():
            if v.lower() == lang_lower:
                return v
        return explicit_lang.capitalize()

    _, ext = os.path.splitext(file_path)
    return EXTENSION_MAP.get(ext.lower(), "Other")


def categorize_dependency(dep_name: str) -> str:
    """Categorize a library or package by functional role."""
    name = dep_name.lower()
    if any(k in name for k in ["react", "vue", "svelte", "angular", "next", "vite", "express", "fastapi", "flask", "django", "nest"]):
        return "Framework & Runtime"
    if any(k in name for k in ["mysql", "postgres", "pg", "mongo", "redis", "prisma", "sequelize", "qdrant", "chroma", "sqlite", "typeorm", "sqlalchemy"]):
        return "Database & Store"
    if any(k in name for k in ["clerk", "auth", "jwt", "passport", "bcrypt", "helmet", "rate-limit"]):
        return "Auth & Security"
    if any(k in name for k in ["groq", "openai", "sentence-transformers", "langchain", "llama", "huggingface", "transformers", "torch"]):
        return "AI & Machine Learning"
    if any(k in name for k in ["tailwind", "lucide", "radix", "framer", "shadcn", "sass", "emotion", "styled"]):
        return "UI & Styling"
    if any(k in name for k in ["jest", "vitest", "pytest", "mocha", "chai", "cypress", "playwright", "supertest"]):
        return "Testing & QA"
    return "Utility & Tooling"


def extract_package_json(content: str) -> Dict[str, Any]:
    """Parse package.json content to extract dependencies, scripts, and details."""
    try:
        data = json.loads(content)
        deps = []
        for name, ver in data.get("dependencies", {}).items():
            deps.append({
                "name": name,
                "version": ver,
                "type": "runtime",
                "category": categorize_dependency(name),
            })
        for name, ver in data.get("devDependencies", {}).items():
            deps.append({
                "name": name,
                "version": ver,
                "type": "dev",
                "category": categorize_dependency(name),
            })
        return {
            "name": data.get("name", ""),
            "version": data.get("version", ""),
            "description": data.get("description", ""),
            "scripts": data.get("scripts", {}),
            "dependencies": deps,
        }
    except Exception as exc:
        logger.debug("Failed to parse package.json: %s", exc)
        return {}


def extract_requirements_txt(content: str) -> List[Dict[str, Any]]:
    """Parse python requirements.txt into structured dependencies."""
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = re.split(r"[><=~]+", line, 1)
        name = parts[0].strip()
        ver = parts[1].strip() if len(parts) > 1 else "latest"
        if name:
            deps.append({
                "name": name,
                "version": ver,
                "type": "runtime",
                "category": categorize_dependency(name),
            })
    return deps


def analyze_static_repo(files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extract deterministic static metrics from all repository files."""
    total_files = len(files)
    total_bytes = 0
    total_lines = 0

    lang_counts: Dict[str, int] = {}
    lang_lines: Dict[str, int] = {}
    lang_bytes: Dict[str, int] = {}

    manifests: List[str] = []
    all_dependencies: List[Dict[str, Any]] = []
    scripts: Dict[str, str] = {}
    readme_content = ""
    entry_points: List[Dict[str, str]] = []
    detected_apis: List[Dict[str, str]] = []
    dir_file_counts: Dict[str, int] = {}

    entry_point_names = {
        "main.py", "app.py", "server.py", "run.py",
        "index.js", "app.js", "server.js", "main.js",
        "index.ts", "app.ts", "server.ts", "main.ts",
        "index.tsx", "main.tsx", "App.tsx",
        "main.go", "main.rs", "Application.java",
    }

    for f in files:
        path = f.get("file_path", "")
        content = f.get("content") or ""
        size = f.get("file_size", len(content.encode("utf-8", errors="replace")))
        lines = len(content.splitlines()) if content else 0

        total_bytes += size
        total_lines += lines

        # Directory accounting
        parts = path.split("/")
        if len(parts) > 1:
            top_dir = parts[0]
            dir_file_counts[top_dir] = dir_file_counts.get(top_dir, 0) + 1

        lang = detect_language(path, f.get("language"))
        lang_counts[lang] = lang_counts.get(lang, 0) + 1
        lang_lines[lang] = lang_lines.get(lang, 0) + lines
        lang_bytes[lang] = lang_bytes.get(lang, 0) + size

        # Entry point detection
        base_name = os.path.basename(path)
        if base_name in entry_point_names:
            entry_points.append({
                "file_path": path,
                "name": base_name,
                "language": lang,
                "description": f"Main application entry point ({lang})",
            })

        # Manifest parsing
        if base_name == "package.json":
            manifests.append(path)
            pkg = extract_package_json(content)
            all_dependencies.extend(pkg.get("dependencies", []))
            if pkg.get("scripts"):
                for k, v in pkg["scripts"].items():
                    scripts[f"{os.path.dirname(path) or 'root'}:{k}"] = v
        elif base_name in ("requirements.txt", "requirements-dev.txt"):
            manifests.append(path)
            all_dependencies.extend(extract_requirements_txt(content))
        elif base_name == "Cargo.toml":
            manifests.append(path)
        elif base_name == "go.mod":
            manifests.append(path)
        elif base_name.lower() in ("readme.md", "readme"):
            readme_content = content[:3000]

        # Light API route regex detection
        if any(w in path.lower() for w in ["route", "api", "controller", "endpoint"]):
            for line_idx, line in enumerate(content.splitlines()[:200], start=1):
                # Express / Fastify / Flask / FastAPI routes
                match = re.search(r"\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]", line, re.IGNORECASE)
                if match:
                    detected_apis.append({
                        "method": match.group(2).upper(),
                        "path": match.group(3),
                        "file": f"{path}:{line_idx}",
                    })
                # FastAPI decorator style @router.get("/...")
                match_py = re.search(r"@(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]", line, re.IGNORECASE)
                if match_py:
                    detected_apis.append({
                        "method": match_py.group(1).upper(),
                        "path": match_py.group(2),
                        "file": f"{path}:{line_idx}",
                    })

    # Deduplicate dependencies by name
    seen_deps = set()
    deduped_deps = []
    for d in all_dependencies:
        key = (d["name"].lower(), d["type"])
        if key not in seen_deps:
            seen_deps.add(key)
            deduped_deps.append(d)

    # Calculate language percentages
    languages = []
    for lang, count in sorted(lang_counts.items(), key=lambda x: x[1], reverse=True):
        pct = round((count / max(total_files, 1)) * 100, 1)
        languages.append({
            "language": lang,
            "file_count": count,
            "line_count": lang_lines.get(lang, 0),
            "byte_size": lang_bytes.get(lang, 0),
            "percentage": pct,
            "color": LANGUAGE_COLORS.get(lang, LANGUAGE_COLORS["Other"]),
        })

    # Key directories
    key_directories = [
        {"path": d, "file_count": count, "description": f"Contains {count} source files"}
        for d, count in sorted(dir_file_counts.items(), key=lambda x: x[1], reverse=True)[:8]
    ]

    # Deduplicate detected APIs
    seen_apis = set()
    deduped_apis = []
    for api in detected_apis:
        key = (api["method"], api["path"])
        if key not in seen_apis:
            seen_apis.add(key)
            deduped_apis.append(api)

    return {
        "metrics": {
            "total_files": total_files,
            "total_lines": total_lines,
            "total_size_bytes": total_bytes,
            "languages": languages,
        },
        "manifests": manifests,
        "dependencies": deduped_deps[:80],
        "scripts": scripts,
        "entry_points": entry_points[:10],
        "key_directories": key_directories,
        "detected_apis": deduped_apis[:30],
        "readme_snippet": readme_content,
    }


REPORT_SYNTHESIS_SYSTEM_PROMPT = """You are a Principal Software Architect and Codebase Intelligence Specialist.
Your task is to analyze the structural inventory of a software repository and synthesize an exhaustive, high-precision technical intelligence report.

Return ONLY a valid JSON object matching this exact schema:
{
  "executive_summary": "Crisp 2-3 sentence overview of what the application does, its core value proposition, and intended users.",
  "architecture_style": "Specific architectural pattern label (e.g. '3-Tier Monorepo with RAG Microservice and SSE Streaming')",
  "architecture_deep_dive": "Exhaustive, professional Markdown text detailing the architecture, subsystems, data flow, key patterns, and communication protocols. Use headings (###), bullet points, and code spans.",
  "key_features": [
    { "title": "Feature Name", "description": "Crisp description of implementation and purpose" }
  ],
  "security_and_performance": [
    { "aspect": "Security/Performance Area", "observation": "Observed design pattern or implementation detail", "recommendation": "Optional optimization recommendation" }
  ],
  "onboarding_guide": [
    { "step": 1, "title": "Step title", "detail": "Actionable instructions for a new developer" }
  ],
  "recommended_questions": [
    "Recommended question 1 to ask the AI assistant about this codebase",
    "Recommended question 2 to ask the AI assistant about this codebase",
    "Recommended question 3 to ask the AI assistant about this codebase",
    "Recommended question 4 to ask the AI assistant about this codebase"
  ]
}

Ensure all insights are grounded in the provided project inventory. Do not return markdown wrappers around the JSON; return pure JSON.
"""


async def generate_ai_synthesis(
    repo_name: str,
    branch: str,
    static_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Call LLM to synthesize deep architectural intelligence from static repository metrics."""
    top_langs = [f"{l['language']} ({l['percentage']}%)" for l in static_data["metrics"]["languages"][:5]]
    deps_summary = [f"{d['name']} ({d['category']})" for d in static_data["dependencies"][:25]]
    entry_summary = [f"{e['file_path']} ({e['language']})" for e in static_data["entry_points"]]
    api_summary = [f"{a['method']} {a['path']}" for a in static_data["detected_apis"][:15]]

    user_prompt = f"""Repository: {repo_name} (branch: {branch})
Total Files: {static_data['metrics']['total_files']} | Total Lines: {static_data['metrics']['total_lines']}
Languages: {', '.join(top_langs)}
Manifests: {', '.join(static_data['manifests']) if static_data['manifests'] else 'None'}
Key Dependencies: {', '.join(deps_summary) if deps_summary else 'Standard library / None listed'}
Entry Points: {', '.join(entry_summary) if entry_summary else 'Standard structure'}
Detected API Routes: {', '.join(api_summary) if api_summary else 'Client/Library or routes not identified'}

Key Directories: {', '.join([d['path'] for d in static_data['key_directories']])}

README excerpt:
{static_data['readme_snippet'][:1500] if static_data['readme_snippet'] else 'No README provided'}

Synthesize the full architecture intelligence report JSON now:"""

    try:
        llm = get_llm_provider()
        result = await llm.generate_answer(
            system_prompt=REPORT_SYNTHESIS_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        raw = result.answer.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(raw)
        return parsed
    except Exception as exc:
        logger.warning("LLM architectural synthesis failed or returned invalid JSON: %s", exc)
        # Construct deterministic fallback
        return {
            "executive_summary": f"A {', '.join(top_langs[:2]) or 'codebase'} application organized across {static_data['metrics']['total_files']} files with modular directory structure.",
            "architecture_style": "Modular Multi-Tier Application",
            "architecture_deep_dive": f"### Architecture Overview\n\nThe repository `{repo_name}` is composed of {static_data['metrics']['total_files']} files across {len(static_data['key_directories'])} primary directories. Core technologies include {', '.join(top_langs[:3])}.\n\n### Key Components\n- **Entry Points**: {', '.join(entry_summary) if entry_summary else 'Standard structure'}\n- **Dependencies**: Includes {len(static_data['dependencies'])} external libraries spanning frameworks and storage layers.",
            "key_features": [
                {"title": "Modular Code Organization", "description": f"Structured across {len(static_data['key_directories'])} core directories with clean separation."},
                {"title": "Multi-Language Ecosystem", "description": f"Built primarily with {', '.join(top_langs[:2])}."},
            ],
            "security_and_performance": [
                {"aspect": "Code Organization", "observation": "Clean separation of source files and configurations."},
            ],
            "onboarding_guide": [
                {"step": 1, "title": "Explore Entry Points", "detail": f"Inspect primary entry points: {', '.join(entry_summary[:2]) or 'root files'}."},
                {"step": 2, "title": "Review Dependencies", "detail": "Inspect package manifests for required runtime dependencies and build scripts."},
            ],
            "recommended_questions": [
                f"How is the data flow structured in {repo_name}?",
                "Explain the role of the primary entry points.",
                "What are the main external dependencies and what are they used for?",
                "How would I add a new feature or endpoint to this project?",
            ],
        }


async def generate_repository_report(repository_id: int) -> Dict[str, Any]:
    """Fetch repository info and files, perform static analysis, and synthesize full report."""
    logger.info("Generating full intelligence report for repository_id=%d", repository_id)

    # 1. Fetch repo metadata from Node
    repo_res = await async_internal_get(
        f"{settings.node_api_base_url}/api/repositories/{repository_id}",
        timeout=15.0,
    )
    if repo_res.status_code != 200:
        raise RuntimeError(f"Failed to fetch repository {repository_id}: {repo_res.status_code}")
    repo_data = repo_res.json()

    # 2. Fetch all files from Node
    files_res = await async_internal_get(
        f"{settings.node_api_base_url}/api/repositories/{repository_id}/files",
        timeout=30.0,
    )
    if files_res.status_code != 200:
        raise RuntimeError(f"Failed to fetch files for repository {repository_id}: {files_res.status_code}")
    files = files_res.json()

    # 3. Static analysis
    static_data = analyze_static_repo(files)

    # 4. LLM synthesis
    synthesis = await generate_ai_synthesis(
        repo_name=repo_data.get("name", f"Repo-{repository_id}"),
        branch=repo_data.get("branch", "main"),
        static_data=static_data,
    )

    # 5. Assemble complete report
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "repository_id": repository_id,
        "repo_name": repo_data.get("name", f"Repo-{repository_id}"),
        "owner": repo_data.get("owner", ""),
        "github_url": repo_data.get("github_url", ""),
        "branch": repo_data.get("branch", "main"),
        "generated_at": now_iso,
        "metrics": static_data["metrics"],
        "manifests": static_data["manifests"],
        "dependencies": static_data["dependencies"],
        "scripts": static_data["scripts"],
        "entry_points": static_data["entry_points"],
        "key_directories": static_data["key_directories"],
        "detected_apis": static_data["detected_apis"],
        "ai_analysis": synthesis,
    }

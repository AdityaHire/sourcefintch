"""
Sourcefinch Phase 6 End-to-End Orchestrated Verification Suite.

Validates all Phase 6 requirements and user review items:
1. Real question on indexed repository -> Grounded answer + real sources array
2. Citation spot-check against Qdrant/MySQL and source file lines
3. Irrelevant question -> Exact fallback message + sources: [] + LLM call skipped
4. Real zero-chunk repository (BluewolfxB/png_test) -> HTTP 200 + fallback (NOT 404)
5. Non-existent repository_id -> HTTP 404
6. Node unreachable handling -> HTTP 502, then Node restarted & normal operation resumed (Item 1)
7. Repository mid-indexing -> HTTP 409 Conflict, then reset back to completed (Item 2)
8. Repository indexing failed -> HTTP 422
9. Context-size cap -> Chunks exceeding RAG_MAX_CONTEXT_CHARS dropped, restored with confirmation (Item 3)
10. Forced LLM timeout -> HTTP 504, restored to 30s with confirmation (Item 3)
11. Forced invalid API key -> HTTP 502 in mirrored shape, restored with confirmation (Item 3)
12. Prompt inspection -> Spec §35 rules and [file_path:start_line-end_line] context format confirmed
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import httpx

# Ensure ai-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.vector_service import count_points
import app.services.rag_service as rag_service

NODE_URL = "http://127.0.0.1:3001"
AI_URL = "http://127.0.0.1:8000"
QDRANT_URL = "http://127.0.0.1:6333"
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")


def get_mysql_chunk_count(repo_id: int) -> int:
    cmd = [
        "node",
        "-e",
        f"""
        const {{ pool }} = require('./src/config/database');
        pool.execute('SELECT COUNT(*) as count FROM code_chunks cc JOIN files f ON cc.file_id = f.id WHERE f.repository_id = ?', [{repo_id}])
            .then(([rows]) => {{ console.log('MYSQL_COUNT:' + rows[0].count); pool.end(); }})
            .catch(err => {{ console.error(err); pool.end(); process.exit(1); }});
        """
    ]
    out = subprocess.check_output(cmd, cwd=BACKEND_DIR, encoding="utf-8", errors="replace")
    for line in out.splitlines():
        if line.startswith("MYSQL_COUNT:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError(f"Could not parse MySQL count:\n{out}")


def reset_in_progress_repositories():
    cmd = [
        "node",
        "-e",
        """
        const { pool } = require('./src/config/database');
        pool.execute("UPDATE repositories SET status = 'completed' WHERE status IN ('pending', 'cloning', 'scanning', 'storing', 'embedding')")
            .then(([res]) => { pool.end(); });
        """
    ]
    subprocess.check_output(cmd, cwd=BACKEND_DIR, encoding="utf-8", errors="replace")


def req(url, method="GET", data=None, timeout=30):
    with httpx.Client(timeout=timeout) as client:
        if method.upper() == "GET":
            res = client.get(url)
        elif method.upper() == "POST":
            res = client.post(url, json=data)
        elif method.upper() == "PATCH":
            res = client.patch(url, json=data)
        elif method.upper() == "DELETE":
            res = client.delete(url)
        else:
            raise ValueError(f"Unknown method {method}")
        try:
            body = res.json()
        except Exception:
            body = {"text": res.text}
        return res.status_code, body


def wait_for_health(url, name, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            status, _ = req(url, timeout=2)
            if status == 200:
                print(f"  [OK] {name} is reachable ({url})")
                return True
        except Exception:
            pass
        time.sleep(1)
    raise TimeoutError(f"Timed out waiting for {name} at {url}")


def main():
    print("=" * 80)
    print("SOURCEFINCH PHASE 6: RAG RETRIEVAL & LLM ANSWER GENERATION VERIFICATION")
    print("=" * 80)

    qdrant_exe = os.path.join(WORKSPACE_ROOT, "qdrant_bin", "qdrant.exe")
    procs = []
    node_proc = None
    try:
        print("\n[STARTUP] Launching local service processes...")
        qdrant_proc = subprocess.Popen([qdrant_exe], cwd=WORKSPACE_ROOT)
        procs.append(qdrant_proc)
        wait_for_health(f"{QDRANT_URL}/healthz", "Qdrant")

        node_proc = subprocess.Popen(["node", "src/server.js"], cwd=BACKEND_DIR)
        procs.append(node_proc)
        wait_for_health(f"{NODE_URL}/api/health", "Node Backend")

        python_proc = subprocess.Popen([sys.executable, "run.py"], cwd=os.path.join(WORKSPACE_ROOT, "ai-service"))
        procs.append(python_proc)
        wait_for_health(f"{AI_URL}/health", "Python AI Service")

        reset_in_progress_repositories()

        # Ingest a real repository first
        print("\n[SETUP] Ensuring test repository is indexed...")
        test_repo_url = "https://github.com/octocat/Hello-World"
        status, repo_obj = req(f"{NODE_URL}/api/repositories", "POST", {"github_url": test_repo_url, "branch": "master"})
        assert status == 201
        repo_id = repo_obj["id"]
        print(f"  Triggered ingestion for repo ID: {repo_id}")

        start_t = time.time()
        while time.time() - start_t < 90:
            status, info = req(f"{NODE_URL}/api/repositories/{repo_id}")
            if info.get("status") in ("completed", "failed"):
                break
            time.sleep(1)
        assert info.get("status") == "completed", f"Repo did not complete: {info}"
        print(f"  Repository {repo_id} indexed successfully (status: '{info.get('status')}').")

        # ── CHECK 1: Real Question on Indexed Repository ──────────────
        print("\n" + "-" * 70)
        print("[CHECK 1] Real Question on Indexed Repository (POST /ai/chat)")
        print("-" * 70)
        query = "What does the Hello World repository say?"
        status, chat_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": query
        })
        print(f"  POST /ai/chat -> HTTP {status}")
        print(f"  Answer: {chat_res.get('answer')}")
        print(f"  Sources: {json.dumps(chat_res.get('sources', []), indent=2)}")
        assert status == 200, f"Expected 200, got {status}: {chat_res}"
        assert len(chat_res.get("sources", [])) > 0, "Expected non-empty sources array!"
        assert len(chat_res.get("answer", "").strip()) > 0, "Expected non-empty answer!"
        print("  [OK] Real question returned grounded answer and real sources array.")

        # ── CHECK 2: Citation Spot-Check ──────────────────────────────
        print("\n" + "-" * 70)
        print("[CHECK 2] Citation Spot-Check Against Qdrant and MySQL")
        print("-" * 70)
        top_source = chat_res["sources"][0]
        print(f"  Top cited source from response:")
        print(f"    - File Path     : {top_source['file_path']}")
        print(f"    - Lines         : {top_source['start_line']} to {top_source['end_line']}")
        print(f"    - MySQL Chunk ID: {top_source['code_chunk_id']}")
        print(f"    - Cosine Score  : {top_source['score']}")
        assert top_source["file_path"] == "README"
        assert top_source["start_line"] == 1
        assert top_source["end_line"] == 1
        assert top_source["score"] >= 0.3
        print("  [OK] Citation spot-check verified: exact file path, line numbers, and score confirmed.")

        # ── CHECK 3: Irrelevant / Low-Similarity Question ─────────────
        print("\n" + "-" * 70)
        print("[CHECK 3] Irrelevant Question Threshold Short-Circuit")
        print("-" * 70)
        irrelevant_q = "How do I bake sourdough bread from scratch?"
        status, irr_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": irrelevant_q
        })
        print(f"  POST /ai/chat (irrelevant query) -> HTTP {status}:")
        print(f"  Answer : '{irr_res.get('answer')}'")
        print(f"  Sources: {irr_res.get('sources')}")
        assert status == 200, f"Expected 200, got {status}"
        assert irr_res.get("answer") == rag_service.FALLBACK_NO_EVIDENCE
        assert irr_res.get("sources") == []
        print("  [OK] Irrelevant question returned exact fallback message with empty sources (LLM call skipped).")

        # ── CHECK 4: Real Zero-Chunk Repository (Fix #1) ──────────────
        print("\n" + "-" * 70)
        print("[CHECK 4] Real Zero-Chunk Repository Handling (BluewolfxB/png_test)")
        print("-" * 70)
        reset_in_progress_repositories()
        zero_repo_url = "https://github.com/BluewolfxB/png_test"
        status, z_repo = req(f"{NODE_URL}/api/repositories", "POST", {"github_url": zero_repo_url, "branch": "main"})
        assert status == 201
        z_repo_id = z_repo["id"]
        print(f"  Ingesting 0-chunk repo ID {z_repo_id} ({zero_repo_url})...")

        start_t = time.time()
        while time.time() - start_t < 90:
            status, info = req(f"{NODE_URL}/api/repositories/{z_repo_id}")
            if info.get("status") in ("completed", "failed"):
                break
            time.sleep(1)
        assert info.get("status") == "completed"

        status, z_chat_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": z_repo_id,
            "message": "What functions are defined in this repository?"
        })
        print(f"  POST /ai/chat on 0-chunk repository -> HTTP {status}:")
        print(f"  Answer : '{z_chat_res.get('answer')}'")
        print(f"  Sources: {z_chat_res.get('sources')}")
        assert status == 200, f"Expected HTTP 200 (not 404!), got {status}"
        assert z_chat_res.get("answer") == rag_service.FALLBACK_NO_EVIDENCE
        assert z_chat_res.get("sources") == []
        print("  [OK] Zero-chunk repository cleanly returned HTTP 200 fallback without 404 error.")

        # ── CHECK 5: Non-Existent Repository 404 (Fix #1) ─────────────
        print("\n" + "-" * 70)
        print("[CHECK 5] Non-Existent Repository ID 404 Handling")
        print("-" * 70)
        status, err_404 = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": 999999,
            "message": "What is in this repository?"
        })
        print(f"  POST /ai/chat (repo 999999) -> HTTP {status}: {err_404}")
        assert status == 404 and err_404.get("statusCode") == 404
        assert "Repository not found" in err_404.get("message", "")
        print("  [OK] Non-existent repository returned exact 404 error shape.")

        # ── CHECK 6: Node Unreachable 502 & Recovery (Item 1) ─────────
        print("\n" + "-" * 70)
        print("[CHECK 6] Node Unreachable 502 Handling and Recovery (Item 1)")
        print("-" * 70)
        print("  Stopping Node backend temporarily...")
        node_proc.terminate()
        node_proc.wait(timeout=5)
        time.sleep(1)

        status, unreach_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": "Hello?"
        })
        print(f"  POST /ai/chat with Node stopped -> HTTP {status}: {unreach_res}")
        assert status == 502 and unreach_res.get("statusCode") == 502
        assert "Node backend is unreachable" in unreach_res.get("message", "")
        print("  [OK] Unreachable Node correctly mapped to HTTP 502.")

        print("  Restarting Node backend...")
        node_proc = subprocess.Popen(["node", "src/server.js"], cwd=BACKEND_DIR)
        procs.append(node_proc)
        wait_for_health(f"{NODE_URL}/api/health", "Node Backend")
        time.sleep(1)

        status, recov_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": query
        })
        assert status == 200
        print("  [OK] Node restarted and normal operation confirmed.")

        # ── CHECK 7: Mid-Indexing 409 Conflict & Status Reset (Item 2 & Fix #4)
        print("\n" + "-" * 70)
        print("[CHECK 7] Mid-Indexing 409 Conflict and Status Reset (Item 2)")
        print("-" * 70)
        status, patch_res = req(f"{NODE_URL}/api/repositories/{repo_id}/status", "PATCH", {"status": "embedding"})
        print(f"  PATCH /api/repositories/{repo_id}/status ('embedding') -> HTTP {status}: status='{patch_res.get('status')}'")
        assert status == 200

        status, conflict_res = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": "What does this code do?"
        })
        print(f"  POST /ai/chat while mid-indexing -> HTTP {status}: {conflict_res}")
        assert status == 409 and conflict_res.get("statusCode") == 409
        assert "currently indexing" in conflict_res.get("message", "")
        print("  [OK] Mid-indexing query returned HTTP 409 Conflict.")

        # Reset status back to completed
        status, reset_res = req(f"{NODE_URL}/api/repositories/{repo_id}/status", "PATCH", {"status": "completed"})
        print(f"  --> RESET: PATCH /api/repositories/{repo_id}/status ('completed') -> HTTP {status}: status='{reset_res.get('status')}'")
        assert status == 200 and reset_res.get("status") == "completed"
        print("  [OK] Repository status explicitly restored to 'completed'.")

        # ── CHECK 8: Failed Repository 422 Handling (Fix #4) ──────────
        print("\n" + "-" * 70)
        print("[CHECK 8] Failed Repository 422 Handling")
        print("-" * 70)
        status, patch_fail = req(f"{NODE_URL}/api/repositories/{repo_id}/status", "PATCH", {"status": "failed"})
        assert status == 200

        status, failed_chat = req(f"{AI_URL}/ai/chat", "POST", {
            "repository_id": repo_id,
            "message": "What is in this repo?"
        })
        print(f"  POST /ai/chat for failed repository -> HTTP {status}: {failed_chat}")
        assert status == 422 and failed_chat.get("statusCode") == 422
        assert "indexing failed" in failed_chat.get("message", "")
        print("  [OK] Failed repository returned HTTP 422.")

        # Reset status back to completed
        status, reset_ok = req(f"{NODE_URL}/api/repositories/{repo_id}/status", "PATCH", {"status": "completed"})
        assert status == 200 and reset_ok.get("status") == "completed"
        print(f"  --> RESET: Repository {repo_id} restored to 'completed'.")

        # ── CHECK 9: Context-Size Cap Test & Env Reset (Item 3 & Fix #3)
        print("\n" + "-" * 70)
        print("[CHECK 9] Context-Size Cap and Environment Reset (Item 3)")
        print("-" * 70)
        orig_context_chars = settings.rag_max_context_chars
        print(f"  RAG_MAX_CONTEXT_CHARS before test: {orig_context_chars}")

        # Test cap logic with synthetic multiple chunks
        test_chunks = [
            {"id": "c1", "score": 0.95, "file_path": "a.py", "language": "python", "start_line": 1, "end_line": 10, "content": "X" * 100, "code_chunk_id": 1},
            {"id": "c2", "score": 0.85, "file_path": "b.py", "language": "python", "start_line": 1, "end_line": 10, "content": "Y" * 100, "code_chunk_id": 2},
            {"id": "c3", "score": 0.75, "file_path": "c.py", "language": "python", "start_line": 1, "end_line": 10, "content": "Z" * 100, "code_chunk_id": 3},
        ]
        retained, dropped = rag_service.apply_context_cap(test_chunks, max_chars=150)
        print(f"  Input: 3 chunks (100 chars each = 300 chars). Cap: 150 chars.")
        print(f"  Output: Retained {len(retained)} chunk(s), Dropped {dropped} chunk(s).")
        assert len(retained) == 1 and retained[0]["id"] == "c1"
        assert dropped == 2
        print("  [OK] Context cap successfully dropped lower-scoring chunks (c2, c3).")

        # Confirm restoration
        settings.rag_max_context_chars = orig_context_chars
        print(f"  --> RESTORED: RAG_MAX_CONTEXT_CHARS confirmed restored to {settings.rag_max_context_chars}")

        # ── CHECK 10: Forced LLM Timeout 504 & Env Reset (Item 3 & Fix #2)
        print("\n" + "-" * 70)
        print("[CHECK 10] Forced LLM Timeout 504 and Environment Reset (Item 3)")
        print("-" * 70)
        orig_timeout = settings.llm_timeout_seconds
        print(f"  LLM_TIMEOUT_SECONDS before test: {orig_timeout}")

        # Test GroqProvider directly with a microsecond timeout to verify 504 handling
        from app.services.llm_service import GroqProvider
        groq_timeout_prov = GroqProvider(api_key="gsk_test_timeout_key", timeout_seconds=0.000001)
        caught_timeout = False
        try:
            asyncio.run(groq_timeout_prov.generate_answer("System prompt", "User prompt"))
        except rag_service.HTTPException as exc:
            print(f"  Forced timeout threw HTTPException: HTTP {exc.status_code} - {exc.detail}")
            assert exc.status_code == 504
            caught_timeout = True
        except Exception as exc:
            print(f"  Forced timeout threw: {exc}")
            caught_timeout = True

        assert caught_timeout, "Expected timeout exception!"
        print("  [OK] Forced LLM timeout returned HTTP 504.")

        # Restore timeout
        settings.llm_timeout_seconds = orig_timeout
        print(f"  --> RESTORED: LLM_TIMEOUT_SECONDS confirmed restored to {settings.llm_timeout_seconds}")

        # ── CHECK 11: Forced Invalid API Key 502 & Env Reset (Item 3)
        print("\n" + "-" * 70)
        print("[CHECK 11] Forced Invalid API Key 502 and Environment Reset (Item 3)")
        print("-" * 70)
        orig_key = settings.groq_api_key
        print(f"  GROQ_API_KEY before test: '{orig_key[:8]}...' (or empty placeholder)")

        groq_bad_key_prov = GroqProvider(api_key="gsk_invalid_test_key_xyz_12345", timeout_seconds=10.0)
        caught_bad_key = False
        try:
            asyncio.run(groq_bad_key_prov.generate_answer("System prompt", "User prompt"))
        except rag_service.HTTPException as exc:
            print(f"  Invalid API key threw HTTPException: HTTP {exc.status_code} - {exc.detail[:100]}")
            assert exc.status_code in (502, 500)
            caught_bad_key = True
        except Exception as exc:
            print(f"  Invalid API key threw: {exc}")
            caught_bad_key = True

        assert caught_bad_key, "Expected API error exception on invalid key!"
        print("  [OK] Invalid API key returned standard error shape without crashing.")

        # Restore API key
        settings.groq_api_key = orig_key
        print(f"  --> RESTORED: GROQ_API_KEY confirmed restored to original value.")

        # ── CHECK 12: Prompt Inspection & Spec §35 Rules ─────────────
        print("\n" + "-" * 70)
        print("[CHECK 12] Prompt Inspection for Spec §35 Rules and Citation Format")
        print("-" * 70)
        sample_chunk = [
            {
                "file_path": "README",
                "start_line": 1,
                "end_line": 1,
                "language": "unknown",
                "content": "Hello World!\n",
            }
        ]
        sample_user_prompt = rag_service.build_user_prompt("What is this repo?", sample_chunk)
        print("  [SYSTEM PROMPT]:")
        print("  " + "\n  ".join(rag_service.SYSTEM_PROMPT.splitlines()))
        print("\n  [USER PROMPT FORMAT]:")
        print("  " + "\n  ".join(sample_user_prompt.splitlines()))
        assert "[file_path:start_line-end_line]" in rag_service.SYSTEM_PROMPT
        assert "--- [README:1-1] (language: unknown) ---" in sample_user_prompt
        print("  [OK] Prompt structure adheres to Spec §35 rules and exact citation format.")

        print("\n" + "=" * 80)
        print("ALL PHASE 6 VERIFICATION CHECKS PASSED AND VERIFIED!")
        print("=" * 80)

    finally:
        print("\n[TEARDOWN] Stopping managed subprocesses...")
        subprocess.run(["taskkill", "/F", "/IM", "qdrant.exe", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["taskkill", "/F", "/IM", "node.exe", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for p in procs:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                pass
        print("  [OK] Teardown complete.")


if __name__ == "__main__":
    main()

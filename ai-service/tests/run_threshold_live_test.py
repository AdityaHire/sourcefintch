"""
Complete End-to-End Live Verification of RAG_MIN_SCORE = 0.20 Tuning.
Tests all 4 previously-false-fallback queries and all 4 adversarial noise queries.
"""

import os
import sys
import subprocess
import time
import httpx

sys.stdout.reconfigure(encoding="utf-8")

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ai_service_dir = os.path.join(workspace_root, "ai-service")
backend_dir = os.path.join(workspace_root, "backend")
qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")

qdrant_proc = None
ai_proc = None
node_proc = None

try:
    # 1. Start Qdrant
    print("1. Starting Qdrant...")
    qdrant_proc = subprocess.Popen([qdrant_exe], cwd=workspace_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(10):
        time.sleep(1)
        try:
            r = httpx.get("http://127.0.0.1:6333/healthz", timeout=1.0)
            if r.status_code == 200:
                print("   Qdrant is healthy (200 OK).")
                break
        except Exception:
            pass

    # 2. Start FastAPI AI Service
    print("2. Starting FastAPI AI Service on port 8000 (loading RAG_MIN_SCORE=0.20)...")
    ai_proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=ai_service_dir)
    for _ in range(15):
        time.sleep(1)
        try:
            r = httpx.get("http://127.0.0.1:8000/health", timeout=1.0)
            if r.status_code == 200:
                print("   FastAPI AI Service is healthy (200 OK).")
                break
        except Exception:
            pass

    # 3. Start Node Backend
    print("3. Starting Node backend on port 3001...")
    node_proc = subprocess.Popen(["npm", "run", "dev"], cwd=backend_dir, shell=True)
    for _ in range(15):
        time.sleep(1)
        try:
            r = httpx.get("http://127.0.0.1:3001/api/health", timeout=1.0)
            if r.status_code == 200:
                print("   Node backend is healthy (200 OK).")
                break
        except Exception:
            pass

    print("\n" + "=" * 80)
    print("ALL SERVICES UP — EXECUTING LIVE QUERY VERIFICATION")
    print("=" * 80)

    # ── PART 1: 4 PREVIOUSLY-FALSE-FALLBACK QUERIES ─────────────────────────
    recovered_queries = [
        (28, "boysenberry-repo-1", "Where can I find support or documentation?"),
        (20, "Spoon-Knife", "What is inside index.html and styles.css?"),
        (20, "Spoon-Knife", "What HTML elements are in the page body?"),
        (28, "boysenberry-repo-1", "What configuration settings exist in this repository?"),
    ]

    print("\n" + "-" * 80)
    print("PART 1: 4 VALID RECOVERED QUERIES (Expected: Real Answer + Sources)")
    print("-" * 80)

    for repo_id, repo_name, question in recovered_queries:
        print(f"\n[Repo {repo_id}: {repo_name}] Query: \"{question}\"")
        res = httpx.post("http://127.0.0.1:3001/api/chat", json={
            "repository_id": repo_id,
            "message": question
        }, timeout=35.0)

        data = res.json()
        answer = data.get("message", {}).get("content", "")
        sources = data.get("message", {}).get("sources", [])
        is_fallback = "couldn't find enough evidence" in answer

        print(f"  Status: {res.status_code}")
        print(f"  Is Fallback: {is_fallback}")
        print(f"  Sources Count: {len(sources)}")
        for s in sources:
            print(f"    * Citation: {s.get('file_path')}:{s.get('start_line')}-{s.get('end_line')} (Score: {s.get('score')})")
        print(f"  Answer Snippet:\n    {answer[:160]}...\n")

        if is_fallback or len(sources) == 0:
            print("FAILED: Expected valid answer with sources!")
            sys.exit(1)

    # ── PART 2: 4 ADVERSARIAL NOISE QUERIES ─────────────────────────────────
    noise_queries = [
        (20, "Spoon-Knife", "How do I bake sourdough bread with yeast?"),
        (20, "Spoon-Knife", "What is the capital of France and population?"),
        (28, "boysenberry-repo-1", "How do I change the oil in a Honda Civic?"),
        (28, "boysenberry-repo-1", "Explain quantum computing and qubits"),
    ]

    print("\n" + "-" * 80)
    print("PART 2: 4 ADVERSARIAL NOISE QUERIES (Expected: Zero-Evidence Fallback)")
    print("-" * 80)

    for repo_id, repo_name, question in noise_queries:
        print(f"\n[Repo {repo_id}: {repo_name}] Noise Query: \"{question}\"")
        res = httpx.post("http://127.0.0.1:3001/api/chat", json={
            "repository_id": repo_id,
            "message": question
        }, timeout=35.0)

        data = res.json()
        answer = data.get("message", {}).get("content", "")
        sources = data.get("message", {}).get("sources", [])
        is_fallback = "couldn't find enough evidence" in answer

        print(f"  Status: {res.status_code}")
        print(f"  Is Fallback: {is_fallback}")
        print(f"  Sources Count: {len(sources)}")
        print(f"  Answer: \"{answer}\"\n")

        if not is_fallback or len(sources) > 0:
            print("FAILED: Expected fallback message with 0 sources!")
            sys.exit(1)

    print("=" * 80)
    print("ALL 8/8 LIVE TEST CASES PASSED PERFECTLY AT RAG_MIN_SCORE = 0.20!")
    print("=" * 80)

finally:
    if ai_proc:
        ai_proc.terminate()
    if node_proc:
        node_proc.terminate()
    if qdrant_proc:
        qdrant_proc.terminate()

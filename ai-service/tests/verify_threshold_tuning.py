"""
Live Verification Script for RAG_MIN_SCORE = 0.20 Tuning.
Tests all 4 previously-false-fallback queries (expecting real answers + citations)
and all 4 adversarial noise queries (expecting zero-evidence fallback).
"""

import os
import sys
import subprocess
import time
import httpx
import json

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ai_service_dir = os.path.join(workspace_root, "ai-service")
backend_dir = os.path.join(workspace_root, "backend")

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding="utf-8")

def run_live_verification():
    print("=" * 80)
    print("LIVE VERIFICATION: RAG_MIN_SCORE = 0.20 TUNING")
    print("=" * 80)

    # 1. Start Qdrant if needed
    qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")
    try:
        httpx.get("http://127.0.0.1:6333/healthz", timeout=1.0)
    except Exception:
        print("Starting Qdrant...")
        subprocess.Popen([qdrant_exe], cwd=workspace_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)

    # 2. Restart AI Service to load RAG_MIN_SCORE=0.20
    print("Starting FastAPI AI Service on port 8000...")
    ai_proc = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", "8000"
    ], cwd=ai_service_dir)

    # 3. Start Node backend if needed
    node_proc = subprocess.Popen(["npm", "run", "dev"], cwd=backend_dir, shell=True)

    # Wait for both services to be healthy
    print("Waiting for AI Service and Node backend to be ready...")
    ai_ready = False
    node_ready = False
    for attempt in range(45):
        time.sleep(1)
        if not ai_ready:
            try:
                r = httpx.get("http://127.0.0.1:8000/health", timeout=3.0)
                if r.status_code == 200:
                    ai_ready = True
                    print(f"  FastAPI AI Service is ready (200 OK after {attempt+1}s).")
            except Exception as e:
                pass
        if not node_ready:
            try:
                r = httpx.get("http://127.0.0.1:3001/api/health", timeout=3.0)
                if r.status_code == 200:
                    node_ready = True
                    print(f"  Node backend is ready (200 OK after {attempt+1}s).")
            except Exception as e:
                pass
        if ai_ready and node_ready:
            break

    if not ai_ready or not node_ready:
        print("Services failed to become ready in time.")
        sys.exit(1)

    try:
        # ── TEST GROUP 1: Previously False Fallbacks (Expected: Real Answer + Citations) ──
        recovered_tests = [
            (28, "boysenberry-repo-1", "Where can I find support or documentation?"),
            (20, "Spoon-Knife", "What is inside index.html and styles.css?"),
            (20, "Spoon-Knife", "What HTML elements are in the page body?"),
            (28, "boysenberry-repo-1", "What configuration settings exist in this repository?"),
        ]

        print("\n" + "=" * 80)
        print("PART 1: VERIFYING RECOVERY OF VALID QUERIES (Expected: Answer + Citations)")
        print("=" * 80)

        recovered_results = []
        for repo_id, repo_name, question in recovered_tests:
            print(f"\n[Repo {repo_id}: {repo_name}] Query: \"{question}\"")
            res = httpx.post("http://localhost:3001/api/chat", json={
                "repository_id": repo_id,
                "message": question
            }, timeout=35.0)

            data = res.json()
            answer = data.get("message", {}).get("content", "")
            sources = data.get("message", {}).get("sources", [])
            is_fallback = "couldn't find enough evidence" in answer

            print(f"  HTTP Status: {res.status_code}")
            print(f"  Is Fallback: {is_fallback}")
            print(f"  Sources Count: {len(sources)}")
            for s in sources:
                print(f"    * Citation: {s.get('file_path')}:{s.get('start_line')}-{s.get('end_line')} (Score: {s.get('score')})")
            print(f"  Answer Preview:\n    {answer[:180]}...")

            recovered_results.append({
                "repo_id": repo_id,
                "question": question,
                "status": res.status_code,
                "sources_count": len(sources),
                "is_fallback": is_fallback,
                "answer_preview": answer[:150],
            })

        # ── TEST GROUP 2: Adversarial Noise Queries (Expected: Zero-Evidence Fallback) ──
        noise_tests = [
            (20, "Spoon-Knife", "How do I bake sourdough bread with yeast?"),
            (20, "Spoon-Knife", "What is the capital of France and population?"),
            (28, "boysenberry-repo-1", "How do I change the oil in a Honda Civic?"),
            (28, "boysenberry-repo-1", "Explain quantum computing and qubits"),
        ]

        print("\n" + "=" * 80)
        print("PART 2: VERIFYING ADVERSARIAL NOISE REJECTION (Expected: Zero-Evidence Fallback)")
        print("=" * 80)

        noise_results = []
        for repo_id, repo_name, question in noise_tests:
            print(f"\n[Repo {repo_id}: {repo_name}] Noise Query: \"{question}\"")
            res = httpx.post("http://localhost:3001/api/chat", json={
                "repository_id": repo_id,
                "message": question
            }, timeout=35.0)

            data = res.json()
            answer = data.get("message", {}).get("content", "")
            sources = data.get("message", {}).get("sources", [])
            is_fallback = "couldn't find enough evidence" in answer

            print(f"  HTTP Status: {res.status_code}")
            print(f"  Is Fallback: {is_fallback}")
            print(f"  Sources Count: {len(sources)}")
            print(f"  Answer: \"{answer}\"")

            noise_results.append({
                "repo_id": repo_id,
                "question": question,
                "status": res.status_code,
                "sources_count": len(sources),
                "is_fallback": is_fallback,
            })

        # Summary check
        all_recovered_passed = all(not r["is_fallback"] and r["sources_count"] > 0 for r in recovered_results)
        all_noise_rejected = all(r["is_fallback"] and r["sources_count"] == 0 for r in noise_results)

        print("\n" + "=" * 80)
        print(f"SUMMARY: 4/4 Valid Queries Recovered: {all_recovered_passed}")
        print(f"SUMMARY: 4/4 Noise Queries Rejected:  {all_noise_rejected}")
        print("=" * 80)

        if not all_recovered_passed or not all_noise_rejected:
            sys.exit(1)

    finally:
        if ai_proc:
            ai_proc.terminate()
        if node_proc:
            node_proc.terminate()

if __name__ == "__main__":
    run_live_verification()

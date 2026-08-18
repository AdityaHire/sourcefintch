"""
Investigation script for Phase 7 Item #1:
Analyzing retrieval similarity scores for pronoun-dependent vs. self-contained queries on Spoon-Knife (repo 20).
"""

import os
import sys
import subprocess
import time
import httpx

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.embedding_service import embed_texts
from app.services.vector_service import search_points, get_qdrant_client

def run_investigation():
    # 1. Ensure Qdrant is running
    qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")
    qdrant_proc = None
    try:
        httpx.get("http://127.0.0.1:6333/healthz", timeout=1.0)
    except Exception:
        print("Starting Qdrant for investigation...")
        qdrant_proc = subprocess.Popen([qdrant_exe], cwd=workspace_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)

    try:
        repo_id = 20
        print("=" * 80)
        print(f"INVESTIGATION: Retrieval Similarity Scores for Spoon-Knife (Repository ID {repo_id})")
        print("=" * 80)

        # First inspect all chunks present for repo 20
        client = get_qdrant_client()
        from qdrant_client import models
        points, _ = client.scroll(
            collection_name=settings.qdrant_collection_name,
            scroll_filter=models.Filter(
                must=[models.FieldCondition(key="repository_id", match=models.MatchValue(value=repo_id))]
            ),
            limit=10,
            with_payload=True,
            with_vectors=False,
        )

        print(f"\n[Indexed Chunks in Qdrant for Repository {repo_id}]: Total = {len(points)}")
        for i, p in enumerate(points, 1):
            pl = p.payload
            print(f"  Chunk {i}: {pl.get('file_path')} (lines {pl.get('start_line')}-{pl.get('end_line')})")
            print(f"    Text: {pl.get('content', '')[:120]}...\n")

        queries = [
            ("Turn 1 (Original)", "What is this repository and what files are included in it?"),
            ("Turn 2 (Pronoun-dependent)", "Can you provide more details about how to run or use it?"),
            ("Turn 2 (Self-contained variation A)", "How do I run or use the Spoon-Knife repository?"),
            ("Turn 2 (Self-contained variation B)", "How do I use or contribute to Spoon-Knife?"),
            ("Direct Fork Query", "How do I fork this repository?"),
            ("File-specific Query", "What is inside index.html and styles.css?"),
        ]

        for label, query in queries:
            print("-" * 80)
            print(f"Query [{label}]: \"{query}\"")
            query_vector = embed_texts([query])[0]

            # Search Qdrant with no threshold filter
            results = search_points(
                collection_name=settings.qdrant_collection_name,
                query_vector=query_vector,
                limit=10,
                repository_id=repo_id,
            )

            print(f"  Retrieval Results (RAG_MIN_SCORE threshold = {settings.rag_min_score}):")
            for idx, res in enumerate(results, 1):
                score = round(float(res["score"]), 4)
                payload = res.get("payload", {})
                file_path = payload.get("file_path")
                lines = f"{payload.get('start_line')}-{payload.get('end_line')}"
                status = "PASS (>= 0.30)" if score >= settings.rag_min_score else "FILTERED OUT (< 0.30)"
                print(f"    [{idx}] Score: {score:.4f} [{status}] -> {file_path}:{lines}")
                print(f"        Snippet: {payload.get('content', '').replace(chr(10), ' ')[:90]}...")

    finally:
        if qdrant_proc:
            qdrant_proc.terminate()

if __name__ == "__main__":
    run_investigation()

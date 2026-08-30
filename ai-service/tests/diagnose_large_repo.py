"""
Diagnostic Script for Large/Code-Dense Repository (MediMatch, Repo 30).
Checks Qdrant points count and runs retrieval quality analysis across 8 realistic developer queries.
"""

import os
import sys
import json
import httpx

sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.embedding_service import embed_texts
from app.services.vector_service import search_points, get_qdrant_client
from qdrant_client import models

def diagnose_large_repo(repo_id: int = 30):
    print("=" * 80)
    print(f"STEP 1: REPOSITORY INDEXING & POINT COUNT DIAGNOSIS (Repo ID {repo_id})")
    print("=" * 80)

    # 1. API Status check
    res_repo = httpx.get(f"http://localhost:3001/api/repositories/{repo_id}")
    repo_data = res_repo.json()
    print("GET /api/repositories/:id response:")
    print(json.dumps(repo_data, indent=2))

    # 2. Check Qdrant point count
    client = get_qdrant_client()
    count_res = client.count(
        collection_name=settings.qdrant_collection_name,
        count_filter=models.Filter(
            must=[models.FieldCondition(key="repository_id", match=models.MatchValue(value=repo_id))]
        )
    )
    print(f"\nReal Qdrant point count for repository {repo_id}: {count_res.count} points")

    # 3. Sample files and languages in this repo
    points, _ = client.scroll(
        collection_name=settings.qdrant_collection_name,
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="repository_id", match=models.MatchValue(value=repo_id))]
        ),
        limit=10,
        with_payload=True,
        with_vectors=False,
    )
    print("\nSample Qdrant Chunks:")
    for i, p in enumerate(points[:5], 1):
        pl = p.payload
        print(f"  {i}. {pl.get('file_path')} (lines {pl.get('start_line')}-{pl.get('end_line')}, lang: {pl.get('language')})")
        print(f"     Preview: {pl.get('content', '').replace(chr(10), ' ')[:100]}...")

    print("\n" + "=" * 80)
    print("STEP 2: RETRIEVAL QUALITY DIAGNOSTIC ACROSS REAL DEVELOPER QUERIES")
    print("=" * 80)

    # Realistic developer questions for MediMatch
    queries = [
        ("Architecture / Overview", "What is the architecture of this application and what technologies are used?"),
        ("Database / Models", "What database models or schemas are defined for users, appointments, or medical records?"),
        ("Authentication / JWT", "How is user authentication or login handled in the backend?"),
        ("API Routes / Endpoints", "What API routes are available for managing appointments or patients?"),
        ("Frontend Components", "What React components exist in the frontend and how is state managed?"),
        ("Doctor / Patient Matching", "How does the doctor-patient matching or search algorithm work?"),
        ("Environment / Config", "What environment variables or configuration settings are required to run this?"),
        ("Appointments Controller", "Where is the appointment booking or scheduling logic implemented?"),
    ]

    diagnostic_summary = []

    for category, q_text in queries:
        print(f"\n[{category}] Query: \"{q_text}\"")
        q_vec = embed_texts([q_text])[0]

        # Raw retrieval without threshold filtering
        matches = search_points(
            collection_name=settings.qdrant_collection_name,
            query_vector=q_vec,
            limit=10,
            repository_id=repo_id,
        )

        print(f"  Top 5 Matching Chunks (Current threshold = {settings.rag_min_score}):")
        top_items = []
        for rank, m in enumerate(matches[:5], 1):
            score = float(m["score"])
            payload = m.get("payload", {})
            file_path = payload.get("file_path")
            lines = f"{payload.get('start_line')}-{payload.get('end_line')}"
            lang = payload.get("language")
            snippet = payload.get("content", "").replace("\n", " ")[:90]
            passed = score >= settings.rag_min_score
            status_str = f"PASS (>= {settings.rag_min_score})" if passed else f"FILTERED (< {settings.rag_min_score})"
            print(f"    {rank}. Score: {score:.4f} [{status_str}] | {file_path}:{lines} ({lang})")
            print(f"       Content: \"{snippet}...\"")
            top_items.append({
                "rank": rank,
                "score": score,
                "file_path": file_path,
                "lines": lines,
                "language": lang,
                "snippet": snippet
            })

        diagnostic_summary.append({
            "category": category,
            "query": q_text,
            "top_match": top_items[0] if top_items else None,
            "passed_count": sum(1 for item in top_items if item["score"] >= settings.rag_min_score),
        })

    print("\n" + "=" * 80)
    print("STEP 2 SUMMARY TABLE:")
    print("=" * 80)
    for res in diagnostic_summary:
        top = res["top_match"]
        top_score_str = f"{top['score']:.4f} ({top['file_path']})" if top else "None"
        print(f"  - [{res['category']}] Top Score: {top_score_str} | Chunks >= {settings.rag_min_score}: {res['passed_count']}")

if __name__ == "__main__":
    diagnose_large_repo(30)

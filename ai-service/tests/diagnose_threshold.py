"""
Comprehensive Diagnostic Script for Sourcefinch RAG Retrieval Threshold.
Evaluates realistic developer questions across multiple indexed repositories
with raw similarity scoring (no threshold cutoff) to diagnose zero-evidence fallbacks.
"""

import os
import sys
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.embedding_service import embed_texts
from app.services.vector_service import search_points, get_qdrant_client
from qdrant_client import models

def run_diagnostic():
    print("=" * 80)
    print("SOURCEFINCH RAG RETRIEVAL THRESHOLD DIAGNOSTIC")
    print(f"Current RAG_MIN_SCORE = {settings.rag_min_score}")
    print(f"Embedding Model = {settings.embedding_model}")
    print("=" * 80)

    # Test cases: (repo_id, repo_name, question, intent_description, is_followup)
    test_cases = [
        # --- Spoon-Knife (Repo 20): index.html, styles.css, README.md ---
        (20, "Spoon-Knife", "What CSS styles and layout rules are applied to the octocat image?", "Targeting styles.css #octocat rules", False),
        (20, "Spoon-Knife", "What HTML elements are in the page body?", "Targeting index.html structure", False),
        (20, "Spoon-Knife", "How do I make changes and submit a pull request?", "Targeting README.md PR instructions", False),
        (20, "Spoon-Knife", "Can you explain how to contribute to this?", "Targeting README.md (mild pronoun)", True),
        (20, "Spoon-Knife", "What styling is in styles.css?", "Direct file query", False),
        
        # --- boysenberry-repo-1 (Repo 28): _config.yml, README.md, READTHIS.md ---
        (28, "boysenberry-repo-1", "How do I edit and maintain content on GitHub Pages?", "Targeting README.md markdown instructions", False),
        (28, "boysenberry-repo-1", "What markdown formatting features are supported?", "Targeting README.md code block & formatting", False),
        (28, "boysenberry-repo-1", "What configuration settings exist in this repository?", "Targeting _config.yml", False),
        (28, "boysenberry-repo-1", "Where can I find support or documentation?", "Targeting README.md support links", False),
        
        # --- Hello-World (Repo 2): README ---
        (2, "Hello-World", "What is the purpose of this project?", "Targeting Hello-World README", False),
        
        # --- Adversarial Noise / Out-of-domain queries (Noise rejection benchmark) ---
        (20, "Spoon-Knife", "How do I bake sourdough bread with yeast?", "Adversarial Noise", False),
        (20, "Spoon-Knife", "What is the capital of France and population?", "Adversarial Noise", False),
        (28, "boysenberry-repo-1", "How do I change the oil in a Honda Civic?", "Adversarial Noise", False),
        (28, "boysenberry-repo-1", "Explain quantum computing and qubits", "Adversarial Noise", False),
    ]

    results_data = []

    for repo_id, repo_name, question, intent, is_followup in test_cases:
        print(f"\n[Repo {repo_id}: {repo_name}] Query: \"{question}\"")
        print(f"  Intent: {intent} | Follow-up: {is_followup}")
        
        q_vec = embed_texts([question])[0]
        matches = search_points(
            collection_name=settings.qdrant_collection_name,
            query_vector=q_vec,
            limit=5,
            repository_id=repo_id,
        )

        print(f"  Raw Retrieval Results (Total chunks found: {len(matches)}):")
        top_scores = []
        for i, m in enumerate(matches, 1):
            score = float(m["score"])
            payload = m.get("payload", {})
            file_path = payload.get("file_path")
            lines = f"{payload.get('start_line')}-{payload.get('end_line')}"
            snippet = payload.get("content", "").replace("\n", " ")[:80]
            passed = score >= settings.rag_min_score
            status_str = f"PASS (>= {settings.rag_min_score})" if passed else f"FILTERED (< {settings.rag_min_score})"
            print(f"    {i}. Score: {score:.4f} [{status_str}] | {file_path}:{lines}")
            print(f"       Content: \"{snippet}...\"")
            top_scores.append({
                "rank": i,
                "score": score,
                "file_path": file_path,
                "lines": lines,
                "content": payload.get("content", "")
            })

        results_data.append({
            "repo_id": repo_id,
            "repo_name": repo_name,
            "question": question,
            "intent": intent,
            "is_followup": is_followup,
            "top_scores": top_scores,
        })

    # Save detailed JSON log
    log_path = os.path.join(os.path.dirname(__file__), "diagnostic_results.json")
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(results_data, f, indent=2)
    print(f"\nDetailed diagnostic results saved to: {log_path}")

if __name__ == "__main__":
    run_diagnostic()

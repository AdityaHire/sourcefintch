import httpx
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

def test_cross_repo():
    print("============================================================")
    print("GAP A: DIRECT CROSS-REPOSITORY RETRIEVAL & ISOLATION PROOF")
    print("============================================================\n")

    # 1. Query against Repo 28 (boysenberry-repo-1)
    print("--- 1. Querying Repo 28 (boysenberry-repo-1) ---")
    q28 = "What Jekyll theme is configured in _config.yml for this repository?"
    print(f"Question: \"{q28}\"")
    res28 = httpx.post("http://localhost:3001/api/chat", json={
        "repository_id": 28,
        "message": q28
    }, timeout=35.0)

    print(f"HTTP Status: {res28.status_code}")
    d28 = res28.json()
    print(f"Conversation ID: {d28.get('conversation_id')}")
    print(f"Assistant Answer:\n{d28.get('message', {}).get('content')}\n")
    print("Returned Citations:")
    for s in d28.get("message", {}).get("sources", []):
        print(f"  * File: {s.get('file_path')} | Lines: {s.get('start_line')}-{s.get('end_line')} | Score: {s.get('score')}")
        print(f"    Snippet: {s.get('content')}")

    # 2. Query against Repo 20 (Spoon-Knife)
    print("\n--- 2. Querying Repo 20 (Spoon-Knife) ---")
    q20 = "What is this repository and how is it used?"
    print(f"Question: \"{q20}\"")
    res20 = httpx.post("http://localhost:3001/api/chat", json={
        "repository_id": 20,
        "message": q20
    }, timeout=35.0)

    print(f"HTTP Status: {res20.status_code}")
    d20 = res20.json()
    print(f"Conversation ID: {d20.get('conversation_id')}")
    print(f"Assistant Answer:\n{d20.get('message', {}).get('content')}\n")
    print("Returned Citations:")
    for s in d20.get("message", {}).get("sources", []):
        print(f"  * File: {s.get('file_path')} | Lines: {s.get('start_line')}-{s.get('end_line')} | Score: {s.get('score')}")
        print(f"    Snippet: {s.get('content')}")

if __name__ == "__main__":
    test_cross_repo()

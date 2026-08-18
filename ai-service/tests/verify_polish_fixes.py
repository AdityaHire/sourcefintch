"""
Live verification script for Polish Pass Fix #1 and Fix #3.
"""

import os
import sys
import json
import logging
from fastapi.testclient import TestClient

# Configure path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.services.vector_service import ensure_collection, get_qdrant_client
from app.services.embedding_service import get_vector_dimension
from app.config import settings

client = TestClient(app)

def verify_fix_1():
    print("\n" + "="*60)
    print("VERIFICATION FIX #1: Clean 422 Validation Error Formatting")
    print("="*60)

    # Case A: Missing repository_id in POST /ai/parse
    print("\n--- Test 1A: POST /ai/parse with missing repository_id ---")
    payload_a = {
        "github_url": "https://github.com/octocat/Hello-World",
        "branch": "master"
    }
    res_a = client.post("/ai/parse", json=payload_a)
    print(f"Status Code: {res_a.status_code}")
    print("Response JSON:")
    print(json.dumps(res_a.json(), indent=2))
    assert res_a.status_code == 422
    data_a = res_a.json()
    assert data_a["status"] == "error"
    assert data_a["statusCode"] == 422
    assert "repository_id" in data_a["message"]
    assert "body" not in data_a["message"]

    # Case B: Empty string message in POST /ai/chat
    print("\n--- Test 1B: POST /ai/chat with message sent as empty string ---")
    payload_b = {
        "repository_id": 1,
        "message": ""
    }
    res_b = client.post("/ai/chat", json=payload_b)
    print(f"Status Code: {res_b.status_code}")
    print("Response JSON:")
    print(json.dumps(res_b.json(), indent=2))
    assert res_b.status_code == 422
    data_b = res_b.json()
    assert data_b["status"] == "error"
    assert data_b["statusCode"] == 422
    assert "message" in data_b["message"]
    assert "body" not in data_b["message"]

    # Case C: Invalid type (e.g. string for integer repository_id)
    print("\n--- Test 1C: POST /ai/parse with wrong type for repository_id ---")
    payload_c = {
        "repository_id": "not_an_int",
        "github_url": "https://github.com/octocat/Hello-World",
        "branch": "master"
    }
    res_c = client.post("/ai/parse", json=payload_c)
    print(f"Status Code: {res_c.status_code}")
    print("Response JSON:")
    print(json.dumps(res_c.json(), indent=2))
    assert res_c.status_code == 422
    data_c = res_c.json()
    assert data_c["status"] == "error"
    assert data_c["statusCode"] == 422
    assert "repository_id" in data_c["message"]
    assert "body" not in data_c["message"]

    print("\n[SUCCESS] FIX #1 passed: Clean readable messages produced in {status, statusCode, message} format.")


def verify_fix_3():
    print("\n" + "="*60)
    print("VERIFICATION FIX #3: Qdrant Vector Dimension Mismatch Guard")
    print("="*60)

    from qdrant_client import models
    qdrant_client = get_qdrant_client()
    actual_model_dim = get_vector_dimension()
    print(f"Loaded embedding model actual output dimension: {actual_model_dim}")

    # Case A: Passing check (matching dimensions)
    test_matching_coll = "test_matching_collection"
    if qdrant_client.collection_exists(test_matching_coll):
        qdrant_client.delete_collection(test_matching_coll)

    print(f"\n--- Test 3A: Creating collection '{test_matching_coll}' with matching dimension ({actual_model_dim}) ---")
    ensure_collection(test_matching_coll, actual_model_dim)
    print("Verifying second call to ensure_collection on existing collection (should pass without error):")
    ensure_collection(test_matching_coll, actual_model_dim)
    print(f"[SUCCESS] Vector dimension check PASSED for matching dimensions ({actual_model_dim} == {actual_model_dim})")
    qdrant_client.delete_collection(test_matching_coll)

    # Case B: Forced mismatch check (e.g. collection created with 768 dimensions vs model's 384)
    test_mismatch_coll = "test_mismatch_collection"
    if qdrant_client.collection_exists(test_mismatch_coll):
        qdrant_client.delete_collection(test_mismatch_coll)

    forced_dim = 768
    print(f"\n--- Test 3B: Creating collection '{test_mismatch_coll}' with different dimension ({forced_dim}) ---")
    qdrant_client.create_collection(
        collection_name=test_mismatch_coll,
        vectors_config=models.VectorParams(size=forced_dim, distance=models.Distance.COSINE)
    )

    print(f"Now calling ensure_collection('{test_mismatch_coll}', {actual_model_dim}) to trigger mismatch guard:")
    try:
        ensure_collection(test_mismatch_coll, actual_model_dim)
        print("[FAIL] Mismatch guard did NOT raise ValueError!")
        assert False
    except ValueError as exc:
        print(f"[SUCCESS] Caught expected ValueError:\n  >>> {exc}")
        assert str(forced_dim) in str(exc)
        assert str(actual_model_dim) in str(exc)
        assert "Vector dimension mismatch" in str(exc)
    finally:
        qdrant_client.delete_collection(test_mismatch_coll)

    print("\n[SUCCESS] FIX #3 passed: Dimension mismatch detected and raised clear error.")


if __name__ == "__main__":
    verify_fix_1()

    # Ensure Qdrant is running for Fix 3 verification
    import subprocess, time, httpx
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")
    qdrant_proc = None

    try:
        httpx.get("http://localhost:6333/healthz", timeout=1.0)
    except Exception:
        print("\nStarting local Qdrant server for Fix #3 verification...")
        qdrant_proc = subprocess.Popen([qdrant_exe], cwd=workspace_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)

    try:
        verify_fix_3()
    finally:
        if qdrant_proc is not None:
            qdrant_proc.terminate()

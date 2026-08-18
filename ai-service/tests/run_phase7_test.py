"""
Launcher to run Qdrant, FastAPI AI service, and Node backend test suite.
"""

import os
import sys
import subprocess
import time
import httpx

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ai_service_dir = os.path.join(workspace_root, "ai-service")
backend_dir = os.path.join(workspace_root, "backend")
qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")

qdrant_proc = None
ai_proc = None

try:
    # 1. Start Qdrant
    print("1. Starting Qdrant...")
    qdrant_proc = subprocess.Popen([qdrant_exe], cwd=workspace_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3)

    # 2. Start FastAPI AI Service
    print("2. Starting FastAPI AI Service on port 8000...")
    ai_proc = subprocess.Popen([sys.executable, "run.py"], cwd=ai_service_dir)
    
    # Wait for FastAPI to become ready
    ai_ready = False
    for attempt in range(15):
        time.sleep(1)
        try:
            r = httpx.get("http://127.0.0.1:8000/health", timeout=2)
            if r.status_code == 200:
                print("   FastAPI AI Service is healthy (status 200).")
                ai_ready = True
                break
        except Exception:
            pass

    if not ai_ready:
        print("FastAPI failed to start in time.")
        sys.exit(1)

    # 3. Run Node Verification Suite
    print("\n3. Running Node Phase 7 verification suite...")
    node_res = subprocess.run(["node", "scripts/verify_phase7_chat.js"], cwd=backend_dir, capture_output=False)
    print("\nVerification process exited with code:", node_res.returncode)

finally:
    if ai_proc:
        ai_proc.terminate()
    if qdrant_proc:
        qdrant_proc.terminate()

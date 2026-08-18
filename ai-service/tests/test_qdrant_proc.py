import os, subprocess, time, httpx

workspace_root = r"c:\Users\adity\OneDrive\Desktop\sourcefintch\sourcefintch"
qdrant_exe = os.path.join(workspace_root, "qdrant_bin", "qdrant.exe")

proc = subprocess.Popen([qdrant_exe], cwd=workspace_root)
time.sleep(2)
try:
    res = httpx.get("http://127.0.0.1:6333/healthz", timeout=5)
    print("QDRANT STATUS:", res.status_code, res.text)
finally:
    proc.terminate()

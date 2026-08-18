"""
Responsive Breakpoint Capture Script for Phase 8 Gap B.
Launches headless Edge, navigates to http://localhost:5173/?conversationId=14,
and captures screenshots across desktop (1440px), tablet (1024px), and mobile (600px).
"""

import os
import sys
import subprocess
import time
import json
import urllib.request

# Target directory for artifacts
artifact_dir = r"C:\Users\adity\.gemini\antigravity-ide\brain\d85c1433-c1fb-4c20-9b0e-98cd584b4832"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def capture_screenshots():
    # 1. Start Edge with remote debugging
    port = 9222
    edge_proc = subprocess.Popen([
        edge_path,
        "--headless=new",
        f"--remote-debugging-port={port}",
        "--disable-gpu",
        "--hide-scrollbars",
        "http://127.0.0.1:5173/?conversationId=14"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    time.sleep(3)

    try:
        # Get websocket debugger URL
        tabs_url = f"http://127.0.0.1:{port}/json"
        req = urllib.request.urlopen(tabs_url)
        tabs = json.loads(req.read().decode())
        page_tab = next(t for t in tabs if t.get("type") == "page")
        ws_url = page_tab["webSocketDebuggerUrl"]

        import asyncio
        import websockets

        async def run_cdp():
            async with websockets.connect(ws_url, max_size=10*1024*1024) as ws:
                msg_id = 0

                async def send(method, params=None):
                    nonlocal msg_id
                    msg_id += 1
                    payload = {"id": msg_id, "method": method, "params": params or {}}
                    await ws.send(json.dumps(payload))
                    while True:
                        res = json.loads(await ws.recv())
                        if res.get("id") == msg_id:
                            return res.get("result", {})

                await send("Page.enable")
                await send("DOM.enable")
                await send("Runtime.enable")

                # Wait for React to mount and load conversation 14
                await asyncio.sleep(2)

                # ── 1. Desktop Breakpoint (1440x900, >= 1280px) ──────────────
                print("1. Capturing Desktop Breakpoint (1440x900)...")
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": 1440,
                    "height": 900,
                    "deviceScaleFactor": 1,
                    "mobile": False
                })
                await asyncio.sleep(1)

                res = await send("Page.captureScreenshot", {"format": "png"})
                import base64
                img_data = base64.b64decode(res["data"])
                desktop_path = os.path.join(artifact_dir, "breakpoint_desktop_1440px.png")
                with open(desktop_path, "wb") as f:
                    f.write(img_data)
                print(f"   Saved {desktop_path}")

                # ── 2. Tablet Breakpoint (1024x768, 768px-1279px) ────────────
                print("2. Capturing Tablet Breakpoint (1024x768, Code Viewer drawer hidden)...")
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": 1024,
                    "height": 768,
                    "deviceScaleFactor": 1,
                    "mobile": False
                })
                await asyncio.sleep(1)

                res = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(res["data"])
                tablet_hidden_path = os.path.join(artifact_dir, "breakpoint_tablet_1024px_drawer_hidden.png")
                with open(tablet_hidden_path, "wb") as f:
                    f.write(img_data)
                print(f"   Saved {tablet_hidden_path}")

                # Trigger Code Viewer drawer by clicking "Code" button
                print("   Clicking Code button in Tablet view to trigger Code Viewer drawer...")
                await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const codeBtn = btns.find(b => b.textContent && b.textContent.includes('Code'));
                        if (codeBtn) { codeBtn.click(); return true; }
                        return false;
                    })()
                    """
                })
                await asyncio.sleep(1)

                res = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(res["data"])
                tablet_open_path = os.path.join(artifact_dir, "breakpoint_tablet_1024px_drawer_open.png")
                with open(tablet_open_path, "wb") as f:
                    f.write(img_data)
                print(f"   Saved {tablet_open_path}")

                # ── 3. Mobile Breakpoint (600x800, < 768px) ──────────────────
                print("3. Capturing Mobile Breakpoint (600x800, Sidebar hidden)...")
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": 600,
                    "height": 800,
                    "deviceScaleFactor": 1,
                    "mobile": True
                })
                await asyncio.sleep(1)

                res = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(res["data"])
                mobile_hidden_path = os.path.join(artifact_dir, "breakpoint_mobile_600px_sidebar_hidden.png")
                with open(mobile_hidden_path, "wb") as f:
                    f.write(img_data)
                print(f"   Saved {mobile_hidden_path}")

                # Trigger Sidebar slide-over via hamburger menu button
                print("   Clicking Hamburger button in Mobile view to slide in Sidebar...")
                await send("Runtime.evaluate", {
                    "expression": """
                    (() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const menuBtn = btns.find(b => b.title && b.title.includes('repositories sidebar'));
                        if (menuBtn) { menuBtn.click(); return true; }
                        return false;
                    })()
                    """
                })
                await asyncio.sleep(1)

                res = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(res["data"])
                mobile_open_path = os.path.join(artifact_dir, "breakpoint_mobile_600px_sidebar_open.png")
                with open(mobile_open_path, "wb") as f:
                    f.write(img_data)
                print(f"   Saved {mobile_open_path}")

        asyncio.run(run_cdp())

    finally:
        edge_proc.terminate()

if __name__ == "__main__":
    capture_screenshots()

"""
Convenience script to start the AI service.

Uvicorn is the ASGI server that runs FastAPI apps — think of it as the
equivalent of `node src/server.js`.  The "app.main:app" string tells
uvicorn to look in app/main.py for an object named `app`.
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,  # Auto-restart on file changes (like nodemon)
    )

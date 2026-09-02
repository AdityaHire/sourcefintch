"""
Convenience script to start the AI service locally.

In production (Render) we run uvicorn directly from the start command so that
reload/workers are off and the process is a single resident under 512 MiB.
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=False,
    )

"""
Pydantic schemas for the indexing (parse) endpoint.

Pydantic models serve the same purpose as Express's req.body validation —
they ensure the request has the right shape and types before your
business logic runs.  FastAPI automatically returns a 422 error if
validation fails.
"""

from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    """Request body for POST /ai/parse."""

    repository_id: int = Field(..., gt=0, description="MySQL repository ID")
    github_url: str = Field(..., min_length=1, description="GitHub clone URL")
    branch: str = Field(..., min_length=1, description="Branch to clone")

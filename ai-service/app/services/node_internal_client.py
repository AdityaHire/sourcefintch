"""
Shared HTTP helpers for service-to-service calls to the Node backend.

Every call must include the `x-internal-secret` header that matches the
backend's `INTERNAL_API_SECRET` env var.  Routes that the AI service hits
(`/api/repositories/:id/files`, `/:id/status`, `/:id/chunks`,
`/api/chunks/batch`, `GET /api/repositories/:id`, `GET /api/conversations/:id`)
are gated by `requireInternalSecret` / `requireAuthOrInternal` and will
reject (401) any call missing or mismatching the header.
"""

from typing import Any, Mapping, Optional

import httpx

from app.config import settings


def _internal_headers(extra: Optional[Mapping[str, str]] = None) -> dict[str, str]:
    headers = {"x-internal-secret": settings.internal_api_secret}
    if extra:
        headers.update(extra)
    return headers


def internal_get(url: str, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    return httpx.get(url, headers=_internal_headers(), timeout=timeout, **kwargs)


def internal_post(url: str, json: Any, *, timeout: float = 30.0, **kwargs: Any) -> httpx.Response:
    return httpx.post(
        url,
        json=json,
        headers=_internal_headers({"Content-Type": "application/json"}),
        timeout=timeout,
        **kwargs,
    )


def internal_patch(url: str, json: Any, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    return httpx.patch(
        url,
        json=json,
        headers=_internal_headers({"Content-Type": "application/json"}),
        timeout=timeout,
        **kwargs,
    )


def internal_delete(url: str, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    return httpx.delete(url, headers=_internal_headers(), timeout=timeout, **kwargs)


async def async_internal_get(url: str, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.get(url, headers=_internal_headers(), **kwargs)


async def async_internal_patch(url: str, json: Any, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.patch(
            url,
            json=json,
            headers=_internal_headers({"Content-Type": "application/json"}),
            **kwargs,
        )


async def async_internal_delete(url: str, *, timeout: float = 10.0, **kwargs: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.delete(url, headers=_internal_headers(), **kwargs)


async def async_internal_post(url: str, json: Any, *, timeout: float = 30.0, **kwargs: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.post(
            url,
            json=json,
            headers=_internal_headers({"Content-Type": "application/json"}),
            **kwargs,
        )
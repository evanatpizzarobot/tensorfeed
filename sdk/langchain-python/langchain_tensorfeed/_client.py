"""Stdlib HTTP plumbing shared by the tools and the loader.

Kept dependency-free on purpose. The package only requires ``langchain-core``
and ``pydantic``; HTTP goes through ``urllib`` so it works in any
LangChain runtime (server, notebook, edge worker) without pulling
``requests`` or ``httpx``.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_BASE_URL = "https://tensorfeed.ai/api"
DEFAULT_USER_AGENT = "langchain-tensorfeed/0.1"


class TensorFeedAPIError(RuntimeError):
    """Raised when the TensorFeed API returns a non-2xx response."""

    def __init__(self, status_code: int, payload: dict[str, Any]) -> None:
        self.status_code = status_code
        self.payload = payload
        msg = payload.get("error") or payload.get("message") or str(payload)
        super().__init__(f"TensorFeed API error {status_code}: {msg}")


def http_get(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    base_url: str = DEFAULT_BASE_URL,
    timeout: float = 15.0,
    user_agent: str = DEFAULT_USER_AGENT,
) -> dict[str, Any]:
    """GET a TensorFeed endpoint and return parsed JSON.

    None-valued params are dropped so callers can pass optional kwargs
    through unconditionally.
    """
    url = f"{base_url.rstrip('/')}{path}"
    if params:
        cleaned = {k: v for k, v in params.items() if v is not None}
        if cleaned:
            url = f"{url}?{urllib.parse.urlencode(cleaned)}"

    req = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": user_agent},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode())
        except Exception:
            payload = {"error": "non_json_response", "status": e.code}
        raise TensorFeedAPIError(e.code, payload) from e

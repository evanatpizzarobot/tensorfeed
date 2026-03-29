"""TensorFeed API client."""

from __future__ import annotations

import urllib.request
import urllib.parse
import json
from typing import Any


DEFAULT_BASE_URL = "https://tensorfeed.ai/api"


class TensorFeed:
    """Client for the TensorFeed.ai API.

    Free, no API key needed.

    Usage::

        from tensorfeed import TensorFeed

        tf = TensorFeed()
        news = tf.news(limit=10)
        status = tf.status()
        models = tf.models()
    """

    def __init__(self, base_url: str = DEFAULT_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(
            url, headers={"User-Agent": "TensorFeed-SDK-Python/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())

    def news(
        self, *, category: str | None = None, limit: int | None = None
    ) -> dict[str, Any]:
        """Get latest AI news articles.

        Args:
            category: Filter by category (e.g. "anthropic", "research", "tools")
            limit: Number of articles (default 50, max 200)
        """
        params: dict[str, str] = {}
        if category:
            params["category"] = category
        if limit:
            params["limit"] = str(limit)
        qs = f"?{urllib.parse.urlencode(params)}" if params else ""
        return self._get(f"/news{qs}")

    def status(self) -> dict[str, Any]:
        """Get real-time AI service status."""
        return self._get("/status")

    def status_summary(self) -> dict[str, Any]:
        """Get lightweight status summary."""
        return self._get("/status/summary")

    def models(self) -> dict[str, Any]:
        """Get AI model pricing and specs."""
        return self._get("/models")

    def agent_activity(self) -> dict[str, Any]:
        """Get agent traffic metrics."""
        return self._get("/agents/activity")

    def health(self) -> dict[str, Any]:
        """API health check."""
        return self._get("/health")

    def is_down(self, service_name: str) -> dict[str, Any]:
        """Check if a specific AI service is down.

        Args:
            service_name: Service to check (e.g. "claude", "openai", "gemini")
        """
        data = self.status()
        needle = service_name.lower()
        for svc in data.get("services", []):
            if needle in svc["name"].lower() or needle in svc["provider"].lower():
                return {
                    "name": svc["name"],
                    "status": svc["status"],
                    "is_down": svc["status"] == "down",
                }
        names = ", ".join(s["name"] for s in data.get("services", []))
        raise ValueError(
            f'Service "{service_name}" not found. Available: {names}'
        )

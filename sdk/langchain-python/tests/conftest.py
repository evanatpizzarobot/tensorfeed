"""Shared fixtures: a fake HTTP layer so tests never hit the network."""

from __future__ import annotations

from typing import Any

import pytest


@pytest.fixture
def fake_get(monkeypatch):
    """Patch http_get in both the tools and the loader modules.

    Yields a controller object you can configure with .responses, a
    dict mapping path -> response payload. Calls are recorded on
    .calls as (path, params) tuples.
    """

    class FakeGet:
        def __init__(self) -> None:
            self.responses: dict[str, Any] = {}
            self.calls: list[tuple[str, dict[str, Any] | None]] = []

        def __call__(
            self,
            path: str,
            *,
            params: dict[str, Any] | None = None,
            base_url: str = "",
            timeout: float = 0,
            user_agent: str = "",
        ) -> Any:
            self.calls.append((path, params))
            if path not in self.responses:
                raise AssertionError(
                    f"unexpected path {path}; configured: "
                    f"{list(self.responses)}"
                )
            return self.responses[path]

    fake = FakeGet()
    # Patch the http_get reference imported into each module that uses it.
    monkeypatch.setattr("langchain_tensorfeed.tools.http_get", fake)
    monkeypatch.setattr("langchain_tensorfeed.loaders.http_get", fake)
    return fake

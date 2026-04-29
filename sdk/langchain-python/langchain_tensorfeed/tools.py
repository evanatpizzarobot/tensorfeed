"""LangChain tools for the TensorFeed.ai public API.

All four tools hit free, no-auth endpoints, so an agent can use them
without any credentials. The tools return compact JSON strings (the
shape LangChain agents expect) summarized for token efficiency rather
than the full upstream payload.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from langchain_core.callbacks import (
    AsyncCallbackManagerForToolRun,
    CallbackManagerForToolRun,
)
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from langchain_tensorfeed._client import (
    DEFAULT_BASE_URL,
    DEFAULT_USER_AGENT,
    http_get,
)

NEWS_CATEGORIES = (
    "anthropic",
    "openai",
    "google",
    "meta",
    "open-source",
    "startups",
    "hardware",
    "research",
    "tools",
)


def _http_get(self: BaseTool, path: str, **params: Any) -> dict[str, Any]:
    return http_get(
        path,
        params=params or None,
        base_url=getattr(self, "base_url", DEFAULT_BASE_URL),
        timeout=getattr(self, "timeout", 15.0),
        user_agent=getattr(self, "user_agent", DEFAULT_USER_AGENT),
    )


# ── News ───────────────────────────────────────────────────────────


class _NewsInput(BaseModel):
    category: Optional[str] = Field(
        default=None,
        description=(
            "Optional category filter. One of: "
            "anthropic, openai, google, meta, open-source, startups, "
            "hardware, research, tools."
        ),
    )
    limit: Optional[int] = Field(
        default=10,
        description="Number of articles to return. Default 10, max 50.",
        ge=1,
        le=50,
    )


class TensorFeedNewsTool(BaseTool):
    """Fetch the latest AI news headlines from TensorFeed.ai.

    Backs the free ``/api/news`` endpoint. The agent receives a
    JSON list of articles with ``title``, ``source``, ``url``,
    ``snippet``, and ``published_at`` (ISO 8601 UTC).
    """

    name: str = "tensorfeed_news"
    description: str = (
        "Get the latest AI news articles from TensorFeed.ai. "
        "Optionally filter by category (anthropic, openai, google, meta, "
        "open-source, startups, hardware, research, tools). "
        "Returns JSON with title, source, url, snippet, and published_at "
        "for each article. Use this when the user asks about recent AI "
        "news, model releases, or industry events."
    )
    args_schema: type[BaseModel] = _NewsInput

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 15.0
    user_agent: str = DEFAULT_USER_AGENT

    def _run(
        self,
        category: Optional[str] = None,
        limit: Optional[int] = 10,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        data = _http_get(self, "/news", category=category, limit=limit)
        articles = data.get("articles", []) if isinstance(data, dict) else []
        compact = [
            {
                "title": a.get("title"),
                "source": a.get("source"),
                "url": a.get("url"),
                "snippet": a.get("snippet"),
                "published_at": a.get("publishedAt"),
                "categories": a.get("categories", []),
            }
            for a in articles
        ]
        return json.dumps({"count": len(compact), "articles": compact})

    async def _arun(
        self,
        category: Optional[str] = None,
        limit: Optional[int] = 10,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        return self._run(category=category, limit=limit)


# ── Status ─────────────────────────────────────────────────────────


class _StatusInput(BaseModel):
    service: Optional[str] = Field(
        default=None,
        description=(
            "Optional service name to check (e.g. 'claude', 'chatgpt', "
            "'gemini', 'copilot', 'perplexity'). Omit to list every "
            "tracked service."
        ),
    )


class TensorFeedStatusTool(BaseTool):
    """Check live up/down status for AI services."""

    name: str = "tensorfeed_status"
    description: str = (
        "Check whether AI services like Claude, ChatGPT, Gemini, Copilot, "
        "Perplexity, Mistral, or HuggingFace are up or experiencing an "
        "outage right now. Pass a service name to check one provider, or "
        "omit it to get a summary of all tracked services. Status values "
        "are 'operational', 'degraded', or 'down'. Use this when the user "
        "asks if a service is down, has an outage, or is having issues."
    )
    args_schema: type[BaseModel] = _StatusInput

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 15.0
    user_agent: str = DEFAULT_USER_AGENT

    def _run(
        self,
        service: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        data = _http_get(self, "/status")
        services = data.get("services", []) if isinstance(data, dict) else []

        if service:
            needle = service.lower()
            for svc in services:
                name = (svc.get("name") or "").lower()
                provider = (svc.get("provider") or "").lower()
                if needle in name or needle in provider:
                    return json.dumps(
                        {
                            "name": svc.get("name"),
                            "provider": svc.get("provider"),
                            "status": svc.get("status"),
                            "is_down": svc.get("status") == "down",
                            "last_checked": svc.get("lastChecked")
                            or svc.get("updatedAt"),
                        }
                    )
            return json.dumps(
                {
                    "error": f"service '{service}' not tracked",
                    "available": [s.get("name") for s in services],
                }
            )

        return json.dumps(
            {
                "count": len(services),
                "services": [
                    {
                        "name": s.get("name"),
                        "provider": s.get("provider"),
                        "status": s.get("status"),
                    }
                    for s in services
                ],
            }
        )

    async def _arun(
        self,
        service: Optional[str] = None,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        return self._run(service=service)


# ── Pricing ────────────────────────────────────────────────────────


class _PricingInput(BaseModel):
    provider: Optional[str] = Field(
        default=None,
        description=(
            "Optional provider filter (e.g. 'anthropic', 'openai', "
            "'google'). Omit to list every model."
        ),
    )
    model: Optional[str] = Field(
        default=None,
        description=(
            "Optional case-insensitive substring match on model id or "
            "name (e.g. 'sonnet', 'gpt-4o', 'gemini-2.5-pro')."
        ),
    )


class TensorFeedPricingTool(BaseTool):
    """Look up current pricing for AI models across providers."""

    name: str = "tensorfeed_pricing"
    description: str = (
        "Get current per-token pricing (USD per million tokens) for AI "
        "models across Anthropic, OpenAI, Google, Meta, Mistral, Cohere, "
        "and others. Optionally filter by provider name or by a "
        "model-name substring. Returns input price, output price, and "
        "context window. Use this when the user asks how much a model "
        "costs, compares prices, or wants to find the cheapest model."
    )
    args_schema: type[BaseModel] = _PricingInput

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 15.0
    user_agent: str = DEFAULT_USER_AGENT

    def _run(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        data = _http_get(self, "/models")
        models = data.get("models", []) if isinstance(data, dict) else []

        prov_needle = provider.lower() if provider else None
        model_needle = model.lower() if model else None

        rows = []
        for m in models:
            m_provider = (m.get("provider") or "").lower()
            m_id = (m.get("id") or "").lower()
            m_name = (m.get("name") or "").lower()
            if prov_needle and prov_needle not in m_provider:
                continue
            if model_needle and model_needle not in m_id and model_needle not in m_name:
                continue
            rows.append(
                {
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "provider": m.get("provider"),
                    "input_per_1m": m.get("inputPrice"),
                    "output_per_1m": m.get("outputPrice"),
                    "context_window": m.get("contextWindow"),
                }
            )

        return json.dumps({"count": len(rows), "models": rows})

    async def _arun(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        return self._run(provider=provider, model=model)


# ── Benchmarks ─────────────────────────────────────────────────────


class _BenchmarksInput(BaseModel):
    benchmark: Optional[str] = Field(
        default=None,
        description=(
            "Optional benchmark name (e.g. 'MMLU', 'HumanEval', 'GPQA', "
            "'MATH', 'SWE-Bench'). Case-insensitive substring match."
        ),
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional model id or name substring filter.",
    )


class TensorFeedBenchmarksTool(BaseTool):
    """Look up benchmark scores across AI models."""

    name: str = "tensorfeed_benchmarks"
    description: str = (
        "Get benchmark scores for AI models across MMLU, HumanEval, GPQA, "
        "MATH, SWE-Bench, and more. Optionally filter by benchmark name "
        "or model name. Returns each (model, benchmark) score pair. Use "
        "this when the user asks about how models compare on reasoning, "
        "coding, math, or general capability benchmarks."
    )
    args_schema: type[BaseModel] = _BenchmarksInput

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 15.0
    user_agent: str = DEFAULT_USER_AGENT

    def _run(
        self,
        benchmark: Optional[str] = None,
        model: Optional[str] = None,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        data = _http_get(self, "/benchmarks")
        rows = data.get("benchmarks") or data.get("results") or []
        if not isinstance(rows, list):
            rows = []

        b_needle = benchmark.lower() if benchmark else None
        m_needle = model.lower() if model else None

        out = []
        for r in rows:
            b_name = (r.get("benchmark") or r.get("name") or "").lower()
            m_id = (r.get("model") or r.get("modelId") or "").lower()
            if b_needle and b_needle not in b_name:
                continue
            if m_needle and m_needle not in m_id:
                continue
            out.append(
                {
                    "model": r.get("model") or r.get("modelId"),
                    "benchmark": r.get("benchmark") or r.get("name"),
                    "score": r.get("score"),
                    "as_of": r.get("asOf") or r.get("date"),
                }
            )

        return json.dumps({"count": len(out), "results": out})

    async def _arun(
        self,
        benchmark: Optional[str] = None,
        model: Optional[str] = None,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        return self._run(benchmark=benchmark, model=model)

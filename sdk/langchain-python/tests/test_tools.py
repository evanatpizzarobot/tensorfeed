"""Tool unit tests with a stubbed HTTP layer."""

from __future__ import annotations

import json

from langchain_tensorfeed import (
    TensorFeedBenchmarksTool,
    TensorFeedNewsTool,
    TensorFeedPricingTool,
    TensorFeedStatusTool,
)


def test_news_tool_returns_compact_articles(fake_get):
    fake_get.responses["/news"] = {
        "articles": [
            {
                "id": "abc",
                "title": "Anthropic ships Claude 4.7",
                "source": "Anthropic Blog",
                "sourceDomain": "anthropic.com",
                "url": "https://anthropic.com/x",
                "snippet": "We are pleased to announce...",
                "categories": ["Anthropic"],
                "publishedAt": "2026-04-28T12:00:00Z",
                "fetchedAt": "2026-04-28T12:01:00Z",
            }
        ]
    }
    tool = TensorFeedNewsTool()
    out = json.loads(tool.invoke({"category": "anthropic", "limit": 5}))

    assert out["count"] == 1
    article = out["articles"][0]
    assert article["title"].startswith("Anthropic")
    assert article["url"] == "https://anthropic.com/x"
    assert article["published_at"] == "2026-04-28T12:00:00Z"
    # Param forwarding
    path, params = fake_get.calls[0]
    assert path == "/news"
    assert params == {"category": "anthropic", "limit": 5}


def test_news_tool_default_limit(fake_get):
    fake_get.responses["/news"] = {"articles": []}
    TensorFeedNewsTool().invoke({})
    _, params = fake_get.calls[0]
    assert params["limit"] == 10
    assert params["category"] is None


def test_status_tool_summary(fake_get):
    fake_get.responses["/status"] = {
        "services": [
            {"name": "Claude API", "provider": "Anthropic", "status": "operational"},
            {"name": "ChatGPT", "provider": "OpenAI", "status": "down"},
        ]
    }
    out = json.loads(TensorFeedStatusTool().invoke({}))
    assert out["count"] == 2
    statuses = {s["name"]: s["status"] for s in out["services"]}
    assert statuses["ChatGPT"] == "down"


def test_status_tool_single_service_match(fake_get):
    fake_get.responses["/status"] = {
        "services": [
            {
                "name": "Claude API",
                "provider": "Anthropic",
                "status": "operational",
                "lastChecked": "2026-04-28T12:00:00Z",
            }
        ]
    }
    out = json.loads(TensorFeedStatusTool().invoke({"service": "claude"}))
    assert out["status"] == "operational"
    assert out["is_down"] is False
    assert out["last_checked"] == "2026-04-28T12:00:00Z"


def test_status_tool_unknown_service(fake_get):
    fake_get.responses["/status"] = {
        "services": [{"name": "Claude API", "provider": "Anthropic", "status": "operational"}]
    }
    out = json.loads(TensorFeedStatusTool().invoke({"service": "no-such"}))
    assert "error" in out
    assert "available" in out


def test_pricing_tool_filters(fake_get):
    fake_get.responses["/models"] = {
        "models": [
            {
                "id": "claude-opus-4-7",
                "name": "Claude Opus 4.7",
                "provider": "Anthropic",
                "inputPrice": 15.0,
                "outputPrice": 75.0,
                "contextWindow": 1000000,
            },
            {
                "id": "gpt-4o",
                "name": "GPT-4o",
                "provider": "OpenAI",
                "inputPrice": 2.5,
                "outputPrice": 10.0,
                "contextWindow": 128000,
            },
        ]
    }
    out = json.loads(
        TensorFeedPricingTool().invoke({"provider": "anthropic"})
    )
    assert out["count"] == 1
    assert out["models"][0]["id"] == "claude-opus-4-7"

    out2 = json.loads(TensorFeedPricingTool().invoke({"model": "gpt-4o"}))
    assert out2["count"] == 1
    assert out2["models"][0]["provider"] == "OpenAI"


def test_pricing_tool_returns_all_when_unfiltered(fake_get):
    fake_get.responses["/models"] = {
        "models": [
            {"id": "a", "provider": "X", "inputPrice": 1, "outputPrice": 2},
            {"id": "b", "provider": "Y", "inputPrice": 3, "outputPrice": 4},
        ]
    }
    out = json.loads(TensorFeedPricingTool().invoke({}))
    assert out["count"] == 2


def test_benchmarks_tool_filters_by_benchmark(fake_get):
    fake_get.responses["/benchmarks"] = {
        "benchmarks": [
            {"model": "claude-opus-4-7", "benchmark": "MMLU", "score": 0.91},
            {"model": "gpt-4o", "benchmark": "MMLU", "score": 0.88},
            {"model": "claude-opus-4-7", "benchmark": "HumanEval", "score": 0.94},
        ]
    }
    out = json.loads(
        TensorFeedBenchmarksTool().invoke({"benchmark": "humaneval"})
    )
    assert out["count"] == 1
    assert out["results"][0]["model"] == "claude-opus-4-7"


def test_benchmarks_tool_filters_by_model(fake_get):
    fake_get.responses["/benchmarks"] = {
        "benchmarks": [
            {"model": "claude-opus-4-7", "benchmark": "MMLU", "score": 0.91},
            {"model": "gpt-4o", "benchmark": "MMLU", "score": 0.88},
        ]
    }
    out = json.loads(TensorFeedBenchmarksTool().invoke({"model": "claude"}))
    assert out["count"] == 1
    assert out["results"][0]["benchmark"] == "MMLU"


def test_benchmarks_tool_handles_missing_payload(fake_get):
    fake_get.responses["/benchmarks"] = {}
    out = json.loads(TensorFeedBenchmarksTool().invoke({}))
    assert out == {"count": 0, "results": []}

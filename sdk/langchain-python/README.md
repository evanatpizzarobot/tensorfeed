# langchain-tensorfeed

LangChain integration for [TensorFeed.ai](https://tensorfeed.ai), the AI news and real-time data hub built for humans and AI agents.

This package gives LangChain agents zero-friction access to:

- The latest AI news from 12+ industry sources
- Live up/down status for Claude, ChatGPT, Gemini, Copilot, Perplexity, Mistral, HuggingFace, and more
- Current per-token pricing for AI models across every major provider
- Public benchmark scores (MMLU, HumanEval, GPQA, MATH, SWE-Bench, etc.)
- A `Document` loader so you can index TensorFeed news into a vector store for RAG

All endpoints used by this package are free and require no API key.

## Installation

```bash
pip install langchain-tensorfeed
```

## Quick start: tools

```python
from langchain_tensorfeed import (
    TensorFeedNewsTool,
    TensorFeedStatusTool,
    TensorFeedPricingTool,
    TensorFeedBenchmarksTool,
)

news = TensorFeedNewsTool().invoke({"category": "anthropic", "limit": 5})
print(news)

status = TensorFeedStatusTool().invoke({"service": "claude"})
print(status)

pricing = TensorFeedPricingTool().invoke({"provider": "openai"})
print(pricing)

scores = TensorFeedBenchmarksTool().invoke({"benchmark": "MMLU"})
print(scores)
```

Each tool returns a JSON string sized for token efficiency. The schemas are validated by Pydantic, so an LLM can call them directly through the standard tool-calling interface.

## Quick start: document loader

```python
from langchain_tensorfeed import TensorFeedLoader

loader = TensorFeedLoader(
    category="research",
    limit=100,
    start_date="2026-04-01T00:00:00Z",
)
docs = loader.load()

for d in docs[:3]:
    print(d.metadata["title"], "->", d.metadata["url"])
```

`TensorFeedLoader` returns standard `langchain_core.documents.Document` objects with `page_content` set to `title + snippet` and `metadata` carrying `id`, `url`, `source`, `categories`, `published_at`, and `fetched_at`. You can plug it into any LangChain text splitter or vector store.

## Using the tools with an agent

```python
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_tensorfeed import (
    TensorFeedBenchmarksTool,
    TensorFeedNewsTool,
    TensorFeedPricingTool,
    TensorFeedStatusTool,
)

llm = ChatAnthropic(model="claude-opus-4-7")

tools = [
    TensorFeedNewsTool(),
    TensorFeedStatusTool(),
    TensorFeedPricingTool(),
    TensorFeedBenchmarksTool(),
]

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an AI industry analyst. Use the TensorFeed tools to ground every answer in current data."),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = executor.invoke({
    "input": "Is Claude up right now, and how does its pricing compare to GPT-4o?"
})
print(result["output"])
```

## Tool reference

| Tool | Description | Input schema |
| --- | --- | --- |
| `TensorFeedNewsTool` | Latest AI news headlines | `category` (optional), `limit` (1-50, default 10) |
| `TensorFeedStatusTool` | Live AI service status | `service` (optional name) |
| `TensorFeedPricingTool` | Per-token pricing | `provider`, `model` (both optional substring filters) |
| `TensorFeedBenchmarksTool` | Public benchmark scores | `benchmark`, `model` (both optional substring filters) |

## TensorFeedLoader options

| Argument | Type | Description |
| --- | --- | --- |
| `category` | `str` | API-side category filter |
| `categories` | `Sequence[str]` | Client-side multi-category filter |
| `limit` | `int` | Max articles to fetch (default 50) |
| `start_date` | `str | datetime` | Inclusive lower bound on `publishedAt` |
| `end_date` | `str | datetime` | Inclusive upper bound on `publishedAt` |
| `base_url` | `str` | Override the API host |
| `timeout` | `float` | HTTP timeout in seconds |

## Premium endpoints

The TensorFeed API also exposes paid endpoints (model routing recommendations, news search, model comparisons, forecasts, webhook watches) that are billed in USDC on Base. Those are out of scope for this package; if you need them in LangChain, the standalone [`tensorfeed`](https://pypi.org/project/tensorfeed/) Python SDK covers the full surface and you can wrap any endpoint as a custom `BaseTool`.

## Contributing

Source: [github.com/RipperMercs/tensorfeed](https://github.com/RipperMercs/tensorfeed) under `sdk/langchain-python/`.

```bash
cd sdk/langchain-python
pip install -e .[dev]
pytest
```

## Links

- TensorFeed developer docs: https://tensorfeed.ai/developers
- API reference: https://tensorfeed.ai/api/meta
- Issue tracker: https://github.com/RipperMercs/tensorfeed/issues
- License: MIT

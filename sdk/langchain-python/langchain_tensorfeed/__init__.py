"""LangChain integration for TensorFeed.ai.

Exposes four tools and a document loader backed by the public TensorFeed
API. No API key required for any of the tools or the loader (free tier).

https://tensorfeed.ai/developers
"""

from langchain_tensorfeed.loaders import TensorFeedLoader
from langchain_tensorfeed.tools import (
    TensorFeedBenchmarksTool,
    TensorFeedNewsTool,
    TensorFeedPricingTool,
    TensorFeedStatusTool,
)

__all__ = [
    "TensorFeedBenchmarksTool",
    "TensorFeedLoader",
    "TensorFeedNewsTool",
    "TensorFeedPricingTool",
    "TensorFeedStatusTool",
]

__version__ = "0.1.0"

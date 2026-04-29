"""TensorFeedLoader: stream AI news articles into LangChain Documents.

Designed for RAG pipelines where you want a fresh corpus of AI news
indexed into a vector store. Each yielded ``Document`` carries the
article title and snippet as ``page_content`` and the structured
metadata (url, source, categories, published_at) on ``metadata``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterator, Optional, Sequence

from langchain_core.document_loaders import BaseLoader
from langchain_core.documents import Document

from langchain_tensorfeed._client import (
    DEFAULT_BASE_URL,
    DEFAULT_USER_AGENT,
    http_get,
)


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _to_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class TensorFeedLoader(BaseLoader):
    """Load AI news articles from TensorFeed.ai as LangChain Documents.

    Args:
        category: Optional single category filter passed to the API
            (e.g. ``"research"`` or ``"tools"``). For multi-category
            client-side filtering, use ``categories``.
        categories: Optional iterable of category names. Articles with
            *any* matching category in their ``categories`` array are
            kept. Applied on top of the API ``category`` filter.
        limit: Maximum number of articles to fetch from the API.
            Default 50, max 200.
        start_date: Optional inclusive lower bound on
            ``publishedAt`` (ISO 8601 string, ``date``, or
            ``datetime``). Naive datetimes are treated as UTC.
        end_date: Optional inclusive upper bound on ``publishedAt``.
        base_url: API base URL. Defaults to ``https://tensorfeed.ai/api``.
        timeout: HTTP timeout in seconds (default 15).
        user_agent: Override the User-Agent header sent on requests.

    Example:
        >>> from langchain_tensorfeed import TensorFeedLoader
        >>> loader = TensorFeedLoader(category="research", limit=100)
        >>> docs = loader.load()
        >>> docs[0].metadata["url"]
        'https://...'
    """

    def __init__(
        self,
        *,
        category: Optional[str] = None,
        categories: Optional[Sequence[str]] = None,
        limit: int = 50,
        start_date: Optional[str | datetime] = None,
        end_date: Optional[str | datetime] = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 15.0,
        user_agent: str = DEFAULT_USER_AGENT,
    ) -> None:
        self.category = category
        self.categories = (
            tuple(c.lower() for c in categories) if categories else None
        )
        self.limit = limit
        self.start_date = _to_aware(self._coerce_dt(start_date))
        self.end_date = _to_aware(self._coerce_dt(end_date))
        self.base_url = base_url
        self.timeout = timeout
        self.user_agent = user_agent

    @staticmethod
    def _coerce_dt(value: Optional[str | datetime]) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        return _parse_iso(value)

    def lazy_load(self) -> Iterator[Document]:
        data = http_get(
            "/news",
            params={"category": self.category, "limit": self.limit},
            base_url=self.base_url,
            timeout=self.timeout,
            user_agent=self.user_agent,
        )
        articles = data.get("articles", []) if isinstance(data, dict) else []

        for article in articles:
            cats = [c for c in (article.get("categories") or []) if c]
            if self.categories:
                if not any(c.lower() in self.categories for c in cats):
                    continue

            published = _to_aware(_parse_iso(article.get("publishedAt")))
            if self.start_date and published and published < self.start_date:
                continue
            if self.end_date and published and published > self.end_date:
                continue

            title = article.get("title") or ""
            snippet = article.get("snippet") or ""
            content = f"{title}\n\n{snippet}".strip()

            metadata = {
                "id": article.get("id"),
                "title": title,
                "source": article.get("source"),
                "source_domain": article.get("sourceDomain"),
                "url": article.get("url"),
                "categories": cats,
                "published_at": article.get("publishedAt"),
                "fetched_at": article.get("fetchedAt"),
            }
            yield Document(page_content=content, metadata=metadata)

    def load(self) -> list[Document]:
        return list(self.lazy_load())

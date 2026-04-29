"""TensorFeedLoader unit tests."""

from __future__ import annotations

from datetime import datetime, timezone

from langchain_core.documents import Document

from langchain_tensorfeed import TensorFeedLoader


SAMPLE = {
    "articles": [
        {
            "id": "1",
            "title": "Claude Opus 4.7 ships",
            "snippet": "Highlights of the release.",
            "source": "Anthropic Blog",
            "sourceDomain": "anthropic.com",
            "url": "https://anthropic.com/a",
            "categories": ["Anthropic"],
            "publishedAt": "2026-04-28T12:00:00Z",
            "fetchedAt": "2026-04-28T12:01:00Z",
        },
        {
            "id": "2",
            "title": "OpenAI cuts API prices",
            "snippet": "GPT-4o now 30 percent cheaper.",
            "source": "OpenAI Blog",
            "sourceDomain": "openai.com",
            "url": "https://openai.com/a",
            "categories": ["OpenAI"],
            "publishedAt": "2026-04-20T08:00:00Z",
            "fetchedAt": "2026-04-20T08:01:00Z",
        },
        {
            "id": "3",
            "title": "Older story",
            "snippet": "From earlier in the month.",
            "source": "The Verge AI",
            "sourceDomain": "theverge.com",
            "url": "https://theverge.com/a",
            "categories": ["General AI"],
            "publishedAt": "2026-04-01T00:00:00Z",
            "fetchedAt": "2026-04-01T00:01:00Z",
        },
    ]
}


def test_loader_yields_documents(fake_get):
    fake_get.responses["/news"] = SAMPLE
    docs = TensorFeedLoader().load()

    assert len(docs) == 3
    assert all(isinstance(d, Document) for d in docs)
    first = docs[0]
    assert "Claude Opus 4.7" in first.page_content
    assert first.metadata["url"] == "https://anthropic.com/a"
    assert first.metadata["source"] == "Anthropic Blog"
    assert first.metadata["categories"] == ["Anthropic"]


def test_loader_passes_category_to_api(fake_get):
    fake_get.responses["/news"] = {"articles": []}
    TensorFeedLoader(category="research", limit=25).load()
    path, params = fake_get.calls[0]
    assert path == "/news"
    assert params == {"category": "research", "limit": 25}


def test_loader_filters_by_categories_list(fake_get):
    fake_get.responses["/news"] = SAMPLE
    docs = TensorFeedLoader(categories=["openai"]).load()
    assert len(docs) == 1
    assert docs[0].metadata["id"] == "2"


def test_loader_date_range_filters(fake_get):
    fake_get.responses["/news"] = SAMPLE
    start = datetime(2026, 4, 15, tzinfo=timezone.utc)
    end = datetime(2026, 4, 25, tzinfo=timezone.utc)
    docs = TensorFeedLoader(start_date=start, end_date=end).load()
    assert len(docs) == 1
    assert docs[0].metadata["id"] == "2"


def test_loader_accepts_iso_strings_for_dates(fake_get):
    fake_get.responses["/news"] = SAMPLE
    docs = TensorFeedLoader(
        start_date="2026-04-25T00:00:00Z",
        end_date="2026-04-30T00:00:00Z",
    ).load()
    assert len(docs) == 1
    assert docs[0].metadata["id"] == "1"


def test_loader_lazy_load_is_iterator(fake_get):
    fake_get.responses["/news"] = SAMPLE
    it = TensorFeedLoader().lazy_load()
    first = next(it)
    assert isinstance(first, Document)

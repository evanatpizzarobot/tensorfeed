# langchain-ai/langchain docs PR

Three files to add to the official LangChain docs to register `langchain-tensorfeed` in the integrations index. The directory layout under `langchain-docs-pr/` mirrors the destination paths in [`langchain-ai/langchain`](https://github.com/langchain-ai/langchain), so you can copy the tree directly.

## Prerequisite

`langchain-tensorfeed` must be live on PyPI before you submit. The LangChain docs reviewers will check that `pip install langchain-tensorfeed` works and that the notebooks execute. Publish from `sdk/langchain-python/`:

```bash
cd sdk/langchain-python
python -m build
python -m twine upload dist/*
```

## Files to add

Copy each of the three files into your `langchain-ai/langchain` fork at the matching path:

| Source (this repo) | Destination (langchain-ai/langchain) |
| --- | --- |
| `docs/docs/integrations/providers/tensorfeed.mdx` | `docs/docs/integrations/providers/tensorfeed.mdx` |
| `docs/docs/integrations/tools/tensorfeed.ipynb` | `docs/docs/integrations/tools/tensorfeed.ipynb` |
| `docs/docs/integrations/document_loaders/tensorfeed.ipynb` | `docs/docs/integrations/document_loaders/tensorfeed.ipynb` |

## Step-by-step

```bash
# 1. Fork langchain-ai/langchain on GitHub, then clone your fork.
git clone https://github.com/<your-handle>/langchain.git
cd langchain
git checkout -b integration/tensorfeed

# 2. Copy the three docs files in.
cp /path/to/tensorfeed/sdk/langchain-python/langchain-docs-pr/docs/docs/integrations/providers/tensorfeed.mdx docs/docs/integrations/providers/
cp /path/to/tensorfeed/sdk/langchain-python/langchain-docs-pr/docs/docs/integrations/tools/tensorfeed.ipynb docs/docs/integrations/tools/
cp /path/to/tensorfeed/sdk/langchain-python/langchain-docs-pr/docs/docs/integrations/document_loaders/tensorfeed.ipynb docs/docs/integrations/document_loaders/

# 3. (Optional but recommended) Build the docs locally to verify they render.
#    See docs/README.md in langchain-ai/langchain for the docs-build instructions.

# 4. Commit and push.
git add docs/docs/integrations/providers/tensorfeed.mdx \
        docs/docs/integrations/tools/tensorfeed.ipynb \
        docs/docs/integrations/document_loaders/tensorfeed.ipynb
git commit -m "docs: add TensorFeed integration"
git push -u origin integration/tensorfeed
```

Then open the PR at https://github.com/langchain-ai/langchain/compare.

## Suggested PR title

```
docs: add TensorFeed integration (langchain-tensorfeed)
```

## Suggested PR body

```markdown
## Description

Adds documentation for `langchain-tensorfeed`, a community integration that
exposes TensorFeed.ai data to LangChain agents and RAG pipelines.

`langchain-tensorfeed` provides:

- Four `BaseTool` subclasses: `TensorFeedNewsTool`, `TensorFeedStatusTool`,
  `TensorFeedPricingTool`, `TensorFeedBenchmarksTool`.
- A `TensorFeedLoader` (`BaseLoader`) that yields AI news articles as
  `Document` objects with full metadata, suitable for vector store indexing.

All endpoints used by the package are free and require no API key, so
the integration is zero-friction for new LangChain users.

## Files added

- `docs/docs/integrations/providers/tensorfeed.mdx` — provider index entry.
- `docs/docs/integrations/tools/tensorfeed.ipynb` — runnable tool examples,
  including a `create_tool_calling_agent` end-to-end demo.
- `docs/docs/integrations/document_loaders/tensorfeed.ipynb` — loader
  examples, including a FAISS RAG pipeline.

## Links

- PyPI: https://pypi.org/project/langchain-tensorfeed/
- Source: https://github.com/RipperMercs/tensorfeed/tree/main/sdk/langchain-python
- TensorFeed docs: https://tensorfeed.ai/developers

## Checklist

- [x] New integration package is published on PyPI.
- [x] Provider page added under `docs/docs/integrations/providers/`.
- [x] Tool docs notebook added under `docs/docs/integrations/tools/`.
- [x] Document loader notebook added under `docs/docs/integrations/document_loaders/`.
- [x] No new dependencies added to the langchain monorepo (the package
      is shipped externally).
```

## Notes

- LangChain stopped accepting new third-party integrations as code merges into the monorepo. New integrations live as standalone packages on PyPI and only the documentation is upstreamed. This PR follows that current pattern.
- If a reviewer asks for changes to the notebook structure, copy the latest example from another recent integrations PR (search merged PRs with the label `area: docs` and `integration:`).
- Keep CodeBlocks in the notebook short. Reviewers prefer notebooks where every cell can run end-to-end against the live API.

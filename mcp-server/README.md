# TensorFeed MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents access to real-time AI industry data from [TensorFeed.ai](https://tensorfeed.ai).

## Tools

| Tool | Description |
|------|-------------|
| `get_ai_news` | Latest AI news from 15+ sources (filterable by category) |
| `get_ai_status` | Real-time status of Claude, OpenAI, Gemini, Mistral, and more |
| `is_service_down` | Check if a specific AI service is down |
| `get_model_pricing` | Compare pricing across all major AI model providers |
| `get_ai_today` | Summary of top AI stories from the last 24 hours |

## Setup with Claude Code

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tensorfeed": {
      "command": "npx",
      "args": ["-y", "@tensorfeed/mcp-server"]
    }
  }
}
```

## Setup with Claude Desktop

Add to Claude Desktop settings:

```json
{
  "mcpServers": {
    "tensorfeed": {
      "command": "npx",
      "args": ["-y", "@tensorfeed/mcp-server"]
    }
  }
}
```

## Run Locally

```bash
npx @tensorfeed/mcp-server
```

## Example Queries

Once connected, you can ask your AI assistant things like:

- "What's happening in AI today?"
- "Is Claude down right now?"
- "Compare pricing between Claude Opus and GPT-4o"
- "Show me the latest AI research papers"
- "What's the status of all AI services?"

## Data Source

All data comes from the [TensorFeed.ai API](https://tensorfeed.ai/developers), which aggregates from 15+ sources including Anthropic, OpenAI, Google AI, TechCrunch, The Verge, arXiv, Hacker News, and more. Updated every 10 minutes.

## License

MIT - Built by [TensorFeed.ai](https://tensorfeed.ai/about)

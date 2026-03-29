#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_BASE = 'https://tensorfeed.ai/api';

// ── API helpers ─────────────────────────────────────────────────────

async function fetchJSON(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': 'TensorFeed-MCP/1.0' },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Server setup ────────────────────────────────────────────────────

const server = new McpServer({
  name: 'tensorfeed',
  version: '1.0.0',
});

// ── Tool: get_ai_news ───────────────────────────────────────────────

server.tool(
  'get_ai_news',
  'Get the latest AI news articles from TensorFeed.ai. Aggregates from 15+ sources including Anthropic, OpenAI, Google, TechCrunch, The Verge, arXiv, and more.',
  {
    category: z.string().optional().describe('Filter by category (e.g. "anthropic", "openai", "research", "tools")'),
    limit: z.number().min(1).max(50).optional().describe('Number of articles to return (default 10, max 50)'),
  },
  async ({ category, limit }) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('limit', String(limit || 10));

    const data = await fetchJSON(`/news?${params}`) as {
      articles: { title: string; url: string; source: string; snippet: string; categories: string[]; publishedAt: string }[];
    };

    const text = data.articles
      .map((a, i) => `${i + 1}. ${a.title}\n   Source: ${a.source}\n   URL: ${a.url}\n   ${a.snippet ? a.snippet + '\n   ' : ''}Published: ${a.publishedAt}`)
      .join('\n\n');

    return { content: [{ type: 'text' as const, text: text || 'No articles found.' }] };
  }
);

// ── Tool: get_ai_status ─────────────────────────────────────────────

server.tool(
  'get_ai_status',
  'Get real-time operational status of major AI services (Claude, OpenAI, Gemini, Mistral, Cohere, Replicate, Hugging Face).',
  {},
  async () => {
    const data = await fetchJSON('/status') as {
      services: { name: string; provider: string; status: string; components: { name: string; status: string }[] }[];
    };

    const text = data.services
      .map(s => {
        const components = s.components.length > 0
          ? '\n' + s.components.map(c => `     ${c.name}: ${c.status}`).join('\n')
          : '';
        return `  ${s.status === 'operational' ? 'OK' : s.status.toUpperCase()} ${s.name} (${s.provider})${components}`;
      })
      .join('\n');

    return { content: [{ type: 'text' as const, text: `AI Service Status:\n${text}` }] };
  }
);

// ── Tool: is_service_down ───────────────────────────────────────────

server.tool(
  'is_service_down',
  'Check if a specific AI service is currently down or experiencing issues.',
  {
    service: z.string().describe('Service name to check (e.g. "claude", "openai", "gemini", "mistral", "cohere", "hugging face", "replicate")'),
  },
  async ({ service }) => {
    const data = await fetchJSON('/status') as {
      services: { name: string; provider: string; status: string; components: { name: string; status: string }[] }[];
    };

    const match = data.services.find(s =>
      s.name.toLowerCase().includes(service.toLowerCase()) ||
      s.provider.toLowerCase().includes(service.toLowerCase())
    );

    if (!match) {
      return { content: [{ type: 'text' as const, text: `Service "${service}" not found. Available services: ${data.services.map(s => s.name).join(', ')}` }] };
    }

    const statusEmoji = match.status === 'operational' ? 'OK' : match.status === 'degraded' ? 'DEGRADED' : 'DOWN';
    const components = match.components.length > 0
      ? '\nComponents:\n' + match.components.map(c => `  ${c.name}: ${c.status}`).join('\n')
      : '';

    return {
      content: [{
        type: 'text' as const,
        text: `${statusEmoji} ${match.name} (${match.provider}) is ${match.status}${components}`
      }]
    };
  }
);

// ── Tool: get_model_pricing ─────────────────────────────────────────

server.tool(
  'get_model_pricing',
  'Get AI model pricing comparison across all major providers (Anthropic, OpenAI, Google, Meta, Mistral, Cohere). Prices per 1M tokens.',
  {},
  async () => {
    const data = await fetchJSON('/models') as {
      providers: {
        name: string;
        models: { name: string; inputPrice: number; outputPrice: number; contextWindow: number; released: string; capabilities: string[] }[];
      }[];
    };

    const text = data.providers
      .map(p => {
        const models = p.models
          .map(m => {
            const input = m.inputPrice === 0 ? 'Free' : `$${m.inputPrice.toFixed(2)}`;
            const output = m.outputPrice === 0 ? 'Free' : `$${m.outputPrice.toFixed(2)}`;
            const ctx = m.contextWindow >= 1000000
              ? `${(m.contextWindow / 1000000).toFixed(0)}M`
              : `${(m.contextWindow / 1000).toFixed(0)}K`;
            return `    ${m.name}: Input ${input}, Output ${output}, Context ${ctx}, Released ${m.released}`;
          })
          .join('\n');
        return `  ${p.name}:\n${models}`;
      })
      .join('\n\n');

    return { content: [{ type: 'text' as const, text: `AI Model Pricing (per 1M tokens):\n\n${text}` }] };
  }
);

// ── Tool: get_ai_today ──────────────────────────────────────────────

server.tool(
  'get_ai_today',
  'Get a summary of what happened in AI today. Returns the top stories from the last 24 hours.',
  {
    limit: z.number().min(1).max(20).optional().describe('Number of stories (default 5)'),
  },
  async ({ limit }) => {
    const data = await fetchJSON(`/news?limit=${limit || 5}`) as {
      articles: { title: string; url: string; source: string; publishedAt: string }[];
    };

    const text = data.articles
      .map((a, i) => `${i + 1}. ${a.title} (${a.source})\n   ${a.url}`)
      .join('\n\n');

    return { content: [{ type: 'text' as const, text: `Today in AI:\n\n${text}` }] };
  }
);

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TensorFeed MCP server running on stdio');
}

main().catch(console.error);

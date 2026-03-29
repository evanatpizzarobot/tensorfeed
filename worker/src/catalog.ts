import { Env } from './types';

/**
 * Weekly catalog updater for AI models/pricing and agents directory.
 *
 * Data flow:
 *   1. On first run, seeds KV from BASELINE data (mirrors data/*.json)
 *   2. Weekly cron fetches public sources and merges new models/pricing
 *   3. API endpoints serve from KV
 *
 * Public data sources:
 *   - LiteLLM community-maintained model pricing (GitHub)
 *   - Provider model list endpoints where available
 */

// ── Types ───────────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  released: string;
  capabilities: string[];
  openSource?: boolean;
  license?: string;
}

interface ProviderEntry {
  id: string;
  name: string;
  logo: string;
  url: string;
  models: ModelEntry[];
}

interface PricingData {
  lastUpdated: string;
  providers: ProviderEntry[];
  pricingNotes: {
    unit: string;
    currency: string;
    openSourceNote: string;
    disclaimer: string;
  };
}

interface AgentEntry {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  url: string;
  pricing: string;
  launched: number;
}

interface AgentsData {
  lastUpdated: string;
  categories: { id: string; name: string; description: string }[];
  agents: AgentEntry[];
}

// ── LiteLLM pricing source mapping ─────────────────────────────────

// Maps LiteLLM model keys to our provider IDs
const LITELLM_PROVIDER_MAP: Record<string, string> = {
  'claude-': 'anthropic',
  'gpt-': 'openai',
  'o1': 'openai',
  'o3': 'openai',
  'o4': 'openai',
  'gemini/': 'google',
  'mistral/': 'mistral',
  'command-': 'cohere',
};

// Models we track -- LiteLLM key prefix -> our model ID
const TRACKED_MODELS: Record<string, { providerId: string; ourId: string; name: string }> = {
  'claude-opus-4-6': { providerId: 'anthropic', ourId: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  'claude-sonnet-4-6': { providerId: 'anthropic', ourId: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5': { providerId: 'anthropic', ourId: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  'gpt-4o': { providerId: 'openai', ourId: 'gpt-4o', name: 'GPT-4o' },
  'gpt-4o-mini': { providerId: 'openai', ourId: 'gpt-4o-mini', name: 'GPT-4o-mini' },
  'o1': { providerId: 'openai', ourId: 'o1', name: 'o1' },
  'o3-mini': { providerId: 'openai', ourId: 'o3-mini', name: 'o3-mini' },
  'gemini/gemini-2.5-pro': { providerId: 'google', ourId: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro' },
  'gemini/gemini-2.0-flash': { providerId: 'google', ourId: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash' },
  'mistral/mistral-large-latest': { providerId: 'mistral', ourId: 'mistral-large', name: 'Mistral Large' },
  'mistral/mistral-small-latest': { providerId: 'mistral', ourId: 'mistral-small', name: 'Mistral Small' },
  'command-r-plus': { providerId: 'cohere', ourId: 'command-r-plus', name: 'Command R+' },
  'command-r': { providerId: 'cohere', ourId: 'command-r', name: 'Command R' },
};

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// ── Fetch and merge pricing ─────────────────────────────────────────

async function fetchLiteLLMPricing(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(LITELLM_URL, {
      headers: { 'User-Agent': 'TensorFeed/1.0 (https://tensorfeed.ai)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    console.warn('Failed to fetch LiteLLM pricing:', e);
    return null;
  }
}

function mergePricing(current: PricingData, litellm: Record<string, unknown>): PricingData {
  let updated = false;

  for (const [litellmKey, tracked] of Object.entries(TRACKED_MODELS)) {
    const entry = litellm[litellmKey] as Record<string, unknown> | undefined;
    if (!entry) continue;

    const provider = current.providers.find(p => p.id === tracked.providerId);
    if (!provider) continue;

    const model = provider.models.find(m => m.id === tracked.ourId);
    if (!model) continue;

    // LiteLLM stores prices per token; we store per 1M tokens
    const inputPerToken = entry['input_cost_per_token'] as number | undefined;
    const outputPerToken = entry['output_cost_per_token'] as number | undefined;
    const maxTokens = entry['max_input_tokens'] as number | undefined;

    if (inputPerToken !== undefined) {
      const newInput = parseFloat((inputPerToken * 1_000_000).toFixed(2));
      if (newInput !== model.inputPrice && newInput > 0) {
        console.log(`Price update: ${model.name} input $${model.inputPrice} -> $${newInput}`);
        model.inputPrice = newInput;
        updated = true;
      }
    }

    if (outputPerToken !== undefined) {
      const newOutput = parseFloat((outputPerToken * 1_000_000).toFixed(2));
      if (newOutput !== model.outputPrice && newOutput > 0) {
        console.log(`Price update: ${model.name} output $${model.outputPrice} -> $${newOutput}`);
        model.outputPrice = newOutput;
        updated = true;
      }
    }

    if (maxTokens !== undefined && maxTokens !== model.contextWindow && maxTokens > 0) {
      console.log(`Context update: ${model.name} ${model.contextWindow} -> ${maxTokens}`);
      model.contextWindow = maxTokens;
      updated = true;
    }
  }

  // Check for new models from tracked providers that we don't have yet
  for (const [key, value] of Object.entries(litellm)) {
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as Record<string, unknown>;

    // Skip if we already track this exact key
    if (TRACKED_MODELS[key]) continue;

    // Check if this model belongs to a provider we track
    let providerId: string | null = null;
    for (const [prefix, pid] of Object.entries(LITELLM_PROVIDER_MAP)) {
      if (key.startsWith(prefix)) {
        providerId = pid;
        break;
      }
    }
    if (!providerId) continue;

    const provider = current.providers.find(p => p.id === providerId);
    if (!provider) continue;

    // Only add models released recently (have a litellm_provider field)
    const litellmProvider = entry['litellm_provider'] as string | undefined;
    if (!litellmProvider) continue;

    const inputPerToken = entry['input_cost_per_token'] as number | undefined;
    const outputPerToken = entry['output_cost_per_token'] as number | undefined;
    const maxTokens = (entry['max_input_tokens'] || entry['max_tokens']) as number | undefined;

    // Skip if no pricing info or it's a variant/alias (contains ":")
    if (key.includes(':') || key.includes('/latest')) continue;
    if (inputPerToken === undefined || outputPerToken === undefined) continue;

    // Check we don't already have a model with a similar name
    const cleanKey = key.replace('gemini/', '').replace('mistral/', '');
    const alreadyHave = provider.models.some(
      m => m.id === cleanKey || m.name.toLowerCase().includes(cleanKey.toLowerCase())
    );
    if (alreadyHave) continue;

    // Add the new model
    const newModel: ModelEntry = {
      id: cleanKey,
      name: cleanKey,
      inputPrice: parseFloat((inputPerToken * 1_000_000).toFixed(2)),
      outputPrice: parseFloat((outputPerToken * 1_000_000).toFixed(2)),
      contextWindow: maxTokens || 128000,
      released: new Date().toISOString().slice(0, 7), // YYYY-MM
      capabilities: ['text'],
    };

    console.log(`New model detected: ${provider.name} / ${newModel.name}`);
    provider.models.push(newModel);
    updated = true;
  }

  if (updated) {
    current.lastUpdated = new Date().toISOString().slice(0, 10);
  }

  return current;
}

// ── Baseline data (mirrors data/*.json for first-run seeding) ───────

const BASELINE_PRICING: PricingData = {
  lastUpdated: '2026-03-28',
  providers: [
    {
      id: 'anthropic', name: 'Anthropic', logo: '/images/providers/anthropic.png', url: 'https://www.anthropic.com',
      models: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', inputPrice: 15.00, outputPrice: 75.00, contextWindow: 200000, released: '2026-03', capabilities: ['text', 'vision', 'tool-use', 'code'] },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', inputPrice: 3.00, outputPrice: 15.00, contextWindow: 200000, released: '2026-03', capabilities: ['text', 'vision', 'tool-use', 'code'] },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', inputPrice: 0.80, outputPrice: 4.00, contextWindow: 200000, released: '2025-06', capabilities: ['text', 'vision', 'tool-use', 'code'] },
      ],
    },
    {
      id: 'openai', name: 'OpenAI', logo: '/images/providers/openai.png', url: 'https://openai.com',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128000, released: '2024-05', capabilities: ['text', 'vision', 'tool-use', 'code'] },
        { id: 'gpt-4o-mini', name: 'GPT-4o-mini', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 128000, released: '2024-07', capabilities: ['text', 'vision', 'tool-use', 'code'] },
        { id: 'o1', name: 'o1', inputPrice: 15.00, outputPrice: 60.00, contextWindow: 200000, released: '2024-12', capabilities: ['text', 'reasoning', 'code'] },
        { id: 'o3-mini', name: 'o3-mini', inputPrice: 1.10, outputPrice: 4.40, contextWindow: 200000, released: '2025-01', capabilities: ['text', 'reasoning', 'code'] },
      ],
    },
    {
      id: 'google', name: 'Google', logo: '/images/providers/google.png', url: 'https://ai.google.dev',
      models: [
        { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', inputPrice: 1.25, outputPrice: 10.00, contextWindow: 1000000, released: '2025-03', capabilities: ['text', 'vision', 'tool-use', 'code', 'reasoning'] },
        { id: 'gemini-2-0-flash', name: 'Gemini 2.0 Flash', inputPrice: 0.10, outputPrice: 0.40, contextWindow: 1000000, released: '2025-02', capabilities: ['text', 'vision', 'tool-use', 'code'] },
      ],
    },
    {
      id: 'meta', name: 'Meta', logo: '/images/providers/meta.png', url: 'https://ai.meta.com',
      models: [
        { id: 'llama-4-scout', name: 'Llama 4 Scout', inputPrice: 0, outputPrice: 0, contextWindow: 10000000, released: '2025-04', openSource: true, license: 'Llama 4 Community License', capabilities: ['text', 'vision', 'code'] },
        { id: 'llama-4-maverick', name: 'Llama 4 Maverick', inputPrice: 0, outputPrice: 0, contextWindow: 1000000, released: '2025-04', openSource: true, license: 'Llama 4 Community License', capabilities: ['text', 'vision', 'code'] },
      ],
    },
    {
      id: 'mistral', name: 'Mistral', logo: '/images/providers/mistral.png', url: 'https://mistral.ai',
      models: [
        { id: 'mistral-large', name: 'Mistral Large', inputPrice: 2.00, outputPrice: 6.00, contextWindow: 128000, released: '2025-01', capabilities: ['text', 'vision', 'tool-use', 'code'] },
        { id: 'mistral-small', name: 'Mistral Small', inputPrice: 0.10, outputPrice: 0.30, contextWindow: 128000, released: '2025-01', capabilities: ['text', 'tool-use', 'code'] },
      ],
    },
    {
      id: 'cohere', name: 'Cohere', logo: '/images/providers/cohere.png', url: 'https://cohere.com',
      models: [
        { id: 'command-r-plus', name: 'Command R+', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128000, released: '2024-04', capabilities: ['text', 'tool-use', 'RAG'] },
        { id: 'command-r', name: 'Command R', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 128000, released: '2024-03', capabilities: ['text', 'tool-use', 'RAG'] },
      ],
    },
  ],
  pricingNotes: {
    unit: 'per 1M tokens',
    currency: 'USD',
    openSourceNote: 'Open source models are free to download and self-host. Hosted API pricing varies by provider.',
    disclaimer: 'Prices are subject to change. Check provider websites for the most current pricing.',
  },
};

const BASELINE_AGENTS: AgentsData = {
  lastUpdated: '2026-03-28',
  categories: [
    { id: 'coding', name: 'Coding Agents', description: 'AI-powered tools that write, review, and debug code directly in your development workflow.' },
    { id: 'research', name: 'Research Agents', description: 'AI agents specialized in finding, synthesizing, and analyzing information from various sources.' },
    { id: 'general', name: 'General / Personal Agents', description: 'Versatile AI assistants for everyday tasks including writing, analysis, brainstorming, and conversation.' },
    { id: 'creative', name: 'Creative Agents', description: 'AI tools for generating images, music, video, and other creative media.' },
    { id: 'frameworks', name: 'Frameworks & Platforms', description: 'Developer tools and SDKs for building custom AI agents and multi-agent workflows.' },
  ],
  agents: [
    { id: 'claude-code', name: 'Claude Code', provider: 'Anthropic', category: 'coding', description: 'An agentic CLI tool that lets Claude operate directly in your terminal, reading files, editing code, running commands, and managing git workflows autonomously.', url: 'https://docs.anthropic.com/en/docs/claude-code', pricing: 'Usage-based via Claude API', launched: 2025 },
    { id: 'cursor', name: 'Cursor', provider: 'Anysphere', category: 'coding', description: 'An AI-native code editor built on VS Code that provides inline code generation, multi-file editing, and codebase-aware chat powered by multiple foundation models.', url: 'https://cursor.sh', pricing: 'Free tier, Pro $20/mo, Business $40/mo', launched: 2023 },
    { id: 'github-copilot', name: 'GitHub Copilot', provider: 'GitHub / Microsoft', category: 'coding', description: 'An AI pair programmer integrated into popular editors that suggests code completions, generates functions from comments, and offers chat-based coding assistance.', url: 'https://github.com/features/copilot', pricing: 'Individual $10/mo, Business $19/mo, Enterprise $39/mo', launched: 2022 },
    { id: 'windsurf', name: 'Windsurf', provider: 'Codeium', category: 'coding', description: 'An AI-powered IDE that combines copilot and agent capabilities, allowing flows where the AI and developer collaborate on code changes across an entire project.', url: 'https://codeium.com/windsurf', pricing: 'Free tier, Pro $15/mo, Teams $30/mo', launched: 2024 },
    { id: 'perplexity', name: 'Perplexity', provider: 'Perplexity AI', category: 'research', description: 'An AI-powered answer engine that searches the web in real time, synthesizes information from multiple sources, and provides cited responses to complex questions.', url: 'https://www.perplexity.ai', pricing: 'Free tier, Pro $20/mo', launched: 2022 },
    { id: 'elicit', name: 'Elicit', provider: 'Elicit Inc.', category: 'research', description: 'A research assistant that helps find and analyze academic papers, extract key claims, and summarize findings across large bodies of scientific literature.', url: 'https://elicit.com', pricing: 'Free tier, Plus $10/mo, Enterprise custom', launched: 2021 },
    { id: 'consensus', name: 'Consensus', provider: 'Consensus NLP', category: 'research', description: 'A search engine that uses AI to find and synthesize results from peer-reviewed scientific research, providing evidence-based answers with citations.', url: 'https://consensus.app', pricing: 'Free tier, Premium $9.99/mo', launched: 2022 },
    { id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', category: 'general', description: 'A general-purpose AI assistant that can handle conversation, writing, coding, analysis, and web browsing, with plugin and custom GPT support for specialized tasks.', url: 'https://chat.openai.com', pricing: 'Free tier, Plus $20/mo, Team $25/mo, Enterprise custom', launched: 2022 },
    { id: 'gemini', name: 'Gemini', provider: 'Google', category: 'general', description: "Google's multimodal AI assistant with deep integration into Google Workspace, Search, and Android, capable of handling text, images, code, and long documents.", url: 'https://gemini.google.com', pricing: 'Free tier, Advanced $19.99/mo (included with Google One AI Premium)', launched: 2023 },
    { id: 'claude', name: 'Claude', provider: 'Anthropic', category: 'general', description: 'A helpful AI assistant known for nuanced instruction-following, long-context understanding, and careful reasoning across writing, analysis, coding, and research tasks.', url: 'https://claude.ai', pricing: 'Free tier, Pro $20/mo, Team $25/mo, Enterprise custom', launched: 2023 },
    { id: 'midjourney', name: 'Midjourney', provider: 'Midjourney Inc.', category: 'creative', description: 'A leading AI image generation tool that creates high-quality, artistic images from text prompts, known for its distinctive aesthetic style and photorealistic output.', url: 'https://www.midjourney.com', pricing: 'Basic $10/mo, Standard $30/mo, Pro $60/mo', launched: 2022 },
    { id: 'dall-e-3', name: 'DALL-E 3', provider: 'OpenAI', category: 'creative', description: "OpenAI's image generation model integrated into ChatGPT and available via API, offering precise prompt adherence and the ability to render text within images.", url: 'https://openai.com/dall-e-3', pricing: 'Included with ChatGPT Plus, API usage-based', launched: 2023 },
    { id: 'suno', name: 'Suno', provider: 'Suno Inc.', category: 'creative', description: 'An AI music generation platform that creates full songs with vocals, instruments, and lyrics from text prompts or custom lyrics input.', url: 'https://suno.com', pricing: 'Free tier, Pro $10/mo, Premier $30/mo', launched: 2023 },
    { id: 'langchain', name: 'LangChain', provider: 'LangChain Inc.', category: 'frameworks', description: 'An open-source framework for building LLM-powered applications with chains, agents, retrieval-augmented generation, and memory, supporting multiple model providers.', url: 'https://www.langchain.com', pricing: 'Open source (LangSmith platform has paid tiers)', launched: 2022 },
    { id: 'crewai', name: 'CrewAI', provider: 'CrewAI Inc.', category: 'frameworks', description: 'A framework for orchestrating role-playing AI agents that collaborate on complex tasks, allowing developers to define agent roles, goals, and delegation patterns.', url: 'https://www.crewai.com', pricing: 'Open source, Enterprise cloud plans available', launched: 2024 },
    { id: 'autogen', name: 'AutoGen', provider: 'Microsoft', category: 'frameworks', description: 'An open-source framework for building multi-agent conversational systems where multiple AI agents can collaborate, debate, and coordinate to solve tasks.', url: 'https://github.com/microsoft/autogen', pricing: 'Open source', launched: 2023 },
    { id: 'openai-assistants', name: 'OpenAI Assistants API', provider: 'OpenAI', category: 'frameworks', description: "A platform API for building AI assistants with persistent threads, file retrieval, code interpretation, and function calling built into OpenAI's hosted infrastructure.", url: 'https://platform.openai.com/docs/assistants', pricing: 'Usage-based via OpenAI API', launched: 2023 },
    { id: 'claude-mcp', name: 'Model Context Protocol (MCP)', provider: 'Anthropic', category: 'frameworks', description: 'An open protocol that standardizes how AI applications connect to external data sources and tools, enabling plug-and-play integrations for any MCP-compatible client.', url: 'https://modelcontextprotocol.io', pricing: 'Open source protocol', launched: 2024 },
  ],
};

// ── Main update function ────────────────────────────────────────────

export async function updateCatalog(env: Env): Promise<void> {
  console.log('Catalog update starting...');

  // --- Pricing / Models ---
  let pricing = await env.TENSORFEED_CACHE.get('pricing', 'json') as PricingData | null;
  if (!pricing) {
    console.log('Seeding pricing data from baseline');
    pricing = BASELINE_PRICING;
  }

  const litellm = await fetchLiteLLMPricing();
  if (litellm) {
    pricing = mergePricing(pricing, litellm);
    console.log('Merged LiteLLM pricing data');
  } else {
    console.log('LiteLLM fetch failed, keeping existing pricing');
  }

  await env.TENSORFEED_CACHE.put('pricing', JSON.stringify(pricing), {
    metadata: { updatedAt: new Date().toISOString() },
  });

  // --- Agents Directory ---
  let agents = await env.TENSORFEED_CACHE.get('agents-directory', 'json') as AgentsData | null;
  if (!agents) {
    console.log('Seeding agents directory from baseline');
    agents = BASELINE_AGENTS;
  }

  await env.TENSORFEED_CACHE.put('agents-directory', JSON.stringify(agents), {
    metadata: { updatedAt: new Date().toISOString() },
  });

  console.log(
    `Catalog update complete - ${pricing.providers.reduce((n, p) => n + p.models.length, 0)} models, ${agents.agents.length} agents`
  );
}

import { Env } from './types';
import { getAgentActivity } from './activity';

/**
 * Premium enriched agents directory.
 *
 * Joins the static `agents-directory` payload with live signals from
 * other KV namespaces:
 *   - status (services)         -> live_status, status_page_url
 *   - news (articles)           -> recent_news_count, recent_news (top 3)
 *   - agent activity            -> agent_traffic_24h (recent hits matching this provider)
 *   - models                    -> sample pricing for the provider's flagship
 *
 * Each enriched record gets a derived `trending_score` (0-100) computed
 * from recent news mentions, agent activity, and live status. Sort and
 * filter run server-side so agents can pull a tight, ranked list in one
 * call.
 *
 * Free `/api/agents/directory` continues to return the raw catalog.
 * This module powers the paid `/api/premium/agents/directory`.
 */

// === Source data shapes ===

export interface DirectoryAgent {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  url: string;
  pricing?: string;
  launched?: number | string;
  capabilities?: string[];
  openSource?: boolean;
}

interface DirectoryCategory {
  id: string;
  name: string;
  description?: string;
}

export interface DirectoryPayload {
  lastUpdated?: string;
  categories?: DirectoryCategory[];
  agents: DirectoryAgent[];
}

interface ServiceStatus {
  name: string;
  provider: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  statusPageUrl?: string;
  lastChecked?: string;
}

interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  snippet: string;
  publishedAt: string;
}

interface AgentActivityRecent {
  bot: string;
  endpoint: string;
  timestamp: string;
}

interface AgentActivityPayload {
  today_count: number;
  last_updated: string;
  recent: AgentActivityRecent[];
}

interface ModelPricing {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
  tier?: string;
}

interface ProviderPricing {
  id: string;
  name: string;
  models: ModelPricing[];
}

interface PricingPayload {
  providers: ProviderPricing[];
}

// === Enrichment output ===

export interface EnrichedAgent extends DirectoryAgent {
  live_status: ServiceStatus['status'] | 'unknown';
  status_page_url: string | null;
  recent_news_count: number;
  recent_news: { title: string; url: string; published_at: string; source: string }[];
  agent_traffic_24h: number;
  flagship_pricing: { model: string; input: number; output: number; blended: number } | null;
  trending_score: number;
}

export interface EnrichedDirectoryResult {
  ok: true;
  source: 'tensorfeed.ai';
  computed_at: string;
  total: number;
  returned: number;
  filters_applied: Record<string, unknown>;
  sort: SortKey;
  data_freshness: {
    directory: string | null;
    status: string | null;
    news: string | null;
    pricing: string | null;
    activity: string | null;
  };
  agents: EnrichedAgent[];
}

// === Provider matching ===

/**
 * Bot User-Agent signatures known to map to specific providers. Used to
 * attribute agent activity hits to a directory entry.
 */
const PROVIDER_TO_BOT_PATTERNS: Record<string, string[]> = {
  anthropic: ['ClaudeBot', 'anthropic-ai'],
  openai: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot'],
  perplexity: ['PerplexityBot'],
  google: ['Google-Extended', 'Googlebot'],
  microsoft: ['Bingbot'],
  apple: ['Applebot'],
  cohere: ['cohere-ai'],
  bytedance: ['Bytespider'],
  amazon: ['Amazonbot'],
};

function botsForProvider(provider: string): string[] {
  const key = provider.toLowerCase();
  for (const [k, bots] of Object.entries(PROVIDER_TO_BOT_PATTERNS)) {
    if (key.includes(k)) return bots;
  }
  return [];
}

function matchProviderToService(
  agent: DirectoryAgent,
  services: ServiceStatus[],
): ServiceStatus | null {
  const provider = agent.provider.toLowerCase();
  return (
    services.find(s => {
      const sp = (s.provider || '').toLowerCase();
      const sn = (s.name || '').toLowerCase();
      return sp === provider || sn === provider || sp.includes(provider) || provider.includes(sp);
    }) ?? null
  );
}

function matchArticles(agent: DirectoryAgent, articles: Article[]): Article[] {
  const provider = agent.provider.toLowerCase();
  const name = agent.name.toLowerCase();
  return articles.filter(a => {
    const src = (a.source || '').toLowerCase();
    const dom = (a.sourceDomain || '').toLowerCase();
    const title = (a.title || '').toLowerCase();
    return (
      src.includes(provider) ||
      dom.includes(provider) ||
      title.includes(provider) ||
      title.includes(name)
    );
  });
}

function flagshipPricingFor(
  agent: DirectoryAgent,
  pricing: PricingPayload | null,
): EnrichedAgent['flagship_pricing'] {
  if (!pricing?.providers) return null;
  const provider = agent.provider.toLowerCase();
  const match = pricing.providers.find(p => p.name.toLowerCase().includes(provider) || provider.includes(p.name.toLowerCase()));
  if (!match) return null;

  const flagship =
    match.models.find(m => m.tier === 'flagship') ??
    match.models[0];
  if (!flagship) return null;

  return {
    model: flagship.name,
    input: flagship.inputPrice,
    output: flagship.outputPrice,
    blended: parseFloat(((flagship.inputPrice + flagship.outputPrice) / 2).toFixed(4)),
  };
}

function activityForProvider(
  agent: DirectoryAgent,
  activity: AgentActivityPayload | null,
): number {
  if (!activity?.recent) return 0;
  const bots = botsForProvider(agent.provider);
  if (bots.length === 0) return 0;
  const lowered = bots.map(b => b.toLowerCase());
  return activity.recent.reduce((n, hit) => {
    const bot = (hit.bot || '').toLowerCase();
    return lowered.some(b => bot.includes(b)) ? n + 1 : n;
  }, 0);
}

function statusBoost(status: ServiceStatus['status'] | 'unknown'): number {
  switch (status) {
    case 'operational':
      return 10;
    case 'degraded':
      return 4;
    case 'down':
      return 0;
    default:
      return 6;
  }
}

/**
 * Trending score in [0, 100]:
 *   60% recent news (capped at 20 articles -> 60)
 *   30% agent activity (capped at 30 hits -> 30)
 *   10% live status boost (operational=10, degraded=4, down=0, unknown=6)
 */
export function computeTrendingScore(
  newsCount: number,
  agentActivity: number,
  status: ServiceStatus['status'] | 'unknown',
): number {
  const newsScore = Math.min(newsCount, 20) * 3; // 0-60
  const activityScore = Math.min(agentActivity, 30); // 0-30
  const score = newsScore + activityScore + statusBoost(status);
  return Math.min(100, Math.round(score));
}

// === Filters & sort ===

export type SortKey =
  | 'trending'
  | 'alphabetical'
  | 'status'
  | 'price_low'
  | 'price_high'
  | 'news_count';

export interface EnrichedOptions {
  category?: string;
  status?: 'operational' | 'degraded' | 'down' | 'unknown';
  open_source?: boolean;
  capability?: string;
  sort?: SortKey;
  limit?: number;
}

const STATUS_RANK: Record<ServiceStatus['status'] | 'unknown', number> = {
  operational: 0,
  degraded: 1,
  down: 2,
  unknown: 3,
};

function applySort(agents: EnrichedAgent[], key: SortKey): EnrichedAgent[] {
  const out = agents.slice();
  switch (key) {
    case 'alphabetical':
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'status':
      out.sort((a, b) => STATUS_RANK[a.live_status] - STATUS_RANK[b.live_status]);
      break;
    case 'price_low':
      out.sort((a, b) => {
        const ap = a.flagship_pricing?.blended ?? Number.POSITIVE_INFINITY;
        const bp = b.flagship_pricing?.blended ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      });
      break;
    case 'price_high':
      out.sort((a, b) => {
        const ap = a.flagship_pricing?.blended ?? Number.NEGATIVE_INFINITY;
        const bp = b.flagship_pricing?.blended ?? Number.NEGATIVE_INFINITY;
        return bp - ap;
      });
      break;
    case 'news_count':
      out.sort((a, b) => b.recent_news_count - a.recent_news_count);
      break;
    case 'trending':
    default:
      out.sort((a, b) => b.trending_score - a.trending_score);
  }
  return out;
}

function applyFilters(agents: EnrichedAgent[], opts: EnrichedOptions): EnrichedAgent[] {
  let out = agents;
  if (opts.category) {
    const k = opts.category.toLowerCase();
    out = out.filter(a => a.category.toLowerCase() === k);
  }
  if (opts.status) {
    out = out.filter(a => a.live_status === opts.status);
  }
  if (opts.open_source === true) {
    out = out.filter(a => a.openSource === true);
  } else if (opts.open_source === false) {
    out = out.filter(a => a.openSource !== true);
  }
  if (opts.capability) {
    const k = opts.capability.toLowerCase();
    out = out.filter(a => (a.capabilities ?? []).some(c => c.toLowerCase().includes(k)));
  }
  return out;
}

// === Top-level entry ===

export async function getEnrichedDirectory(
  env: Env,
  options: EnrichedOptions = {},
): Promise<EnrichedDirectoryResult> {
  const [directoryRaw, servicesRaw, articlesRaw, pricingRaw] = await Promise.all([
    env.TENSORFEED_CACHE.get('agents-directory', 'json') as Promise<DirectoryPayload | null>,
    env.TENSORFEED_STATUS.get('services', 'json') as Promise<ServiceStatus[] | null>,
    env.TENSORFEED_NEWS.get('articles', 'json') as Promise<Article[] | null>,
    env.TENSORFEED_CACHE.get('models', 'json') as Promise<PricingPayload | null>,
  ]);
  // Activity uses an in-process cache; safe to call.
  const activity = await getAgentActivity(env).catch(() => null);

  const directory: DirectoryPayload = directoryRaw ?? { agents: [] };
  const services: ServiceStatus[] = servicesRaw ?? [];
  const articles: Article[] = articlesRaw ?? [];

  const enriched: EnrichedAgent[] = directory.agents.map(agent => {
    const service = matchProviderToService(agent, services);
    const liveStatus = service?.status ?? 'unknown';
    const matchedArticles = matchArticles(agent, articles).slice(0, 50);
    const traffic = activityForProvider(agent, activity as AgentActivityPayload | null);
    const flagship = flagshipPricingFor(agent, pricingRaw);

    return {
      ...agent,
      live_status: liveStatus,
      status_page_url: service?.statusPageUrl ?? null,
      recent_news_count: matchedArticles.length,
      recent_news: matchedArticles.slice(0, 3).map(a => ({
        title: a.title,
        url: a.url,
        published_at: a.publishedAt,
        source: a.source,
      })),
      agent_traffic_24h: traffic,
      flagship_pricing: flagship,
      trending_score: computeTrendingScore(matchedArticles.length, traffic, liveStatus),
    };
  });

  const filtered = applyFilters(enriched, options);
  const sorted = applySort(filtered, options.sort ?? 'trending');
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const trimmed = sorted.slice(0, limit);

  return {
    ok: true,
    source: 'tensorfeed.ai',
    computed_at: new Date().toISOString(),
    total: enriched.length,
    returned: trimmed.length,
    filters_applied: {
      ...(options.category ? { category: options.category } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(typeof options.open_source === 'boolean' ? { open_source: options.open_source } : {}),
      ...(options.capability ? { capability: options.capability } : {}),
    },
    sort: options.sort ?? 'trending',
    data_freshness: {
      directory: directory.lastUpdated ?? null,
      status: services[0]?.lastChecked ?? null,
      news: articles[0]?.publishedAt ?? null,
      pricing: pricingRaw?.providers?.[0]?.name ? 'live' : null,
      activity: (activity as AgentActivityPayload | null)?.last_updated ?? null,
    },
    agents: trimmed,
  };
}

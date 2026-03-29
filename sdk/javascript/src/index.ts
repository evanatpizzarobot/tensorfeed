/**
 * TensorFeed.ai JavaScript/TypeScript SDK
 *
 * Free, no-auth API client for AI news, service status, and model data.
 * https://tensorfeed.ai/developers
 */

const DEFAULT_BASE_URL = 'https://tensorfeed.ai/api';

// ── Types ───────────────────────────────────────────────────────────

export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  snippet: string;
  categories: string[];
  publishedAt: string;
  fetchedAt: string;
}

export interface NewsResponse {
  ok: boolean;
  source: string;
  updated: string;
  count: number;
  articles: Article[];
}

export interface ServiceStatus {
  name: string;
  provider: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  components: { name: string; status: string }[];
  lastChecked?: string;
}

export interface StatusResponse {
  ok: boolean;
  source: string;
  checked: string;
  services: ServiceStatus[];
}

export interface Model {
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

export interface Provider {
  id: string;
  name: string;
  logo: string;
  url: string;
  models: Model[];
}

export interface ModelsResponse {
  ok: boolean;
  source: string;
  lastUpdated: string;
  providers: Provider[];
}

export interface AgentActivity {
  today_count: number;
  last_updated: string;
  recent: { bot: string; endpoint: string; timestamp: string }[];
}

export interface HealthResponse {
  ok: boolean;
  timestamp: string;
  news: { totalArticles: number; sourcesPolled: number; sourcesSucceeded: number; lastUpdated: string };
}

export interface TensorFeedOptions {
  baseUrl?: string;
}

// ── Client ──────────────────────────────────────────────────────────

export class TensorFeed {
  private baseUrl: string;

  constructor(options?: TensorFeedOptions) {
    this.baseUrl = options?.baseUrl || DEFAULT_BASE_URL;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'User-Agent': 'TensorFeed-SDK-JS/1.0' },
    });
    if (!res.ok) {
      throw new Error(`TensorFeed API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  /** Get latest AI news articles */
  async news(options?: { category?: string; limit?: number }): Promise<NewsResponse> {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.get<NewsResponse>(`/news${qs ? `?${qs}` : ''}`);
  }

  /** Get real-time AI service status */
  async status(): Promise<StatusResponse> {
    return this.get<StatusResponse>('/status');
  }

  /** Get status summary (lightweight) */
  async statusSummary(): Promise<{ ok: boolean; services: { name: string; status: string; provider: string }[] }> {
    return this.get('/status/summary');
  }

  /** Get AI model pricing and specs */
  async models(): Promise<ModelsResponse> {
    return this.get<ModelsResponse>('/models');
  }

  /** Get agent activity metrics */
  async agentActivity(): Promise<AgentActivity> {
    return this.get<AgentActivity>('/agents/activity');
  }

  /** Health check */
  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  /** Check if a specific service is down */
  async isDown(serviceName: string): Promise<{ name: string; status: string; isDown: boolean }> {
    const data = await this.status();
    const service = data.services.find(
      s => s.name.toLowerCase().includes(serviceName.toLowerCase()) ||
           s.provider.toLowerCase().includes(serviceName.toLowerCase())
    );
    if (!service) {
      throw new Error(`Service "${serviceName}" not found. Available: ${data.services.map(s => s.name).join(', ')}`);
    }
    return {
      name: service.name,
      status: service.status,
      isDown: service.status === 'down',
    };
  }
}

export default TensorFeed;

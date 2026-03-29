'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------
const BASE_URL = 'https://terminalfeed.io/api';

// ---------------------------------------------------------------------------
// Standard API wrapper
// ---------------------------------------------------------------------------
interface TFApiResponse<T> {
  source: string;
  endpoint: string;
  updated_at: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Endpoint-specific types
// ---------------------------------------------------------------------------

/** /api/service-status */
export interface TFServiceStatus {
  name: string;
  status: string;
  description: string;
}

/** /api/github-trending */
export interface TFGithubRepo {
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  todayStars: number;
  url: string;
}

/** /api/internet-pulse */
export interface TFPulseRegion {
  name: string;
  latency_ms: number;
}

/** /api/predictions */
export interface TFPrediction {
  question: string;
  yes_percent: number;
  no_percent: number;
  volume_usd: number;
}

/** /api/cyber-threats */
export interface TFThreat {
  ioc: string;
  ioc_type: string;
  threat_type: string;
  malware: string;
  reporter: string;
  timestamp: string;
}

/** /api/economic-data */
export interface TFEconomicIndicator {
  name: string;
  value: number;
  unit: string;
  date: string;
}

/** /api/briefing */
export interface TFBriefing {
  summary: string;
  generated_at: string;
  sections: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Generic hook return type
// ---------------------------------------------------------------------------
export interface UseTerminalFeedResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// ---------------------------------------------------------------------------
// Generic fetch + auto-refresh hook
// ---------------------------------------------------------------------------
export function useTerminalFeedData<T>(
  endpoint: string,
  refreshInterval: number,
): UseTerminalFeedResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/${endpoint}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json: TFApiResponse<T> = await res.json();
      setData(json.data);
      setLastUpdated(json.updated_at);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    intervalRef.current = setInterval(fetchData, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, lastUpdated };
}

// ---------------------------------------------------------------------------
// Convenience hooks
// ---------------------------------------------------------------------------

export function useServiceStatus() {
  return useTerminalFeedData<TFServiceStatus[]>('service-status', 60_000);
}

export function useGithubTrending() {
  return useTerminalFeedData<TFGithubRepo[]>('github-trending', 300_000);
}

export function useInternetPulse() {
  return useTerminalFeedData<TFPulseRegion[]>('internet-pulse', 60_000);
}

export function usePredictions() {
  return useTerminalFeedData<TFPrediction[]>('predictions', 60_000);
}

export function useCyberThreats() {
  return useTerminalFeedData<TFThreat[]>('cyber-threats', 60_000);
}

export function useEconomicData() {
  return useTerminalFeedData<TFEconomicIndicator[]>('economic-data', 3_600_000);
}

export function useBriefing() {
  return useTerminalFeedData<TFBriefing>('briefing', 300_000);
}

// ---------------------------------------------------------------------------
// AI relevance filter
// ---------------------------------------------------------------------------

export const AI_KEYWORDS =
  /\b(ai|artificial.intelligence|machine.learning|deep.learning|neural.net(work)?s?|llm|large.language.model|gpt|openai|anthropic|gemini|diffusion|transformer|nlp|computer.vision|generative|chatbot|agi|rlhf|fine.tun(e|ing)|embedding|vector.db|langchain|hugging.?face|stable.diffusion|midjourney|copilot|auto.?gpt|rag|retrieval.augmented)\b/i;

export function isAIRelated(text: string): boolean {
  return AI_KEYWORDS.test(text);
}

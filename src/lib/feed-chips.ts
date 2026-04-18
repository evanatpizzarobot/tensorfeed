import type { NewsArticle } from './types';

export type ChipKey =
  | 'all'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'meta'
  | 'research'
  | 'hardware'
  | 'hackernews';

export interface ChipDef {
  key: ChipKey;
  label: string;
  color?: string;
}

export const CHIPS: ChipDef[] = [
  { key: 'all', label: 'All' },
  { key: 'anthropic', label: 'Anthropic', color: 'var(--src-anthropic)' },
  { key: 'openai', label: 'OpenAI', color: 'var(--src-openai)' },
  { key: 'google', label: 'Google', color: 'var(--src-google)' },
  { key: 'meta', label: 'Meta / Llama', color: 'var(--src-meta)' },
  { key: 'research', label: 'Research', color: 'var(--src-arxiv)' },
  { key: 'hardware', label: 'Hardware', color: 'var(--src-nvidia)' },
  { key: 'hackernews', label: 'Hacker News', color: 'var(--src-hackernews)' },
];

/**
 * Brand keyword sets per provider. Matched against title + snippet so that
 * articles about a company's products count toward that company's chip even
 * when the article is published by a third-party source (Verge, HN, etc.).
 */
const BRAND_PATTERNS: Partial<Record<ChipKey, RegExp>> = {
  anthropic:
    /\b(anthropic|claude|opus|sonnet|haiku|claude code|constitutional ai|computer use)\b/i,
  openai:
    /\b(openai|chatgpt|gpt-?[345]|gpt-?4o|gpt-?4\.5|sora|dall-?e|whisper|o1|o3|o4|codex|sam altman)\b/i,
  google:
    /\b(google|gemini|deepmind|bard|notebooklm|imagen|veo|astra|tpu)\b/i,
  meta:
    /\b(meta ai|facebook ai|llama|maverick|behemoth|fair labs?|yann lecun)\b/i,
  research:
    /\b(arxiv|paper|preprint|benchmark(?:s|ed)?|evaluation|ablation|finetun)\b/i,
  hardware:
    /\b(nvidia|amd|intel|tsmc|blackwell|hopper|h100|h200|b200|b300|gpu|chip|fab|wafer)\b/i,
  hackernews: /\b(hacker news|ycombinator|hn discussion)\b/i,
};

function articleMatches(a: NewsArticle, brand: RegExp, sourcePattern?: RegExp, categoryPattern?: RegExp) {
  const haystack = `${a.title} ${a.snippet}`;
  if (brand.test(haystack)) return true;
  if (sourcePattern && sourcePattern.test(a.source)) return true;
  if (categoryPattern && a.categories.some((c) => categoryPattern.test(c))) return true;
  return false;
}

const MATCHERS: Record<ChipKey, (a: NewsArticle) => boolean> = {
  all: () => true,
  anthropic: (a) =>
    articleMatches(a, BRAND_PATTERNS.anthropic!, /anthropic|claude/i, /anthropic|claude/i),
  openai: (a) => articleMatches(a, BRAND_PATTERNS.openai!, /openai|chatgpt/i, /openai/i),
  google: (a) =>
    articleMatches(a, BRAND_PATTERNS.google!, /google|gemini|deepmind/i, /google\/gemini/i),
  meta: (a) =>
    articleMatches(a, BRAND_PATTERNS.meta!, /(^|\b)meta(\b|$)|facebook|llama/i, /meta\/llama/i),
  research: (a) =>
    articleMatches(a, BRAND_PATTERNS.research!, /arxiv|mit tech|nature|science/i, /research/i),
  hardware: (a) =>
    articleMatches(a, BRAND_PATTERNS.hardware!, /nvidia|amd|intel|tsmc/i, /hardware/i),
  hackernews: (a) => articleMatches(a, BRAND_PATTERNS.hackernews!, /hacker news|ycombinator/i),
};

export function filterByChip(articles: NewsArticle[], chip: ChipKey): NewsArticle[] {
  if (chip === 'all') return articles;
  return articles.filter(MATCHERS[chip]);
}

export function chipCounts(articles: NewsArticle[]): Record<ChipKey, number> {
  const out = {
    all: articles.length,
    anthropic: 0,
    openai: 0,
    google: 0,
    meta: 0,
    research: 0,
    hardware: 0,
    hackernews: 0,
  } as Record<ChipKey, number>;
  for (const def of CHIPS) {
    if (def.key === 'all') continue;
    out[def.key] = articles.filter(MATCHERS[def.key]).length;
  }
  return out;
}

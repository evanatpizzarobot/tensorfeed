import React from 'react';

/**
 * Subtle text highlighting for headlines and snippets.
 *
 * Three highlight layers, applied in order of specificity:
 *   1. Dollar amounts             -> gold (--accent-amber)
 *   2. AI provider / model names  -> per-brand color (matches the source-coding system)
 *   3. GPU canonical names        -> green
 *   4. Severity verbs             -> red (negative) / green (positive)
 *
 * Restraint matters. The brand looks worse with too much color than with too
 * little. Only one highlight per word. The default text color stays unchanged.
 *
 * Implementation note: we tokenize the input string once with a single
 * combined regex, then map each match to a styled span. Plain text passes
 * through. No HTML parsing, no innerHTML, safe by construction.
 */

// Brand color tokens. Hex values match the design system + source-coding
// taxonomy already used elsewhere (article card left borders, model
// directory, status colors).
const COLOR = {
  money: '#f59e0b',        // amber
  anthropic: '#f97316',    // coral/orange
  openai: '#10b981',       // green
  google: '#3b82f6',       // blue
  meta: '#a855f7',         // purple
  deepseek: '#06b6d4',     // cyan
  mistral: '#fb923c',      // orange
  cohere: '#14b8a6',       // teal
  nvidia: '#84cc16',       // lime
  microsoft: '#3b82f6',    // blue
  apple: '#9ca3af',        // gray
  amazon: '#f97316',       // orange
  gpu: '#10b981',          // green for high-tier GPUs
  severityRed: '#ef4444',  // negative
  severityGreen: '#10b981',// positive
};

type Highlight = { color: string; weight?: 'medium' | 'semibold' };

const BRAND_COLOR: Record<string, Highlight> = {
  // Anthropic family
  Anthropic: { color: COLOR.anthropic, weight: 'semibold' },
  Claude: { color: COLOR.anthropic, weight: 'semibold' },
  Opus: { color: COLOR.anthropic },
  Sonnet: { color: COLOR.anthropic },
  Haiku: { color: COLOR.anthropic },
  // OpenAI family
  OpenAI: { color: COLOR.openai, weight: 'semibold' },
  ChatGPT: { color: COLOR.openai, weight: 'semibold' },
  GPT: { color: COLOR.openai },
  // Google family
  Google: { color: COLOR.google, weight: 'semibold' },
  Gemini: { color: COLOR.google, weight: 'semibold' },
  DeepMind: { color: COLOR.google },
  // Meta family
  Meta: { color: COLOR.meta, weight: 'semibold' },
  Llama: { color: COLOR.meta, weight: 'semibold' },
  LLaMA: { color: COLOR.meta, weight: 'semibold' },
  // Other labs
  DeepSeek: { color: COLOR.deepseek, weight: 'semibold' },
  Mistral: { color: COLOR.mistral, weight: 'semibold' },
  Cohere: { color: COLOR.cohere, weight: 'semibold' },
  // Hardware / hyperscalers
  NVIDIA: { color: COLOR.nvidia, weight: 'semibold' },
  Nvidia: { color: COLOR.nvidia, weight: 'semibold' },
  Microsoft: { color: COLOR.microsoft, weight: 'semibold' },
  Apple: { color: COLOR.apple, weight: 'semibold' },
  Amazon: { color: COLOR.amazon, weight: 'semibold' },
  AWS: { color: COLOR.amazon, weight: 'semibold' },
  Azure: { color: COLOR.microsoft, weight: 'semibold' },
};

const GPU_NAMES = ['H200', 'H100', 'B200', 'A100', 'A6000', 'L40S', 'L40', 'L4', 'MI300X', 'MI250'];
const GPU_HIGHLIGHT: Highlight = { color: COLOR.gpu, weight: 'semibold' };

const SEVERITY_RED_WORDS = [
  'outage', 'outages', 'down', 'breach', 'breached', 'leak', 'leaked', 'leaks',
  'lawsuit', 'sued', 'sues', 'hacked', 'banned', 'fired', 'collapse', 'collapsed',
  'failure', 'failed', 'crisis', 'attack',
];
const SEVERITY_GREEN_WORDS = [
  'launch', 'launches', 'launched', 'release', 'releases', 'released',
  'ships', 'shipped', 'open-source', 'open source', 'breakthrough',
];

const SEVERITY_RED: Highlight = { color: COLOR.severityRed };
const SEVERITY_GREEN: Highlight = { color: COLOR.severityGreen };
const MONEY: Highlight = { color: COLOR.money, weight: 'semibold' };

// Pre-build the combined regex. Order matters: money first (greedy), then
// brand names, then GPU names, then severity words. Word boundaries on
// names so we don't match "GPTfoo".
function buildPattern(): RegExp {
  const escapeForAlternation = (s: string) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const moneyPattern = '\\$\\d{1,3}(?:[.,]\\d+)?\\s?[BMKbk]?(?:[/-]hr)?';
  const brandNames = Object.keys(BRAND_COLOR)
    .sort((a, b) => b.length - a.length)
    .map(escapeForAlternation)
    .join('|');
  const gpuNamesPattern = GPU_NAMES.sort((a, b) => b.length - a.length)
    .map(escapeForAlternation)
    .join('|');
  const severityRedPattern = SEVERITY_RED_WORDS
    .sort((a, b) => b.length - a.length)
    .map(escapeForAlternation)
    .join('|');
  const severityGreenPattern = SEVERITY_GREEN_WORDS
    .sort((a, b) => b.length - a.length)
    .map(escapeForAlternation)
    .join('|');

  // Each alternative is in its own capture group so we know which highlight to apply.
  // Brands and GPUs use \b word boundaries; severity words are matched case-insensitively.
  return new RegExp(
    `(${moneyPattern})` +
    `|\\b(${brandNames})\\b` +
    `|\\b(${gpuNamesPattern})\\b` +
    `|\\b(${severityRedPattern})\\b` +
    `|\\b(${severityGreenPattern})\\b`,
    'g',
  );
}

let cachedPattern: RegExp | null = null;
function getPattern(): RegExp {
  if (!cachedPattern) cachedPattern = buildPattern();
  cachedPattern.lastIndex = 0;
  return cachedPattern;
}

interface Token {
  text: string;
  highlight?: Highlight;
}

export function tokenizeForHighlight(input: string): Token[] {
  if (!input) return [];
  const pattern = getPattern();
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: input.slice(lastIndex, match.index) });
    }
    const matched = match[0];
    let highlight: Highlight | undefined;
    if (match[1]) {
      highlight = MONEY;
    } else if (match[2]) {
      highlight = BRAND_COLOR[match[2]];
    } else if (match[3]) {
      highlight = GPU_HIGHLIGHT;
    } else if (match[4]) {
      // Case-insensitive: severity words are matched in any case but we
      // applied the regex without 'i' since most severity words are lowercase
      // in normal news text. If the match landed via the brand alternation
      // accidentally, we still color correctly.
      highlight = SEVERITY_RED;
    } else if (match[5]) {
      highlight = SEVERITY_GREEN;
    }
    tokens.push({ text: matched, highlight });
    lastIndex = match.index + matched.length;
  }
  if (lastIndex < input.length) {
    tokens.push({ text: input.slice(lastIndex) });
  }
  return tokens;
}

interface HighlightedTextProps {
  text: string;
  className?: string;
}

/**
 * Render a string with subtle inline highlighting. Safe: only renders text,
 * never HTML. Use for headlines and short snippets. Skip for long-form body
 * (the noise compounds at length).
 */
export default function HighlightedText({ text, className }: HighlightedTextProps) {
  const tokens = tokenizeForHighlight(text);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (!tok.highlight) return <React.Fragment key={i}>{tok.text}</React.Fragment>;
        const style: React.CSSProperties = { color: tok.highlight.color };
        if (tok.highlight.weight === 'semibold') style.fontWeight = 600;
        if (tok.highlight.weight === 'medium') style.fontWeight = 500;
        return (
          <span key={i} style={style}>
            {tok.text}
          </span>
        );
      })}
    </span>
  );
}

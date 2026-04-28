/**
 * Shared bot-detection patterns for the Pages Functions middleware.
 * Mirrors the patterns in worker/src/activity.ts so labels match across
 * Worker-tracked hits and Pages-tracked hits in the same buffer.
 */

const BOT_PATTERNS: [RegExp, string][] = [
  [/ClaudeBot/i, 'ClaudeBot'],
  [/anthropic-ai/i, 'anthropic-ai'],
  [/GPTBot/i, 'GPTBot'],
  [/ChatGPT-User/i, 'ChatGPT-User'],
  [/OAI-SearchBot/i, 'OAI-SearchBot'],
  [/PerplexityBot/i, 'PerplexityBot'],
  [/Google-Extended/i, 'Google-Extended'],
  [/Googlebot/i, 'Googlebot'],
  [/Bingbot/i, 'Bingbot'],
  [/Applebot/i, 'Applebot'],
  [/DuckDuckBot/i, 'DuckDuckBot'],
  [/Bytespider/i, 'Bytespider'],
  [/Amazonbot/i, 'Amazonbot'],
  [/FacebookExternalHit/i, 'FacebookBot'],
  [/Twitterbot/i, 'Twitterbot'],
  [/cohere-ai/i, 'cohere-ai'],
  [/Scrapy/i, 'Scrapy'],
  [/python-requests/i, 'python-requests'],
  [/axios/i, 'axios'],
  [/node-fetch/i, 'node-fetch'],
  [/YouBot/i, 'YouBot'],
  [/Timely/i, 'Timely'],
  [/bot\b/i, 'Unknown Bot'],
  [/crawler/i, 'Unknown Crawler'],
  [/spider/i, 'Unknown Spider'],
  [/agent\b/i, 'Unknown Agent'],
];

export function detectBot(userAgent: string): string | null {
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

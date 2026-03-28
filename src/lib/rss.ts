import Parser from 'rss-parser';
import { NewsArticle } from './types';
import sourcesData from '../../data/sources.json';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'TensorFeed/1.0 (https://tensorfeed.ai)',
  },
});

function generateId(url: string): string {
  // Simple hash from URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

export async function fetchAllFeeds(): Promise<NewsArticle[]> {
  const sources = sourcesData.sources.filter(s => s.active);
  const allArticles: NewsArticle[] = [];

  const feedPromises = sources.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url);
      const articles: NewsArticle[] = (feed.items || []).slice(0, 10).map((item) => {
        const snippet = item.contentSnippet || item.content || item.summary || '';
        return {
          id: generateId(item.link || item.guid || item.title || ''),
          title: item.title?.trim() || 'Untitled',
          url: item.link || '',
          source: source.name,
          sourceIcon: source.icon,
          sourceDomain: source.domain,
          snippet: truncate(stripHtml(snippet), 250),
          categories: source.categories,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
        };
      });
      return articles;
    } catch (error) {
      console.warn(`Failed to fetch ${source.name} (${source.url}):`, error);
      return [];
    }
  });

  const results = await Promise.allSettled(feedPromises);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    }
  }

  // Sort by published date, newest first
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allArticles.filter(article => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });

  return deduped;
}

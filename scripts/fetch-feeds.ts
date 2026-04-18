import { fetchAllFeeds } from '../src/lib/rss';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  snippet: string;
  categories: string[];
  publishedAt: string;
  fetchedAt: string;
  sourceIcon?: string;
}

// ---------------------------------------------------------------------------
// Agent API helpers
// ---------------------------------------------------------------------------

function buildAgentNews(articles: Article[]) {
  return {
    ok: true,
    count: articles.length,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source,
      sourceDomain: a.sourceDomain,
      snippet: a.snippet,
      categories: a.categories,
      publishedAt: a.publishedAt,
      fetchedAt: a.fetchedAt,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// File writing helper
// ---------------------------------------------------------------------------

function writeFile(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  Wrote ${filePath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const root = path.resolve(__dirname, '..');
  const publicDir = path.join(root, 'public');
  const dataDir = path.join(root, 'data');

  // 1. Fetch articles from live RSS feeds
  console.log('Fetching RSS feeds...');
  const articles: Article[] = await fetchAllFeeds();
  console.log(`Fetched ${articles.length} articles from live RSS feeds`);

  // Write raw data
  const outputPath = path.join(dataDir, 'articles.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ articles, fetchedAt: new Date().toISOString() }, null, 2),
  );
  console.log(`Wrote articles to ${outputPath}`);

  // NOTE: /feed.xml, /feed.json, /feed/research.xml, and /feed/tools.xml are
  // served dynamically by the Worker (see worker/src/index.ts). The Worker
  // reads the freshest articles from KV on every request (cached 60 to 300s)
  // so the feeds stay within 10 minutes of the latest RSS poll instead of
  // being frozen at build time.

  // 2. Generate static agent API JSON files
  console.log('\nGenerating agent API files...');

  const agentApiDir = path.join(publicDir, 'api', 'agents');
  fs.mkdirSync(agentApiDir, { recursive: true });

  // news.json
  writeFile(
    path.join(agentApiDir, 'news.json'),
    JSON.stringify(buildAgentNews(articles), null, 2),
  );

  // status.json - fetch from live worker API
  try {
    const statusRes = await fetch('https://tensorfeed.ai/api/status');
    const statusData = statusRes.ok ? await statusRes.json() : { ok: true, services: [], fetchedAt: new Date().toISOString() };
    writeFile(path.join(agentApiDir, 'status.json'), JSON.stringify(statusData, null, 2));
  } catch {
    writeFile(path.join(agentApiDir, 'status.json'), JSON.stringify({ ok: true, services: [], fetchedAt: new Date().toISOString() }, null, 2));
  }

  // pricing.json - copy from data/pricing.json
  const pricingRaw = fs.readFileSync(
    path.join(dataDir, 'pricing.json'),
    'utf-8',
  );
  const pricingData = JSON.parse(pricingRaw);
  writeFile(
    path.join(agentApiDir, 'pricing.json'),
    JSON.stringify({ ok: true, ...pricingData }, null, 2),
  );

  console.log('\nDone. All feeds and API files generated.');
}

main().catch(console.error);

import { fetchAllFeeds } from '../src/lib/rss';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Fetching RSS feeds...');
  const articles = await fetchAllFeeds();
  console.log(`Fetched ${articles.length} articles from live RSS feeds`);

  const outputPath = path.join(__dirname, '..', 'data', 'articles.json');
  fs.writeFileSync(outputPath, JSON.stringify({ articles, fetchedAt: new Date().toISOString() }, null, 2));
  console.log(`Wrote articles to ${outputPath}`);
}

main().catch(console.error);

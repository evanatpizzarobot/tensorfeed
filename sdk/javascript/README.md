# tensorfeed

JavaScript/TypeScript SDK for the [TensorFeed.ai](https://tensorfeed.ai) API.

Free, no API key needed. Get real-time AI news, service status, and model pricing data.

## Install

```bash
npm install tensorfeed
```

## Usage

```typescript
import { TensorFeed } from 'tensorfeed';

const tf = new TensorFeed();

// Get latest AI news
const news = await tf.news({ limit: 10 });
console.log(news.articles);

// Filter by category
const research = await tf.news({ category: 'research', limit: 5 });

// Check AI service status
const status = await tf.status();
status.services.forEach(s => {
  console.log(`${s.name}: ${s.status}`);
});

// Check if a specific service is down
const claude = await tf.isDown('claude');
console.log(`Claude is ${claude.isDown ? 'DOWN' : 'operational'}`);

// Get model pricing
const models = await tf.models();
models.providers.forEach(p => {
  p.models.forEach(m => {
    console.log(`${p.name} ${m.name}: $${m.inputPrice}/1M input`);
  });
});

// Health check
const health = await tf.health();
console.log(`${health.news.totalArticles} articles from ${health.news.sourcesSucceeded} sources`);
```

## API Reference

| Method | Description |
|--------|-------------|
| `tf.news({ category?, limit? })` | Latest AI news articles |
| `tf.status()` | Real-time AI service status |
| `tf.statusSummary()` | Lightweight status summary |
| `tf.models()` | Model pricing and specs |
| `tf.isDown(serviceName)` | Check if a service is down |
| `tf.agentActivity()` | Agent traffic metrics |
| `tf.health()` | API health check |

## Links

- [API Docs](https://tensorfeed.ai/developers)
- [TensorFeed.ai](https://tensorfeed.ai)

## License

MIT - [TensorFeed.ai](https://tensorfeed.ai/about)

# tensorfeed

Python SDK for the [TensorFeed.ai](https://tensorfeed.ai) API.

Free, no API key needed. Get real-time AI news, service status, and model pricing data.

## Install

```bash
pip install tensorfeed
```

## Usage

```python
from tensorfeed import TensorFeed

tf = TensorFeed()

# Get latest AI news
news = tf.news(limit=10)
for article in news["articles"]:
    print(f'{article["title"]} ({article["source"]})')

# Filter by category
research = tf.news(category="research", limit=5)

# Check AI service status
status = tf.status()
for service in status["services"]:
    print(f'{service["name"]}: {service["status"]}')

# Check if a specific service is down
result = tf.is_down("claude")
print(f'Claude is {"DOWN" if result["is_down"] else "operational"}')

# Get model pricing
models = tf.models()
for provider in models["providers"]:
    for model in provider["models"]:
        print(f'{provider["name"]} {model["name"]}: ${model["inputPrice"]}/1M input')

# Health check
health = tf.health()
print(f'{health["news"]["totalArticles"]} articles from {health["news"]["sourcesSucceeded"]} sources')
```

## API Reference

| Method | Description |
|--------|-------------|
| `tf.news(category=, limit=)` | Latest AI news articles |
| `tf.status()` | Real-time AI service status |
| `tf.status_summary()` | Lightweight status summary |
| `tf.models()` | Model pricing and specs |
| `tf.is_down(service_name)` | Check if a service is down |
| `tf.agent_activity()` | Agent traffic metrics |
| `tf.health()` | API health check |

## Links

- [API Docs](https://tensorfeed.ai/developers)
- [TensorFeed.ai](https://tensorfeed.ai)

## License

MIT - [TensorFeed.ai](https://tensorfeed.ai/about)

import { Metadata } from 'next';
import Link from 'next/link';
import { PenTool, Clock, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'TensorFeed Originals | In-Depth AI Analysis & Editorial',
};

const ARTICLES = [
  {
    slug: 'why-we-built-tensorfeed',
    title: 'Why We Built TensorFeed.ai',
    date: 'Mar 28, 2026',
    description:
      'Every morning I found myself opening a dozen tabs to check AI news, model releases, and API status pages. TensorFeed started as a personal frustration and grew into an aggregated hub built for humans and AI agents alike.',
  },
  {
    slug: 'state-of-ai-apis-2026',
    title: 'The State of AI APIs in 2026',
    date: 'Mar 30, 2026',
    description:
      'The API landscape shifted dramatically over the past year. Pricing wars, the context window race, agent-native endpoints, MCP protocol adoption, and structured outputs all reshaped how developers build on AI. We break down what matters.',
  },
  {
    slug: 'claude-vs-gpt-vs-gemini',
    title: 'Claude vs GPT vs Gemini: An Honest Comparison',
    date: 'Apr 2, 2026',
    description:
      'Benchmarks only tell part of the story. We ran all three frontier models through real-world coding, writing, analysis, and research tasks. Here is what we found, including a task-by-task scorecard and pricing comparison.',
  },
  {
    slug: 'building-for-ai-agents',
    title: 'Building for AI Agents: What Developers Need to Know',
    date: 'Apr 5, 2026',
    description:
      'AI agents are moving from demos to production, and the software they need looks different from traditional web apps. Structured data, llms.txt, MCP servers, and agent-friendly API design patterns that actually work.',
  },
];

export default function OriginalsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <PenTool className="w-7 h-7 text-accent-primary" />
          <h1 className="text-3xl font-bold text-text-primary">TensorFeed Originals</h1>
        </div>
        <p className="text-text-secondary text-lg">
          In-depth analysis and perspectives on the AI landscape
        </p>
      </div>

      {/* Articles */}
      <div className="grid gap-6">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/originals/${article.slug}`}
            className="group block bg-bg-secondary border border-border rounded-xl p-6 hover:border-accent-primary transition-colors"
          >
            <div className="flex items-start gap-4">
              <PenTool className="w-5 h-5 text-accent-primary shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent-primary transition-colors">
                    {article.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Evan Marcus</span>
                  <span>&middot;</span>
                  <span>{article.date}</span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed mb-3">
                  {article.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-accent-primary font-medium group-hover:gap-2 transition-all">
                  Read More
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

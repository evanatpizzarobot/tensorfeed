import { Metadata } from 'next';
import Link from 'next/link';
import { PenTool, Clock, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'TensorFeed Originals | In-Depth AI Analysis & Editorial',
};

const ARTICLES = [
  {
    slug: 'claude-mythos-not-afraid',
    title: 'Claude Mythos: Anthropic\'s Most Powerful Model Yet, and Why I\'m Not Afraid',
    author: 'Ripper',
    date: 'Apr 8, 2026',
    readTime: '8 min read',
    description:
      'Anthropic unveiled Claude Mythos Preview, a model that found tens of thousands of zero-days and escaped its own sandbox. They gave it to defenders first. Here\'s why that matters.',
  },
  {
    slug: 'building-for-ai-agents',
    title: 'Building for AI Agents: What Developers Need to Know',
    author: 'Ripper',
    date: 'Apr 5, 2026',
    readTime: '6 min read',
    description:
      'AI agents are moving from demos to production, and the software they need looks different from traditional web apps. Structured data, llms.txt, MCP servers, and agent-friendly API design patterns that actually work.',
  },
  {
    slug: 'rise-of-agentic-ai',
    title: 'The Rise of Agentic AI: From Chatbots to Autonomous Workers',
    author: 'Kira Nolan',
    date: 'Apr 4, 2026',
    readTime: '5 min read',
    description:
      'Gartner says 40% of enterprise apps will have AI agents by end of 2026. OpenClaw went viral. NVIDIA shipped Agent Toolkit at GTC. What separates a chatbot from an agent and why it matters.',
  },
  {
    slug: 'claude-vs-gpt-vs-gemini',
    title: 'Claude vs GPT vs Gemini: An Honest Comparison',
    author: 'Ripper',
    date: 'Apr 2, 2026',
    readTime: '6 min read',
    description:
      'Benchmarks only tell part of the story. We ran all three frontier models through real-world coding, writing, analysis, and research tasks. Here is what we found, including a task-by-task scorecard and pricing comparison.',
  },
  {
    slug: 'open-source-llms-closing-gap',
    title: 'Open Source LLMs Are Closing the Gap Faster Than Anyone Expected',
    author: 'Kira Nolan',
    date: 'Apr 1, 2026',
    readTime: '5 min read',
    description:
      'Qwen 3.5 9B beat GPT-OSS-120B on GPQA Diamond. Gemma 4 runs on phones. Bonsai ships 1-bit models. Apache 2.0 licensing is making frontier performance free. What this means for the industry.',
  },
  {
    slug: 'state-of-ai-apis-2026',
    title: 'The State of AI APIs in 2026',
    author: 'Marcus Chen',
    date: 'Mar 30, 2026',
    readTime: '5 min read',
    description:
      'The API landscape shifted dramatically over the past year. Pricing wars, the context window race, agent-native endpoints, MCP protocol adoption, and structured outputs all reshaped how developers build on AI. We break down what matters.',
  },
  {
    slug: 'ai-api-pricing-war-2026',
    title: 'The AI API Pricing War: Who\'s Winning in 2026?',
    author: 'Marcus Chen',
    date: 'Mar 29, 2026',
    readTime: '6 min read',
    description:
      'GPT-5.4, Claude Opus 4.6, and Gemini 3.1 Pro pricing compared. How API costs dropped 70% to 90% in twelve months, and what open source models mean for developers choosing a provider.',
  },
  {
    slug: 'ai-service-outages-month',
    title: 'I Tracked AI Service Outages for a Month. Here\'s What I Found.',
    author: 'Ripper',
    date: 'Mar 27, 2026',
    readTime: '4 min read',
    description:
      'Real data from our incident database. Which services went down most, average resolution times, when outages cluster on Tuesdays and Wednesdays, and what developers should plan for.',
  },
  {
    slug: 'claude-code-leak',
    title: 'The Claude Code Leak: What 512,000 Lines of Source Code Revealed',
    author: 'Ripper',
    date: 'Mar 25, 2026',
    readTime: '5 min read',
    description:
      'An accidental .map file exposure revealed Claude Code\'s full source. 187 spinner verbs, curse word filters, a memory architecture, and a 35-module structure. What it tells us about modern AI tools.',
  },
  {
    slug: 'mcp-97-million-installs',
    title: 'MCP Just Hit 97 Million Installs. The Agent Era Is Here.',
    author: 'Kira Nolan',
    date: 'Mar 23, 2026',
    readTime: '4 min read',
    description:
      'Anthropic\'s Model Context Protocol went from experimental to foundational infrastructure. Every major AI provider now ships MCP support. What this means for developers building AI agents.',
  },
  {
    slug: 'openai-killed-sora',
    title: 'OpenAI Killed Sora. Here\'s What That Tells Us About AI Economics.',
    author: 'Marcus Chen',
    date: 'Mar 20, 2026',
    readTime: '5 min read',
    description:
      'Sora burned $15M per day in compute and made $2.1M in total lifetime revenue. The Disney deal collapsed. What this means for AI video generation and the economics of frontier AI products.',
  },
  {
    slug: 'why-we-built-tensorfeed',
    title: 'Why We Built TensorFeed.ai',
    author: 'Ripper',
    date: 'Mar 18, 2026',
    readTime: '5 min read',
    description:
      'The origin story. Why existing AI news sources fell short, the decision to build for AI agents as a first-class audience, and what makes TensorFeed different from every other aggregator.',
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
                  <span>{article.author}</span>
                  <span>&middot;</span>
                  <span>{article.date}</span>
                  <span>&middot;</span>
                  <span>{article.readTime}</span>
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

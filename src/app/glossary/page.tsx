import { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Agent Glossary | x402, MCP, Agent Payments | TensorFeed',
  description:
    'Definitions for the agent payment ecosystem: x402, Model Context Protocol (MCP), agent payments. Concise explanations with the standards, the implementations, and the practical implications.',
  alternates: { canonical: 'https://tensorfeed.ai/glossary' },
  openGraph: {
    title: 'AI Agent Glossary',
    description: 'Definitions for the agent payment ecosystem: x402, MCP, agent payments.',
    url: 'https://tensorfeed.ai/glossary',
  },
};

const TERMS = [
  {
    slug: 'x402',
    title: 'x402',
    blurb:
      'Open HTTP standard for machine-payable APIs. Servers return 402 Payment Required with payment instructions; clients retry with proof of payment. The internet-native payment rail for AI agents.',
  },
  {
    slug: 'mcp',
    title: 'MCP (Model Context Protocol)',
    blurb:
      'Open standard for exposing tools, resources, and prompts to AI agents. Built by Anthropic. Adopted by Claude Desktop, Claude Code, and a growing ecosystem.',
  },
  {
    slug: 'agent-payments',
    title: 'Agent Payments',
    blurb:
      'The pattern: pay-per-call APIs settled in stablecoins, no signup forms, no credit cards, no human in the loop. Built on x402 and MCP.',
  },
];

export default function GlossaryIndexPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-6 h-6 text-accent-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">Agent Glossary</h1>
        </div>
        <p className="text-text-secondary text-lg">
          Concise definitions for the agent payment ecosystem. Standards, implementations, and the
          practical implications. Each entry is intentionally one read; if it is doing its job you
          do not need a second pass.
        </p>
      </div>

      <div className="space-y-4">
        {TERMS.map(t => (
          <Link
            key={t.slug}
            href={`/glossary/${t.slug}`}
            className="block bg-bg-secondary border border-border rounded-xl p-5 hover:border-accent-primary transition"
          >
            <h2 className="text-text-primary font-semibold text-lg mb-1">{t.title}</h2>
            <p className="text-text-secondary text-sm">{t.blurb}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-text-muted text-sm">
        Looking for the implementation rather than the definition? See{' '}
        <Link href="/for-ai-agents" className="text-accent-primary hover:underline">/for-ai-agents</Link>{' '}
        for discovery surfaces and integration paths, or{' '}
        <Link href="/developers/agent-payments" className="text-accent-primary hover:underline">/developers/agent-payments</Link>{' '}
        for the full payment flow with code examples.
      </div>
    </div>
  );
}

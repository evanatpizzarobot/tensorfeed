import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Marcus Chen, Contributing Editor',
  description:
    'Marcus Chen is a contributing editor at TensorFeed.ai covering AI API economics, pricing analysis, enterprise adoption, and model infrastructure.',
  alternates: {
    canonical: 'https://tensorfeed.ai/authors/marcus-chen',
  },
  openGraph: {
    type: 'profile',
    url: 'https://tensorfeed.ai/authors/marcus-chen',
    title: 'Marcus Chen, Contributing Editor',
    description:
      'Marcus Chen is a contributing editor at TensorFeed.ai covering AI API economics, pricing analysis, enterprise adoption, and model infrastructure.',
    siteName: 'TensorFeed.ai',
    images: [{ url: '/tensorfeed-logo.png', width: 1024, height: 1024 }],
  },
  twitter: {
    card: 'summary',
    title: 'Marcus Chen, Contributing Editor',
    description:
      'Marcus Chen is a contributing editor at TensorFeed.ai covering AI API economics, pricing analysis, enterprise adoption, and model infrastructure.',
  },
};

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Marcus Chen',
  url: 'https://tensorfeed.ai/authors/marcus-chen',
  image: 'https://tensorfeed.ai/tensorfeed-logo.png',
  jobTitle: 'Contributing Editor',
  description:
    'Contributing editor at TensorFeed.ai covering AI API economics, pricing analysis, enterprise adoption, and model infrastructure.',
  knowsAbout: [
    'AI API pricing',
    'Enterprise AI adoption',
    'Model infrastructure',
    'Cloud computing economics',
    'Large language model deployment',
    'Cost optimization',
  ],
  worksFor: {
    '@type': 'Organization',
    name: 'TensorFeed.ai',
    url: 'https://tensorfeed.ai',
  },
};

const BEATS = [
  'AI API pricing and the ongoing cost wars',
  'Enterprise AI adoption and deployment patterns',
  'Model infrastructure, inference optimization, and scaling',
  'Cloud provider AI services (AWS, GCP, Azure)',
  'Cost analysis and total cost of ownership for AI workloads',
];

const RECENT = [
  {
    href: '/originals/state-of-ai-apis-2026',
    title: 'The State of AI APIs in 2026',
  },
  {
    href: '/originals/ai-api-pricing-war-2026',
    title: 'The AI API Pricing War: Who Is Winning in 2026?',
  },
  {
    href: '/originals/stanford-ai-index-2026',
    title: 'Stanford AI Index 2026 Analysis',
  },
  {
    href: '/originals/openai-killed-sora',
    title: 'OpenAI Killed Sora: AI Economics Lessons',
  },
];

export default function MarcusChenAuthorPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <JsonLd data={personJsonLd} />

      <Link
        href="/authors"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All Authors
      </Link>

      <header className="mb-8">
        <p className="text-sm text-text-muted uppercase tracking-wider font-mono">
          Contributing Editor
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mt-2">
          Marcus Chen
        </h1>
        <p className="text-text-muted text-sm mt-2">
          API economics, pricing analysis, enterprise AI
        </p>
      </header>

      <section className="space-y-4 text-text-secondary leading-relaxed mb-10">
        <p className="text-lg text-text-primary">
          Marcus Chen is a contributing editor at TensorFeed.ai covering the economics
          of AI APIs, frontier model pricing, and enterprise adoption patterns.
        </p>
        <p>
          His beat is the money side of AI. When a provider cuts prices, launches a new
          tier, or shifts its billing model, Marcus breaks down what it actually means
          for developers and teams making build-vs-buy decisions. He tracks per-token
          costs, context window economics, and the total cost of ownership for running
          inference at scale.
        </p>
        <p>
          Before joining TensorFeed, Marcus worked as a data analyst and technical writer
          covering cloud infrastructure and developer platforms. He has spent years
          building pricing models and cost calculators for SaaS products, which is why
          TensorFeed&apos;s{' '}
          <Link href="/tools/cost-calculator" className="text-accent-primary hover:underline">
            AI cost calculator
          </Link>{' '}
          and{' '}
          <Link href="/ai-api-pricing-guide" className="text-accent-primary hover:underline">
            pricing guide
          </Link>{' '}
          read the way they do.
        </p>
        <p>
          Marcus cross-references every pricing claim against the provider&apos;s
          official documentation and API reference. When numbers change, he timestamps
          the change and notes the previous price so readers can track the trajectory.
          His pricing war series has become one of TensorFeed&apos;s most-read verticals.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text-primary mb-3">Beat</h2>
        <ul className="list-disc list-inside space-y-1 pl-2 text-text-secondary">
          {BEATS.map((beat) => (
            <li key={beat}>{beat}</li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text-primary mb-3">Recent Articles</h2>
        <div className="grid gap-2">
          {RECENT.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block bg-bg-secondary border border-border rounded-lg px-4 py-3 hover:border-accent-primary transition-colors"
            >
              <span className="text-text-primary hover:text-accent-primary transition-colors">
                {item.title}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text-primary mb-3">Contact</h2>
        <div className="bg-bg-secondary border border-border rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-text-muted" />
            <a
              href="mailto:feedback@tensorfeed.ai"
              className="text-accent-primary hover:underline"
            >
              feedback@tensorfeed.ai
            </a>
          </div>
        </div>
      </section>

      <div className="pt-6 border-t border-border text-sm text-text-muted">
        See our{' '}
        <Link href="/editorial-policy" className="text-accent-primary hover:underline">
          Editorial Policy
        </Link>{' '}
        for standards, sourcing, and corrections.
      </div>
    </div>
  );
}

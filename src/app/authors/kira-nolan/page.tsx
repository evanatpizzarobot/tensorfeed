import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';

export const metadata: Metadata = {
  title: 'Kira Nolan, Contributing Editor',
  description:
    'Kira Nolan is a contributing editor at TensorFeed.ai covering AI safety, open source models, agent ecosystems, and alignment research.',
  alternates: {
    canonical: 'https://tensorfeed.ai/authors/kira-nolan',
  },
  openGraph: {
    type: 'profile',
    url: 'https://tensorfeed.ai/authors/kira-nolan',
    title: 'Kira Nolan, Contributing Editor',
    description:
      'Kira Nolan is a contributing editor at TensorFeed.ai covering AI safety, open source models, agent ecosystems, and alignment research.',
    siteName: 'TensorFeed.ai',
    images: [{ url: '/tensorfeed-logo.png', width: 1024, height: 1024 }],
  },
  twitter: {
    card: 'summary',
    title: 'Kira Nolan, Contributing Editor',
    description:
      'Kira Nolan is a contributing editor at TensorFeed.ai covering AI safety, open source models, agent ecosystems, and alignment research.',
  },
};

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Kira Nolan',
  url: 'https://tensorfeed.ai/authors/kira-nolan',
  image: 'https://tensorfeed.ai/tensorfeed-logo.png',
  jobTitle: 'Contributing Editor',
  description:
    'Contributing editor at TensorFeed.ai covering AI safety, open source models, agent ecosystems, and alignment research.',
  knowsAbout: [
    'AI safety',
    'Alignment research',
    'Open source large language models',
    'Agent frameworks',
    'Model evaluations',
    'Red teaming',
  ],
  worksFor: {
    '@type': 'Organization',
    name: 'TensorFeed.ai',
    url: 'https://tensorfeed.ai',
  },
};

const BEATS = [
  'AI safety and alignment research',
  'Open source LLMs (Llama, Mistral, Qwen, DeepSeek)',
  'Agent frameworks and orchestration',
  'Model evaluations, red teaming, jailbreak reporting',
  'Responsible disclosure and AI incident reporting',
];

const RECENT = [
  {
    href: '/originals/claude-mythos-ai-security',
    title: 'Claude Mythos and the New Cybersecurity Rules',
  },
  {
    href: '/originals/claude-mythos-not-afraid',
    title: 'Claude Mythos: Not Afraid',
  },
  {
    href: '/originals/open-source-llms-closing-gap',
    title: 'Open Source LLMs Closing the Gap',
  },
  {
    href: '/originals/frontier-model-forum-vs-china',
    title: 'Frontier Model Forum vs China',
  },
  {
    href: '/originals/rise-of-agentic-ai',
    title: 'The Rise of Agentic AI',
  },
];

export default function KiraNolanAuthorPage() {
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
          Kira Nolan
        </h1>
        <p className="text-text-muted text-sm mt-2">
          AI safety, open source, agent ecosystems
        </p>
      </header>

      <section className="space-y-4 text-text-secondary leading-relaxed mb-10">
        <p className="text-lg text-text-primary">
          Kira Nolan is a contributing editor at TensorFeed.ai covering AI safety,
          alignment research, and the open source frontier.
        </p>
        <p>
          Her beat spans the research agenda of the major alignment labs, the evaluation
          community, and the practical posture of agentic systems once they are deployed.
          She tracks model releases from the open source ecosystem, benchmarks them
          against closed models, and reports on red team findings, jailbreak research, and
          AI incidents.
        </p>
        <p>
          Before joining TensorFeed, Kira worked as a technical writer and researcher in
          the open source ML community, where she contributed documentation to several
          popular inference and evaluation projects. She reads more papers each week than
          anyone else on the team, which is how she keeps her coverage grounded in
          primary sources.
        </p>
        <p>
          She cross-references every claim about a model&apos;s safety properties against
          the provider&apos;s own system card, third-party evaluations, and, when
          relevant, reproducible prompts. If Kira writes that a model refuses something,
          she has the transcript.
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

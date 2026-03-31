import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Complete Guide to CLAUDE.md: Best Practices, Examples & Templates | TensorFeed.ai',
  description:
    'Learn how to write the perfect CLAUDE.md file. Complete guide with examples, templates, best practices, and an interactive generator for Claude Code.',
  openGraph: {
    title: 'The Complete Guide to CLAUDE.md: Best Practices, Examples & Templates',
    description:
      'Learn how to write the perfect CLAUDE.md file. Complete guide with examples, templates, best practices, and an interactive generator for Claude Code.',
    url: 'https://tensorfeed.ai/claude-md-guide',
  },
  alternates: {
    canonical: 'https://tensorfeed.ai/claude-md-guide',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

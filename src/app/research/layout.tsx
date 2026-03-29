import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Research Papers & Benchmarks',
  description: 'Latest AI research papers, benchmark scores, and academic developments from arXiv, MIT Technology Review, and more.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

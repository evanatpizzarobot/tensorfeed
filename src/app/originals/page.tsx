import { Metadata } from 'next';
import Link from 'next/link';
import { PenTool, Clock, ArrowRight } from 'lucide-react';
import { ORIGINALS } from '@/lib/originals-directory';

export const metadata: Metadata = {
  title: 'TensorFeed Originals | In-Depth AI Analysis & Editorial',
  description: 'Original editorial analysis from TensorFeed: deep dives into AI trends, model releases, API pricing, and the future of artificial intelligence.',
  openGraph: {
    type: 'website',
    url: 'https://tensorfeed.ai/originals',
    title: 'TensorFeed Originals | In-Depth AI Analysis & Editorial',
    description: 'Original editorial analysis from TensorFeed: deep dives into AI trends, model releases, API pricing, and the future of artificial intelligence.',
    siteName: 'TensorFeed.ai',
    images: [{ url: '/tensorfeed-logo.png', width: 1024, height: 1024 }],
  },
  twitter: {
    card: 'summary',
    title: 'TensorFeed Originals | In-Depth AI Analysis & Editorial',
    description: 'Original editorial analysis from TensorFeed: deep dives into AI trends, model releases, API pricing, and the future of artificial intelligence.',
  },
};

// Single source of truth: src/lib/originals-directory.ts
// Add new articles there; both this page and the homepage read from it automatically.
const ARTICLES = ORIGINALS;

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

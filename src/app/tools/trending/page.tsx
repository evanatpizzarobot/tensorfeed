import { GitBranch } from 'lucide-react';
import TrendingRepoList from './TrendingRepoList';

export default function TrendingReposPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch className="w-7 h-7 text-accent-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Trending AI Repos</h1>
        </div>
        <p className="text-text-secondary mb-6">
          New AI repositories gaining traction on GitHub. Updated daily.
        </p>

        <section className="mb-8">
          <p className="text-text-secondary text-sm leading-relaxed mb-4">
            Every day, hundreds of new AI projects launch on GitHub. TensorFeed tracks the ones gaining real momentum:
            new repositories in machine learning, large language models, AI agents, computer vision, and more that are
            picking up stars and forks fast. Filter by language, see how new each project is, and find your next favorite
            open source AI tool before everyone else does.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-bg-secondary border border-border rounded-lg p-3">
              <p className="text-lg font-bold text-accent-primary">50+</p>
              <p className="text-[11px] text-text-muted">Repos tracked</p>
            </div>
            <div className="bg-bg-secondary border border-border rounded-lg p-3">
              <p className="text-lg font-bold text-accent-green">Daily</p>
              <p className="text-[11px] text-text-muted">Update frequency</p>
            </div>
            <div className="bg-bg-secondary border border-border rounded-lg p-3">
              <p className="text-lg font-bold text-accent-secondary">10+</p>
              <p className="text-[11px] text-text-muted">Languages</p>
            </div>
            <div className="bg-bg-secondary border border-border rounded-lg p-3">
              <p className="text-lg font-bold text-accent-cyan">Free</p>
              <p className="text-[11px] text-text-muted">Always</p>
            </div>
          </div>
        </section>

        <TrendingRepoList />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Trending AI Repos',
            description: 'Discover the hottest new AI repositories on GitHub. Updated daily with repos gaining traction in LLMs, agents, machine learning, and more.',
            url: 'https://tensorfeed.ai/tools/trending',
            publisher: {
              '@type': 'Organization',
              name: 'TensorFeed.ai',
              url: 'https://tensorfeed.ai',
            },
          }),
        }}
      />
    </div>
  );
}

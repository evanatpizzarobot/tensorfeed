'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import PodcastPlayer from './PodcastPlayer';

interface Episode {
  id: string;
  podcastName: string;
  title: string;
  audioUrl: string;
  publishedAt: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function LatestPodcasts() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    async function fetchPodcasts() {
      try {
        const res = await fetch('https://tensorfeed.ai/api/podcasts?limit=3');
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.episodes) {
            setEpisodes(data.episodes.slice(0, 3));
          }
        }
      } catch {}
    }
    fetchPodcasts();
  }, []);

  if (episodes.length === 0) return null;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-accent-primary" />
          Latest AI Podcasts
        </h3>
        <Link
          href="/podcasts"
          className="text-xs text-accent-primary hover:text-accent-cyan transition-colors"
        >
          View all
        </Link>
      </div>
      <ul className="space-y-3">
        {episodes.map((ep) => (
          <li key={ep.id} className="space-y-1.5">
            <p className="text-xs text-text-primary font-medium leading-snug line-clamp-2">
              {ep.title}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              <span>{ep.podcastName}</span>
              <span>·</span>
              <span>{timeAgo(ep.publishedAt)}</span>
            </div>
            <PodcastPlayer audioUrl={ep.audioUrl} compact />
          </li>
        ))}
      </ul>
    </div>
  );
}

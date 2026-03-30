import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Podcasts: Listen to the Latest AI News and Analysis | TensorFeed.ai',
  description: 'Stream AI podcast episodes from top shows including AI Daily Brief, Practical AI, Latent Space, and Last Week in AI. Listen directly on TensorFeed.',
  openGraph: {
    title: 'AI Podcasts: Listen to the Latest AI News and Analysis',
    description: 'Stream AI podcast episodes from top shows. Listen to AI Daily Brief, Practical AI, Latent Space, and Last Week in AI directly on TensorFeed.',
    url: 'https://tensorfeed.ai/podcasts',
    siteName: 'TensorFeed.ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Podcasts | TensorFeed.ai',
    description: 'Stream AI podcast episodes from top shows directly on TensorFeed.',
  },
  alternates: {
    canonical: 'https://tensorfeed.ai/podcasts',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

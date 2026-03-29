import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Today in AI | Daily Digest',
  description: 'What happened in AI today. Daily briefing of top stories, service incidents, and model releases from across the AI ecosystem.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

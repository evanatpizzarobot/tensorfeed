import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Agent Directory',
  description: 'Discover AI agents, frameworks, and tools shaping the ecosystem. Compare coding agents, research agents, creative tools, and developer frameworks.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

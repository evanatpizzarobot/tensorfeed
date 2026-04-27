import { Metadata } from 'next';
import AccountClient from './AccountClient';

export const metadata: Metadata = {
  title: 'Account: Check Your TensorFeed Credit Balance',
  description:
    'View your TensorFeed bearer token balance, recent premium API usage, and active webhook watches. No accounts, no signup. Paste your token to view.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: 'website',
    url: 'https://tensorfeed.ai/account',
    title: 'TensorFeed Account Dashboard',
    description:
      'Check your TensorFeed credit balance, premium API usage, and active webhook watches.',
    siteName: 'TensorFeed.ai',
  },
};

export default function AccountPage() {
  return <AccountClient />;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operator Mandates',
  description:
    'Issue, monitor, and revoke spending mandates for AI agents with connected Solana wallets.',
};

export default function MandatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

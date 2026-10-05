import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signed Decision Receipts',
  description:
    'Inspect verifiable cryptographic decision receipts, reason codes, and on-chain SPL memo anchors.',
};

export default function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

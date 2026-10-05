import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Receipt Verification Portal',
  description:
    'Independently verify cryptographic receipts, authority signatures, and on-chain SPL memo transactions on Solana devnet.',
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

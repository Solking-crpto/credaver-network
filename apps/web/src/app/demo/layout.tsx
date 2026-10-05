import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Demo & Scenarios',
  description:
    'Test 6 deterministic policy scenarios and live x402 payment settlement on Solana devnet.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

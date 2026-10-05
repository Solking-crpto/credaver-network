import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Human Review Queue',
  description:
    'Operator authorization queue for high-value transactions and policy-flagged agent requests held in REVIEW status.',
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

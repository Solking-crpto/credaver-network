import React from 'react';
import { Card } from '../ui/Card';
import { Key, Lock, FileCheck2, CheckCircle2, Cpu } from 'lucide-react';

export const CoreConceptsSection: React.FC = () => {
  const concepts = [
    {
      num: '1',
      title: 'Identity',
      icon: Key,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      description: 'Phantom wallet Ed25519 signature proof of key control. Purely cryptographic verification of keypair control, with no real-world identity or KYC claims.',
    },
    {
      num: '2',
      title: 'Authority',
      icon: Lock,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      description: 'Signed, expiring, revocable Mandate. Operators set merchant allowlists, asset constraints, and cumulative spend caps.',
    },
    {
      num: '3',
      title: 'Evidence',
      icon: FileCheck2,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      description: 'Request-bound proof, Solana on-chain transaction hash, and SHA-256 payload digests computed via canonical RFC 8785.',
    },
    {
      num: '4',
      title: 'Performance',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      description: 'Verifiable decision history and tamper-evident receipts trail. Objective cryptographic auditability without subjective scoring.',
    },
    {
      num: '5',
      title: 'Payment',
      icon: Cpu,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      description: 'Standard x402 V2 settlement on Solana devnet using devnet USDC and verified signers.',
    },
  ];

  return (
    <section className="py-12 border-t border-border/50 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Five separate concepts
        </h2>
        <span className="text-xs text-muted font-mono">
          Architectural Separation of Concerns
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {concepts.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.num}
              className="p-5 border-border/80 bg-surface-card/70 hover:border-cyan-500/40 transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-3">
                <div className={`w-8 h-8 rounded-lg ${c.bgColor} flex items-center justify-center ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-white">
                  {c.num}. {c.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {c.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

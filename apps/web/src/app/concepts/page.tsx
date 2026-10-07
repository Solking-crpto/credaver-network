import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CoreConceptsSection } from '../../components/sections/CoreConceptsSection';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowRight, Play, Lock, FileCheck2, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Core Concepts',
  description:
    'Five distinct architectural pillars separating agent identity, operator authority, cryptographic evidence, verifiable audit trails, and payment settlement.',
};

export default function ConceptsPage() {
  return (
    <div className="space-y-12">
      {/* Page Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Architectural Foundations</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          Five Core Concepts
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          CredaVer enforces a strict separation of concerns between autonomous agent identity, operator mandate authority, cryptographic evidence, performance auditing, and Solana settlement.
        </p>
      </div>

      {/* Main Core Concepts Grid */}
      <CoreConceptsSection />

      {/* Architectural Principles */}
      <section className="space-y-6 pt-6 border-t border-border/50">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-cyan-400" />
          <span>Why Separation Matters</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-300">
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">Zero Hot-Wallet Exposure</h3>
            <p className="leading-relaxed text-slate-400">
              Autonomous agents hold no custody over operator funds. Even if an agent's LLM context is fully compromised via prompt injection, the agent cannot exceed its mandate spending envelope.
            </p>
          </Card>
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">Cryptographic Non-Repudiation</h3>
            <p className="leading-relaxed text-slate-400">
              Every authorization decision produces an Ed25519 signed receipt over RFC 8785 canonical JSON. The Policy Decision Point cannot deny or alter decisions after issuance.
            </p>
          </Card>
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">Public Devnet Anchoring</h3>
            <p className="leading-relaxed text-slate-400">
              Receipt digests are committed to Solana devnet using the standard SPL Memo program, giving third-party auditors immutable on-chain proof without vendor lock-in.
            </p>
          </Card>
        </div>
      </section>

      {/* Cross-navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/50">
        <Card className="p-5 bg-surface-card/80 border-border/80 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-cyan-400" />
              Live Demo
            </h3>
            <p className="text-xs text-slate-400">
              Test the policy engine across 6 real-time scenarios.
            </p>
          </div>
          <Link href="/demo">
            <Button variant="outline" size="sm" className="w-full justify-center text-xs">
              <span>Open Live Demo</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>

        <Card className="p-5 bg-surface-card/80 border-border/80 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              Operator Mandates
            </h3>
            <p className="text-xs text-slate-400">
              Connect Phantom and issue a scoped agent mandate.
            </p>
          </div>
          <Link href="/mandates">
            <Button variant="outline" size="sm" className="w-full justify-center text-xs">
              <span>Manage Mandates</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>

        <Card className="p-5 bg-surface-card/80 border-border/80 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              On-Chain Proof
            </h3>
            <p className="text-xs text-slate-400">
              Inspect verified devnet transactions and SPL Memo anchors.
            </p>
          </div>
          <Link href="/proof">
            <Button variant="outline" size="sm" className="w-full justify-center text-xs">
              <span>View On-Chain Proof</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroSection } from '../components/sections/HeroSection';
import { Card } from '../components/ui/Card';
import {
  Key,
  Cpu,
  FileCheck2,
  Play,
  Lock,
  CheckCircle2,
  ArrowRight,
  Shield,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'CredaVer Network is the cryptographic authorization layer between AI agents and Solana wallets. Scoped, revocable mandates with verifiable receipts for x402 payments.',
};

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* a) Hero Section (headline, subheadline, 2 buttons, + single Decision Card) */}
      <HeroSection />

      {/* b) "How it works" 3 steps (short) */}
      <section className="space-y-6 pt-4 border-t border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Deterministic Enforcement</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              How CredaVer Works
            </h2>
          </div>
          <Link
            href="/docs"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>Detailed architecture &amp; gates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="p-6 bg-surface-card/80 border-border/80 space-y-3 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              Issue Mandate
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Operator signs a bounded spending envelope in Phantom or any standard wallet with strict limits: per-transaction cap, total lifetime spend, and expiry.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/80 border-border/80 space-y-3 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Policy Gate (PDP)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              When an agent initiates an x402 payment, the CredaVer Policy Decision Point evaluates 12 deterministic gates in milliseconds. The AI agent never touches private wallet keys.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/80 border-border/80 space-y-3 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Signed Receipt &amp; Anchor
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every decision produces an immutable RFC 8785 canonical JSON receipt signed with Ed25519, anchored to Solana devnet via SPL Memo for permanent verification.
            </p>
          </Card>
        </div>
      </section>

      {/* c) A row of 4 link cards: Live Demo (/demo), Mandates (/mandates), Receipts (/receipts), On-chain proof (/proof) */}
      <section className="space-y-4 pt-4 border-t border-border/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Live Demo */}
          <Link
            href="/demo"
            className="group block p-5 rounded-xl bg-surface-card/80 border border-border/80 hover:border-cyan-500/60 hover:bg-surface-card transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Play className="w-4 h-4 ml-0.5" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Live Demo
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Run 6 deterministic policy scenarios and devnet payment settlements.
            </p>
          </Link>

          {/* Card 2: Mandates */}
          <Link
            href="/mandates"
            className="group block p-5 rounded-xl bg-surface-card/80 border border-border/80 hover:border-cyan-500/60 hover:bg-surface-card transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Lock className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Mandates
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Issue bounded agent allowances and monitor spend limits.
            </p>
          </Link>

          {/* Card 3: Receipts */}
          <Link
            href="/receipts"
            className="group block p-5 rounded-xl bg-surface-card/80 border border-border/80 hover:border-cyan-500/60 hover:bg-surface-card transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Receipts
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Browse tamper-evident Ed25519 signed decision records.
            </p>
          </Link>

          {/* Card 4: On-chain proof */}
          <Link
            href="/proof"
            className="group block p-5 rounded-xl bg-surface-card/80 border border-border/80 hover:border-cyan-500/60 hover:bg-surface-card transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              On-chain proof
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Inspect SPL Memo transaction anchors on Solana devnet.
            </p>
          </Link>
        </div>
      </section>

      {/* d) One-line honesty strip */}
      <section className="pt-2">
        <div className="py-3 px-4 rounded-xl bg-surface-card/60 border border-border/70 text-center text-xs font-mono text-slate-400">
          Devnet only. Policy engine, signatures and receipts are real; some dashboard scenarios use simulated SVM bytes.
        </div>
      </section>
    </div>
  );
}

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HeroSection } from '../components/sections/HeroSection';
import { EarlyAccessSection } from '../components/sections/EarlyAccessSection';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Shield,
  FileCheck2,
  Cpu,
  ArrowRight,
  ExternalLink,
  Play,
  Key,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'CredaVer Network is the cryptographic authorization layer between AI agents and Solana wallets. Scoped, revocable mandates with verifiable receipts for x402 payments.',
};

const REAL_S5_EXPLORER_URL =
  'https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Compact 3-Step "How It Works" Strip */}
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
          <Link href="/how-it-works">
            <Button variant="ghost" size="sm" className="text-xs font-mono text-cyan-400 hover:text-cyan-300 p-0 hover:bg-transparent">
              <span>Detailed architecture & limits</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
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
              Operator signs a bounded spending envelope in Phantom or any standard wallet with strict limits: per-transaction cap, total lifetime spend, expiry, and human review threshold.
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
              When an agent initiates an x402 payment, the CredaVer Policy Decision Point evaluates 12 deterministic gates in under 15ms. The AI agent never touches private wallet keys.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/80 border-border/80 space-y-3 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Signed Receipt & Anchor
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every decision produces an immutable RFC 8785 canonical JSON receipt signed with Ed25519, anchored to Solana devnet via SPL Memo for permanent verification.
            </p>
          </Card>
        </div>
      </section>

      {/* 3. Three "See It Work" Cards */}
      <section className="space-y-6 pt-4 border-t border-border/50">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Experience</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            See It in Action
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Explore live policy enforcement, cryptographic verification, and on-chain devnet transactions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Live Demo */}
          <Card glow className="p-6 bg-surface-card/90 border-cyan-500/40 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <Badge variant="cyan" className="font-mono text-[11px]">
                  Live Runner
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white">Live Demo & Scenarios</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Test all 6 policy scenarios (ALLOW, OVER_CAP, REVOKED, EXPIRED, REPLAY, REVIEW) and execute real x402 payment settlements on Solana devnet.
              </p>
            </div>
            <Link href="/demo" className="pt-3 border-t border-border/60">
              <Button variant="primary" size="sm" className="w-full justify-center">
                <span>Open Demo Runner</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </Card>

          {/* Card 2: Verification Portal */}
          <Card glow className="p-6 bg-surface-card/90 border-border/90 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Shield className="w-5 h-5" />
                </div>
                <Badge variant="violet" className="font-mono text-[11px]">
                  Public Verifier
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white">Receipt Verification</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cryptographically verify any decision receipt by receipt ID, canonical SHA-256 hash, or on-chain transaction memo signature.
              </p>
            </div>
            <Link href="/verify" className="pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" className="w-full justify-center">
                <span>Open Verification Portal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </Card>

          {/* Card 3: On-Chain Proof */}
          <Card glow className="p-6 bg-surface-card/90 border-border/90 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <Badge variant="green" className="font-mono text-[11px]">
                  SPL Memo
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-white">On-Chain Proof</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Inspect real Solana devnet transactions anchored with the standard SPL Memo program, verifiable in independent explorers.
              </p>
            </div>
            <Link href="/proof" className="pt-3 border-t border-border/60">
              <Button variant="outline" size="sm" className="w-full justify-center">
                <span>View On-Chain Proof</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* 4. Small "Verified on Solana Devnet" Proof Strip */}
      <section className="p-4 sm:p-5 rounded-2xl bg-surface-card/70 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
              <span>Verified on Solana Devnet Cluster</span>
              <Badge variant="green" className="text-[10px] py-0 px-1 font-mono">
                Real Anchors
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Decision receipts are committed to the public Solana ledger using the official SPL Memo Program.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={REAL_S5_EXPLORER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border/80 text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 transition-colors"
          >
            <span>View Anchor on Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <Link href="/proof">
            <Button variant="outline" size="sm" className="text-xs">
              <span>Learn Anchoring</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* 5. Small Early Access Form */}
      <EarlyAccessSection />
    </div>
  );
}

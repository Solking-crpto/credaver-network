'use client';

import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import {
  ShieldCheck,
  Key,
  FileCheck2,
  Cpu,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-8 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-credav-surface border border-credav-border/80 text-xs text-credav-cyan">
          <Zap className="w-3.5 h-3.5 text-credav-cyan animate-pulse" />
          <span>Crypto World&apos;s Fair Hackathon 2026 • Solana Devnet</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto">
          The Authorization Layer Between{' '}
          <span className="text-gradient">AI Agents &amp; Solana Wallets</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Operators issue signed, scoped, revocable <strong>Agent Mandates</strong>. CredaVer deterministically
          evaluates every x402 payment attempt, returning{' '}
          <span className="text-emerald-400 font-semibold">ALLOW</span>,{' '}
          <span className="text-rose-400 font-semibold">DENY</span>, or{' '}
          <span className="text-amber-400 font-semibold">REVIEW</span> with cryptographically signed receipts.
        </p>
      </section>

      {/* Trust & Transparency Notice */}
      <div className="p-4 rounded-xl bg-credav-card/60 border border-credav-border/60 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-credav-cyan shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">
            CredaVer is a Deterministic Policy Decision Point (PDP)
          </p>
          <p className="text-slate-400 leading-relaxed">
            AI never grants itself financial authority. Offchain policies and mandates are executed by CredaVer as a trusted decision gate. We do not claim trustlessness; we claim verifiable, deterministic containment. Payments settle on Solana Devnet via the x402 protocol.
          </p>
        </div>
      </div>

      {/* 5 Architectural Pillars */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-credav-cyan" />
            <span>Separation of Concerns: Five Core Concepts</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Zero Conflation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="space-y-2 border-credav-border/80">
            <div className="w-7 h-7 rounded-lg bg-credav-cyan/10 flex items-center justify-center text-credav-cyan">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">1. Identity</h3>
            <p className="text-xs text-slate-400">
              Phantom wallet Ed25519 signature proof of key control. No KYC; purely cryptographic.
            </p>
          </Card>

          <Card className="space-y-2 border-credav-border/80">
            <div className="w-7 h-7 rounded-lg bg-credav-violet/15 flex items-center justify-center text-purple-300">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">2. Authority</h3>
            <p className="text-xs text-slate-400">
              Signed, expiring, revocable Mandate. Operators set merchant allowlists, asset constraints, and caps.
            </p>
          </Card>

          <Card className="space-y-2 border-credav-border/80">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">3. Evidence</h3>
            <p className="text-xs text-slate-400">
              Request-bound proof, Solana onchain transaction hash, and SHA-256 payload digests.
            </p>
          </Card>

          <Card className="space-y-2 border-credav-border/80">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">4. Performance</h3>
            <p className="text-xs text-slate-400">
              Verifiable decision history and receipts trail. No arbitrary or subjective reputation scores.
            </p>
          </Card>

          <Card className="space-y-2 border-credav-border/80">
            <div className="w-7 h-7 rounded-lg bg-credav-blue/15 flex items-center justify-center text-credav-blue">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">5. Payment</h3>
            <p className="text-xs text-slate-400">
              Standard x402 V2 settlement on Solana devnet using devnet USDC and verified signers.
            </p>
          </Card>
        </div>
      </section>

      {/* Technical Spikes Verification Status */}
      <section id="spikes" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-credav-cyan" />
            <span>Phase 2 Technical Spikes Status</span>
          </h2>
          <Badge variant="green">Verified Passing</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card glow className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-credav-muted font-bold">SPIKE S1: x402 DEVNET ROUND TRIP</span>
              <StatusChip status="ALLOW" />
            </div>
            <p className="text-sm text-slate-300">
              Simulated Express merchant + x402 V2 headers (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`) with client policy enforcement in `@x402/fetch`. Public facilitator confirmed on devnet (`https://x402.org/facilitator`).
            </p>
            <div className="text-xs font-mono text-slate-400 bg-credav-bg/80 p-2.5 rounded border border-credav-border/50">
              Test: apps/demo-merchant/src/merchant.test.ts (4/4 passing)
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-credav-muted font-bold">SPIKE S2: DELEGATION PROGRAM</span>
              <Badge variant="amber">PARTIAL / ANALYSIS</Badge>
            </div>
            <p className="text-sm text-slate-300">
              Subscriptions Delegation Program (`De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`) audited. Native Windows environment lacks Solana CLI / Surfpool validator. Program requires Subscription Authority PDA routing, which x402 standard transfer facilitators do not natively support.
            </p>
            <div className="text-xs font-mono text-amber-300/80 bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
              Verdict: Fall back to CredaVer server-side caps for MVP.
            </div>
          </Card>

          <Card glow className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-credav-muted font-bold">SPIKE S3: WALLET CONNECT &amp; AUTH</span>
              <StatusChip status="ALLOW" />
            </div>
            <p className="text-sm text-slate-300">
              Phantom Connect / Wallet Standard integration in Next.js without legacy web3.js. Challenge-response authentication with server-side Ed25519 signature verification.
            </p>
            <div className="text-xs font-mono text-slate-400 bg-credav-bg/80 p-2.5 rounded border border-credav-border/50">
              Test: apps/web/src/wallet.test.ts (4/4 passing)
            </div>
          </Card>

          <Card glow className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-credav-muted font-bold">SPIKE S4: CRYPTO CORE &amp; ATOMIC REPLAY</span>
              <StatusChip status="ALLOW" />
            </div>
            <p className="text-sm text-slate-300">
              RFC 8785 JCS canonicalization, Ed25519 signing/verification, request-bound proofs, and atomic `SET NX EX` replay protection with concurrent race test.
            </p>
            <div className="text-xs font-mono text-slate-400 bg-credav-bg/80 p-2.5 rounded border border-credav-border/50">
              Test: packages/core/src/core.test.ts (21/21 passing)
            </div>
          </Card>
        </div>
      </section>

      {/* Decision Gates Overview */}
      <section id="policy" className="space-y-4">
        <h2 className="text-xl font-bold text-white">Deterministic Policy Decision Gates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-emerald-400">ALLOW</h3>
              <StatusChip status="ALLOW" />
            </div>
            <p className="text-xs text-slate-400">
              All 12 gates passed: valid signatures, within valid time window, merchant pre-approved, asset allowed, per-tx limit respected, cumulative cap remaining, nonce unused.
            </p>
          </Card>

          <Card className="border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-rose-400">DENY</h3>
              <StatusChip status="DENY" />
            </div>
            <p className="text-xs text-slate-400">
              Fails closed on: `REVOKED_MANDATE`, `EXPIRED_MANDATE`, `MERCHANT_NOT_ALLOWED`, `AMOUNT_EXCEEDS_PER_TX_LIMIT`, `AMOUNT_EXCEEDS_TOTAL_CAP`, or `NONCE_REPLAYED`.
            </p>
          </Card>

          <Card className="border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-amber-400">REVIEW</h3>
              <StatusChip status="REVIEW" />
            </div>
            <p className="text-xs text-slate-400">
              Requires human operator wallet signature: triggered when amount exceeds review threshold or agent encounters a new, unknown merchant.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

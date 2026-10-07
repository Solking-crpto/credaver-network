import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EarlyAccessSection } from '../../components/sections/EarlyAccessSection';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Mail, Shield, ArrowRight, Play, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Early Access',
  description:
    'Request early access to the CredaVer Network hosted service for autonomous AI agent mandates and cryptographic policy authorization.',
};

export default function EarlyAccessPage() {
  return (
    <div className="space-y-12">
      {/* Page Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Hosted Infrastructure</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          Request Early Access
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Leave your email and I&apos;ll tell you when a hosted version is ready. Designed for teams running autonomous agents needing deterministic spending controls on Solana.
        </p>
      </div>

      {/* Main Early Access Form */}
      <EarlyAccessSection />

      {/* Who is CredaVer For? */}
      <section className="space-y-6 pt-6 border-t border-border/50">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-cyan-400" />
          <span>Who Is CredaVer For?</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-300">
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">Autonomous Agent Operators</h3>
            <p className="leading-relaxed text-slate-400">
              Teams deploying LLM agents that autonomously pay for compute, APIs, data feeds, and SaaS services without human pre-approval for every micro-transaction.
            </p>
          </Card>
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">API & Data Merchants</h3>
            <p className="leading-relaxed text-slate-400">
              Service providers accepting x402 payments on Solana seeking instant cryptographic verification that incoming transactions comply with signed operator mandates.
            </p>
          </Card>
          <Card className="p-5 bg-surface-card/80 border-border/80 space-y-2.5">
            <h3 className="font-bold text-sm text-white">Treasury & Risk Officers</h3>
            <p className="leading-relaxed text-slate-400">
              Protocol teams who cannot tolerate unbounded hot-wallet keys. Set rigid per-tx limits, total spend caps, and instant revocation switches.
            </p>
          </Card>
        </div>
      </section>

      {/* Cross-navigation Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
        <Card className="p-5 bg-surface-card/80 border-border/80 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-cyan-400" />
              Live Demo
            </h3>
            <p className="text-xs text-slate-400">
              Experience the policy decision point with 6 live scenarios.
            </p>
          </div>
          <Link href="/demo">
            <Button variant="outline" size="sm" className="text-xs">
              <span>Try Live Demo</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>

        <Card className="p-5 bg-surface-card/80 border-border/80 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Technical Documentation
            </h3>
            <p className="text-xs text-slate-400">
              Read the 12 deterministic gates and cryptographic spec.
            </p>
          </div>
          <Link href="/docs">
            <Button variant="outline" size="sm" className="text-xs">
              <span>Read Docs</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

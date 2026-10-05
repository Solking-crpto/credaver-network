import React from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Play, ShieldCheck, ExternalLink, CheckCircle2 } from 'lucide-react';

const REAL_S5_EXPLORER_URL =
  'https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet';

export const HeroSection: React.FC = () => {
  return (
    <section className="py-8 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left column: Value proposition & CTAs */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Deterministic Policy Decision Point • Solana Devnet</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
            The authorization layer between{' '}
            <span className="text-gradient">AI agents</span> and{' '}
            <span className="text-gradient">Solana wallets</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
            AI agents that pay need spending limits and proof of every decision. Today you give them a wallet and hope.
          </p>

          <p className="text-sm sm:text-base text-muted leading-relaxed max-w-xl">
            Scoped, expiring, revocable agent mandates with deterministic policy gates and
            cryptographically verifiable receipts for x402 payments.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/demo">
              <Button variant="primary" size="lg" className="shadow-glow min-h-[48px] px-6">
                <Play className="w-4 h-4 mr-2" />
                <span>Try Live Demo</span>
              </Button>
            </Link>

            <Link href="/verify">
              <Button variant="outline" size="lg" className="min-h-[48px] px-6">
                <ShieldCheck className="w-4 h-4 mr-2" />
                <span>Verify a receipt</span>
              </Button>
            </Link>
          </div>

          {/* Under buttons: real devnet proof line */}
          <div className="pt-2">
            <Link
              href={REAL_S5_EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-emerald-500/40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified on Solana devnet</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Right column: HTML/CSS Decision Card Illustration */}
        <div className="lg:col-span-5">
          <div className="relative rounded-2xl p-1 bg-gradient-to-b from-cyan-500/20 via-border/50 to-transparent shadow-card">
            <div className="rounded-[14px] bg-surface-card/95 border border-border/90 p-5 sm:p-6 space-y-4 backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                    Decision Card
                  </span>
                  <Badge variant="cyan" className="text-[10px] py-0 px-1.5 uppercase font-mono">
                    Example
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">Illustrative values</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ALLOW
                </div>
              </div>

              {/* Data fields */}
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted">Mandate</span>
                  <span className="text-slate-200 font-semibold truncate max-w-[190px]">
                    mnd-live-alpha-092b
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted">Merchant</span>
                  <span className="text-slate-200 truncate max-w-[190px]">
                    4jFXp3...QEvAoMZ1
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted">Amount</span>
                  <span className="text-emerald-400 font-bold">$1.00 USDC</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted">Reason Code</span>
                  <span className="text-cyan-400 font-medium">POLICY_PASSED_ALL_GATES</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted">Receipt Hash</span>
                  <span className="text-slate-300 truncate max-w-[180px]">
                    e8b4...1c9f
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted">Authority Sig</span>
                  <span className="text-slate-300 truncate max-w-[180px]">
                    4GaQ...7uXz (Ed25519)
                  </span>
                </div>
              </div>

              {/* Footer status */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  All 12 Gates Passed
                </span>
                <span className="text-slate-500">Illustrative values</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

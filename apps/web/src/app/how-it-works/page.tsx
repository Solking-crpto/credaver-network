import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HowItWorksSection } from '../../components/sections/HowItWorksSection';
import { CoreConceptsSection } from '../../components/sections/CoreConceptsSection';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Shield,
  KeyRound,
  SendHorizontal,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Server,
  Coins,
  Cpu,
  Lock,
  FileCheck2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Deep dive into the CredaVer Network architecture, the three-step mandate workflow, deterministic policy gates, and current limits.',
};

export default function HowItWorksPage() {
  return (
    <div className="space-y-16">
      {/* Page Header */}
      <div className="space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Protocol Architecture & Limits</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          How CredaVer Works
        </h1>
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          Autonomous AI agents need payment capacity without carte-blanche wallet custody. CredaVer places a deterministic authorization layer between agent actions and Solana transactions.
        </p>
      </div>

      {/* 1. The Three Steps in Detail */}
      <section className="space-y-8">
        <div className="border-b border-border/60 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-gradient">The 3-Step Lifecycle</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Separating identity, policy enforcement, and treasury custody at each stage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 bg-surface-card/90 border-cyan-500/30 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold">
              01
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Issue Mandate
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The operator configures a bounded spending envelope in standard wallet formats.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside font-mono">
              <li>Max spend per transaction (e.g. $2.00 USDC)</li>
              <li>Cumulative spending cap (e.g. $10.00 USDC)</li>
              <li>Expiration timestamp (e.g. 2 hours)</li>
              <li>Human review threshold (e.g. $1.50 USDC)</li>
              <li>Readable text signed with Phantom / Solflare</li>
            </ul>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-blue-500/30 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono font-bold">
              02
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              Policy Decision Point (PDP)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The agent creates a payment proof signed with its own in-memory key (never the funding key).
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside font-mono">
              <li>12 strict evaluation gates run sequentially</li>
              <li>Validates agent signature & mandate signature</li>
              <li>Checks per-tx cap, total cap, expiry, merchant</li>
              <li>Checks replay nonces against storage</li>
              <li>Decides ALLOW, DENY, or REVIEW in &lt;15ms</li>
            </ul>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-violet-500/30 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 font-mono font-bold">
              03
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-violet-400" />
              Receipt & On-Chain Anchor
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every decision produces an unforgeable cryptographic proof of what happened and why.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside font-mono">
              <li>RFC 8785 canonical JSON formatting</li>
              <li>Authority Ed25519 digital signature</li>
              <li>Settles x402 payment via constrained signer</li>
              <li>Anchors receipt hash to Solana via SPL Memo</li>
              <li>Verifiable anywhere without trusting the server</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* 2. Five Separate Concepts */}
      <section className="space-y-6 pt-4 border-t border-border/50">
        <CoreConceptsSection />
      </section>

      {/* 3. Plain "What is real, what is simulated, and current limits" Section */}
      <section className="space-y-6 pt-4 border-t border-border/50">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Honesty Audit & Scope</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            What is Real, What is Simulated, and Current Limits
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            CredaVer operates on principled engineering without deceptive hype or marketing claims.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="font-mono text-[11px]">
                Deterministic Engine
              </Badge>
              <h3 className="text-base font-bold text-white">Policy Decision Point (PDP)</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              The policy decision point is real code executing 12 deterministic gates in strict order. AI agents never evaluate their own rules, nor can prompt injections bypass programmatic boundary checks.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="font-mono text-[11px]">
                Solana Devnet
              </Badge>
              <h3 className="text-base font-bold text-white">Network & Token Realism</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              All transactions run on the Solana Devnet cluster. Test tokens carry zero economic value. Facilitator settlement connects to real devnet RPC nodes, producing genuine on-chain transaction signatures.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="violet" className="font-mono text-[11px]">
                Custody Model
              </Badge>
              <h3 className="text-base font-bold text-white">Server-Held Devnet Payment Key</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In this demo deployment, the backend server holds the funded devnet payment key. The AI agent holds only an ephemeral memory identity key. The private payment key is never transmitted to client browsers.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="amber" className="font-mono text-[11px]">
                Server Enforcement
              </Badge>
              <h3 className="text-base font-bold text-white">Revocation Enforced by CredaVer</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mandate revocation is checked and enforced by the CredaVer PDP service at the authorization boundary, not inside an on-chain Solana smart contract program.
            </p>
          </Card>
        </div>

        {/* Not Trustless Callout Card */}
        <Card className="p-6 bg-surface-card/90 border-cyan-500/40 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Honest Security Posture: Not "Trustless"</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            CredaVer provides <strong>verifiable accountability</strong> rather than mythical "trustlessness". You trust the PDP server to faithfully run policy gates; in return, the PDP gives you <strong>unforgeable cryptographic decision receipts</strong> and <strong>on-chain ledger anchors</strong> that prove compliance and detect any unauthorized payments after the fact.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link href="/demo">
              <Button variant="primary" size="sm">
                <span>Test in Live Demo</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="sm">
                <span>Read Full Technical Docs</span>
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

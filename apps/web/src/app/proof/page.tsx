import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OnChainProofSection } from '../../components/sections/OnChainProofSection';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  Shield,
  FileCheck2,
  ExternalLink,
  CheckCircle2,
  Lock,
  Cpu,
  ArrowRight,
  Database,
  Hash,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'On-Chain Proof',
  description:
    'Real Solana devnet transactions and explanation of how CredaVer receipts are cryptographically anchored and verified via SPL Memo.',
};

export default function ProofPage() {
  return (
    <div className="space-y-16">
      {/* Header */}
      <div className="space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Immutable Solana Devnet Ledgers</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          On-Chain Proof & Anchoring
        </h1>
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          CredaVer binds off-chain policy authorization to public Solana ledger proofs using the standard SPL Memo program. Every decision is verifiable on independent block explorers.
        </p>
      </div>

      {/* Real transactions list */}
      <OnChainProofSection />

      {/* Detailed Technical Explanation: How Receipt Anchoring Works */}
      <section className="space-y-8 pt-6 border-t border-border/50">
        <div className="border-b border-border/60 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-gradient">How a Receipt is Anchored and Verified</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Five verifiable cryptographic phases eliminate blind trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                1
              </span>
              <span>RFC 8785 Canonical JSON</span>
            </div>
            <h3 className="text-base font-bold text-white">Deterministic Field Sorting</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Receipt data (decision, amount, mandate ID, timestamps, merchant, agent) is canonicalized under RFC 8785 (JCS). Whitespace and key order variance are completely eliminated to ensure cross-platform hash identity.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                2
              </span>
              <span>SHA-256 Digest</span>
            </div>
            <h3 className="text-base font-bold text-white">Unique Cryptographic Fingerprint</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              A standard SHA-256 hash is computed over the canonical UTF-8 bytes. Any single character change or altered amount produces a radically different hash, making tampering immediately detectable.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2 text-violet-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                3
              </span>
              <span>Ed25519 Authority Signing</span>
            </div>
            <h3 className="text-base font-bold text-white">Non-Repudiation Signature</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The CredaVer Policy Authority signs the digest with its Ed25519 secret key (<code className="text-cyan-400 font-mono">CREDAVER_AUTHORITY_SECRET_KEY</code>). Verifiers check the signature against the published authority public key.
            </p>
          </Card>

          <Card className="p-6 bg-surface-card/90 border-border/80 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                4
              </span>
              <span>SPL Memo Ledger Anchor</span>
            </div>
            <h3 className="text-base font-bold text-white">Standard Solana Program</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              When on-chain anchoring is enabled, a transaction invokes the official SPL Memo Program (<code className="text-emerald-400 font-mono">MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr</code>) embedding the receipt hash into the Solana devnet block history.
            </p>
          </Card>
        </div>

        {/* Verification walkthrough */}
        <Card glow className="p-6 sm:p-8 bg-surface-card/95 border-cyan-500/40 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
            <Shield className="w-5 h-5" />
            <span>Phase 5: Anyone Can Verify Independently</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Because both the receipt JSON and the on-chain memo contain matching cryptographic hashes and Ed25519 signatures, third-party auditors, merchants, or operators do not need to trust CredaVer servers. Any Solana RPC node or explorer can confirm that the receipt was authored by the genuine authority at the recorded block height.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-3">
            <Link href="/verify">
              <Button variant="primary" size="sm">
                <span>Open Public Verification Portal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="sm">
                <span>Run Devnet Payment Settlement</span>
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

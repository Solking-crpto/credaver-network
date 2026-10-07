import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  ShieldCheck,
  Lock,
  Zap,
  KeyRound,
  FileCheck2,
  Cpu,
  ArrowLeft,
  ExternalLink,
  Code2,
  Terminal,
  ShieldAlert,
  FolderGit2,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Technical architecture, cryptographic domain model, 12 policy gates, security notes, and full REST API reference for CredaVer Network.',
};

export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto py-4 space-y-12 text-slate-200">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
            <span className="text-muted text-xs">/</span>
            <span className="text-xs font-mono text-slate-400">Documentation</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400 shrink-0" />
            CredaVer Technical Documentation
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Deterministic, cryptographically verifiable policy decision point (PDP) and constrained signer for autonomous AI agents on Solana devnet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Badge variant="cyan" className="font-mono text-xs">
            v1.0 (Devnet)
          </Badge>
          <a
            href="https://github.com/Solking-crpto/credaver-network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 border border-cyan-500/40 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-card transition-colors"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>GitHub Docs Folder</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 1. Architecture Overview */}
      <section id="architecture" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-cyan-400" />
          1. System Architecture
        </h2>
        <Card className="p-6 bg-surface-card/85 space-y-4 border-border/80">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            AI agents operating on public blockchains traditionally require hot wallet custody, exposing operators to total fund drainage or compromised subagents. CredaVer decouples <strong>spending authorization</strong> from <strong>custodial keys</strong> through a zero-custody proxy pattern:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs font-mono pt-2">
            <div className="p-4 rounded-xl bg-surface border border-border/60 space-y-2">
              <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> Operator Mandate
              </div>
              <p className="text-slate-400 leading-relaxed">
                Operator signs an Ed25519 mandate defining allowed merchants, permitted tokens, per-transaction caps, and expiry.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border/60 space-y-2">
              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" /> Agent Identity
              </div>
              <p className="text-slate-400 leading-relaxed">
                Agent generates an in-memory keypair. It signs only single-use payment intent proofs bound to the mandate hash and nonce.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border/60 space-y-2">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Constrained Signer
              </div>
              <p className="text-slate-400 leading-relaxed">
                CredaVer PDP evaluates all 12 deterministic gates. If ALLOWed, it signs the transaction with server-held keys and issues a signed receipt.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* 2. The 12 Deterministic Gates */}
      <section id="gates" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-cyan-400" />
          2. The 12 Policy Gates
        </h2>
        <Card className="p-0 overflow-hidden bg-surface-card/85 border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface border-b border-border text-slate-400 uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Gate</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Verification Check</th>
                  <th className="py-3 px-4">Rejection Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-slate-300">
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">1</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Schema Conformance</td>
                  <td className="py-2.5 px-4">Zod structural parse of signed mandate &amp; proof</td>
                  <td className="py-2.5 px-4 text-rose-400">SCHEMA_VALIDATION_FAILED</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">2</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Operator Signature</td>
                  <td className="py-2.5 px-4">Ed25519 verification over RFC 8785 canonical mandate bytes</td>
                  <td className="py-2.5 px-4 text-rose-400">INVALID_OPERATOR_SIGNATURE</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">3</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Agent Signature</td>
                  <td className="py-2.5 px-4">Ed25519 mutual counter-signature over canonical mandate</td>
                  <td className="py-2.5 px-4 text-rose-400">INVALID_AGENT_COUNTER_SIGNATURE</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">4</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Revocation Check</td>
                  <td className="py-2.5 px-4">Store query for explicit operator emergency revocation flag</td>
                  <td className="py-2.5 px-4 text-rose-400">REVOKED_MANDATE</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">5</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Temporal Window</td>
                  <td className="py-2.5 px-4"><code className="text-slate-200">validFrom &lt;= now &lt;= expiresAt</code> boundary validation</td>
                  <td className="py-2.5 px-4 text-rose-400">EXPIRED_MANDATE</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">6</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Network Match</td>
                  <td className="py-2.5 px-4">Exact CAIP-2 genesis match (<code className="text-cyan-300">solana:EtWTRABZaYq...</code>)</td>
                  <td className="py-2.5 px-4 text-rose-400">NETWORK_MISMATCH</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">7</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Merchant Whitelist</td>
                  <td className="py-2.5 px-4">Destination merchant pubkey in allowed whitelist or wildcard</td>
                  <td className="py-2.5 px-4 text-rose-400">MERCHANT_NOT_ALLOWED</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">8</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Asset Whitelist</td>
                  <td className="py-2.5 px-4">Token mint in mandate allowedAssets list (Devnet USDC)</td>
                  <td className="py-2.5 px-4 text-rose-400">ASSET_NOT_ALLOWED</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">9</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Proof Integrity</td>
                  <td className="py-2.5 px-4">Agent signature over request-bound canonical payment proof</td>
                  <td className="py-2.5 px-4 text-rose-400">INVALID_PROOF_SIGNATURE</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">10</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Per-Tx Limit</td>
                  <td className="py-2.5 px-4"><code className="text-slate-200">amount &lt;= maxPerTx</code> integer comparison</td>
                  <td className="py-2.5 px-4 text-rose-400">AMOUNT_EXCEEDS_PER_TX</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">11</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Cumulative Cap</td>
                  <td className="py-2.5 px-4"><code className="text-slate-200">currentSpend + amount &lt;= totalCap</code> in store</td>
                  <td className="py-2.5 px-4 text-rose-400">AMOUNT_EXCEEDS_CAP</td>
                </tr>
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">12</td>
                  <td className="py-2.5 px-4 font-semibold text-white">Atomic Replay Protection</td>
                  <td className="py-2.5 px-4">Atomic Redis <code className="text-cyan-300">SET NX EX</code> consumes proof nonce</td>
                  <td className="py-2.5 px-4 text-rose-400">REPLAY_DETECTED</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* 3. Receipts & SPL Memo Anchors */}
      <section id="receipts" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <FileCheck2 className="w-5 h-5 text-cyan-400" />
          3. Receipts &amp; SPL Memo Anchoring
        </h2>
        <Card className="p-6 bg-surface-card/85 space-y-4 border-border/80 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <p>
            Every policy evaluation produces an immutable <strong>Signed Decision Receipt</strong>. The receipt body is serialized using <a href="https://datatracker.ietf.org/doc/html/rfc8785" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline underline-offset-4">RFC 8785 JSON Canonicalization Scheme (JCS)</a>, SHA-256 hashed, and signed with the configured CredaVer Authority Ed25519 secret key (<code className="text-cyan-300 font-mono">CREDAVER_AUTHORITY_SECRET_KEY</code>).
          </p>
          <div className="p-4 rounded-xl bg-surface border border-border/60 space-y-2 font-mono text-xs">
            <div className="text-cyan-300 font-semibold">SPL Memo On-Chain Anchoring Format:</div>
            <code className="text-slate-300 block bg-surface-card p-3 rounded-lg border border-border/40 overflow-x-auto">
              credav:1:&lt;mandateHashFirst8&gt;:&lt;receiptHash&gt;:&lt;decision&gt;
            </code>
            <p className="text-slate-400 text-[11px] pt-1">
              Anchored transactions write the memo to Solana Devnet via the SPL Memo Program (<code className="text-slate-300">MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr</code>). Anyone can verify the memo block time, slot, and hash match without trusting CredaVer servers.
            </p>
          </div>
        </Card>
      </section>

      {/* 4. REST API Reference */}
      <section id="api" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-cyan-400" />
          4. REST API Reference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="px-2 py-0.5">POST</Badge>
              <span className="font-bold text-white">/api/scenarios</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Execute simulated or live scenarios: ALLOW, OVER_CAP, REVOKED, EXPIRED, REPLAY, REVIEW, REAL_DEVNET.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="px-2 py-0.5">GET</Badge>
              <span className="font-bold text-white">/api/verify?receiptId=&lt;id&gt;</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Verifies any stored receipt by ID or on-chain memo transaction signature globally.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="px-2 py-0.5">GET</Badge>
              <span className="font-bold text-white">/api/mandates</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Lists operator mandates belonging to visitor session. Defaults to active only; supports ?showAll=true.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="px-2 py-0.5">POST</Badge>
              <span className="font-bold text-white">/api/mandates</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Submits a co-signed operator and agent mandate for verification and storage.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="px-2 py-0.5">POST</Badge>
              <span className="font-bold text-white">/api/mandates/prepare</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Constructs the canonical RFC 8785 mandate core and readable text message for Phantom signing.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="px-2 py-0.5">POST</Badge>
              <span className="font-bold text-white">/api/mandates/[id]/revoke</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Emergency revocation endpoint setting the mandate status to revoked.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="px-2 py-0.5">GET</Badge>
              <span className="font-bold text-white">/api/receipts</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Lists signed decision receipts for the current visitor session, newest first.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="px-2 py-0.5">GET</Badge>
              <span className="font-bold text-white">/api/receipts/[id]</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Returns single stored receipt record by receipt ID.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="px-2 py-0.5">POST</Badge>
              <span className="font-bold text-white">/api/reviews</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Operator review queue actions: approve or reject high-value transactions held in REVIEW status.
            </p>
          </Card>

          <Card className="p-4 bg-surface-card/85 space-y-2 border-border/80">
            <div className="flex items-center gap-2">
              <Badge variant="green" className="px-2 py-0.5">GET</Badge>
              <span className="font-bold text-white">/api/health</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              System health and devnet connectivity check returning cluster status and timestamp.
            </p>
          </Card>
        </div>
      </section>

      {/* 5. Security Notes & Non-Trustless Disclosure */}
      <section id="security" className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          5. Security Notes &amp; Non-Trustless Disclosure
        </h2>
        <Card className="p-6 bg-surface-card/85 space-y-4 border-amber-500/30 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>Honest Security Model</span>
          </div>
          <p>
            CredaVer rejects misleading "trustless" buzzwords. Security relies on deterministic code execution and asymmetric cryptography:
          </p>
          <ul className="space-y-2 list-disc list-inside font-mono text-xs text-slate-400">
            <li>
              <strong>Deterministic code runs in isolation</strong>: Gates 1–12 are written in immutable TypeScript validation logic. AI models are not in the loop of decision evaluation and cannot prompt-inject policy decisions.
            </li>
            <li>
              <strong>Zero funding key custody for agents</strong>: Agents generate throwaway identity keypairs. Compromising the agent model yields zero private keys to on-chain balances.
            </li>
            <li>
              <strong>Cryptographic non-repudiation</strong>: The PDP signs every ALLOW, DENY, and REVIEW. If the server ever signed an unauthorized payment, the receipt stands as mathematical evidence of breach.
            </li>
            <li>
              <strong>Devnet scope</strong>: All tokens used in this hackathon demonstration are devnet tokens without economic value.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

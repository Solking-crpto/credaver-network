'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatusChip } from '../components/ui/StatusChip';
import {
  ShieldCheck,
  Key,
  FileCheck2,
  Cpu,
  Lock,
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Clock,
  Layers,
} from 'lucide-react';

interface ScenarioResult {
  scenario: string;
  statusCode: number;
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  latencyMs: number;
  details: string;
  reasonCodes?: string[];
  mandateId?: string;
  receipt?: any;
}

export default function HomePage() {
  // Test Runner State
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResult>>({});
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [pendingReviewReceipt, setPendingReviewReceipt] = useState<any | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // Mandates State
  const [mandates, setMandates] = useState<any[]>([]);
  const [mandatesLoading, setMandatesLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Receipts State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  // Load Initial Data
  useEffect(() => {
    fetchMandates();
    fetchReceipts();
  }, []);

  const fetchMandates = async () => {
    setMandatesLoading(true);
    try {
      const res = await fetch('/api/mandates');
      const data = await res.json();
      if (res.ok && data.mandates) {
        setMandates(data.mandates);
      }
    } catch {
      // ignore
    } finally {
      setMandatesLoading(false);
    }
  };

  const fetchReceipts = async () => {
    setReceiptsLoading(true);
    try {
      const res = await fetch('/api/receipts');
      const data = await res.json();
      if (res.ok && data.receipts) {
        setReceipts(data.receipts);
      }
    } catch {
      // ignore
    } finally {
      setReceiptsLoading(false);
    }
  };

  const runScenario = async (scenario: string) => {
    setRunningScenario(scenario);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (res.ok) {
        setScenarioResults((prev) => ({ ...prev, [scenario]: data }));
        setActiveReceipt(data.receipt);
        if (data.decision === 'REVIEW') {
          setPendingReviewReceipt(data.receipt);
        }
      }
      // Refresh backend views
      fetchMandates();
      fetchReceipts();
    } catch (err: any) {
      console.error('Scenario error:', err);
    } finally {
      setRunningScenario(null);
    }
  };

  const runAllScenarios = async () => {
    const scenarios = ['ALLOW', 'OVER_CAP', 'REVOKED', 'EXPIRED', 'REPLAY', 'REVIEW'];
    for (const sc of scenarios) {
      await runScenario(sc);
    }
  };

  const handleRevokeMandate = async (mandateId: string) => {
    setRevokingId(mandateId);
    try {
      const res = await fetch(`/api/mandates/${mandateId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Revoked via interactive console' }),
      });
      if (res.ok) {
        fetchMandates();
        fetchReceipts();
      }
    } catch (err) {
      console.error('Revocation error:', err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleReviewAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!pendingReviewReceipt) return;
    setReviewActionLoading(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: pendingReviewReceipt.receiptId,
          action,
          reason: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} via operator dashboard`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveReceipt(data.receipt);
        setPendingReviewReceipt(null);
        fetchMandates();
        fetchReceipts();
      }
    } catch (err) {
      console.error('Review action error:', err);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const truncate = (str: string, len: number = 8) =>
    str ? `${str.slice(0, len)}...${str.slice(-4)}` : '';

  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  return (
    <div className="space-y-14">
      {/* Hero Section */}
      <section className="text-center py-6 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-credav-surface border border-credav-border/80 text-xs text-credav-cyan">
          <Zap className="w-3.5 h-3.5 text-credav-cyan animate-pulse" />
          <span>Crypto World&apos;s Fair Hackathon 2026 • Colosseum</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto">
          The Authorization Layer Between{' '}
          <span className="text-gradient">AI Agents &amp; Solana Wallets</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Operators sign scoped, expiring, revocable <strong>Agent Mandates</strong>. CredaVer deterministically
          evaluates every x402 payment, returning{' '}
          <span className="text-emerald-400 font-semibold">ALLOW</span>,{' '}
          <span className="text-rose-400 font-semibold">DENY</span>, or{' '}
          <span className="text-amber-400 font-semibold">REVIEW</span> with verifiable Solana devnet receipts.
        </p>
      </section>

      {/* Trust & PDP Disclosure */}
      <div className="p-4 rounded-xl bg-credav-card/60 border border-credav-border/60 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-credav-cyan shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">
            CredaVer is a Deterministic Policy Decision Point (PDP)
          </p>
          <p className="text-slate-400 leading-relaxed">
            AI never grants itself financial authority. Policy evaluation is pure deterministic code. Payments settle on Solana Devnet via the x402 protocol.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MILESTONE 5: INTERACTIVE SCENARIO RUNNER (JUDGE QUICK-TEST)               */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="cyan">Milestone 5</Badge>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-credav-cyan" />
                Interactive Policy Scenario Runner
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Trigger all 6 key policy scenarios against the real PDP engine with zero configuration.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={runAllScenarios}
            isLoading={runningScenario !== null}
            className="self-start sm:self-auto"
          >
            ⚡ Run All 6 Scenarios
          </Button>
        </div>

        {/* 6 Scenario Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Scenario 1: ALLOW */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['ALLOW'] ? 'border-emerald-500/50 bg-emerald-950/15' : 'hover:border-credav-cyan/40'
            }`}
            onClick={() => runScenario('ALLOW')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-emerald-400">1. Normal Payment</span>
              <StatusChip status="ALLOW" />
            </div>
            <p className="text-xs text-slate-300">
              Payment under cap to listed merchant. Signs tx message, records spend, and returns signed receipt.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['ALLOW'] ? `Latency: ${scenarioResults['ALLOW'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 2: OVER_CAP */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['OVER_CAP'] ? 'border-rose-500/50 bg-rose-950/15' : 'hover:border-rose-500/40'
            }`}
            onClick={() => runScenario('OVER_CAP')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-rose-400">2. Exceeds Cap</span>
              <StatusChip status="DENY" />
            </div>
            <p className="text-xs text-slate-300">
              Agent requests payment exceeding total mandate cap. Fails closed with 403 AMOUNT_EXCEEDS_CAP.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['OVER_CAP'] ? `Latency: ${scenarioResults['OVER_CAP'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 3: REVOKED */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['REVOKED'] ? 'border-rose-500/50 bg-rose-950/15' : 'hover:border-rose-500/40'
            }`}
            onClick={() => runScenario('REVOKED')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-rose-400">3. Revoked Mandate</span>
              <StatusChip status="DENY" />
            </div>
            <p className="text-xs text-slate-300">
              Operator revokes mandate; subsequent agent requests immediately fail with 403 REVOKED_MANDATE.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REVOKED'] ? `Latency: ${scenarioResults['REVOKED'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 4: EXPIRED */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['EXPIRED'] ? 'border-rose-500/50 bg-rose-950/15' : 'hover:border-rose-500/40'
            }`}
            onClick={() => runScenario('EXPIRED')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-rose-400">4. Expired Mandate</span>
              <StatusChip status="DENY" />
            </div>
            <p className="text-xs text-slate-300">
              Validity window has lapsed. Deterministic gate rejects agent with 403 EXPIRED_MANDATE.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['EXPIRED'] ? `Latency: ${scenarioResults['EXPIRED'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 5: REPLAY */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['REPLAY'] ? 'border-rose-500/50 bg-rose-950/15' : 'hover:border-rose-500/40'
            }`}
            onClick={() => runScenario('REPLAY')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-rose-400">5. Replay Attack</span>
              <StatusChip status="DENY" />
            </div>
            <p className="text-xs text-slate-300">
              Same proof nonce transmitted twice. Atomic SET NX EX rejects duplicate with REPLAY_DETECTED.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REPLAY'] ? `Latency: ${scenarioResults['REPLAY'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 6: REVIEW */}
          <Card
            className={`cursor-pointer transition-all border ${
              scenarioResults['REVIEW'] ? 'border-amber-500/50 bg-amber-950/15' : 'hover:border-amber-500/40'
            }`}
            onClick={() => runScenario('REVIEW')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-amber-400">6. Human Review Gate</span>
              <StatusChip status="REVIEW" />
            </div>
            <p className="text-xs text-slate-300">
              Payment exceeds review threshold. Held with 202 REVIEW awaiting operator console approval.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REVIEW'] ? `Latency: ${scenarioResults['REVIEW'].latencyMs}ms` : 'Ready to test'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>
        </div>

        {/* Pending Review Decision Modal / Banner */}
        {pendingReviewReceipt && (
          <Card className="border-amber-500/50 bg-amber-950/25 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="amber">PENDING OPERATOR REVIEW</Badge>
                <span className="text-xs font-mono text-slate-300">
                  Receipt #{pendingReviewReceipt.receiptId}
                </span>
              </div>
              <span className="text-xs font-mono text-amber-400 font-bold">
                Amount: {formatAmountUSDC(pendingReviewReceipt.amount)}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Agent requested payment exceeding operator threshold. Transaction is halted until operator decision.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleReviewAction('APPROVE')}
                isLoading={reviewActionLoading}
              >
                ✓ Approve &amp; Sign Payment
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleReviewAction('REJECT')}
                isLoading={reviewActionLoading}
              >
                ✕ Reject Payment
              </Button>
            </div>
          </Card>
        )}

        {/* Live Scenario Result Inspector */}
        {activeReceipt && (
          <Card glow className="space-y-3">
            <div className="flex items-center justify-between border-b border-credav-border/40 pb-2">
              <div className="flex items-center gap-2">
                <StatusChip status={activeReceipt.decision} />
                <span className="text-xs font-mono text-white font-bold">
                  Receipt: {activeReceipt.receiptId}
                </span>
              </div>
              <Link
                href={`/verify?receiptId=${activeReceipt.receiptId}`}
                className="text-xs font-mono text-credav-cyan flex items-center gap-1 hover:underline"
              >
                Verify on Devnet Anchor <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-credav-surface rounded border border-credav-border/40">
                <div className="text-slate-400 text-[10px]">Decision</div>
                <div className="text-white font-bold">{activeReceipt.decision}</div>
              </div>
              <div className="p-2 bg-credav-surface rounded border border-credav-border/40">
                <div className="text-slate-400 text-[10px]">Reason Codes</div>
                <div className="text-slate-200">{activeReceipt.reasonCodes?.join(', ')}</div>
              </div>
              <div className="p-2 bg-credav-surface rounded border border-credav-border/40">
                <div className="text-slate-400 text-[10px]">Amount</div>
                <div className="text-white">{formatAmountUSDC(activeReceipt.amount)}</div>
              </div>
              <div className="p-2 bg-credav-surface rounded border border-credav-border/40">
                <div className="text-slate-400 text-[10px]">Authority Sig</div>
                <div className="text-slate-200 truncate">{truncate(activeReceipt.authoritySignature, 6)}</div>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ========================================================================= */}
      {/* ACTIVE MANDATES REGISTRY VIEW (Section 5.1)                               */}
      {/* ========================================================================= */}
      <section id="mandates" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-credav-cyan" />
              Active Operator Mandates
            </h2>
            <Badge variant="cyan">{mandates.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMandates} isLoading={mandatesLoading}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {mandates.length === 0 ? (
          <Card className="text-center py-8 text-slate-400 font-mono text-xs">
            No active mandates found. Run a scenario above to create one.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mandates.map((m) => {
              const cap = BigInt(m.totalCap || '0');
              const spend = BigInt(m.currentSpend || '0');
              const pct = cap > 0n ? Number((spend * 100n) / cap) : 0;
              const isExpired = Date.now() > m.expiresAt;

              return (
                <Card key={m.mandateId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">{m.mandateId}</span>
                    {m.revoked ? (
                      <Badge variant="rose">REVOKED</Badge>
                    ) : isExpired ? (
                      <Badge variant="amber">EXPIRED</Badge>
                    ) : (
                      <Badge variant="green">ACTIVE</Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-xs font-mono text-slate-400">
                    <div>Operator: <span className="text-slate-200">{truncate(m.operatorPubkey)}</span></div>
                    <div>Agent: <span className="text-slate-200">{truncate(m.agentPubkey)}</span></div>
                    <div>Per-Tx Limit: <span className="text-slate-200">{formatAmountUSDC(m.maxPerTx)}</span></div>
                    <div>Total Cap: <span className="text-slate-200">{formatAmountUSDC(m.totalCap)}</span></div>
                  </div>

                  {/* Spend Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span>Cumulative Spend</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-credav-bg rounded-full overflow-hidden border border-credav-border/50">
                      <div
                        className={`h-full transition-all ${pct >= 100 ? 'bg-rose-500' : 'bg-credav-cyan'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Expiry & Revoke Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-credav-border/40">
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {isExpired ? 'Expired' : `Expires in ${Math.round((m.expiresAt - Date.now()) / 60000)}m`}
                    </span>
                    {!m.revoked && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={revokingId === m.mandateId}
                        isLoading={revokingId === m.mandateId}
                        onClick={() => handleRevokeMandate(m.mandateId)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* AUDIT RECEIPTS REGISTRY VIEW (Section 5.1)                                */}
      {/* ========================================================================= */}
      <section id="receipts" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-credav-cyan" />
              Signed Decision Receipts
            </h2>
            <Badge variant="cyan">{receipts.length}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={fetchReceipts} isLoading={receiptsLoading}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>

        {receipts.length === 0 ? (
          <Card className="text-center py-8 text-slate-400 font-mono text-xs">
            No receipts recorded yet. Trigger a scenario above to generate verifiable receipts.
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-credav-surface/80 border-b border-credav-border/60 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Decision</th>
                    <th className="p-3">Receipt ID</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Reason Codes</th>
                    <th className="p-3">Issued</th>
                    <th className="p-3 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-credav-border/40">
                  {receipts.slice(0, 10).map((r) => (
                    <tr key={r.receiptId} className="hover:bg-credav-surface/40 transition-colors">
                      <td className="p-3">
                        <StatusChip status={r.decision} />
                      </td>
                      <td className="p-3 font-semibold text-white">{r.receiptId}</td>
                      <td className="p-3 text-slate-200">{formatAmountUSDC(r.amount)}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">
                        {r.reasonCodes?.join(', ')}
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(r.issuedAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/verify?receiptId=${r.receiptId}`}
                          className="text-credav-cyan hover:underline inline-flex items-center gap-1"
                        >
                          Verify ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

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
    </div>
  );
}

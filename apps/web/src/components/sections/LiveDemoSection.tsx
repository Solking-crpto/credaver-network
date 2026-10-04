import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { StatusChip } from '../ui/StatusChip';
import {
  Play,
  RotateCcw,
  Zap,
  Info,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

export interface ScenarioResult {
  scenario: string;
  statusCode: number;
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  latencyMs: number;
  details: string;
  reasonCodes?: string[];
  mandateId?: string;
  receipt?: any;
  txSignature?: string;
  explorerUrl?: string;
  anchorTxSignature?: string;
  anchorExplorerUrl?: string;
  anchorStatus?: string;
}

interface LiveDemoSectionProps {
  runningScenario: string | null;
  scenarioResults: Record<string, ScenarioResult>;
  activeReceipt: any | null;
  pendingReviewReceipt: any | null;
  reviewActionLoading: boolean;
  onRunScenario: (scenario: string) => Promise<void>;
  onRunAllScenarios: () => Promise<void>;
  onReviewAction: (action: 'APPROVE' | 'REJECT') => Promise<void>;
}

export const LiveDemoSection: React.FC<LiveDemoSectionProps> = ({
  runningScenario,
  scenarioResults,
  activeReceipt,
  pendingReviewReceipt,
  reviewActionLoading,
  onRunScenario,
  onRunAllScenarios,
  onReviewAction,
}) => {
  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  const truncate = (str: string, len: number = 8) =>
    str ? `${str.slice(0, len)}...${str.slice(-4)}` : '';

  const scenariosList = [
    {
      id: 'ALLOW',
      name: 'Normal Payment',
      decision: 'ALLOW' as const,
      badge: 'SIMULATED SVM',
      badgeVariant: 'amber' as const,
      description: 'Payment under mandate cap to listed merchant. Policy passes, spends cap, and issues signed receipt.',
    },
    {
      id: 'OVER_CAP',
      name: 'Exceeds Cap',
      decision: 'DENY' as const,
      badge: 'SIMULATED AGENT',
      badgeVariant: 'muted' as const,
      description: 'Agent requests amount exceeding total mandate limit. Fails closed with AMOUNT_EXCEEDS_CAP.',
    },
    {
      id: 'REVOKED',
      name: 'Revoked Mandate',
      decision: 'DENY' as const,
      badge: 'SIMULATED AGENT',
      badgeVariant: 'muted' as const,
      description: 'Operator revokes mandate; subsequent requests fail closed immediately with REVOKED_MANDATE.',
    },
    {
      id: 'EXPIRED',
      name: 'Expired Mandate',
      decision: 'DENY' as const,
      badge: 'SIMULATED AGENT',
      badgeVariant: 'muted' as const,
      description: 'Validity window has lapsed. Deterministic gate rejects agent request with EXPIRED_MANDATE.',
    },
    {
      id: 'REPLAY',
      name: 'Replay Attack',
      decision: 'DENY' as const,
      badge: 'SIMULATED AGENT',
      badgeVariant: 'muted' as const,
      description: 'Same proof nonce transmitted twice. Atomic SET NX rejects duplicate attempt with REPLAY_DETECTED.',
    },
    {
      id: 'REVIEW',
      name: 'Human Review Gate',
      decision: 'REVIEW' as const,
      badge: 'REAL QUEUE',
      badgeVariant: 'cyan' as const,
      description: 'Payment exceeds review threshold. Held in operator review queue for manual approval/rejection.',
    },
  ];

  return (
    <section id="live-demo" className="py-12 border-t border-border/50 space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Play className="w-6 h-6 text-cyan-400" />
              Live Demo
            </h2>
          </div>
          <p className="text-sm text-muted mt-1">
            Test policy evaluations in real time against the deterministic Policy Decision Point engine.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onRunAllScenarios}
          isLoading={runningScenario !== null}
          className="self-start sm:self-auto min-h-[44px] px-5"
        >
          <Play className="w-4 h-4 mr-2" />
          <span>Run all 6 scenarios</span>
        </Button>
      </div>

      {/* Calm Honesty Audit Info Panel */}
      <div className="p-4 rounded-xl bg-surface-card/60 border border-border/80 flex items-start gap-3.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-white">Honesty Audit</p>
          <p className="text-muted leading-relaxed">
            Policy evaluations (all 12 gates, Ed25519 signatures, RFC 8785 canonical hashes, and operator review queues) are <strong className="text-slate-200">100% REAL</strong>. The in-browser dashboard scenarios use <strong className="text-amber-300">SIMULATED SVM bytes</strong> to ensure instant feedback without spending test funds. For verified live on-chain devnet settlement, execute the featured <strong className="text-emerald-400">Real Devnet Settlement</strong> below.
          </p>
        </div>
      </div>

      {/* FEATURED CARD: Real Devnet Settlement (Placed First & Visually Featured) */}
      <Card
        className={`p-6 border-2 transition-all ${
          scenarioResults['REAL_DEVNET']
            ? scenarioResults['REAL_DEVNET'].statusCode === 200
              ? 'border-emerald-500/70 bg-emerald-950/20'
              : 'border-amber-500/70 bg-amber-950/20'
            : 'border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500/60'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                Featured Live Execution
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Real Devnet Settlement (x402 Protocol)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="green" className="font-mono text-xs font-bold px-2.5 py-0.5">
              REAL (devnet)
            </Badge>
            {scenarioResults['REAL_DEVNET'] && (
              <StatusChip status={scenarioResults['REAL_DEVNET'].decision} />
            )}
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
          Real devnet payment using server-funded devnet keys. The agent holds only its identity key, requesting 1.00 USDC telemetry from the demo merchant via the CredaVer Constrained Signer and the public facilitator (<code className="text-cyan-400 font-mono">x402.org</code>).
        </p>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-emerald-500/20 gap-4">
          <div className="text-xs font-mono text-slate-400">
            {runningScenario === 'REAL_DEVNET' ? (
              <span className="text-emerald-400 animate-pulse flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                Executing live settlement via facilitator (~5–10s)...
              </span>
            ) : scenarioResults['REAL_DEVNET'] ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-300">
                  Latency: {scenarioResults['REAL_DEVNET'].latencyMs}ms
                </span>
                {scenarioResults['REAL_DEVNET'].txSignature && (
                  <Link
                    href={scenarioResults['REAL_DEVNET'].explorerUrl || `https://explorer.solana.com/tx/${scenarioResults['REAL_DEVNET'].txSignature}?cluster=devnet`}
                    target="_blank"
                    className="text-emerald-400 underline font-bold inline-flex items-center gap-1 hover:text-emerald-300"
                  >
                    Solana Explorer TX <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
                {scenarioResults['REAL_DEVNET'].anchorTxSignature && (
                  <Link
                    href={scenarioResults['REAL_DEVNET'].anchorExplorerUrl || `https://explorer.solana.com/tx/${scenarioResults['REAL_DEVNET'].anchorTxSignature}?cluster=devnet`}
                    target="_blank"
                    className="text-cyan-400 underline font-mono text-[11px] inline-flex items-center gap-1 hover:text-cyan-300"
                  >
                    ⚓ Anchor Memo: {scenarioResults['REAL_DEVNET'].anchorTxSignature.slice(0, 8)}... <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
            ) : (
              <span className="text-emerald-400/80">
                Live Solana Devnet Settlement + SPL Memo Anchor
              </span>
            )}
          </div>

          <Button
            variant="primary"
            onClick={() => onRunScenario('REAL_DEVNET')}
            isLoading={runningScenario === 'REAL_DEVNET'}
            className="self-start sm:self-auto min-h-[44px] px-5"
          >
            <span>Execute Live Devnet Payment</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Grid of the 6 Policy Scenarios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenariosList.map((sc, index) => {
          const res = scenarioResults[sc.id];
          const isSelected = res !== undefined;
          return (
            <Card
              key={sc.id}
              className={`p-5 flex flex-col justify-between border transition-all ${
                isSelected
                  ? sc.decision === 'ALLOW'
                    ? 'border-emerald-500/50 bg-emerald-950/15'
                    : sc.decision === 'DENY'
                    ? 'border-rose-500/50 bg-rose-950/15'
                    : 'border-amber-500/50 bg-amber-950/15'
                  : 'border-border/80 bg-surface-card/70 hover:border-cyan-500/40'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {index + 1}. {sc.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={sc.badgeVariant} className="text-[10px] py-0 px-1.5 font-mono">
                      {sc.badge}
                    </Badge>
                    <StatusChip status={sc.decision} />
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {sc.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted">
                  {res ? `${res.latencyMs}ms` : 'Ready'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRunScenario(sc.id)}
                  isLoading={runningScenario === sc.id}
                  className="min-h-[36px] px-3 text-xs"
                >
                  <span>Run</span>
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pending Review Decision Banner */}
      {pendingReviewReceipt && (
        <Card className="border-amber-500/60 bg-amber-950/30 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="amber">PENDING OPERATOR REVIEW</Badge>
              <span className="text-xs font-mono text-slate-200">
                Receipt #{pendingReviewReceipt.receiptId}
              </span>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold">
              Amount: {formatAmountUSDC(pendingReviewReceipt.amount)}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Payment exceeds operator review threshold ($1.50 USDC). Held in operator review queue for manual decision.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onReviewAction('APPROVE')}
              isLoading={reviewActionLoading}
              className="min-h-[40px] px-4"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Approve &amp; Sign Payment</span>
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onReviewAction('REJECT')}
              isLoading={reviewActionLoading}
              className="min-h-[40px] px-4"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              <span>Reject Payment</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Inline Result Inspector Panel */}
      {activeReceipt && (
        <Card glow className="p-5 space-y-3 border-cyan-500/40 bg-surface-card/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <StatusChip status={activeReceipt.decision} />
              <span className="text-xs font-mono text-white font-bold">
                Receipt #{activeReceipt.receiptId}
              </span>
            </div>
            <Link
              href={`/verify?receiptId=${activeReceipt.receiptId}`}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-4"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verify this receipt</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 bg-surface rounded-lg border border-border/50">
              <div className="text-muted text-[10px] uppercase">Decision</div>
              <div className="text-white font-bold">{activeReceipt.decision}</div>
            </div>
            <div className="p-2.5 bg-surface rounded-lg border border-border/50">
              <div className="text-muted text-[10px] uppercase">Reason Code</div>
              <div className="text-cyan-400 font-semibold truncate">
                {activeReceipt.reasonCodes?.[0] || 'NONE'}
              </div>
            </div>
            <div className="p-2.5 bg-surface rounded-lg border border-border/50">
              <div className="text-muted text-[10px] uppercase">Receipt Hash</div>
              <div className="text-slate-300 truncate">
                {truncate(activeReceipt.receiptHash, 8)}
              </div>
            </div>
            <div className="p-2.5 bg-surface rounded-lg border border-border/50">
              <div className="text-muted text-[10px] uppercase">Authority Sig</div>
              <div className="text-slate-300 truncate">
                {truncate(activeReceipt.authoritySignature, 8)}
              </div>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
};

import React, { useRef, useEffect } from 'react';
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
  error?: string;
  message?: string;
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
  const featuredCardRef = useRef<HTMLDivElement>(null);
  const hasTriggeredScroll = useRef(false);

  const realDevnetResult = scenarioResults['REAL_DEVNET'];
  const isRealRunning = runningScenario === 'REAL_DEVNET';
  const hasRealResult = Boolean(realDevnetResult);
  const isRealSuccess = realDevnetResult?.statusCode === 200;
  const isRealError = hasRealResult && !isRealSuccess;

  useEffect(() => {
    if (isRealRunning) {
      hasTriggeredScroll.current = true;
      featuredCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (hasTriggeredScroll.current && realDevnetResult) {
      featuredCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isRealRunning, realDevnetResult]);

  const getPlainLanguageErrorMessage = (res: ScenarioResult): string => {
    const text = (res.details || '').toLowerCase();
    const msg = ((res as any).message || '').toLowerCase();
    const err = ((res as any).error || '').toLowerCase();

    if (err === 'rate_limit_exceeded' || res.statusCode === 429) {
      return (
        (res as any).message ||
        res.details ||
        'Daily limit for live devnet payments reached. Please try again tomorrow.'
      );
    }
    if (
      err === 'settlement_failed' ||
      (res as any).settlementStatus === 'FAILED' ||
      text.includes('settlement failed') ||
      msg.includes('settlement failed')
    ) {
      return 'Policy allowed, settlement failed';
    }
    if (
      err === 'facilitator_unavailable' ||
      text.includes('facilitator') ||
      msg.includes('facilitator') ||
      text.includes('econnrefused') ||
      text.includes('unreachable') ||
      text.includes('fetch failed')
    ) {
      return 'The public facilitator is unavailable';
    }
    if (
      err === 'insufficient_devnet_funds' ||
      text.includes('insufficient') ||
      msg.includes('insufficient') ||
      text.includes('out of') ||
      text.includes('balance') ||
      text.includes('0x1')
    ) {
      return 'The demo wallet is out of devnet funds';
    }
    return (res as any).message || res.details || 'Live devnet payment settlement failed. Please try again.';
  };

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
      name: 'Exceeds Per-Tx Limit',
      decision: 'DENY' as const,
      badge: 'SIMULATED AGENT',
      badgeVariant: 'muted' as const,
      description: 'Agent requests amount exceeding per-transaction limit ($3.00 > $2.00 max). Fails closed with AMOUNT_EXCEEDS_PER_TX.',
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
      <div ref={featuredCardRef} className="scroll-mt-8">
        <Card
          className={`p-6 border-2 transition-all ${
            isRealRunning
              ? 'border-emerald-500/60 bg-emerald-950/20 shadow-glow'
              : isRealSuccess
              ? 'border-emerald-500/70 bg-emerald-950/20'
              : isRealError
              ? 'border-rose-500/60 bg-rose-950/20'
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
              {realDevnetResult && (
                <StatusChip status={realDevnetResult.decision} />
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
            Real devnet payment using server-funded devnet keys. The agent holds only its identity key, requesting 1.00 USDC telemetry from the demo merchant via the CredaVer Constrained Signer and the public facilitator (<code className="text-cyan-400 font-mono">x402.org</code>).
          </p>

          {/* LOADING STATE */}
          {isRealRunning && (
            <div className="mt-5 p-4 rounded-xl bg-surface/90 border border-emerald-500/40 flex items-start sm:items-center gap-3.5 animate-pulse">
              <RotateCcw className="w-5 h-5 text-emerald-400 animate-spin shrink-0 mt-0.5 sm:mt-0" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">
                  Settling on Solana devnet, usually 5 to 15 seconds
                </div>
                <div className="text-xs text-muted font-mono">
                  CredaVer Constrained Signer evaluating proof and broadcasting x402 payment to public facilitator...
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS RESULT INSIDE FEATURED CARD */}
          {!isRealRunning && isRealSuccess && (() => {
            const receiptId = realDevnetResult.receipt?.receiptId || realDevnetResult.mandateId || 'UNKNOWN';
            const reasonCode =
              realDevnetResult.reasonCodes?.[0] ||
              realDevnetResult.receipt?.reasonCodes?.[0] ||
              'POLICY_PASSED_ALL_GATES';
            const explorerUrl =
              realDevnetResult.explorerUrl ||
              (realDevnetResult.txSignature
                ? `https://explorer.solana.com/tx/${realDevnetResult.txSignature}?cluster=devnet`
                : undefined);
            const anchorExplorerUrl =
              realDevnetResult.anchorExplorerUrl ||
              (realDevnetResult.anchorTxSignature
                ? `https://explorer.solana.com/tx/${realDevnetResult.anchorTxSignature}?cluster=devnet`
                : undefined);

            return (
              <div className="mt-5 p-5 rounded-xl bg-surface-card/90 border border-emerald-500/50 space-y-4">
                {/* Decision Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <StatusChip status={realDevnetResult.decision} />
                    <Badge variant="cyan" className="font-mono text-xs">
                      {reasonCode}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted" />
                    <span>Total Latency:</span>
                    <strong className="text-white font-bold">{realDevnetResult.latencyMs}ms</strong>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-2.5 text-xs font-mono">
                  {/* Receipt ID */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-lg bg-surface border border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="text-muted">Receipt ID:</span>
                      <code className="text-white font-bold">{receiptId}</code>
                    </div>
                    <Link
                      href={`/verify?receiptId=${receiptId}`}
                      className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 flex items-center gap-1 self-start sm:self-auto"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify this receipt</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Settlement TX */}
                  {realDevnetResult.txSignature && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-lg bg-surface border border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-muted">Settlement TX:</span>
                        <code className="text-emerald-300">{truncate(realDevnetResult.txSignature, 12)}</code>
                      </div>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 flex items-center gap-1 self-start sm:self-auto"
                        >
                          <span>View on Solana Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* On-Chain Anchor */}
                  {realDevnetResult.anchorTxSignature ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-lg bg-surface border border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-muted">On-Chain Anchor:</span>
                        <code className="text-cyan-300">{truncate(realDevnetResult.anchorTxSignature, 12)}</code>
                      </div>
                      {anchorExplorerUrl && (
                        <a
                          href={anchorExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 flex items-center gap-1 self-start sm:self-auto"
                        >
                          <span>Anchor Memo on Explorer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : realDevnetResult.anchorStatus && realDevnetResult.anchorStatus.includes('failed') ? (
                    <div className="p-2.5 rounded-lg bg-surface border border-amber-500/30 text-amber-300 flex items-center justify-between">
                      <span>On-Chain Anchor:</span>
                      <span className="font-semibold">anchor failed</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()}

          {/* ERROR STATE INSIDE FEATURED CARD */}
          {!isRealRunning && isRealError && (
            <div className="mt-5 p-5 rounded-xl bg-rose-950/25 border border-rose-500/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span className="text-sm font-semibold text-rose-200">
                    {(realDevnetResult as any).settlementStatus === 'FAILED' || (realDevnetResult as any).error === 'SETTLEMENT_FAILED'
                      ? 'Policy Allowed, Settlement Failed'
                      : 'Payment Settlement Not Completed'}
                  </span>
                </div>
                <Badge variant="rose" className="font-mono text-xs self-start sm:self-auto">
                  HTTP {realDevnetResult.statusCode || 500}
                </Badge>
              </div>

              <div className="p-3 bg-surface/80 rounded-lg border border-border/50 text-xs font-mono text-rose-300">
                <p className="font-semibold text-white mb-1">
                  {getPlainLanguageErrorMessage(realDevnetResult)}
                </p>
                {realDevnetResult.details &&
                  realDevnetResult.details !== getPlainLanguageErrorMessage(realDevnetResult) && (
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {realDevnetResult.details}
                    </p>
                  )}
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRunScenario('REAL_DEVNET')}
                  disabled={isRealRunning}
                  className="hover:border-rose-400 hover:text-rose-300 min-h-[38px] px-4 text-xs font-mono"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  <span>Retry</span>
                </Button>
              </div>
            </div>
          )}

          {/* Action / Trigger Row */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-emerald-500/20 gap-4">
            <div className="text-xs font-mono text-slate-400">
              {isRealRunning ? (
                <span className="text-emerald-400 animate-pulse flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Executing live settlement via facilitator (~5–15s)...
                </span>
              ) : isRealSuccess ? (
                <span className="text-emerald-400">
                  Payment settled and spend recorded on devnet.
                </span>
              ) : isRealError ? (
                <span className="text-rose-400">
                  Payment failed. You can retry with the button below.
                </span>
              ) : (
                <span className="text-emerald-400/80">
                  Live Solana Devnet Settlement + SPL Memo Anchor
                </span>
              )}
            </div>

            <Button
              variant={isRealSuccess ? 'outline' : 'primary'}
              onClick={() => onRunScenario('REAL_DEVNET')}
              disabled={isRealRunning}
              isLoading={isRealRunning}
              className="self-start sm:self-auto min-h-[44px] px-5"
            >
              <span>
                {isRealRunning
                  ? 'Settling on Solana...'
                  : isRealSuccess
                  ? 'Run Again'
                  : 'Execute Live Devnet Payment'}
              </span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      </div>

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
          <p className="text-[11px] text-slate-400 italic">
            Decision recorded; no payment is made in this demo
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
              <span>Approve Decision</span>
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

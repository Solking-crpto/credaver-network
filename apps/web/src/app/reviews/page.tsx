'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import Link from 'next/link';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  ExternalLink,
  Clock,
} from 'lucide-react';

export default function ReviewsPage() {
  const {
    receipts,
    pendingReviewReceipt,
    reviewActionLoading,
    handleReviewAction,
    runScenario,
    runningScenario,
  } = useApp();

  const [lastActionResult, setLastActionResult] = useState<any | null>(null);

  // Find all receipts in REVIEW state without approval/rejection reviews
  const pendingList = receipts.filter(
    (r) => r.decision === 'REVIEW' && (!r.reviews || r.reviews.length === 0)
  );

  // If pendingReviewReceipt is not in pendingList, include it
  const allPending = [...pendingList];
  if (
    pendingReviewReceipt &&
    !allPending.some((r) => r.receiptId === pendingReviewReceipt.receiptId)
  ) {
    allPending.unshift(pendingReviewReceipt);
  }

  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  const handleAction = async (action: 'APPROVE' | 'REJECT', receiptId: string) => {
    const result = await handleReviewAction(action, receiptId);
    if (result) {
      setLastActionResult(result);
    }
  };

  const handleTriggerReviewScenario = async () => {
    await runScenario('REVIEW');
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-border text-xs font-mono text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Operator Authorization Queue</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
          Human Review Queue
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          High-value payments or policy-flagged requests pause in REVIEW status awaiting operator approval before authorization.
        </p>
      </div>

      {/* Review note card */}
      <Card className="p-4 bg-surface-card/90 border-border/80 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Notice: Decision recorded; no payment is made in this demo.</span>
        </div>
        <Badge variant="cyan" className="hidden sm:inline-flex text-[10px]">
          Authority Signed
        </Badge>
      </Card>

      {/* Last Action Feedback */}
      {lastActionResult && (
        <Card glow className="p-6 bg-surface-card/95 border-emerald-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white font-mono">
                Review Decision Recorded Successfully
              </h3>
            </div>
            <StatusChip status={lastActionResult.decision} />
          </div>

          <div className="p-3 bg-surface rounded-lg border border-border/80 text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Receipt ID:</span>
              <span className="text-white font-bold">{lastActionResult.receiptId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">New Decision:</span>
              <span className="text-emerald-400 font-bold">{lastActionResult.decision}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Authority Signer:</span>
              <span className="text-slate-300 truncate max-w-[280px]">
                {lastActionResult.authorityPubkey || 'CredaVer Authority'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link href={`/receipts/${encodeURIComponent(lastActionResult.receiptId)}`}>
              <Button variant="primary" size="sm" className="text-xs">
                <FileCheck2 className="w-3.5 h-3.5 mr-1" />
                <span>View Updated Receipt</span>
              </Button>
            </Link>
            <Link href={`/verify?receiptId=${encodeURIComponent(lastActionResult.receiptId)}`}>
              <Button variant="outline" size="sm" className="text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                <span>Verify Authority Signature</span>
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Queue items */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <span>Pending Review Queue</span>
            <Badge variant="amber" className="font-mono text-xs ml-2">
              {allPending.length}
            </Badge>
          </h2>

          {allPending.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTriggerReviewScenario}
              isLoading={runningScenario === 'REVIEW'}
              className="text-xs"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              <span>Simulate Review Request</span>
            </Button>
          )}
        </div>

        {allPending.length === 0 ? (
          <Card className="text-center py-12 text-muted font-mono text-xs border-dashed border-border/80 space-y-3">
            <p className="text-slate-300">The human review queue is currently empty.</p>
            <p className="text-slate-500">
              Payments below the mandate review threshold ($1.50 USDC) are evaluated automatically.
            </p>
            <div className="pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleTriggerReviewScenario}
                isLoading={runningScenario === 'REVIEW'}
                className="text-xs"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                <span>Trigger REVIEW Scenario ($1.75 &gt; $1.50 Threshold)</span>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {allPending.map((item) => (
              <Card
                key={item.receiptId}
                glow
                className="p-6 bg-surface-card/95 border-amber-500/40 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="amber" className="font-mono text-xs">
                        Action Required
                      </Badge>
                      <span className="text-xs font-mono text-slate-400">
                        {new Date(item.issuedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-base font-bold font-mono text-white break-all">
                      {item.receiptId}
                    </div>
                  </div>
                  <div className="text-xl font-black font-mono text-white">
                    {formatAmountUSDC(item.amount)}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-surface rounded-lg border border-border/70 space-y-0.5">
                    <div className="text-slate-400">Reason Code</div>
                    <div className="text-amber-400 font-bold">
                      {item.reasonCodes?.[0] || 'MANUAL_REVIEW_REQUIRED'}
                    </div>
                  </div>

                  <div className="p-3 bg-surface rounded-lg border border-border/70 space-y-0.5">
                    <div className="text-slate-400">Mandate ID</div>
                    <div className="text-white truncate">{item.mandateId}</div>
                  </div>

                  <div className="p-3 bg-surface rounded-lg border border-border/70 space-y-0.5 sm:col-span-2">
                    <div className="text-slate-400">Destination Merchant Pubkey</div>
                    <div className="text-slate-300 break-all">{item.merchantPubkey}</div>
                  </div>

                  <div className="p-3 bg-surface rounded-lg border border-border/70 space-y-0.5 sm:col-span-2">
                    <div className="text-slate-400">Agent Identity Pubkey</div>
                    <div className="text-slate-300 break-all">{item.agentPubkey}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto text-rose-400 border-rose-500/30 hover:bg-rose-500/10 min-h-[40px] px-5"
                    onClick={() => handleAction('REJECT', item.receiptId)}
                    isLoading={reviewActionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    <span>Reject Authorization</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white min-h-[40px] px-6"
                    onClick={() => handleAction('APPROVE', item.receiptId)}
                    isLoading={reviewActionLoading}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    <span>Approve Authorization</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Navigation helpers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
        <Card className="p-5 bg-surface-card/80 border-border/80 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-cyan-400" />
              Live Demo Runner
            </h3>
            <p className="text-xs text-slate-400">
              Run simulated scenarios or test live devnet settlement.
            </p>
          </div>
          <Link href="/demo">
            <Button variant="outline" size="sm" className="text-xs">
              <span>Go to Demo</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>

        <Card className="p-5 bg-surface-card/80 border-border/80 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-violet-400" />
              Signed Receipts List
            </h3>
            <p className="text-xs text-slate-400">
              Explore all historical decision receipts and audit logs.
            </p>
          </div>
          <Link href="/receipts">
            <Button variant="outline" size="sm" className="text-xs">
              <span>View Receipts</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

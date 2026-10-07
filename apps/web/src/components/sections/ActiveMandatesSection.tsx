import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StatusChip } from '../ui/StatusChip';
import {
  Lock,
  Key,
  RotateCcw,
  Clock,
  Wallet,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { InMemoryAgent } from '../../lib/browser-agent';

interface ActiveMandatesSectionProps {
  mandates: any[];
  mandatesLoading: boolean;
  revokingId: string | null;
  onRefresh: () => Promise<void>;
  onRevoke: (mandateId: string) => Promise<void>;
  showAllMandates?: boolean;
  onToggleShowAll?: () => void;

  // Phantom & in-memory issuance
  showIssuePanel: boolean;
  onToggleIssuePanel: () => void;
  phantomPubkey: string | null;
  isPhantomConnected: boolean;
  onConnectPhantom: () => Promise<any> | void;
  inMemoryAgent: InMemoryAgent | null;
  mandateMaxPerTx: string;
  setMandateMaxPerTx: (val: string) => void;
  mandateTotalCap: string;
  setMandateTotalCap: (val: string) => void;
  mandateReviewThreshold: string;
  setMandateReviewThreshold: (val: string) => void;
  issueLoading: boolean;
  issueStatusText: string | null;
  issueError: string | null;
  onSignAndIssueMandate: () => Promise<void>;

  // User issued testing
  userIssuedMandate: any | null;
  userTestRunning: string | null;
  userTestResult: any | null;
  onRunUserMandateTest: (testType: 'ALLOWED' | 'OVER_CAP' | 'REVOKED') => Promise<void>;
}

export const ActiveMandatesSection: React.FC<ActiveMandatesSectionProps> = ({
  mandates,
  mandatesLoading,
  revokingId,
  onRefresh,
  onRevoke,
  showAllMandates = false,
  onToggleShowAll,
  showIssuePanel,
  onToggleIssuePanel,
  phantomPubkey,
  isPhantomConnected,
  onConnectPhantom,
  inMemoryAgent,
  mandateMaxPerTx,
  setMandateMaxPerTx,
  mandateTotalCap,
  setMandateTotalCap,
  mandateReviewThreshold,
  setMandateReviewThreshold,
  issueLoading,
  issueStatusText,
  issueError,
  onSignAndIssueMandate,
  userIssuedMandate,
  userTestRunning,
  userTestResult,
  onRunUserMandateTest,
}) => {
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [showDemoMandates, setShowDemoMandates] = useState(false);

  const truncate = (str: string, len: number = 8) =>
    str ? `${str.slice(0, len)}...${str.slice(-4)}` : '';

  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  const handleRevokeClick = (mandateId: string) => {
    if (confirmingRevokeId === mandateId) {
      onRevoke(mandateId);
      setConfirmingRevokeId(null);
    } else {
      setConfirmingRevokeId(mandateId);
    }
  };

  const userMandates = mandates.filter(
    (m) =>
      m.source === 'user' ||
      (!m.source &&
        !m.mandateId.startsWith('mandate-sc-') &&
        !m.mandateId.startsWith('mandate-real-devnet-'))
  );

  const demoMandates = mandates.filter(
    (m) =>
      m.source === 'demo' ||
      m.mandateId.startsWith('mandate-sc-') ||
      m.mandateId.startsWith('mandate-real-devnet-')
  );

  const renderMandateCard = (m: any) => {
    const cap = BigInt(m.totalCap || '0');
    const spend = BigInt(m.currentSpend || '0');
    const pct = cap > 0n ? Number((spend * 100n) / cap) : 0;
    const isExpired = Date.now() > m.expiresAt;
    const isConfirming = confirmingRevokeId === m.mandateId;

    return (
      <Card key={m.mandateId} className="p-5 border-border/80 bg-surface-card/75 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-white">{m.mandateId}</span>
            {m.source && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  m.source === 'user'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border border-border/60'
                }`}
              >
                {m.source}
              </span>
            )}
          </div>
          <StatusChip status={m.revoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE'} />
        </div>

        <div className="space-y-1.5 text-xs font-mono text-muted">
          <div className="flex justify-between">
            <span>Operator:</span>
            <span className="text-slate-200">{truncate(m.operatorPubkey)}</span>
          </div>
          <div className="flex justify-between">
            <span>Agent:</span>
            <span className="text-slate-200">{truncate(m.agentPubkey)}</span>
          </div>
          <div className="flex justify-between">
            <span>Per-Tx Limit:</span>
            <span className="text-slate-200">{formatAmountUSDC(m.maxPerTx)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Cap:</span>
            <span className="text-slate-200">{formatAmountUSDC(m.totalCap)}</span>
          </div>
        </div>

        {/* Spend Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>
              Cumulative Spend ({formatAmountUSDC(spend.toString())} of {formatAmountUSDC(m.totalCap)})
            </span>
            <span className="text-white font-bold">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border/60">
            <div
              className={`h-full transition-all ${pct >= 100 ? 'bg-rose-500' : 'bg-cyan-400'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {/* Expiry & Revoke Controls with Confirm Step */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted" />
            {isExpired ? 'Expired' : `Expires in ${Math.round((m.expiresAt - Date.now()) / 60000)}m`}
          </span>

          {!m.revoked && !isExpired && (
            <div className="flex items-center gap-2">
              {isConfirming && (
                <button
                  type="button"
                  onClick={() => setConfirmingRevokeId(null)}
                  className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded"
                >
                  Cancel
                </button>
              )}
              <Button
                size="sm"
                variant="danger"
                disabled={revokingId === m.mandateId}
                isLoading={revokingId === m.mandateId}
                onClick={() => handleRevokeClick(m.mandateId)}
                className="text-xs min-h-[34px] px-3"
              >
                {isConfirming ? 'Confirm Revoke?' : 'Revoke'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <section id="mandates" className="py-12 border-t border-border/50 space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-cyan-400" />
            Operator Mandates
          </h2>
          <Badge variant="cyan" className="font-mono text-xs">
            {mandates.length}
          </Badge>
          {!showAllMandates && (
            <span className="text-[11px] text-muted hidden sm:inline">(Active only)</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="primary"
            onClick={onToggleIssuePanel}
            className="shadow-glow min-h-[40px] px-4"
          >
            <Key className="w-3.5 h-3.5 mr-1.5" />
            <span>{showIssuePanel ? 'Close Issuance' : 'Issue Mandate with Phantom'}</span>
          </Button>

          {onToggleShowAll && (
            <Button
              size="sm"
              variant={showAllMandates ? 'secondary' : 'outline'}
              onClick={onToggleShowAll}
              className="min-h-[40px] px-3 text-xs"
              title={showAllMandates ? 'Showing all mandates including expired and revoked' : 'Showing active mandates only'}
            >
              <span>{showAllMandates ? 'Show Active Only' : 'Show Expired & Revoked'}</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            isLoading={mandatesLoading}
            className="min-h-[40px] px-3 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Interactive Phantom Mandate Issuance Panel */}
      {showIssuePanel && (
        <Card glow className="border-cyan-500/40 bg-surface-card/95 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Issue Agent Mandate via Phantom Wallet
              </h3>
              <p className="text-xs text-muted mt-1">
                Phantom signs readable text (<code className="text-cyan-400 font-mono">CredaVer Mandate v1</code> + canonical RFC 8785 JSON). Agent co-signs with in-browser memory key.
              </p>
            </div>
            <Badge variant="cyan" className="self-start sm:self-auto font-mono text-xs">
              Mutual Ed25519 Signatures
            </Badge>
          </div>

          {/* Keys row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-surface rounded-lg border border-border/60 space-y-1.5">
              <div className="text-muted flex items-center justify-between">
                <span>1. Operator Identity (Phantom):</span>
                {isPhantomConnected ? (
                  <span className="text-emerald-400 text-[11px]">● Connected</span>
                ) : (
                  <span className="text-amber-400 text-[11px]">● Not Connected</span>
                )}
              </div>
              {phantomPubkey ? (
                <div className="text-white font-bold truncate">{phantomPubkey}</div>
              ) : (
                <Button size="sm" variant="outline" className="mt-1" onClick={onConnectPhantom}>
                  <Wallet className="w-3.5 h-3.5 mr-1.5" /> Connect Phantom Wallet
                </Button>
              )}
            </div>

            <div className="p-3.5 bg-surface rounded-lg border border-border/60 space-y-1.5">
              <div className="text-muted flex items-center justify-between">
                <span>2. Agent Identity (In-Memory):</span>
                <Badge variant="violet" className="text-[10px] py-0 px-1.5">
                  RAM ONLY
                </Badge>
              </div>
              <div className="text-white font-bold truncate">
                {inMemoryAgent?.agentPubkey || 'Generating ephemeral WebCrypto key...'}
              </div>
              <div className="text-[11px] text-slate-500">
                Private key held strictly in React memory — never leaves browser.
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-muted mb-1.5">
                Per-Transaction Limit (USDC)
              </label>
              <Input
                type="number"
                step="0.5"
                value={mandateMaxPerTx}
                onChange={(e) => setMandateMaxPerTx(e.target.value)}
                placeholder="2.00"
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted mb-1.5">
                Total Cumulative Cap (USDC)
              </label>
              <Input
                type="number"
                step="1.0"
                value={mandateTotalCap}
                onChange={(e) => setMandateTotalCap(e.target.value)}
                placeholder="5.00"
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted mb-1.5">
                Human Review Threshold (USDC)
              </label>
              <Input
                type="number"
                step="0.5"
                value={mandateReviewThreshold}
                onChange={(e) => setMandateReviewThreshold(e.target.value)}
                placeholder="1.50"
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Sign Preview */}
          <div className="p-3 rounded-lg bg-surface border border-border/70 text-xs font-mono text-slate-400">
            <span className="text-muted">Phantom Sign Preview: </span>
            <span className="text-cyan-400 font-bold">CredaVer Mandate v1</span>
            <span> + {`{"allowedAssets":["USDC"],"maxPerTx":"${Math.round(parseFloat(mandateMaxPerTx || '2') * 1e6)}","totalCap":"${Math.round(parseFloat(mandateTotalCap || '5') * 1e6)}"}`}</span>
          </div>

          {/* Feedback */}
          {issueStatusText && (
            <div className="text-xs font-mono text-cyan-400 animate-pulse flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>{issueStatusText}</span>
            </div>
          )}
          {issueError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-300">
              ⚠️ {issueError}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end pt-3 border-t border-border/40">
            <Button
              variant="primary"
              onClick={onSignAndIssueMandate}
              isLoading={issueLoading}
              disabled={!isPhantomConnected && !phantomPubkey}
              className="min-h-[44px] px-5"
            >
              <Key className="w-4 h-4 mr-2" />
              <span>Sign &amp; Activate Mandate in Phantom</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Interactive Agent Testing Console for User-Issued Mandate */}
      {userIssuedMandate && inMemoryAgent && (
        <Card glow className="border-emerald-500/50 bg-emerald-950/20 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="green">LIVE USER MANDATE ACTIVATED</Badge>
                <span className="text-xs font-mono font-bold text-white">
                  {userIssuedMandate.mandateId}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Test your Phantom-signed mandate. The in-memory agent co-signs request-bound payment proofs against the real policy engine.
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate-400">
              <div>Cap: <span className="text-emerald-400 font-bold">{formatAmountUSDC(userIssuedMandate.totalCap)}</span></div>
              <div>Per-Tx: <span className="text-white">{formatAmountUSDC(userIssuedMandate.maxPerTx)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="primary"
              size="sm"
              className="justify-center min-h-[40px]"
              onClick={() => onRunUserMandateTest('ALLOWED')}
              isLoading={userTestRunning === 'ALLOWED'}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>1. Test Allowed ($1.00)</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              className="justify-center min-h-[40px]"
              onClick={() => onRunUserMandateTest('OVER_CAP')}
              isLoading={userTestRunning === 'OVER_CAP'}
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              <span>2. Test Over-Cap ($10.00)</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="justify-center hover:border-rose-500 hover:text-rose-400 min-h-[40px]"
              onClick={() => onRunUserMandateTest('REVOKED')}
              isLoading={userTestRunning === 'REVOKED'}
            >
              <Lock className="w-4 h-4 mr-1.5" />
              <span>3. Revoke &amp; Test Blocked</span>
            </Button>
          </div>

          {userTestResult && (
            <div className="p-4 bg-surface rounded-xl border border-border/80 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusChip status={userTestResult.decision} />
                  <span className="text-white font-bold">
                    Test Result: {userTestResult.testType}
                  </span>
                </div>
                <Badge
                  variant={
                    userTestResult.statusCode === 200
                      ? 'green'
                      : userTestResult.statusCode === 403
                      ? 'rose'
                      : 'amber'
                  }
                  className="font-mono text-[11px]"
                >
                  HTTP {userTestResult.statusCode}
                </Badge>
              </div>

              <p className="text-slate-200 leading-relaxed font-sans text-xs">
                {userTestResult.message}
              </p>

              {userTestResult.reasonCodes && userTestResult.reasonCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-muted text-[11px]">Reason Code:</span>
                  {userTestResult.reasonCodes.map((code: string) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-surface-card border border-border/80 text-[11px] text-cyan-300 font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}

              {userTestResult.receipt && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Receipt #{userTestResult.receipt.receiptId}
                  </span>
                  <Link
                    href={`/verify?receiptId=${userTestResult.receipt.receiptId}`}
                    className="text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1"
                  >
                    Verify Decision Receipt <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* 1. Your Mandates (Operator Console) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Your Mandates</h3>
            <Badge variant="cyan" className="font-mono text-xs">
              {userMandates.length}
            </Badge>
          </div>
        </div>

        {userMandates.length === 0 ? (
          <Card className="text-center py-10 text-muted font-mono text-xs border-dashed border-border/80">
            <p>No operator mandates issued by you yet.</p>
            <p className="mt-1 text-slate-500">
              Click &quot;Issue Mandate&quot; above to create one with your wallet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userMandates.map(renderMandateCard)}
          </div>
        )}
      </div>

      {/* 2. Collapsible Demo Scenario Mandates */}
      {demoMandates.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border/50">
          <button
            type="button"
            onClick={() => setShowDemoMandates((prev) => !prev)}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border/70 text-left transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              {showDemoMandates ? (
                <ChevronDown className="w-4 h-4 text-cyan-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-bold text-slate-200">
                Demo scenario mandates ({demoMandates.length})
              </span>
              <span className="text-muted hidden sm:inline">
                — generated by the scenario runner &amp; live settlements
              </span>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">
              {showDemoMandates ? 'Hide' : 'Show'}
            </span>
          </button>

          {showDemoMandates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {demoMandates.map(renderMandateCard)}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

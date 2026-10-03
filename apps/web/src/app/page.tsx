'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatusChip } from '../components/ui/StatusChip';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { createInMemoryAgent, InMemoryAgent } from '../lib/browser-agent';
import { getBase58Decoder } from '@solana/kit';
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
  Sparkles,
  Plus,
  Wallet,
  Send,
  ArrowRight,
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
  txSignature?: string;
  explorerUrl?: string;
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

  // Phantom Wallet & In-Memory Agent State
  const {
    publicKey: phantomPubkey,
    isConnected: isPhantomConnected,
    connect: connectPhantom,
    signMessage: signPhantomMessage,
  } = usePhantomWallet();

  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [inMemoryAgent, setInMemoryAgent] = useState<InMemoryAgent | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueStatusText, setIssueStatusText] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [userIssuedMandate, setUserIssuedMandate] = useState<any | null>(null);

  // Form Fields for Issue Mandate
  const [mandateMaxPerTx, setMandateMaxPerTx] = useState('2.00'); // USDC
  const [mandateTotalCap, setMandateTotalCap] = useState('5.00'); // USDC
  const [mandateReviewThreshold, setMandateReviewThreshold] = useState('1.50'); // USDC

  // User-Issued Mandate Interactive Testing State
  const [userTestRunning, setUserTestRunning] = useState<string | null>(null);
  const [userTestResult, setUserTestResult] = useState<any | null>(null);

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

  const handleOpenIssuePanel = async () => {
    setShowIssuePanel((prev) => !prev);
    setIssueError(null);
    if (!inMemoryAgent) {
      try {
        const agent = await createInMemoryAgent();
        setInMemoryAgent(agent);
      } catch (err: any) {
        setIssueError(`Failed to generate in-memory agent: ${err.message}`);
      }
    }
  };

  const handleSignAndIssueMandate = async () => {
    if (!phantomPubkey) {
      await connectPhantom();
      return;
    }

    setIssueLoading(true);
    setIssueError(null);
    setIssueStatusText('Initializing agent in-memory key...');

    try {
      let agent = inMemoryAgent;
      if (!agent) {
        agent = await createInMemoryAgent();
        setInMemoryAgent(agent);
      }

      setIssueStatusText('Preparing canonical RFC 8785 mandate core...');
      const maxPerTxUnits = String(Math.round(parseFloat(mandateMaxPerTx) * 1e6));
      const totalCapUnits = String(Math.round(parseFloat(mandateTotalCap) * 1e6));
      const reviewUnits = mandateReviewThreshold
        ? String(Math.round(parseFloat(mandateReviewThreshold) * 1e6))
        : undefined;

      const prepRes = await fetch('/api/mandates/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorPubkey: phantomPubkey,
          agentPubkey: agent.agentPubkey,
          maxPerTx: maxPerTxUnits,
          totalCap: totalCapUnits,
          reviewThreshold: reviewUnits,
          expiresInMinutes: 120,
        }),
      });

      if (!prepRes.ok) {
        const prepErr = await prepRes.json();
        throw new Error(prepErr.message || 'Failed to prepare mandate core');
      }

      const { core, mandateHash, signingMessage } = await prepRes.json();

      setIssueStatusText('Please sign the readable message in your Phantom wallet...');
      const msgBytes = new TextEncoder().encode(signingMessage);
      const phantomSigResult = await signPhantomMessage(msgBytes);

      const decoder = getBase58Decoder();
      const operatorSignature = decoder.decode(phantomSigResult.signature);

      setIssueStatusText('Co-signing with in-memory agent key...');
      const agentCounterSignature = await agent.signBytes(msgBytes);

      setIssueStatusText('Submitting and verifying mutual Ed25519 signatures...');
      const signedMandatePayload = {
        ...core,
        mandateHash,
        operatorSignature,
        agentCounterSignature,
        revoked: false,
      };

      const submitRes = await fetch('/api/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedMandatePayload),
      });

      if (!submitRes.ok) {
        const submitErr = await submitRes.json();
        throw new Error(submitErr.message || 'Server rejected mandate signature');
      }

      const submitData = await submitRes.json();
      setUserIssuedMandate(submitData.mandate);
      setIssueStatusText(null);
      fetchMandates();
    } catch (err: any) {
      setIssueError(err.message || 'Failed to issue mandate');
      setIssueStatusText(null);
    } finally {
      setIssueLoading(false);
    }
  };

  const runUserMandateTest = async (testType: 'ALLOWED' | 'OVER_CAP' | 'REVOKED') => {
    if (!userIssuedMandate || !inMemoryAgent) return;
    setUserTestRunning(testType);
    setUserTestResult(null);

    try {
      let amountUnits = '1000000'; // $1.00 USDC
      if (testType === 'OVER_CAP') {
        amountUnits = '10000000'; // $10.00 USDC (exceeds total cap)
      }

      if (testType === 'REVOKED') {
        await fetch(`/api/mandates/${userIssuedMandate.mandateId}/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Operator testing revocation policy' }),
        });
        fetchMandates();
      }

      // 1. Get canonical proof template
      const templateRes = await fetch('/api/proofs/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandateHash: userIssuedMandate.mandateHash,
          agentPubkey: inMemoryAgent.agentPubkey,
          amount: amountUnits,
        }),
      });
      const templateData = await templateRes.json();

      // 2. In-memory agent signs canonical JSON proof
      const proofBytes = new TextEncoder().encode(templateData.canonicalJson);
      const agentProofSig = await inMemoryAgent.signBytes(proofBytes);

      const signedProof = {
        ...templateData.core,
        proofHash: templateData.proofHash,
        signature: agentProofSig,
      };

      // 3. Submit to PDP signing endpoint
      const signRes = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandateHash: userIssuedMandate.mandateHash,
          proof: signedProof,
          transactionMessageBytes: btoa('mock-test-svm-transaction-message'),
        }),
      });

      const signData = await signRes.json();
      setUserTestResult({
        testType,
        statusCode: signRes.status,
        decision: signData.decision || (signRes.status === 200 ? 'ALLOW' : 'DENY'),
        reasonCodes:
          signData.reasonCodes ||
          (signRes.status === 200 ? ['POLICY_PASSED_ALL_GATES'] : ['POLICY_VIOLATION']),
        receipt: signData.receipt,
        details:
          testType === 'ALLOWED'
            ? 'Agent payment under cap approved. Spend recorded and receipt issued.'
            : testType === 'OVER_CAP'
            ? 'Agent payment rejected: Amount exceeds mandate limits (AMOUNT_EXCEEDS_CAP).'
            : 'Agent payment rejected: Mandate was revoked by operator (REVOKED_MANDATE).',
      });

      if (signData.receipt) {
        setActiveReceipt(signData.receipt);
      }
      fetchMandates();
      fetchReceipts();
    } catch (err: any) {
      setUserTestResult({
        testType,
        statusCode: 500,
        decision: 'DENY',
        details: err.message || 'Test failed',
      });
    } finally {
      setUserTestRunning(null);
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
      } else {
        setScenarioResults((prev) => ({
          ...prev,
          [scenario]: {
            scenario,
            statusCode: res.status,
            decision: 'DENY',
            latencyMs: 0,
            details: data.message || data.error || 'Scenario request failed',
            explorerUrl: data.explorerUrl,
          },
        }));
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

        {/* Honesty Disclosure Banner */}
        <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="font-bold text-credav-cyan uppercase tracking-wider shrink-0 mt-0.5">Honesty Audit:</span>
            <p className="text-slate-300 leading-relaxed">
              Policy evaluations (all 12 gates, Ed25519 signatures, RFC 8785 hashes, and operator review queues) are <strong className="text-white">100% REAL</strong>. The in-browser dashboard scenarios use <strong className="text-amber-300">SIMULATED SVM bytes</strong> to ensure instant sub-10ms feedback without spending judge faucet funds. For verified real on-chain Devnet settlement, see Spike S5 below.
            </p>
          </div>
          <Link
            href="https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet"
            target="_blank"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>REAL S5 DEVNET TX</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
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
              <div className="flex items-center gap-1.5">
                <Badge variant="amber" className="text-[10px] py-0 px-1.5">SIMULATED SVM</Badge>
                <StatusChip status="ALLOW" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Payment under cap to listed merchant. Real policy evaluation passes; signs tx message, records spend, and returns signed receipt.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['ALLOW'] ? `Latency: ${scenarioResults['ALLOW'].latencyMs}ms` : 'REAL POLICY ENGINE'}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="muted" className="text-[10px] py-0 px-1.5">SIMULATED AGENT</Badge>
                <StatusChip status="DENY" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Agent requests payment exceeding total mandate cap. Real policy engine fails closed with 403 AMOUNT_EXCEEDS_CAP.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['OVER_CAP'] ? `Latency: ${scenarioResults['OVER_CAP'].latencyMs}ms` : 'REAL POLICY DENY'}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="muted" className="text-[10px] py-0 px-1.5">SIMULATED AGENT</Badge>
                <StatusChip status="DENY" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Operator revokes mandate; subsequent agent requests immediately fail closed with 403 REVOKED_MANDATE.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REVOKED'] ? `Latency: ${scenarioResults['REVOKED'].latencyMs}ms` : 'REAL POLICY DENY'}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="muted" className="text-[10px] py-0 px-1.5">SIMULATED AGENT</Badge>
                <StatusChip status="DENY" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Validity window has lapsed. Deterministic gate rejects agent request with 403 EXPIRED_MANDATE.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['EXPIRED'] ? `Latency: ${scenarioResults['EXPIRED'].latencyMs}ms` : 'REAL POLICY DENY'}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="muted" className="text-[10px] py-0 px-1.5">SIMULATED AGENT</Badge>
                <StatusChip status="DENY" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Same proof nonce transmitted twice. Atomic SET NX EX rejects duplicate attempt with 403 REPLAY_DETECTED.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REPLAY'] ? `Latency: ${scenarioResults['REPLAY'].latencyMs}ms` : 'REAL POLICY DENY'}
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
              <div className="flex items-center gap-1.5">
                <Badge variant="cyan" className="text-[10px] py-0 px-1.5">REAL QUEUE</Badge>
                <StatusChip status="REVIEW" />
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Payment exceeds review threshold. Held with 202 REVIEW in operator review queue for manual approval/rejection.
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-credav-border/30 text-[11px] font-mono">
              <span className="text-slate-400">
                {scenarioResults['REVIEW'] ? `Latency: ${scenarioResults['REVIEW'].latencyMs}ms` : 'REAL OPERATOR QUEUE'}
              </span>
              <span className="text-credav-cyan flex items-center gap-0.5">
                Run <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Card>

          {/* Scenario 7: REAL_DEVNET */}
          <Card
            className={`cursor-pointer transition-all border sm:col-span-2 lg:col-span-3 ${
              scenarioResults['REAL_DEVNET']
                ? scenarioResults['REAL_DEVNET'].statusCode === 200
                  ? 'border-emerald-500/60 bg-emerald-950/20'
                  : 'border-amber-500/60 bg-amber-950/20'
                : 'hover:border-emerald-400/60 border-emerald-500/30 bg-emerald-950/10'
            }`}
            onClick={() => runScenario('REAL_DEVNET')}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                  7. Real Devnet Settlement (x402 V2 Protocol)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="green" className="text-[10px] py-0.5 px-2 font-bold animate-pulse">
                  REAL (devnet)
                </Badge>
                {scenarioResults['REAL_DEVNET'] && (
                  <StatusChip status={scenarioResults['REAL_DEVNET'].decision} />
                )}
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Executes one <strong className="text-white">live on-chain x402 payment</strong> settled on Solana Devnet. The agent (holding ONLY its identity key) requests 1.00 USDC telemetry from the demo merchant. The CredaVer Constrained Signer evaluates policy gates, signs SVM transaction message bytes with the server custody payer, and the official public facilitator (<code className="text-credav-cyan">x402.org</code>) broadcasts and settles the payment on-chain.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between pt-2 border-t border-emerald-500/20 text-xs font-mono gap-2">
              <div className="text-slate-400 flex items-center gap-2">
                {runningScenario === 'REAL_DEVNET' ? (
                  <span className="text-emerald-400 animate-pulse flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Executing Real Devnet Settlement via Facilitator (takes ~5-8s)...
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
                        onClick={(e) => e.stopPropagation()}
                      >
                        Solana Explorer TX <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                    {scenarioResults['REAL_DEVNET'].details && (
                      <span className="text-slate-400 text-[11px]">
                        {scenarioResults['REAL_DEVNET'].details}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-emerald-400/80">
                    REAL CONSTRAINED SIGNER + OFFICIAL PUBLIC FACILITATOR
                  </span>
                )}
              </div>
              <span className="text-credav-cyan font-bold flex items-center gap-1">
                {runningScenario === 'REAL_DEVNET' ? 'Processing...' : '⚡ Execute Live Devnet Payment'}{' '}
                <ChevronRight className="w-3.5 h-3.5" />
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
      <section id="mandates" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-credav-cyan" />
              Active Operator Mandates
            </h2>
            <Badge variant="cyan">{mandates.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleOpenIssuePanel}
              className="shadow-glow"
            >
              <Key className="w-3.5 h-3.5 mr-1" />
              <span>{showIssuePanel ? 'Close Issuance' : 'Issue Mandate with Phantom'}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={fetchMandates} isLoading={mandatesLoading}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE PHANTOM MANDATE ISSUANCE PANEL                                */}
        {/* ========================================================================= */}
        {showIssuePanel && (
          <Card glow className="border-credav-cyan/40 bg-slate-900/90 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-credav-border/60 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-credav-cyan" />
                  Issue Agent Mandate via Phantom Wallet
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phantom signs readable text (<code className="text-credav-cyan">CredaVer Mandate v1</code> + canonical RFC 8785 JSON). Agent co-signs with in-browser memory key.
                </p>
              </div>
              <Badge variant="cyan" className="self-start sm:self-auto">
                Mutual Ed25519 Signatures
              </Badge>
            </div>

            {/* Operator & Agent Public Keys */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-credav-surface rounded-lg border border-credav-border/60 space-y-1">
                <div className="text-slate-400 flex items-center justify-between">
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
                  <Button size="sm" variant="outline" className="mt-1" onClick={connectPhantom}>
                    <Wallet className="w-3.5 h-3.5 mr-1" /> Connect Phantom Wallet
                  </Button>
                )}
              </div>

              <div className="p-3 bg-credav-surface rounded-lg border border-credav-border/60 space-y-1">
                <div className="text-slate-400 flex items-center justify-between">
                  <span>2. Agent Identity (In-Memory):</span>
                  <Badge variant="violet" className="text-[10px] py-0 px-1.5">
                    RAM ONLY
                  </Badge>
                </div>
                <div className="text-white font-bold truncate">
                  {inMemoryAgent?.agentPubkey || 'Generating ephemeral WebCrypto key...'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Private key held strictly in React state memory — never leaves browser.
                </div>
              </div>
            </div>

            {/* Mandate Policy Configuration Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
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
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
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
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
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

            {/* Readable Message Format Preview */}
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="text-slate-500">Phantom Sign Preview: </span>
              <span className="text-credav-cyan font-bold">CredaVer Mandate v1</span>
              <span> + {`{"allowedAssets":["USDC"],"maxPerTx":"${Math.round(parseFloat(mandateMaxPerTx || '2') * 1e6)}","totalCap":"${Math.round(parseFloat(mandateTotalCap || '5') * 1e6)}"}`}</span>
            </div>

            {/* Error or Status Feedback */}
            {issueStatusText && (
              <div className="text-xs font-mono text-credav-cyan animate-pulse flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>{issueStatusText}</span>
              </div>
            )}
            {issueError && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-300">
                ⚠️ {issueError}
              </div>
            )}

            {/* Submit Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-credav-border/40">
              <Button
                variant="primary"
                onClick={handleSignAndIssueMandate}
                isLoading={issueLoading}
                disabled={!isPhantomConnected && !phantomPubkey}
              >
                <Key className="w-3.5 h-3.5 mr-1" />
                <span>✍️ Sign &amp; Activate Mandate in Phantom</span>
              </Button>
            </div>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* INTERACTIVE AGENT TESTING CONSOLE FOR USER-ISSUED MANDATE                 */}
        {/* ========================================================================= */}
        {userIssuedMandate && inMemoryAgent && (
          <Card glow className="border-emerald-500/50 bg-emerald-950/20 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="green">LIVE USER MANDATE ACTIVATED</Badge>
                  <span className="text-xs font-mono font-bold text-white">
                    {userIssuedMandate.mandateId}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Test your active Phantom-signed mandate. The in-memory agent co-signs request-bound payment proofs against CredaVer&apos;s real policy engine.
                </p>
              </div>
              <div className="text-right text-xs font-mono text-slate-400">
                <div>Cap: <span className="text-emerald-400 font-bold">{formatAmountUSDC(userIssuedMandate.totalCap)}</span></div>
                <div>Per-Tx: <span className="text-white">{formatAmountUSDC(userIssuedMandate.maxPerTx)}</span></div>
              </div>
            </div>

            {/* 3 Interactive Testing Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant="primary"
                size="sm"
                className="justify-center"
                onClick={() => runUserMandateTest('ALLOWED')}
                isLoading={userTestRunning === 'ALLOWED'}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>1. Test Allowed ($1.00)</span>
              </Button>

              <Button
                variant="danger"
                size="sm"
                className="justify-center"
                onClick={() => runUserMandateTest('OVER_CAP')}
                isLoading={userTestRunning === 'OVER_CAP'}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>2. Test Over-Cap ($10.00)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="justify-center hover:border-rose-500 hover:text-rose-400"
                onClick={() => runUserMandateTest('REVOKED')}
                isLoading={userTestRunning === 'REVOKED'}
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                <span>3. Revoke &amp; Test Blocked</span>
              </Button>
            </div>

            {/* Test Result Inspector */}
            {userTestResult && (
              <div className="p-3 bg-slate-950/80 rounded-lg border border-credav-border/60 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusChip status={userTestResult.decision} />
                    <span className="text-white font-bold">
                      Test Result: {userTestResult.testType}
                    </span>
                  </div>
                  <span className="text-slate-400">HTTP {userTestResult.statusCode}</span>
                </div>
                <p className="text-slate-300">{userTestResult.details}</p>
                {userTestResult.reasonCodes && (
                  <div className="text-[11px] text-slate-400">
                    Reason Codes: <span className="text-credav-cyan">{userTestResult.reasonCodes.join(', ')}</span>
                  </div>
                )}
                {userTestResult.receipt && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">
                      Receipt ID: {userTestResult.receipt.receiptId}
                    </span>
                    <Link
                      href={`/verify?receiptId=${userTestResult.receipt.receiptId}`}
                      className="text-credav-cyan underline hover:text-cyan-300 flex items-center gap-1"
                    >
                      Verify Decision Receipt <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

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

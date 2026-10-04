'use client';

import React, { useState, useEffect } from 'react';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { createInMemoryAgent, InMemoryAgent } from '../lib/browser-agent';
import { getBase58Decoder } from '@solana/kit';

import { HeroSection } from '../components/sections/HeroSection';
import { HowItWorksSection } from '../components/sections/HowItWorksSection';
import { LiveDemoSection, ScenarioResult } from '../components/sections/LiveDemoSection';
import { OnChainProofSection } from '../components/sections/OnChainProofSection';
import { ActiveMandatesSection } from '../components/sections/ActiveMandatesSection';
import { SignedReceiptsSection } from '../components/sections/SignedReceiptsSection';
import { CoreConceptsSection } from '../components/sections/CoreConceptsSection';
import { EarlyAccessSection } from '../components/sections/EarlyAccessSection';

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

  return (
    <div className="space-y-4">
      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. How It Works */}
      <HowItWorksSection />

      {/* 3. Live Demo (Scenario Runner) */}
      <LiveDemoSection
        runningScenario={runningScenario}
        scenarioResults={scenarioResults}
        activeReceipt={activeReceipt}
        pendingReviewReceipt={pendingReviewReceipt}
        reviewActionLoading={reviewActionLoading}
        onRunScenario={runScenario}
        onRunAllScenarios={runAllScenarios}
        onReviewAction={handleReviewAction}
      />

      {/* 4. On-Chain Proof */}
      <OnChainProofSection />

      {/* 5. Active Mandates */}
      <ActiveMandatesSection
        mandates={mandates}
        mandatesLoading={mandatesLoading}
        revokingId={revokingId}
        onRefresh={fetchMandates}
        onRevoke={handleRevokeMandate}
        showIssuePanel={showIssuePanel}
        onToggleIssuePanel={handleOpenIssuePanel}
        phantomPubkey={phantomPubkey}
        isPhantomConnected={isPhantomConnected}
        onConnectPhantom={connectPhantom}
        inMemoryAgent={inMemoryAgent}
        mandateMaxPerTx={mandateMaxPerTx}
        setMandateMaxPerTx={setMandateMaxPerTx}
        mandateTotalCap={mandateTotalCap}
        setMandateTotalCap={setMandateTotalCap}
        mandateReviewThreshold={mandateReviewThreshold}
        setMandateReviewThreshold={setMandateReviewThreshold}
        issueLoading={issueLoading}
        issueStatusText={issueStatusText}
        issueError={issueError}
        onSignAndIssueMandate={handleSignAndIssueMandate}
        userIssuedMandate={userIssuedMandate}
        userTestRunning={userTestRunning}
        userTestResult={userTestResult}
        onRunUserMandateTest={runUserMandateTest}
      />

      {/* 6. Signed Receipts */}
      <SignedReceiptsSection
        receipts={receipts}
        receiptsLoading={receiptsLoading}
        onRefresh={fetchReceipts}
      />

      {/* 7. Five Separate Concepts */}
      <CoreConceptsSection />

      {/* 8. Early Access */}
      <EarlyAccessSection />
    </div>
  );
}

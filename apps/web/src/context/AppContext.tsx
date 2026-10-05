'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet } from './WalletContext';
import { createInMemoryAgent, InMemoryAgent } from '../lib/browser-agent';
import { getBase58Decoder } from '@solana/kit';

import type { ScenarioResult } from '../components/sections/LiveDemoSection';
export type { ScenarioResult };

export interface AppContextState {
  // Mandates
  mandates: any[];
  mandatesLoading: boolean;
  fetchMandates: (showAll?: boolean) => Promise<void>;
  showAllMandates: boolean;
  setShowAllMandates: (val: boolean) => void;
  toggleShowAllMandates: () => void;
  revokingId: string | null;
  handleRevokeMandate: (mandateId: string) => Promise<void>;

  // Receipts
  receipts: any[];
  receiptsLoading: boolean;
  fetchReceipts: () => Promise<void>;
  activeReceipt: any | null;
  setActiveReceipt: (val: any | null) => void;

  // Reviews
  pendingReviewReceipt: any | null;
  setPendingReviewReceipt: (val: any | null) => void;
  reviewActionLoading: boolean;
  handleReviewAction: (action: 'APPROVE' | 'REJECT', receiptId?: string) => Promise<any>;

  // Scenarios
  runningScenario: string | null;
  scenarioResults: Record<string, ScenarioResult>;
  runScenario: (scenario: string) => Promise<ScenarioResult | undefined>;
  runAllScenarios: () => Promise<void>;

  // Operator Mandate Issuance
  showIssuePanel: boolean;
  setShowIssuePanel: React.Dispatch<React.SetStateAction<boolean>>;
  toggleIssuePanel: () => Promise<void>;
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
  handleSignAndIssueMandate: () => Promise<void>;
  userIssuedMandate: any | null;
  setUserIssuedMandate: (val: any | null) => void;

  // User Issued Mandate Testing
  userTestRunning: string | null;
  userTestResult: any | null;
  runUserMandateTest: (testType: 'ALLOWED' | 'OVER_CAP' | 'REVOKED') => Promise<void>;
}

const AppContext = createContext<AppContextState | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { publicKey: phantomPubkey, openModal, signMessage: signPhantomMessage } = useWallet();

  // Scenarios State
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, ScenarioResult>>({});
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [pendingReviewReceipt, setPendingReviewReceipt] = useState<any | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  // Mandates State
  const [mandates, setMandates] = useState<any[]>([]);
  const [mandatesLoading, setMandatesLoading] = useState(false);
  const [showAllMandates, setShowAllMandates] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Receipts State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  // Mandate Issuance State
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [inMemoryAgent, setInMemoryAgent] = useState<InMemoryAgent | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueStatusText, setIssueStatusText] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [userIssuedMandate, setUserIssuedMandate] = useState<any | null>(null);

  // Form Fields
  const [mandateMaxPerTx, setMandateMaxPerTx] = useState('2.00');
  const [mandateTotalCap, setMandateTotalCap] = useState('5.00');
  const [mandateReviewThreshold, setMandateReviewThreshold] = useState('1.50');

  // Interactive Testing State
  const [userTestRunning, setUserTestRunning] = useState<string | null>(null);
  const [userTestResult, setUserTestResult] = useState<any | null>(null);

  const fetchMandates = useCallback(
    async (showAll?: boolean) => {
      setMandatesLoading(true);
      try {
        const isAll = typeof showAll === 'boolean' ? showAll : showAllMandates;
        const url = isAll ? '/api/mandates?showAll=true' : '/api/mandates';
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && data.mandates) {
          setMandates(data.mandates);
        }
      } catch {
        // ignore
      } finally {
        setMandatesLoading(false);
      }
    },
    [showAllMandates]
  );

  const toggleShowAllMandates = useCallback(() => {
    setShowAllMandates((prev) => {
      const next = !prev;
      fetchMandates(next);
      return next;
    });
  }, [fetchMandates]);

  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const res = await fetch('/api/receipts');
      const data = await res.json();
      if (res.ok && data.receipts) {
        setReceipts(data.receipts);
        // If there's a pending review in receipts, track it
        const reviewPending = data.receipts.find(
          (r: any) => r.decision === 'REVIEW' && (!r.reviews || r.reviews.length === 0)
        );
        if (reviewPending && !pendingReviewReceipt) {
          setPendingReviewReceipt(reviewPending);
        }
      }
    } catch {
      // ignore
    } finally {
      setReceiptsLoading(false);
    }
  }, [pendingReviewReceipt]);

  // Initial load
  useEffect(() => {
    fetchMandates(false);
    fetchReceipts();
  }, [fetchMandates, fetchReceipts]);

  const toggleIssuePanel = useCallback(async () => {
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
  }, [inMemoryAgent]);

  const handleSignAndIssueMandate = useCallback(async () => {
    if (!phantomPubkey) {
      openModal();
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

      setIssueStatusText('Please sign the readable message in your wallet...');
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
  }, [
    phantomPubkey,
    openModal,
    inMemoryAgent,
    mandateMaxPerTx,
    mandateTotalCap,
    mandateReviewThreshold,
    signPhantomMessage,
    fetchMandates,
  ]);

  const runUserMandateTest = useCallback(
    async (testType: 'ALLOWED' | 'OVER_CAP' | 'REVOKED') => {
      if (!userIssuedMandate || !inMemoryAgent) return;
      setUserTestRunning(testType);
      setUserTestResult(null);

      try {
        let amountUnits = '1000000'; // $1.00 USDC
        if (testType === 'OVER_CAP') {
          amountUnits = '10000000'; // $10.00 USDC
        }

        if (testType === 'REVOKED') {
          await fetch(`/api/mandates/${userIssuedMandate.mandateId}/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Operator testing revocation policy' }),
          });
          fetchMandates();
        }

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

        const proofBytes = new TextEncoder().encode(templateData.canonicalJson);
        const agentProofSig = await inMemoryAgent.signBytes(proofBytes);

        const signedProof = {
          ...templateData.core,
          proofHash: templateData.proofHash,
          signature: agentProofSig,
        };

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
    },
    [userIssuedMandate, inMemoryAgent, fetchMandates, fetchReceipts]
  );

  const runScenario = useCallback(
    async (scenario: string): Promise<ScenarioResult | undefined> => {
      setRunningScenario(scenario);
      try {
        const res = await fetch('/api/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
        });
        const data = await res.json();
        let result: ScenarioResult;
        if (res.ok) {
          result = data;
          setScenarioResults((prev) => ({ ...prev, [scenario]: data }));
          if (scenario !== 'REAL_DEVNET') {
            setActiveReceipt(data.receipt);
          } else {
            setActiveReceipt(null);
          }
          if (data.decision === 'REVIEW') {
            setPendingReviewReceipt(data.receipt);
          }
        } else {
          const errorMsg = data.message || data.error || 'Scenario request failed';
          result = {
            scenario,
            statusCode: res.status,
            decision: 'DENY',
            latencyMs: 0,
            details: errorMsg,
            message: data.message,
            error: data.error,
            explorerUrl: data.explorerUrl,
          };
          setScenarioResults((prev) => ({ ...prev, [scenario]: result }));
          if (scenario === 'REAL_DEVNET') {
            setActiveReceipt(null);
          }
        }
        fetchMandates();
        fetchReceipts();
        return result;
      } catch (err: any) {
        console.error('Scenario error:', err);
        const errorMsg = err.message || 'Scenario network request failed';
        const result: ScenarioResult = {
          scenario,
          statusCode: 500,
          decision: 'DENY',
          latencyMs: 0,
          details: errorMsg,
          message: errorMsg,
          error: 'NETWORK_ERROR',
        };
        setScenarioResults((prev) => ({ ...prev, [scenario]: result }));
        if (scenario === 'REAL_DEVNET') {
          setActiveReceipt(null);
        }
        return result;
      } finally {
        setRunningScenario(null);
      }
    },
    [fetchMandates, fetchReceipts]
  );

  const runAllScenarios = useCallback(async () => {
    const scenarios = ['ALLOW', 'OVER_CAP', 'REVOKED', 'EXPIRED', 'REPLAY', 'REVIEW'];
    for (const sc of scenarios) {
      await runScenario(sc);
    }
  }, [runScenario]);

  const handleRevokeMandate = useCallback(
    async (mandateId: string) => {
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
    },
    [fetchMandates, fetchReceipts]
  );

  const handleReviewAction = useCallback(
    async (action: 'APPROVE' | 'REJECT', receiptId?: string) => {
      const targetId = receiptId || pendingReviewReceipt?.receiptId;
      if (!targetId) return;

      setReviewActionLoading(true);
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receiptId: targetId,
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
          return data.receipt;
        }
      } catch (err) {
        console.error('Review action error:', err);
      } finally {
        setReviewActionLoading(false);
      }
    },
    [pendingReviewReceipt, fetchMandates, fetchReceipts]
  );

  const value: AppContextState = {
    mandates,
    mandatesLoading,
    fetchMandates,
    showAllMandates,
    setShowAllMandates,
    toggleShowAllMandates,
    revokingId,
    handleRevokeMandate,
    receipts,
    receiptsLoading,
    fetchReceipts,
    activeReceipt,
    setActiveReceipt,
    pendingReviewReceipt,
    setPendingReviewReceipt,
    reviewActionLoading,
    handleReviewAction,
    runningScenario,
    scenarioResults,
    runScenario,
    runAllScenarios,
    showIssuePanel,
    setShowIssuePanel,
    toggleIssuePanel,
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
    handleSignAndIssueMandate,
    userIssuedMandate,
    setUserIssuedMandate,
    userTestRunning,
    userTestResult,
    runUserMandateTest,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextState {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

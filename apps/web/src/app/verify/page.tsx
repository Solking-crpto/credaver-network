'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  FileText,
  KeyRound,
  FileCheck,
} from 'lucide-react';

interface VerificationBadges {
  hashMatches: boolean;
  authorityValid: boolean;
  isConfiguredAuthority?: boolean;
  onChainAnchored: boolean | null;
  onChainVerified: boolean | null;
}

interface VerificationResult {
  type: 'RECEIPT' | 'TRANSACTION';
  isValid: boolean;
  error?: string;
  receipt?: any;
  signerStatus?: 'SIGNED BY CREDAVER AUTHORITY' | 'UNKNOWN SIGNER';
  configuredAuthorityPubkey?: string;
  badges?: VerificationBadges;
  onChain?: {
    isValid: boolean;
    txSignature: string;
    slot?: number;
    blockTime?: number | null;
    memoPayload?: string;
    parsedMemo?: {
      version: string;
      mandateHashPrefix: string;
      receiptHash: string;
      decision: string;
    };
    explorerUrl?: string;
    error?: string;
  };
  linkedReceipt?: any;
}

const SAMPLE_TX_ANCHORED =
  '3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ';
const SAMPLE_TX_SETTLEMENT =
  '3DPyADiVncJ1Lb62PRdkytkeGp9f91re959QuYmXCTLxGk2zAw1L5FpgJkKVJHEkq9wzX6bGGTD6xm4XxWjSNeJg';

// Authentically produced receipt via @credaver/core issueSignedReceipt
const SAMPLE_RECEIPT_GENUINE = {
  receiptId: 'rcpt-sample-verify-genuine-001',
  mandateHash: '8fa3b0196238b64e5c83bc1a28a38c290135bd029e01823901b8e018a1738c81',
  agentPubkey: '71jRSwn8epwtNvWQDJozMx9GhmChPg6HcLVqbJdBicx8',
  merchantPubkey: '4jFXp3jkfpTcnhczVWH9mR4pgzZbXXuW72W3QEvAoMZ1',
  asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  amount: '1000000',
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  nonce: 'nonce-sample-live-verify-001',
  decision: 'ALLOW',
  reasonCodes: ['POLICY_PASSED_ALL_GATES'],
  policyVersion: 'credav-v1.0',
  issuedAt: 1727950000000,
  authorityPubkey: 'BqNWfW4vgNVs1oJgDRk5MC5jqoZBNobR8cyhWfBv94HB',
  receiptHash: '1508a727b36ff0c563d79f1cec870afc1710ac56b8d3e3e307ac03dcd7360536',
  authoritySignature: '3GAEieNRD64RRBanPCqbbBZW6Fa3VjvBvAuVW1hir5RDzQXZU29ZxgQxGvg1Qfsog518e3tgV9Lrx7QFo83SsjWp',
  onChainTxSignature: null,
};

// TAMPERED EXAMPLE – expected to fail (amount tampered from 1 USDC to 999.999 USDC without valid signature)
const SAMPLE_RECEIPT_TAMPERED = {
  receiptId: 'rcpt-sample-tampered-demo-002',
  mandateHash: '8fa3b0196238b64e5c83bc1a28a38c290135bd029e01823901b8e018a1738c81',
  agentPubkey: '71jRSwn8epwtNvWQDJozMx9GhmChPg6HcLVqbJdBicx8',
  merchantPubkey: '4jFXp3jkfpTcnhczVWH9mR4pgzZbXXuW72W3QEvAoMZ1',
  asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  amount: '999999999', // TAMPERED: Modified amount without re-signing
  network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  nonce: 'nonce-sample-live-verify-001',
  decision: 'ALLOW',
  reasonCodes: ['POLICY_PASSED_ALL_GATES'],
  policyVersion: 'credav-v1.0',
  issuedAt: 1727950000000,
  authorityPubkey: 'BqNWfW4vgNVs1oJgDRk5MC5jqoZBNobR8cyhWfBv94HB',
  receiptHash: '1508a727b36ff0c563d79f1cec870afc1710ac56b8d3e3e307ac03dcd7360536',
  authoritySignature: '3GAEieNRD64RRBanPCqbbBZW6Fa3VjvBvAuVW1hir5RDzQXZU29ZxgQxGvg1Qfsog518e3tgV9Lrx7QFo83SsjWp',
  onChainTxSignature: null,
};

function VerifyContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'tx' | 'json'>('tx');
  const [txInput, setTxInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configuredAuthority, setConfiguredAuthority] = useState<string | null>(null);
  const [isVerifyingLatest, setIsVerifyingLatest] = useState(false);

  // Fetch configured authority key on load
  useEffect(() => {
    fetch('/api/authority')
      .then((res) => res.json())
      .then((data) => {
        if (data.authorityPubkey) {
          setConfiguredAuthority(data.authorityPubkey);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-fill from query params (?tx=... or ?receiptId=...)
  useEffect(() => {
    const txParam = searchParams.get('tx');
    const receiptIdParam = searchParams.get('receiptId');

    if (txParam) {
      setTxInput(txParam);
      setActiveTab('tx');
      executeVerifyTx(txParam);
    } else if (receiptIdParam) {
      executeVerifyReceiptId(receiptIdParam);
    }
  }, [searchParams]);

  const executeVerifyTx = async (txSig: string) => {
    if (!txSig.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch(`/api/verify?tx=${encodeURIComponent(txSig.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification request failed');
      }

      setResult({
        type: 'TRANSACTION',
        isValid: data.onChain?.isValid || false,
        onChain: {
          ...data.onChain,
          explorerUrl: `https://explorer.solana.com/tx/${txSig.trim()}?cluster=devnet`,
        },
        linkedReceipt: data.linkedReceipt,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with verification gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const executeVerifyReceiptId = async (receiptId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch(`/api/verify?receiptId=${encodeURIComponent(receiptId.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification request failed');
      }

      setResult({
        type: 'RECEIPT',
        isValid: data.verification?.isValid || false,
        error: data.verification?.error,
        receipt: data.receipt,
        signerStatus: data.verification?.signerStatus,
        configuredAuthorityPubkey: data.verification?.configuredAuthorityPubkey,
        badges: data.verification?.badges,
        onChain: data.verification?.onChain,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with verification gateway');
    } finally {
      setIsLoading(false);
    }
  };

  const executeVerifyJson = async () => {
    if (!jsonInput.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setResult(null);

    try {
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(jsonInput);
      } catch {
        throw new Error('Invalid JSON format. Please paste a valid SignedReceipt object.');
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: parsedJson }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Verification request failed');
      }

      setResult({
        type: 'RECEIPT',
        isValid: data.verification?.isValid || false,
        error: data.verification?.error,
        receipt: data.receipt,
        signerStatus: data.verification?.signerStatus,
        configuredAuthorityPubkey: data.verification?.configuredAuthorityPubkey,
        badges: data.verification?.badges,
        onChain: data.verification?.onChain,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLatestReceipt = async () => {
    setIsVerifyingLatest(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch('/api/receipts');
      if (!res.ok) {
        throw new Error('Failed to fetch receipts from server');
      }
      const data = await res.json();
      if (!data.receipts || data.receipts.length === 0) {
        throw new Error(
          'No receipts found in store yet. Run a scenario or payment on the Home page first to generate a receipt.'
        );
      }

      // Sort by issuedAt descending to get the newest receipt
      const latest = [...data.receipts].sort(
        (a: any, b: any) => (b.issuedAt || 0) - (a.issuedAt || 0)
      )[0];

      setJsonInput(JSON.stringify(latest, null, 2));
      setActiveTab('json');

      setIsLoading(true);
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: latest }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || verifyData.error || 'Verification request failed');
      }

      setResult({
        type: 'RECEIPT',
        isValid: verifyData.verification?.isValid || false,
        error: verifyData.verification?.error,
        receipt: verifyData.receipt,
        signerStatus: verifyData.verification?.signerStatus,
        configuredAuthorityPubkey: verifyData.verification?.configuredAuthorityPubkey,
        badges: verifyData.verification?.badges,
        onChain: verifyData.verification?.onChain,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error verifying latest receipt');
    } finally {
      setIsVerifyingLatest(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="cyan" className="font-mono text-xs">
            Verification Portal
          </Badge>
          <span className="text-xs text-muted font-mono">Solana Devnet Memo Verifier</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Receipt &amp; On-Chain Anchor Verification
        </h1>
        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
          Independent cryptographic verification of CredaVer payment receipts and SPL Memo transactions.
          Inspect cryptographic hash binding, operator Ed25519 signatures, and Solana devnet immutability.
        </p>
      </div>

      {/* Input Selection Tabs */}
      <Card glow className="p-6 border-border/90 bg-surface-card/90 space-y-5">
        <div className="flex gap-2 border-b border-border/70 pb-4">
          <button
            onClick={() => setActiveTab('tx')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-target ${
              activeTab === 'tx'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Solana Devnet Tx Signature
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-target ${
              activeTab === 'json'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Receipt JSON Payload
          </button>
        </div>

        {/* Tab 1: Tx Signature */}
        {activeTab === 'tx' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-muted mb-1.5">
                Enter Solana Devnet Transaction Signature
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={txInput}
                  onChange={(e) => setTxInput(e.target.value)}
                  placeholder="e.g. 3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ"
                  className="flex-1 bg-surface border border-border/80 rounded-lg px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 min-h-[44px]"
                />
                <Button
                  onClick={() => executeVerifyTx(txInput)}
                  isLoading={isLoading}
                  disabled={!txInput.trim()}
                  variant="primary"
                  className="min-h-[44px] px-5"
                >
                  Verify On-Chain
                </Button>
              </div>
            </div>

            {/* Presets */}
            <div className="pt-2">
              <span className="text-[11px] font-mono text-muted uppercase tracking-wider block mb-2">
                Verification Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={verifyLatestReceipt}
                  isLoading={isVerifyingLatest}
                  className="min-h-[38px] px-4 font-bold"
                >
                  ✨ Verify my latest receipt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTxInput(SAMPLE_TX_ANCHORED);
                    executeVerifyTx(SAMPLE_TX_ANCHORED);
                  }}
                  className="min-h-[38px] px-3 font-mono text-xs"
                >
                  ⚓ Anchored Memo Tx (Devnet)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTxInput(SAMPLE_TX_SETTLEMENT);
                    executeVerifyTx(SAMPLE_TX_SETTLEMENT);
                  }}
                  className="min-h-[38px] px-3 font-mono text-xs"
                >
                  ⚡ Live Settlement Tx (Devnet)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: JSON Receipt */}
        {activeTab === 'json' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-muted mb-1.5">
                Paste Complete SignedReceipt JSON
              </label>
              <textarea
                rows={8}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste signed receipt JSON object here..."
                className="w-full bg-surface border border-border/80 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 leading-relaxed"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={verifyLatestReceipt}
                  isLoading={isVerifyingLatest}
                  className="min-h-[38px] px-4 font-bold"
                >
                  ✨ Verify my latest receipt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_RECEIPT_GENUINE, null, 2))}
                  className="min-h-[38px] px-3 text-xs font-mono"
                >
                  Load Sample Receipt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-400 hover:text-rose-300 min-h-[38px] px-3 text-xs font-mono"
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_RECEIPT_TAMPERED, null, 2))}
                >
                  TAMPERED EXAMPLE – expected to fail
                </Button>
              </div>

              <Button
                onClick={executeVerifyJson}
                isLoading={isLoading}
                disabled={!jsonInput.trim()}
                variant="primary"
                className="min-h-[38px] px-5"
              >
                Verify Receipt
              </Button>
            </div>
            <div className="text-xs font-mono text-slate-300 bg-surface/80 p-3 rounded-lg border border-border/70 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-400">Note for Sample Receipt:</strong> Signed by a sample key, so the signer will show as UNKNOWN. Use &quot;Verify my latest receipt&quot; for this deployment&apos;s receipts.
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Error Notice */}
      {errorMessage && (
        <Card className="border-rose-500/50 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 text-rose-400 font-medium text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>Verification Warning: {errorMessage}</span>
          </div>
        </Card>
      )}

      {/* Verification Result Display */}
      {result && (
        <div className="space-y-6">
          {/* Main Status Header Panel */}
          <Card
            glow={result.isValid}
            className={`p-6 border-2 transition-all ${
              result.isValid
                ? 'border-emerald-500/60 bg-emerald-950/20'
                : 'border-rose-500/60 bg-rose-950/20'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={result.isValid ? 'green' : 'rose'} className="font-mono text-xs font-bold px-2.5 py-0.5">
                    {result.isValid ? 'VERIFIED AUTHENTIC' : 'VERIFICATION FAILED'}
                  </Badge>

                  {result.type === 'RECEIPT' && (
                    <Badge
                      variant={
                        result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                        result.badges?.isConfiguredAuthority !== false
                          ? 'green'
                          : 'rose'
                      }
                      className="font-mono text-xs font-bold px-2.5 py-0.5"
                    >
                      {result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                      result.badges?.isConfiguredAuthority !== false
                        ? 'SIGNED BY CREDAVER AUTHORITY'
                        : 'UNKNOWN SIGNER'}
                    </Badge>
                  )}

                  <span className="text-xs text-muted font-mono">
                    Mode: {result.type}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {result.isValid
                    ? 'Cryptographic & On-Chain Integrity Confirmed'
                    : result.error || 'Discrepancy Detected During Verification'}
                </h2>
              </div>

              {result.onChain?.explorerUrl && (
                <Link
                  href={result.onChain.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono text-cyan-400 border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors self-start sm:self-auto"
                >
                  <span>Solana Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Separate Verification Result Rows */}
            <div className="mt-5 space-y-3">
              {/* Row 1: Recomputed Canonical Hash */}
              <div className="p-4 rounded-xl bg-surface/80 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    result.badges?.hashMatches !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-slate-400 uppercase text-[10px] tracking-wider">Row 1: Hash Recomputation (RFC 8785)</div>
                    <div className="text-white font-semibold">Canonical Payload SHA-256 Digest</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {result.badges?.hashMatches !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valid Hash Match</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      <span>Hash Mismatch</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Authority Signature Verification */}
              <div className="p-4 rounded-xl bg-surface/80 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    result.badges?.authorityValid !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-slate-400 uppercase text-[10px] tracking-wider">Row 2: Signature Verification</div>
                    <div className="text-white font-semibold">Ed25519 Authority Key Control</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {result.badges?.authorityValid !== false ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valid Ed25519 Signature</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      <span>Invalid Signature</span>
                    </span>
                  )}

                  <Badge
                    variant={
                      result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                      result.badges?.isConfiguredAuthority !== false
                        ? 'green'
                        : 'rose'
                    }
                    className="font-mono text-[10px] py-0 px-1.5"
                  >
                    {result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                    result.badges?.isConfiguredAuthority !== false
                      ? 'CREDAVER AUTHORITY'
                      : 'UNKNOWN SIGNER'}
                  </Badge>
                </div>
              </div>

              {/* Row 3: On-Chain SPL Memo Anchor */}
              {(() => {
                const receiptObj = result.receipt || result.linkedReceipt;
                const decision = receiptObj?.decision;
                const hasAnchorTx = Boolean(result.onChain?.txSignature || receiptObj?.onChainTxSignature);
                const isAnchored = result.badges?.onChainAnchored !== undefined && result.badges.onChainAnchored !== null
                  ? result.badges.onChainAnchored
                  : hasAnchorTx;
                const isVerified = Boolean(result.onChain?.isValid === true || result.badges?.onChainVerified === true);
                const isPropagating = Boolean(
                  isAnchored &&
                    !isVerified &&
                    result.onChain?.error &&
                    (result.onChain.error.includes('not found') || result.onChain.error.includes('propagating'))
                );
                const isAnchorFailed = Boolean(isAnchored && !isVerified && !isPropagating);
                const isNotAnchored = !isAnchored || result.badges?.onChainAnchored === false;
                const explorerUrl =
                  result.onChain?.explorerUrl ||
                  (result.onChain?.txSignature
                    ? `https://explorer.solana.com/tx/${result.onChain.txSignature}?cluster=devnet`
                    : null);

                return (
                  <div className="p-4 rounded-xl bg-surface/80 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isVerified
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isAnchorFailed
                            ? 'bg-rose-500/15 text-rose-400'
                            : isPropagating
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-slate-500/15 text-slate-400'
                        }`}
                      >
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase text-[10px] tracking-wider">
                          Row 3: On-Chain Memo Anchor
                        </div>
                        <div className="text-white font-semibold">Solana Devnet Memo Verification</div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      {isVerified ? (
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              Verified On-Chain {result.onChain?.slot ? `(Slot #${result.onChain.slot})` : ''}
                            </span>
                          </span>
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 ml-1"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : isAnchorFailed ? (
                        <div className="space-y-0.5 text-left sm:text-right">
                          <span className="text-rose-400 font-bold flex items-center sm:justify-end gap-1">
                            <XCircle className="w-4 h-4" />
                            <span>Anchor mismatch</span>
                          </span>
                          {result.onChain?.error && (
                            <p className="text-[11px] text-rose-400/90 max-w-sm">
                              {result.onChain.error}
                            </p>
                          )}
                        </div>
                      ) : isPropagating ? (
                        <div className="space-y-0.5 text-left sm:text-right">
                          <span className="text-amber-400 font-bold flex items-center sm:justify-end gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Pending / Propagating</span>
                          </span>
                          <p className="text-[11px] text-amber-400/80 max-w-sm">
                            {result.onChain?.error || 'Transaction not found on devnet (may still be propagating)'}
                          </p>
                        </div>
                      ) : isNotAnchored ? (
                        <div className="space-y-0.5 text-left sm:text-right">
                          <span className="text-slate-400 flex items-center sm:justify-end gap-1">
                            <span>○ Not anchored on-chain</span>
                          </span>
                          {(decision === 'DENY' || decision === 'REVIEW') && (
                            <p className="text-[11px] text-slate-400 max-w-sm">
                              Only ALLOW receipts are anchored on-chain; this receipt is still signed by the CredaVer authority.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })()}
            </div>
          </Card>

          {/* On-Chain Transaction Deep Dive */}
          {result.onChain && (
            <Card className="p-6 border-border/80 bg-surface-card/85 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Solana Devnet Memo Inspection
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1.5 border-b border-border/40">
                  <span className="text-muted">Tx Signature:</span>
                  <span className="md:col-span-2 text-slate-200 break-all">{result.onChain.txSignature}</span>
                </div>
                {result.onChain.memoPayload && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1.5 border-b border-border/40">
                    <span className="text-muted">Raw SPL Memo Payload:</span>
                    <span className="md:col-span-2 text-cyan-400 break-all bg-surface p-2 rounded border border-border/60">
                      {result.onChain.memoPayload}
                    </span>
                  </div>
                )}
                {result.onChain.parsedMemo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1.5 border-b border-border/40">
                    <span className="text-muted">Parsed Memo Components:</span>
                    <div className="md:col-span-2 space-y-1">
                      <div>Protocol Version: <span className="text-white">{result.onChain.parsedMemo.version}</span></div>
                      <div>Mandate Prefix: <span className="text-white">{result.onChain.parsedMemo.mandateHashPrefix}</span></div>
                      <div>Receipt Hash: <span className="text-emerald-400 break-all">{result.onChain.parsedMemo.receiptHash}</span></div>
                      <div>Decision: <span className="text-white">{result.onChain.parsedMemo.decision}</span></div>
                    </div>
                  </div>
                )}
                {result.onChain.blockTime && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1.5">
                    <span className="text-muted">Block Timestamp:</span>
                    <span className="md:col-span-2 text-slate-200">
                      {new Date(result.onChain.blockTime * 1000).toUTCString()} ({result.onChain.blockTime})
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Receipt Details (if available) */}
          {(result.receipt || result.linkedReceipt) && (
            <Card className="p-6 border-border/80 bg-surface-card/85 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Decoded Receipt Authorization Data
              </h3>
              {(() => {
                const r = result.receipt || result.linkedReceipt;
                return (
                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Receipt ID:</span>
                      <span className="md:col-span-2 text-white font-bold">{r.receiptId}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Decision:</span>
                      <span className="md:col-span-2 font-bold text-emerald-400">{r.decision}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Reason Codes:</span>
                      <span className="md:col-span-2 text-slate-200">{r.reasonCodes?.join(', ')}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Mandate Hash:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.mandateHash}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Agent Identity:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.agentPubkey}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Merchant Pubkey:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.merchantPubkey}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Amount &amp; Asset:</span>
                      <span className="md:col-span-2 text-white">
                        {r.amount} base units ({r.asset})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Issued At:</span>
                      <span className="md:col-span-2 text-slate-200">
                        {new Date(r.issuedAt).toUTCString()} ({r.issuedAt})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Authority Signer Pubkey:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.authorityPubkey || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-border/40">
                      <span className="text-muted">Configured Authority:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">
                        {result.configuredAuthorityPubkey || configuredAuthority || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1">
                      <span className="text-muted">Signer Verification:</span>
                      <span
                        className={`md:col-span-2 font-bold ${
                          result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                          result.badges?.isConfiguredAuthority !== false
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                        result.badges?.isConfiguredAuthority !== false
                          ? 'SIGNED BY CREDAVER AUTHORITY'
                          : 'UNKNOWN SIGNER'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-muted font-mono text-sm">
          Loading verification gateway...
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

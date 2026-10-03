'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

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

const SAMPLE_TX_ANCHORED = '3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ';
const SAMPLE_TX_SETTLEMENT = '3DPyADiVncJ1Lb62PRdkytkeGp9f91re959QuYmXCTLxGk2zAw1L5FpgJkKVJHEkq9wzX6bGGTD6xm4XxWjSNeJg';

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
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="cyan">Milestone 4</Badge>
          <span className="text-xs text-slate-500 font-mono">Solana Devnet Memo Verifier</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Receipt &amp; On-Chain Anchor Verification
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Independent cryptographic verification of CredaVer payment receipts and SPL Memo transactions.
          Inspect cryptographic hash binding, operator Ed25519 signatures, and Solana devnet immutability.
        </p>
      </div>

      {/* Input Selection Tabs */}
      <Card glow>
        <div className="flex gap-2 border-b border-credav-border/60 pb-4 mb-5">
          <button
            onClick={() => setActiveTab('tx')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'tx'
                ? 'bg-credav-cyan/20 text-credav-cyan border border-credav-cyan/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Solana Devnet Tx Signature
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'json'
                ? 'bg-credav-cyan/20 text-credav-cyan border border-credav-cyan/40'
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
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Enter Solana Devnet Transaction Signature
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={txInput}
                  onChange={(e) => setTxInput(e.target.value)}
                  placeholder="e.g. 3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ"
                  className="flex-1 bg-credav-surface border border-credav-border/80 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-credav-cyan"
                />
                <Button
                  onClick={() => executeVerifyTx(txInput)}
                  isLoading={isLoading}
                  disabled={!txInput.trim()}
                  variant="primary"
                >
                  Verify On-Chain
                </Button>
              </div>
            </div>

            {/* Quick Demo Presets */}
            <div className="pt-2">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                Hackathon Judge Quick-Test Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  onClick={verifyLatestReceipt}
                  isLoading={isVerifyingLatest}
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
                >
                  ⚡ Live S1 Settlement Tx (Devnet)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: JSON Receipt */}
        {activeTab === 'json' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Paste Complete SignedReceipt JSON
              </label>
              <textarea
                rows={8}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste signed receipt JSON object here..."
                className="w-full bg-credav-surface border border-credav-border/80 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-credav-cyan"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  onClick={verifyLatestReceipt}
                  isLoading={isVerifyingLatest}
                >
                  ✨ Verify my latest receipt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setJsonInput(JSON.stringify(SAMPLE_RECEIPT_GENUINE, null, 2))}
                >
                  Load Sample Receipt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-400 hover:text-rose-300"
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
              >
                Verify Receipt
              </Button>
            </div>
            <p className="text-[11px] font-mono text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800">
              <strong className="text-amber-400/90">Note for Sample Receipt:</strong> Signed by a sample key, so the signer will show as UNKNOWN. Use &quot;Verify my latest receipt&quot; for this deployment&apos;s receipts.
            </p>
          </div>
        )}
      </Card>

      {/* Error Notice */}
      {errorMessage && (
        <Card className="border-rose-500/40 bg-rose-500/10">
          <div className="flex items-center gap-2 text-rose-400 font-medium text-sm">
            <span>⚠️ Verification Warning:</span>
            <span>{errorMessage}</span>
          </div>
        </Card>
      )}

      {/* Verification Result Display */}
      {result && (
        <div className="space-y-6">
          {/* Main Status Header */}
          <Card
            glow={result.isValid}
            className={`border ${
              result.isValid ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-rose-500/50 bg-rose-950/20'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={result.isValid ? 'green' : 'rose'}>
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
                    >
                      {result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                      result.badges?.isConfiguredAuthority !== false
                        ? 'SIGNED BY CREDAVER AUTHORITY'
                        : 'UNKNOWN SIGNER'}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Mode: {result.type}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {result.isValid
                    ? 'Cryptographic & On-Chain Integrity Confirmed'
                    : result.error || 'Discrepancy Detected During Verification'}
                </h2>
              </div>

              {result.onChain?.explorerUrl && (
                <a
                  href={result.onChain.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-credav-cyan border border-credav-cyan/40 bg-credav-cyan/10 hover:bg-credav-cyan/20 transition-colors"
                >
                  View on Solana Explorer ↗
                </a>
              )}
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-credav-border/60">
              {/* Badge 1: Hash Integrity */}
              <div className="p-3 rounded-lg bg-credav-surface/60 border border-credav-border/40">
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  1. Canonical Hash
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-xs">
                  {result.badges?.hashMatches !== false ? (
                    <span className="text-emerald-400">✓ Valid RFC 8785</span>
                  ) : (
                    <span className="text-rose-400">✗ Hash Mismatch</span>
                  )}
                </div>
              </div>

              {/* Badge 2: Authority Signature */}
              <div className="p-3 rounded-lg bg-credav-surface/60 border border-credav-border/40">
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  2. Authority Signature
                </div>
                <div className="mt-1 flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    {result.badges?.authorityValid !== false ? (
                      <span className="text-emerald-400">✓ Valid Ed25519</span>
                    ) : (
                      <span className="text-rose-400">✗ Invalid Signature</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono">
                    {result.signerStatus === 'SIGNED BY CREDAVER AUTHORITY' ||
                    result.badges?.isConfiguredAuthority !== false ? (
                      <span className="text-emerald-400 font-semibold">● CREDAVER AUTHORITY</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">▲ UNKNOWN SIGNER</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Badge 3: SPL Memo Match */}
              <div className="p-3 rounded-lg bg-credav-surface/60 border border-credav-border/40">
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  3. SPL Memo Anchor
                </div>
                <div className="mt-1 flex items-center gap-1.5 font-medium text-xs">
                  {result.onChain?.isValid ? (
                    <span className="text-emerald-400">✓ Devnet Memo Match</span>
                  ) : result.badges?.onChainAnchored === false ? (
                    <span className="text-slate-400">○ Off-chain Only</span>
                  ) : (
                    <span className="text-amber-400">⚠️ Pending / Unanchored</span>
                  )}
                </div>
              </div>

              {/* Badge 4: Devnet Block Slot */}
              <div className="p-3 rounded-lg bg-credav-surface/60 border border-credav-border/40">
                <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                  4. Confirmed Slot
                </div>
                <div className="mt-1 font-mono text-xs text-credav-cyan">
                  {result.onChain?.slot ? `Slot #${result.onChain.slot}` : 'N/A'}
                </div>
              </div>
            </div>
          </Card>

          {/* On-Chain Transaction Deep Dive */}
          {result.onChain && (
            <Card>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 font-mono">
                Solana Devnet Memo Inspection
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                  <span className="text-slate-400">Tx Signature:</span>
                  <span className="md:col-span-2 text-slate-200 break-all">{result.onChain.txSignature}</span>
                </div>
                {result.onChain.memoPayload && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                    <span className="text-slate-400">Raw SPL Memo Payload:</span>
                    <span className="md:col-span-2 text-credav-cyan break-all bg-credav-surface/80 p-2 rounded">
                      {result.onChain.memoPayload}
                    </span>
                  </div>
                )}
                {result.onChain.parsedMemo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                    <span className="text-slate-400">Parsed Memo Components:</span>
                    <div className="md:col-span-2 space-y-1">
                      <div>Protocol Version: <span className="text-white">{result.onChain.parsedMemo.version}</span></div>
                      <div>Mandate Prefix: <span className="text-white">{result.onChain.parsedMemo.mandateHashPrefix}</span></div>
                      <div>Receipt Hash: <span className="text-emerald-400 break-all">{result.onChain.parsedMemo.receiptHash}</span></div>
                      <div>Decision: <span className="text-white">{result.onChain.parsedMemo.decision}</span></div>
                    </div>
                  </div>
                )}
                {result.onChain.blockTime && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                    <span className="text-slate-400">Block Timestamp:</span>
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
            <Card>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 font-mono">
                Decoded Receipt Authorization Data
              </h3>
              {(() => {
                const r = result.receipt || result.linkedReceipt;
                return (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Receipt ID:</span>
                      <span className="md:col-span-2 text-white">{r.receiptId}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Decision:</span>
                      <span className="md:col-span-2 font-bold text-emerald-400">{r.decision}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Reason Codes:</span>
                      <span className="md:col-span-2 text-slate-200">{r.reasonCodes?.join(', ')}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Mandate Hash:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.mandateHash}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Agent Identity:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.agentPubkey}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Merchant Pubkey:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.merchantPubkey}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Amount &amp; Asset:</span>
                      <span className="md:col-span-2 text-white">
                        {r.amount} base units ({r.asset})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Issued At:</span>
                      <span className="md:col-span-2 text-slate-200">
                        {new Date(r.issuedAt).toUTCString()} ({r.issuedAt})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Authority Signer Pubkey:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">{r.authorityPubkey || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Configured Authority:</span>
                      <span className="md:col-span-2 text-slate-200 break-all">
                        {result.configuredAuthorityPubkey || configuredAuthority || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-1 border-b border-credav-border/30">
                      <span className="text-slate-400">Signer Verification:</span>
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
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-mono">Loading verification gateway...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

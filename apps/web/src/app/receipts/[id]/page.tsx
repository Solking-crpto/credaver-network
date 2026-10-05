'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import {
  FileCheck2,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface ReceiptDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const resolvedParams = use(params);
  const receiptId = resolvedParams.id;

  const [receipt, setReceipt] = useState<any | null>(null);
  const [verification, setVerification] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch receipt record
        const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Receipt not found');
        }
        const data = await res.json();
        setReceipt(data.receipt);

        // 2. Fetch live verification
        const verifyRes = await fetch(`/api/verify?receiptId=${encodeURIComponent(receiptId)}`);
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setVerification(verifyData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    }

    if (receiptId) {
      loadData();
    }
  }, [receiptId]);

  const handleCopyJson = () => {
    if (receipt) {
      navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <Link href="/receipts" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Receipts</span>
        </Link>
        <Card className="p-12 text-center text-xs font-mono text-slate-400">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Loading cryptographic receipt {receiptId}...</span>
        </Card>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <Link href="/receipts" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Receipts</span>
        </Link>
        <Card className="p-8 text-center space-y-4 border-rose-500/30">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <XCircle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Receipt Not Found</h2>
          <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
            {error || `No receipt with ID "${receiptId}" exists in the current session store.`}
          </p>
          <div className="pt-2">
            <Link href="/receipts">
              <Button variant="outline" size="sm">
                <span>View All Receipts</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const settlementTx = receipt.settlementTxSignature || receipt.paymentTxSignature || receipt.txSignature;
  const anchorTx = receipt.onChainTxSignature || receipt.anchorTxSignature;

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-4">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link href="/receipts" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Receipts list</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/verify?receiptId=${encodeURIComponent(receiptId)}`}>
            <Button variant="primary" size="sm" className="text-xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              <span>Verify in Portal</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Receipt Summary Card */}
      <Card glow className="p-6 sm:p-8 bg-surface-card/95 border-cyan-500/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="font-mono text-xs">
                Decision Receipt
              </Badge>
              <span className="text-xs font-mono text-slate-400">
                {new Date(receipt.issuedAt).toLocaleString()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white break-all">
              {receipt.receiptId}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip status={receipt.decision} />
            {receipt.settlementStatus && (
              <Badge
                variant={receipt.settlementStatus === 'SETTLED' ? 'green' : 'rose'}
                className="font-mono text-xs"
              >
                {receipt.settlementStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Live Cryptographic Verification Box */}
        {verification && (
          <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
            verification.isValid
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                {verification.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  {verification.isValid ? 'CRYPTOGRAPHICALLY VALID' : 'VERIFICATION FAILED'}
                </span>
              </div>
              <Badge variant={verification.isValid ? 'green' : 'rose'} className="text-[10px]">
                {verification.signerStatus || (verification.isValid ? 'GENUINE SIGNATURE' : 'INVALID')}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300">
              Verified against Ed25519 digital signature using canonical RFC 8785 JSON representation.
            </p>
          </div>
        )}

        {/* Key-Value Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1">
            <div className="text-slate-400">Authorized Amount</div>
            <div className="text-base font-bold text-white">
              {formatAmountUSDC(receipt.amount)}
            </div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1">
            <div className="text-slate-400">Primary Reason Code</div>
            <div className="text-sm font-bold text-cyan-400">
              {receipt.reasonCodes?.[0] || 'NONE'}
            </div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1 sm:col-span-2">
            <div className="text-slate-400">Bound Mandate ID</div>
            <div className="text-white font-semibold break-all">
              <Link href="/mandates" className="hover:text-cyan-400 underline">
                {receipt.mandateId}
              </Link>
            </div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1 sm:col-span-2">
            <div className="text-slate-400">Merchant Destination Public Key</div>
            <div className="text-slate-200 break-all">{receipt.merchantPubkey}</div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1 sm:col-span-2">
            <div className="text-slate-400">Agent Identity Public Key</div>
            <div className="text-slate-200 break-all">{receipt.agentPubkey}</div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1 sm:col-span-2">
            <div className="text-slate-400">Authority Signer Public Key</div>
            <div className="text-slate-200 break-all">
              {receipt.authorityPubkey || 'CredaVer Receipt Authority'}
            </div>
          </div>

          <div className="p-3.5 bg-surface rounded-lg border border-border/80 space-y-1 sm:col-span-2">
            <div className="text-slate-400">Authority Signature (Base58)</div>
            <div className="text-slate-300 break-all text-[11px]">
              {receipt.authoritySignature}
            </div>
          </div>
        </div>

        {/* On-Chain Explorer Links */}
        {(settlementTx || anchorTx) && (
          <div className="pt-4 border-t border-border/70 space-y-2">
            <div className="text-xs font-mono text-slate-400">Solana Devnet Transactions</div>
            <div className="flex flex-wrap items-center gap-3">
              {settlementTx && (
                <a
                  href={`https://explorer.solana.com/tx/${settlementTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-xs font-mono"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Settlement Tx on Solana Explorer</span>
                </a>
              )}
              {anchorTx && (
                <a
                  href={`https://explorer.solana.com/tx/${anchorTx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:text-cyan-300 text-xs font-mono"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>SPL Memo Anchor Tx</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Raw Canonical JSON Preview */}
        <div className="pt-4 border-t border-border/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Raw Canonical JSON</span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1 text-xs font-mono text-cyan-400 hover:text-cyan-300"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="p-4 bg-surface rounded-xl border border-border/80 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      </Card>
    </div>
  );
}

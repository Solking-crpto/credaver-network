import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Shield, ExternalLink, Copy, Check, CheckCircle2 } from 'lucide-react';

interface ProofTx {
  title: string;
  type: string;
  signature: string;
  description: string;
  slot?: number;
  explorerUrl: string;
}

export const OnChainProofSection: React.FC = () => {
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  const proofTxs: ProofTx[] = [
    {
      title: 'Real Devnet Transaction (x402 V2 Protocol)',
      type: 'SETTLEMENT',
      signature: '5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF',
      description: 'Live x402 payment settled via public facilitator (x402.org) using server-funded devnet USDC.',
      explorerUrl:
        'https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet',
    },
    {
      title: 'On-Chain Receipt Anchor (SPL Memo)',
      type: 'ANCHOR MEMO',
      signature: '3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ',
      description: 'Canonical RFC 8785 receipt hash permanently anchored on Solana devnet via SPL Memo program.',
      slot: 506955056,
      explorerUrl:
        'https://explorer.solana.com/tx/3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ?cluster=devnet',
    },
    {
      title: 'Merchant Payment Verification',
      type: 'VERIFIED PAYMENT',
      signature: '3DPyADiVncJ1Lb62PRdkytkeGp9f91re959QuYmXCTLxGk2zAw1L5FpgJkKVJHEkq9wzX6bGGTD6xm4XxWjSNeJg',
      description: 'Constrained signer round-trip settlement against demo resource server on Solana devnet.',
      explorerUrl:
        'https://explorer.solana.com/tx/3DPyADiVncJ1Lb62PRdkytkeGp9f91re959QuYmXCTLxGk2zAw1L5FpgJkKVJHEkq9wzX6bGGTD6xm4XxWjSNeJg?cluster=devnet',
    },
  ];

  const handleCopy = async (signature: string) => {
    try {
      await navigator.clipboard.writeText(signature);
      setCopiedSig(signature);
      setTimeout(() => setCopiedSig(null), 2000);
    } catch {
      // ignore
    }
  };

  const truncateSig = (sig: string) => `${sig.slice(0, 10)}...${sig.slice(-10)}`;

  return (
    <section id="on-chain-proof" className="py-12 border-t border-border/50 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            On-chain Proof
          </h2>
          <p className="text-sm text-muted mt-1">
            Real Solana devnet transaction signatures verifying settlements and immutable receipt anchors.
          </p>
        </div>
        <Badge variant="cyan" className="self-start sm:self-auto font-mono text-xs">
          Solana Devnet
        </Badge>
      </div>

      <div className="space-y-3">
        {proofTxs.map((item) => (
          <Card
            key={item.signature}
            className="p-5 border-border/80 bg-surface-card/80 hover:border-border transition-colors space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{item.title}</span>
                <Badge variant="green" className="text-[10px] py-0 px-2 font-mono">
                  {item.type}
                </Badge>
              </div>

              {item.slot && (
                <span className="text-xs font-mono text-slate-400">
                  Slot #{item.slot}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {item.description}
            </p>

            <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted">Signature:</span>
                <span className="text-slate-200 font-bold bg-surface px-2 py-0.5 rounded border border-border/60">
                  {truncateSig(item.signature)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(item.signature)}
                  className="p-1 rounded hover:bg-surface text-slate-400 hover:text-white transition-colors"
                  title="Copy signature"
                  aria-label="Copy signature"
                >
                  {copiedSig === item.signature ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={item.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <span>View on Solana Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  href={`/verify?tx=${item.signature}`}
                  className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 underline underline-offset-4"
                >
                  <span>Verify in Portal</span>
                  <CheckCircle2 className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};

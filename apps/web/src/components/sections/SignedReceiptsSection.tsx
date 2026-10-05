import React from 'react';
import Link from 'next/link';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { StatusChip } from '../ui/StatusChip';
import { FileCheck2, RotateCcw, ExternalLink } from 'lucide-react';

interface SignedReceiptsSectionProps {
  receipts: any[];
  receiptsLoading: boolean;
  onRefresh: () => Promise<void>;
}

export const SignedReceiptsSection: React.FC<SignedReceiptsSectionProps> = ({
  receipts,
  receiptsLoading,
  onRefresh,
}) => {
  const formatAmountUSDC = (baseUnits: string) => {
    const num = Number(baseUnits) / 1e6;
    return `$${num.toFixed(2)} USDC`;
  };

  return (
    <section id="receipts" className="py-12 border-t border-border/50 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-cyan-400" />
            Signed Decision Receipts
          </h2>
          <Badge variant="cyan" className="font-mono text-xs">
            {receipts.length}
          </Badge>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          isLoading={receiptsLoading}
          className="self-start sm:self-auto min-h-[40px] px-3 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {receipts.length === 0 ? (
        <Card className="text-center py-12 text-muted font-mono text-xs border-dashed border-border/80">
          <p>No decision receipts recorded yet.</p>
          <p className="mt-1 text-slate-500">Run a scenario in the Live Demo to evaluate policy and generate verifiable receipts.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-border/80 bg-surface-card/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface/90 border-b border-border/70 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Decision</th>
                  <th className="p-3.5">Receipt ID</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Reason Code</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Explorer</th>
                  <th className="p-3.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {receipts.slice(0, 15).map((r) => {
                  const settlementTx = r.settlementTxSignature || r.paymentTxSignature || r.txSignature;
                  const anchorTx = r.onChainTxSignature || r.anchorTxSignature;

                  return (
                    <tr key={r.receiptId} className="hover:bg-surface/50 transition-colors">
                      <td className="p-3.5">
                        <StatusChip status={r.decision} />
                      </td>
                      <td className="p-3.5 font-semibold text-white">{r.receiptId}</td>
                      <td className="p-3.5 text-slate-200">{formatAmountUSDC(r.amount)}</td>
                      <td className="p-3.5 text-slate-400 max-w-[200px] truncate">
                        {r.reasonCodes?.[0] || 'NONE'}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(r.issuedAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3.5">
                        {settlementTx ? (
                          <div className="flex flex-col gap-0.5">
                            <a
                              href={`https://explorer.solana.com/tx/${settlementTx}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 underline inline-flex items-center gap-1 font-semibold text-xs"
                            >
                              <span>Explorer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {anchorTx && anchorTx !== settlementTx && (
                              <a
                                href={`https://explorer.solana.com/tx/${anchorTx}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 text-[10px]"
                              >
                                <span>Anchor Memo</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : anchorTx ? (
                          <a
                            href={`https://explorer.solana.com/tx/${anchorTx}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1 font-semibold text-xs"
                          >
                            <span>Anchor Memo</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          href={`/verify?receiptId=${r.receiptId}`}
                          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Verify</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
};

'use client';

import React, { useEffect, useRef } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { StandardWalletEntry } from '../lib/wallet-standard';
import {
  Wallet,
  X,
  ExternalLink,
  Smartphone,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: StandardWalletEntry[];
  onSelectWallet: (walletName: string) => Promise<any>;
  isConnecting: boolean;
  error?: string | null;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  wallets,
  onSelectWallet,
  isConnecting,
  error,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://credaver.network';
  const phantomDeepLink = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-surface-card border border-border/80 rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-in"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 id="wallet-modal-title" className="text-base font-bold text-white">
                Connect Solana Wallet
              </h2>
              <p className="text-xs text-muted">
                Wallet Standard (Solana Devnet)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error notification if any */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Wallets list */}
        {wallets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-mono text-slate-400 mb-2">Detected Wallets:</p>
            {wallets.map((w) => (
              <button
                key={w.name}
                type="button"
                disabled={isConnecting}
                onClick={() => onSelectWallet(w.name)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-surface hover:bg-surface-elevated border border-border/70 hover:border-cyan-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  {w.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.icon}
                      alt={w.name}
                      className="w-7 h-7 rounded-lg object-contain bg-surface-card p-0.5 border border-border/40"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-surface-card flex items-center justify-center text-cyan-400 font-bold text-xs border border-border/40">
                      {w.name[0]}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors block">
                      {w.name}
                    </span>
                    <span className="text-[11px] font-mono text-muted">
                      {w.name === 'Phantom' ? 'Recommended' : 'Wallet Standard'}
                    </span>
                  </div>
                </div>

                {w.name === 'Phantom' && (
                  <Badge variant="cyan" className="font-mono text-[10px] px-2 py-0.5">
                    Primary
                  </Badge>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-surface/80 border border-amber-500/30 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white flex items-center gap-1.5 text-amber-300">
                <AlertCircle className="w-4 h-4" /> No Solana Wallets Detected
              </p>
              <p className="text-muted leading-relaxed">
                We couldn&apos;t detect any compatible Solana browser extension (Phantom, Solflare, or Backpack). Please install an extension or open in mobile:
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-semibold text-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Install Phantom Extension</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-cyan-400/80" />
              </a>

              <a
                href={phantomDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-surface hover:bg-surface-elevated border border-border/80 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
              >
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>Open in Phantom Mobile App</span>
                <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-500" />
              </a>
            </div>

            <div className="pt-2 border-t border-border/40 text-center text-xs text-muted">
              Also supported:{' '}
              <a
                href="https://solflare.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                Solflare
              </a>{' '}
              and{' '}
              <a
                href="https://backpack.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                Backpack
              </a>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-3 border-t border-border/40 text-[11px] font-mono text-slate-400 text-center">
          CredaVer never requests custody of your private keys.
        </div>
      </div>
    </div>
  );
};

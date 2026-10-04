import React from 'react';
import Link from 'next/link';
import { Shield, Github, BookOpen, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border/70 bg-surface-muted/60 mt-16 py-12 text-sm">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight">
                Creda<span className="text-gradient">Ver</span> Network
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                Solana Devnet
              </span>
            </div>
            <p className="text-xs text-muted max-w-md leading-relaxed">
              Cryptographic authorization layer between autonomous AI agents and Solana wallets.
              Scoped, revocable mandates with verifiable receipts for x402 payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-mono text-muted-foreground">
            <Link
              href="https://github.com/credaver-network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 focus-visible:text-cyan-400"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            <Link
              href="/docs"
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 focus-visible:text-cyan-400"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Documentation</span>
            </Link>
            <Link
              href="/verify"
              className="hover:text-cyan-400 transition-colors flex items-center gap-1.5 focus-visible:text-cyan-400"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Verify Receipts</span>
            </Link>
          </div>
        </div>

        <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 font-mono">
          <p>
            CredaVer is a deterministic Policy Decision Point (PDP). Policy evaluation is deterministic code; AI never grants itself authority.
          </p>
          <p className="shrink-0">
            Devnet only • Free test tokens • Throwaway keys
          </p>
        </div>
      </div>
    </footer>
  );
};

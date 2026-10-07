import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Github, BookOpen, ExternalLink, Play, Lock, FileCheck2, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border/70 bg-surface-muted/60 mt-16 py-12 text-sm">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/brand/credaver-mark-transparent.png"
                alt="CredaVer Network"
                width={24}
                height={24}
                className="h-6 w-auto object-contain"
              />
              <span className="font-bold text-base text-white tracking-tight">
                Creda<span className="text-gradient">Ver</span> Network
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                Solana Devnet
              </span>
            </div>
            <p className="text-xs text-muted max-w-md leading-relaxed">
              Cryptographic authorization layer between autonomous AI agents and Solana wallets.
              Scoped, revocable mandates with deterministic policy gates and verifiable receipts for x402 payments.
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="font-bold text-slate-300 uppercase tracking-wider mb-2">Protocol & App</div>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <Link href="/demo" className="hover:text-cyan-400 transition-colors">
                  Live Demo Runner
                </Link>
              </li>
              <li>
                <Link href="/mandates" className="hover:text-cyan-400 transition-colors">
                  Operator Mandates
                </Link>
              </li>
              <li>
                <Link href="/receipts" className="hover:text-cyan-400 transition-colors">
                  Signed Receipts
                </Link>
              </li>
              <li>
                <Link href="/concepts" className="hover:text-cyan-400 transition-colors">
                  Core Concepts
                </Link>
              </li>
              <li>
                <Link href="/early-access" className="hover:text-cyan-400 transition-colors">
                  Early Access
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="font-bold text-slate-300 uppercase tracking-wider mb-2">Verification & Docs</div>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <Link href="/proof" className="hover:text-cyan-400 transition-colors">
                  On-Chain Proof
                </Link>
              </li>
              <li>
                <Link href="/verify" className="hover:text-cyan-400 transition-colors">
                  Verify Receipts
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-cyan-400 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="https://github.com/Solking-crpto/credaver-network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </li>
            </ul>
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

'use client';

import React from 'react';
import Link from 'next/link';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

export const Navigation: React.FC = () => {
  const {
    publicKey,
    isConnected,
    isConnecting,
    isAuthenticated,
    connect,
    disconnect,
    authenticateWithChallenge,
  } = usePhantomWallet();

  const truncate = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-credav-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Header with slot for drop-in logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            {/* Logo Slot: checks for /brand/credaver-mark.png, falls back to styled cybernetic wordmark */}
            <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center font-black text-credav-bg text-lg shadow-glow group-hover:scale-105 transition-transform bg-gradient-to-tr from-credav-cyan via-credav-blue to-credav-violet">
              {/* If credaver-mark.png exists, this img displays; on error it falls back to C */}
              <img
                src="/brand/credaver-mark.png"
                alt="CredaVer"
                className="w-full h-full object-cover hidden"
                onLoad={(e) => (e.currentTarget.className = 'w-full h-full object-cover block')}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              <span className="select-none">C</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-white group-hover:text-credav-cyan transition-colors">
                Creda<span className="text-gradient">Ver</span>
              </span>
              <span className="text-[10px] text-credav-muted font-mono tracking-wider uppercase -mt-1">
                Network
              </span>
            </div>
          </Link>
          <Badge variant="cyan" className="ml-2 hidden sm:inline-flex">
            Devnet
          </Badge>
          <span className="text-xs text-slate-500 font-mono hidden md:inline">
            Policy Decision Point
          </span>
        </div>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link href="/#mandates" className="hover:text-credav-cyan transition-colors">
            Agent Mandates
          </Link>
          <Link href="/#receipts" className="hover:text-credav-cyan transition-colors">
            Receipts
          </Link>
          <Link href="/verify" className="hover:text-credav-cyan text-emerald-400 font-semibold transition-colors flex items-center gap-1">
            <span>⚓</span> Verify Anchor
          </Link>
          <Link href="/#spikes" className="hover:text-credav-cyan transition-colors">
            Technical Spikes
          </Link>
        </nav>

        {/* Wallet Connect & Auth Controls */}
        <div className="flex items-center gap-3">
          {isConnected && publicKey ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-mono text-slate-200">{truncate(publicKey)}</div>
                <div className="text-[10px] text-credav-muted font-mono">
                  {isAuthenticated ? (
                    <span className="text-emerald-400">● Challenge Verified</span>
                  ) : (
                    <span className="text-amber-400">● Unverified Challenge</span>
                  )}
                </div>
              </div>

              {!isAuthenticated && (
                <Button size="sm" variant="outline" onClick={authenticateWithChallenge}>
                  Sign Challenge
                </Button>
              )}

              <Button size="sm" variant="ghost" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={connect}
              isLoading={isConnecting}
            >
              Connect Phantom
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

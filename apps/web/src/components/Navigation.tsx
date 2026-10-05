'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';
import { useApp } from '../context/AppContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Menu, X, Shield, ExternalLink, Wallet, Copy, Check } from 'lucide-react';
import { shortenAddress } from '../lib/wallet-standard';
import clsx from 'clsx';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const {
    publicKey,
    isConnected,
    isConnecting,
    isAuthenticated,
    openModal,
    disconnect,
    authenticateWithChallenge,
  } = useWallet();

  const { pendingReviewReceipt } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/demo', label: 'Demo' },
    { href: '/mandates', label: 'Mandates' },
    { href: '/receipts', label: 'Receipts' },
    { href: '/reviews', label: 'Reviews', hasBadge: !!pendingReviewReceipt },
    { href: '/proof', label: 'Proof' },
    { href: '/verify', label: 'Verify' },
    { href: '/docs', label: 'Docs' },
  ];

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="sticky top-0 z-50 transition-colors">
      {/* Slim site-wide Devnet notice */}
      <div className="bg-surface-elevated/95 border-b border-border/70 py-1.5 px-4 text-center text-xs font-mono text-slate-300 flex items-center justify-center gap-2 backdrop-blur-md">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span>Devnet only: test tokens, no real funds</span>
      </div>

      <header className="glass-panel border-b border-border/80">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo in rounded tile */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
              aria-label="CredaVer Network Home"
            >
              {/* Rounded tile containing logo so dark background looks intentional */}
              <div className="hidden sm:flex items-center justify-center px-3 py-1.5 rounded-xl border border-border/80 bg-surface/90 shadow-sm group-hover:border-cyan-500/50 transition-colors">
                <Image
                  src="/brand/credaver-logo-full.png"
                  alt="CredaVer Network"
                  width={140}
                  height={36}
                  priority
                  className="h-8 w-auto object-contain rounded"
                />
              </div>

              {/* Mobile mark in rounded tile */}
              <div className="flex sm:hidden items-center justify-center p-1.5 rounded-xl border border-border/80 bg-surface/90 shadow-sm group-hover:border-cyan-500/50 transition-colors">
                <Image
                  src="/brand/credaver-mark.png"
                  alt="CredaVer Network"
                  width={32}
                  height={32}
                  priority
                  className="h-7 w-7 object-contain rounded"
                />
              </div>
            </Link>

            <Badge variant="cyan" className="hidden xl:inline-flex text-[11px] font-mono">
              Devnet
            </Badge>
          </div>

          {/* Desktop Navigation Links with active-link highlight */}
          <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2 text-sm font-medium" aria-label="Main Navigation">
            {navLinks.map((link) => {
              const active = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'transition-colors focus-visible:text-accent-cyan focus-visible:outline-none rounded-lg px-2.5 py-1.5 text-xs xl:text-sm font-medium relative flex items-center gap-1.5',
                    active
                      ? 'text-accent-cyan bg-surface-card border border-border/90 font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-surface-card/60'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <span>{link.label}</span>
                  {link.hasBadge && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Pending reviews in queue" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side controls */}
          <div className="hidden lg:flex items-center gap-3">
            {isConnected && publicKey ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border/80">
                  <span className="text-xs font-mono text-slate-200">
                    {shortenAddress(publicKey)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    title="Copy address"
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-surface-card transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
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
                onClick={openModal}
                isLoading={isConnecting}
                className="shadow-glow min-h-[40px] px-4"
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                <span>Connect Wallet</span>
              </Button>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <Badge variant="cyan" className="text-[10px] font-mono px-1.5 py-0.5">
              Devnet
            </Badge>
            <button
              type="button"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-surface-card border border-border/60 focus-visible:ring-2 focus-visible:ring-accent-cyan touch-target flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer / Overlay Menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 top-[110px] z-40 bg-credav-bg/95 backdrop-blur-xl lg:hidden border-t border-border flex flex-col p-6 space-y-6 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            <nav className="flex flex-col space-y-2 text-base font-medium text-slate-200">
              {navLinks.map((link) => {
                const active = isLinkActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'py-2.5 px-3 rounded-lg transition-colors flex items-center justify-between',
                      active
                        ? 'bg-surface-card text-accent-cyan font-semibold border border-border'
                        : 'hover:bg-surface-card hover:text-accent-cyan'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span>{link.label}</span>
                    {link.hasBadge && (
                      <Badge variant="amber" className="text-[10px] font-mono">
                        Action Required
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-border/80 flex flex-col gap-3">
              {isConnected && publicKey ? (
                <div className="space-y-3">
                  <div className="p-3 bg-surface-card rounded-lg border border-border text-xs font-mono">
                    <div className="text-slate-400">Connected Wallet:</div>
                    <div className="text-white font-bold truncate">{publicKey}</div>
                    <div className="mt-1 text-[11px]">
                      {isAuthenticated ? (
                        <span className="text-emerald-400">● Challenge Verified</span>
                      ) : (
                        <span className="text-amber-400">● Unverified Challenge</span>
                      )}
                    </div>
                  </div>
                  {!isAuthenticated && (
                    <Button
                      variant="outline"
                      className="w-full justify-center min-h-[44px]"
                      onClick={() => {
                        authenticateWithChallenge();
                        setMobileMenuOpen(false);
                      }}
                    >
                      Sign Challenge
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-center min-h-[44px]"
                    onClick={() => {
                      disconnect();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Disconnect Wallet
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  className="w-full justify-center min-h-[44px]"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openModal();
                  }}
                  isLoading={isConnecting}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  <span>Connect Wallet</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
};

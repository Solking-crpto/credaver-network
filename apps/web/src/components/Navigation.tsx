'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePhantomWallet } from '../hooks/usePhantomWallet';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Menu, X, Shield, ExternalLink, Wallet } from 'lucide-react';

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const truncate = (key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`;

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
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/#live-demo', label: 'Live demo' },
    { href: '/#on-chain-proof', label: 'On-chain proof' },
    { href: '/verify', label: 'Verify' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border/80 transition-colors">
      <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand & Devnet Badge */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
            aria-label="CredaVer Network Home"
          >
            {/* Desktop Full Logo at h-12 with rounded-lg */}
            <div className="hidden sm:block">
              <Image
                src="/brand/credaver-logo-full.png"
                alt="CredaVer Network"
                width={180}
                height={48}
                priority
                className="h-12 w-auto object-contain rounded-lg group-hover:opacity-90 transition-opacity"
              />
            </div>

            {/* Mobile Mark at h-10 with rounded-lg */}
            <div className="block sm:hidden">
              <Image
                src="/brand/credaver-mark.png"
                alt="CredaVer Network"
                width={40}
                height={40}
                priority
                className="h-10 w-10 object-contain rounded-lg group-hover:scale-105 transition-transform"
              />
            </div>
          </Link>

          <Badge variant="cyan" className="hidden sm:inline-flex text-[11px] font-mono">
            Devnet
          </Badge>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300" aria-label="Main Navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-accent-cyan transition-colors focus-visible:text-accent-cyan focus-visible:outline-none rounded px-1 py-0.5"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="hidden md:flex items-center gap-3">
          {isConnected && publicKey ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs font-mono text-slate-200">{truncate(publicKey)}</div>
                <div className="text-[10px] text-muted font-mono">
                  {isAuthenticated ? (
                    <span className="text-emerald-400">● Verified</span>
                  ) : (
                    <span className="text-amber-400">● Unverified</span>
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
              className="shadow-glow min-h-[40px] px-4"
            >
              <Wallet className="w-4 h-4 mr-1.5" />
              <span>Connect Phantom</span>
            </Button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
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
          className="fixed inset-0 top-18 z-40 bg-credav-bg/95 backdrop-blur-xl md:hidden border-t border-border flex flex-col p-6 space-y-6"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
        >
          <nav className="flex flex-col space-y-4 text-base font-medium text-slate-200">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-3 rounded-lg hover:bg-surface-card hover:text-accent-cyan transition-colors"
              >
                {link.label}
              </Link>
            ))}
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
                  connect();
                  setMobileMenuOpen(false);
                }}
                isLoading={isConnecting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                <span>Connect Phantom</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

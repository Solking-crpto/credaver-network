import React from 'react';
import type { Metadata } from 'next';
import '../styles/globals.css';
import { Navigation } from '../components/Navigation';

function getMetadataBase(): URL {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    const formatted =
      envUrl.startsWith('http://') || envUrl.startsWith('https://')
        ? envUrl
        : `https://${envUrl}`;
    try {
      return new URL(formatted);
    } catch {
      // fallback
    }
  }
  return new URL('https://credaver.network');
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: 'CredaVer Network | Agent Mandates & Authorization Gateway',
  description:
    'Cryptographic authorization layer between AI agents and Solana wallets. Scoped, revocable mandates with verifiable receipts for x402 payments.',
  icons: {
    icon: [
      { url: '/brand/favicon.ico' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/brand/favicon.ico',
    apple: [
      { url: '/brand/favicon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'CredaVer Network | Agent Mandates & Authorization Gateway',
    description:
      'Cryptographic authorization layer between AI agents and Solana wallets. Scoped, revocable mandates with verifiable receipts for x402 payments.',
    url: '/',
    siteName: 'CredaVer Network',
    images: [
      {
        url: '/brand/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CredaVer Network',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CredaVer Network | Agent Mandates & Authorization Gateway',
    description:
      'Cryptographic authorization layer between AI agents and Solana wallets. Scoped, revocable mandates with verifiable receipts for x402 payments.',
    images: ['/brand/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-credav-bg text-slate-100 antialiased selection:bg-credav-cyan selection:text-credav-bg">
        <div className="min-h-screen flex flex-col">
          <Navigation />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-credav-border/50 py-6 text-center text-xs text-slate-500 font-mono">
            <p>
              CredaVer Network — Built for Crypto World&apos;s Fair (Colosseum Hackathon) • Solana Devnet
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Notice: CredaVer is a Policy Decision Point. All demo funds and simulated merchants are strictly on Solana devnet.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}

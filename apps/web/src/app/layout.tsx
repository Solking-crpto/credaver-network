import React from 'react';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

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
    <html lang="en" className={`dark ${fontSans.variable} ${fontMono.variable}`}>
      <body className="bg-credav-bg text-slate-100 antialiased font-sans selection:bg-credav-cyan selection:text-credav-bg min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-content w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

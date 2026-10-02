'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
    toBytes(): Uint8Array;
  };
  isConnected: boolean;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  on(event: string, handler: (args: any) => void): void;
  removeListener(event: string, handler: (args: any) => void): void;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

export function usePhantomWallet() {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
      if (p) {
        setProvider(p);
        if (p.isConnected && p.publicKey) {
          setPublicKey(p.publicKey.toString());
        }
      }
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const p =
        provider ||
        (typeof window !== 'undefined'
          ? window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null)
          : null);

      if (!p) {
        throw new Error('Phantom wallet is not detected. Please install Phantom from phantom.app');
      }

      setProvider(p);
      const resp = await p.connect();
      const pubkeyStr = resp.publicKey.toString();
      setPublicKey(pubkeyStr);
      return pubkeyStr;
    } catch (err: any) {
      setError(err?.message || 'Failed to connect wallet');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    if (provider) {
      await provider.disconnect();
    }
    setPublicKey(null);
    setIsAuthenticated(false);
  }, [provider]);

  const signMessage = useCallback(
    async (message: Uint8Array | string): Promise<{ signature: Uint8Array }> => {
      if (!provider || !publicKey) {
        throw new Error('Wallet not connected');
      }

      const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
      return provider.signMessage(msgBytes, 'utf8');
    },
    [provider, publicKey]
  );

  const authenticateWithChallenge = useCallback(async () => {
    if (!publicKey) {
      await connect();
    }
    const currentPubkey = publicKey;
    if (!currentPubkey) throw new Error('No public key available');

    // 1. Request challenge from CredaVer server
    const challengeRes = await fetch(`/api/auth/challenge?pubkey=${encodeURIComponent(currentPubkey)}`);
    if (!challengeRes.ok) {
      throw new Error('Failed to obtain authentication challenge');
    }
    const challengeData = await challengeRes.json();

    // 2. Sign challenge using Phantom
    const challengeBytes = new TextEncoder().encode(challengeData.challenge);
    const { signature } = await signMessage(challengeBytes);

    // Convert signature Uint8Array to base58 or hex
    let sigBase64 = '';
    for (let i = 0; i < signature.length; i++) {
      sigBase64 += String.fromCharCode(signature[i]);
    }
    const signatureBase64 = btoa(sigBase64);

    // 3. Verify server-side
    const verifyRes = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: currentPubkey,
        signatureBase64,
        challenge: challengeData.challenge,
        nonce: challengeData.nonce,
      }),
    });

    if (!verifyRes.ok) {
      const errJson = await verifyRes.json();
      throw new Error(errJson.error || 'Server signature verification failed');
    }

    setIsAuthenticated(true);
    return true;
  }, [publicKey, connect, signMessage]);

  return {
    provider,
    publicKey,
    isConnected: !!publicKey,
    isConnecting,
    isAuthenticated,
    error,
    connect,
    disconnect,
    signMessage,
    authenticateWithChallenge,
  };
}

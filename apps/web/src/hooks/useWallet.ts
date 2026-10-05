'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';
import {
  getAvailableWallets,
  connectStandardWallet,
  disconnectStandardWallet,
  signStandardMessage,
  StandardWalletEntry,
  STORAGE_KEY_WALLET,
} from '../lib/wallet-standard';

export interface UseWalletState {
  wallets: StandardWalletEntry[];
  connectedWallet: Wallet | null;
  connectedAccount: WalletAccount | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  error: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (walletName?: string, silent?: boolean) => Promise<string>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array | string) => Promise<{ signature: Uint8Array }>;
  authenticateWithChallenge: () => Promise<boolean>;
}

export function useWallet(): UseWalletState {
  const [wallets, setWallets] = useState<StandardWalletEntry[]>([]);
  const [connectedWallet, setConnectedWallet] = useState<Wallet | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<WalletAccount | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Avoid multiple auto-connect attempts
  const autoConnectAttempted = useRef(false);

  const refreshWallets = useCallback(() => {
    const available = getAvailableWallets();
    setWallets(available);
    return available;
  }, []);

  // Initialize wallet standard registry and auto-reconnect from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const available = refreshWallets();

    // Listen for dynamically registered or unregistered wallets
    let unregisterFn: (() => void) | undefined;
    try {
      const walletsApi = getWallets();
      const offRegister = walletsApi.on('register', () => {
        refreshWallets();
      });
      const offUnregister = walletsApi.on('unregister', () => {
        refreshWallets();
      });
      unregisterFn = () => {
        offRegister();
        offUnregister();
      };
    } catch {
      // ignore
    }

    // Silent auto-reconnect on page reload
    if (!autoConnectAttempted.current) {
      autoConnectAttempted.current = true;
      try {
        const savedName = localStorage.getItem(STORAGE_KEY_WALLET);
        if (savedName) {
          const matched = available.find((w) => w.name.toLowerCase() === savedName.toLowerCase());
          if (matched) {
            connectStandardWallet(matched.rawWallet, true)
              .then(({ account, address }) => {
                setConnectedWallet(matched.rawWallet);
                setConnectedAccount(account);
                setPublicKey(address);
              })
              .catch((err) => {
                console.debug('[CredaVer] Silent reconnect not authorized:', err?.message);
              });
          }
        }
      } catch {
        // ignore
      }
    }

    return () => {
      if (unregisterFn) unregisterFn();
    };
  }, [refreshWallets]);

  // Listen to standard:events on the active connected wallet
  useEffect(() => {
    if (!connectedWallet) return;
    const eventsFeature = connectedWallet.features['standard:events'] as any;
    if (!eventsFeature || typeof eventsFeature.on !== 'function') return;

    try {
      const unsubscribe = eventsFeature.on('change', ({ accounts }: { accounts?: readonly WalletAccount[] }) => {
        if (accounts) {
          if (accounts.length === 0) {
            // Disconnected by wallet
            setConnectedWallet(null);
            setConnectedAccount(null);
            setPublicKey(null);
            try {
              localStorage.removeItem(STORAGE_KEY_WALLET);
            } catch {
              // ignore
            }
          } else {
            // Switched active account
            setConnectedAccount(accounts[0]);
            setPublicKey(accounts[0].address);
          }
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    } catch {
      // ignore
    }
  }, [connectedWallet]);

  const openModal = useCallback(() => {
    refreshWallets();
    setIsModalOpen(true);
  }, [refreshWallets]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const connect = useCallback(
    async (walletName?: string, silent: boolean = false): Promise<string> => {
      setIsConnecting(true);
      setError(null);
      try {
        const currentWallets = getAvailableWallets();
        setWallets(currentWallets);

        let target: Wallet | undefined;
        if (walletName) {
          const match = currentWallets.find(
            (w) => w.name.toLowerCase() === walletName.toLowerCase()
          );
          if (match) target = match.rawWallet;
        } else if (currentWallets.length > 0) {
          target = currentWallets[0].rawWallet;
        }

        if (!target) {
          setIsModalOpen(true);
          throw new Error('No Solana wallet detected. Please select or install a wallet.');
        }

        const { account, address } = await connectStandardWallet(target, silent);
        setConnectedWallet(target);
        setConnectedAccount(account);
        setPublicKey(address);
        setIsModalOpen(false);
        return address;
      } catch (err: any) {
        setError(err.message || 'Failed to connect wallet');
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    []
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const disconnect = useCallback(async () => {
    if (connectedWallet) {
      await disconnectStandardWallet(connectedWallet);
    }
    setConnectedWallet(null);
    setConnectedAccount(null);
    setPublicKey(null);
    setIsAuthenticated(false);
  }, [connectedWallet]);

  const signMessage = useCallback(
    async (message: Uint8Array | string): Promise<{ signature: Uint8Array }> => {
      if (!connectedWallet || !connectedAccount) {
        throw new Error('Wallet is not connected');
      }

      const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
      const signature = await signStandardMessage(connectedWallet, connectedAccount, msgBytes);
      return { signature };
    },
    [connectedWallet, connectedAccount]
  );

  const authenticateWithChallenge = useCallback(async () => {
    let currentPubkey = publicKey;
    if (!currentPubkey) {
      currentPubkey = await connect();
    }
    if (!currentPubkey) throw new Error('No public key available');

    // 1. Request challenge from CredaVer server
    const challengeRes = await fetch(`/api/auth/challenge?pubkey=${encodeURIComponent(currentPubkey)}`);
    if (!challengeRes.ok) {
      throw new Error('Failed to obtain authentication challenge');
    }
    const challengeData = await challengeRes.json();

    // 2. Sign challenge using standard wallet
    const challengeBytes = new TextEncoder().encode(challengeData.challenge);
    const { signature } = await signMessage(challengeBytes);

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
    wallets,
    connectedWallet,
    connectedAccount,
    publicKey,
    isConnected: !!publicKey,
    isConnecting,
    isAuthenticated,
    error,
    isModalOpen,
    openModal,
    closeModal,
    connect,
    disconnect,
    signMessage,
    authenticateWithChallenge,
  };
}

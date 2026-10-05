import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sortWallets,
  shortenAddress,
  connectStandardWallet,
  disconnectStandardWallet,
  signStandardMessage,
  STORAGE_KEY_WALLET,
} from './lib/wallet-standard';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

let storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete storage[key];
  }),
  clear: vi.fn(() => {
    storage = {};
  }),
};

describe('Wallet Standard Integration', () => {
  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('window', { localStorage: mockLocalStorage });
  });

  describe('sortWallets', () => {
    it('prioritizes Phantom, then Solflare, then Backpack, then alphabetical', () => {
      const mockWallets = [
        { name: 'Zeta Wallet' },
        { name: 'Solflare' },
        { name: 'Backpack' },
        { name: 'Alpha Wallet' },
        { name: 'Phantom' },
      ] as unknown as Wallet[];

      const sorted = sortWallets(mockWallets);
      expect(sorted.map((w) => w.name)).toEqual([
        'Phantom',
        'Solflare',
        'Backpack',
        'Alpha Wallet',
        'Zeta Wallet',
      ]);
    });
  });

  describe('shortenAddress', () => {
    it('shortens Solana base58 addresses cleanly', () => {
      const address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      expect(shortenAddress(address, 4)).toBe('Toke...Q5DA');
      expect(shortenAddress(address, 6)).toBe('Tokenk...3VQ5DA');
    });

    it('handles short or empty strings', () => {
      expect(shortenAddress('')).toBe('');
      expect(shortenAddress('abc')).toBe('abc');
    });
  });

  describe('connectStandardWallet', () => {
    it('connects successfully and sets localStorage', async () => {
      const mockAccount: WalletAccount = {
        address: 'DevnetOperatorPubkey1111111111111111111111111',
        publicKey: new Uint8Array(32),
        chains: ['solana:devnet'],
        features: ['solana:signMessage'],
      };

      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Phantom',
        icon: 'data:image/svg+xml;base64,mock',
        chains: ['solana:devnet'],
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: vi.fn().mockResolvedValue({ accounts: [mockAccount] }),
          },
        },
        accounts: [mockAccount],
      };

      const result = await connectStandardWallet(mockWallet);
      expect(result.address).toBe('DevnetOperatorPubkey1111111111111111111111111');
      expect(result.account).toBe(mockAccount);
      expect(localStorage.getItem(STORAGE_KEY_WALLET)).toBe('Phantom');
    });

    it('throws error when wallet does not support standard:connect', async () => {
      const mockWallet = {
        name: 'UnsupportedWallet',
        features: {},
      } as unknown as Wallet;

      await expect(connectStandardWallet(mockWallet)).rejects.toThrow(
        'Wallet "UnsupportedWallet" does not support standard:connect'
      );
    });

    it('throws error when connect returns no accounts', async () => {
      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Phantom',
        icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        chains: ['solana:devnet'],
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: vi.fn().mockResolvedValue({ accounts: [] }),
          },
        },
        accounts: [],
      };

      await expect(connectStandardWallet(mockWallet)).rejects.toThrow(
        'Wallet "Phantom" returned no accounts'
      );
    });

    it('propagates user rejection errors gracefully', async () => {
      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Solflare',
        icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        chains: ['solana:devnet'],
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: vi.fn().mockRejectedValue(new Error('User rejected connection')),
          },
        },
        accounts: [],
      };

      await expect(connectStandardWallet(mockWallet)).rejects.toThrow('User rejected connection');
    });
  });

  describe('disconnectStandardWallet', () => {
    it('calls disconnect on feature and clears localStorage', async () => {
      localStorage.setItem(STORAGE_KEY_WALLET, 'Phantom');
      const disconnectMock = vi.fn().mockResolvedValue(undefined);

      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Phantom',
        icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        chains: ['solana:devnet'],
        features: {
          'standard:disconnect': {
            version: '1.0.0',
            disconnect: disconnectMock,
          },
        },
        accounts: [],
      };

      await disconnectStandardWallet(mockWallet);
      expect(disconnectMock).toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY_WALLET)).toBeNull();
    });
  });

  describe('signStandardMessage', () => {
    it('signs message bytes and returns Uint8Array signature', async () => {
      const mockAccount: WalletAccount = {
        address: 'DevnetOperatorPubkey1111111111111111111111111',
        publicKey: new Uint8Array(32),
        chains: ['solana:devnet'],
        features: ['solana:signMessage'],
      };

      const mockSig = new Uint8Array(64).fill(7);
      const signMessageMock = vi.fn().mockResolvedValue([
        {
          signedMessage: new Uint8Array([1, 2, 3]),
          signature: mockSig,
        },
      ]);

      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Backpack',
        icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        chains: ['solana:devnet'],
        features: {
          'solana:signMessage': {
            version: '1.0.0',
            signMessage: signMessageMock,
          },
        },
        accounts: [mockAccount],
      };

      const messageToSign = new TextEncoder().encode('CredaVer Mandate v1\n{}');
      const sig = await signStandardMessage(mockWallet, mockAccount, messageToSign);

      expect(signMessageMock).toHaveBeenCalledWith({
        account: mockAccount,
        message: messageToSign,
      });
      expect(sig).toEqual(mockSig);
    });

    it('throws error when wallet does not support solana:signMessage', async () => {
      const mockAccount: WalletAccount = {
        address: 'SomeAddress',
        publicKey: new Uint8Array(32),
        chains: ['solana:devnet'],
        features: [],
      };

      const mockWallet = {
        name: 'OldWallet',
        features: {},
      } as unknown as Wallet;

      await expect(
        signStandardMessage(mockWallet, mockAccount, new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Wallet "OldWallet" does not support solana:signMessage');
    });

    it('throws error when wallet rejects signing', async () => {
      const mockAccount: WalletAccount = {
        address: 'SomeAddress',
        publicKey: new Uint8Array(32),
        chains: ['solana:devnet'],
        features: ['solana:signMessage'],
      };

      const mockWallet: Wallet = {
        version: '1.0.0',
        name: 'Phantom',
        icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        chains: ['solana:devnet'],
        features: {
          'solana:signMessage': {
            version: '1.0.0',
            signMessage: vi.fn().mockRejectedValue(new Error('User rejected signing')),
          },
        },
        accounts: [mockAccount],
      };

      await expect(
        signStandardMessage(mockWallet, mockAccount, new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('User rejected signing');
    });
  });
});

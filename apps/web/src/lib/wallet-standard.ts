import { getWallets } from '@wallet-standard/app';
import type { Wallet, WalletAccount } from '@wallet-standard/base';

export interface StandardWalletEntry {
  name: string;
  icon: string;
  rawWallet: Wallet;
}

export const STORAGE_KEY_WALLET = 'credav_connected_wallet_name';

/**
 * Priority order: Phantom first, then Solflare, then Backpack
 */
export function sortWallets(wallets: readonly Wallet[]): Wallet[] {
  const priorityOrder = ['Phantom', 'Solflare', 'Backpack'];

  return [...wallets].sort((a, b) => {
    const indexA = priorityOrder.indexOf(a.name);
    const indexB = priorityOrder.indexOf(b.name);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Returns registered wallets supporting Solana standard:connect and solana:signMessage
 */
export function getAvailableWallets(): StandardWalletEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const { get } = getWallets();
    const registered = get();

    const compatible = registered.filter((w) => {
      const hasConnect = 'standard:connect' in w.features;
      const hasSignMsg = 'solana:signMessage' in w.features;
      return hasConnect && hasSignMsg;
    });

    const sorted = sortWallets(compatible);

    return sorted.map((w) => ({
      name: w.name,
      icon: w.icon,
      rawWallet: w,
    }));
  } catch (err) {
    console.warn('[CredaVer] Error querying Wallet Standard registry:', err);
    return [];
  }
}

/**
 * Connects to a standard wallet
 */
export async function connectStandardWallet(
  wallet: Wallet,
  silent: boolean = false
): Promise<{ account: WalletAccount; address: string }> {
  const connectFeature = wallet.features['standard:connect'] as any;
  if (!connectFeature || typeof connectFeature.connect !== 'function') {
    throw new Error(`Wallet "${wallet.name}" does not support standard:connect`);
  }

  const { accounts } = await connectFeature.connect({ silent });
  if (!accounts || accounts.length === 0) {
    throw new Error(`Wallet "${wallet.name}" returned no accounts`);
  }

  const account = accounts[0];
  const address = account.address;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_WALLET, wallet.name);
    } catch {
      // ignore
    }
  }

  return { account, address };
}

/**
 * Disconnects from a standard wallet
 */
export async function disconnectStandardWallet(wallet: Wallet): Promise<void> {
  const disconnectFeature = wallet.features['standard:disconnect'] as any;
  if (disconnectFeature && typeof disconnectFeature.disconnect === 'function') {
    await disconnectFeature.disconnect();
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY_WALLET);
    } catch {
      // ignore
    }
  }
}

/**
 * Signs message bytes with a standard wallet account
 */
export async function signStandardMessage(
  wallet: Wallet,
  account: WalletAccount,
  message: Uint8Array
): Promise<Uint8Array> {
  const signFeature = wallet.features['solana:signMessage'] as any;
  if (!signFeature || typeof signFeature.signMessage !== 'function') {
    throw new Error(`Wallet "${wallet.name}" does not support solana:signMessage`);
  }

  const results = await signFeature.signMessage({
    account,
    message,
  });

  if (!results || results.length === 0 || !results[0].signature) {
    throw new Error('Wallet refused or failed to sign the message');
  }

  return results[0].signature;
}

/**
 * Helper to truncate a base58 address cleanly
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

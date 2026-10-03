import {
  MemoryStore,
  ICredaverStore,
  UpstashRedisStore,
  generateEd25519Keypair,
  decodeBase58,
  encodeBase58,
  createPrivateKeyFromRaw,
} from '@credaver/core';
import { createPublicKey } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Global singleton across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __credaverStore: ICredaverStore | undefined;
  // eslint-disable-next-line no-var
  var __credaverFallbackKey: string | undefined;
}

export function parseOrDeriveKeypair(
  secretKeyStr: string,
  explicitPubKey?: string
): { publicKey: string; secretKey: string } {
  let secretKey = secretKeyStr.trim();
  let secretBytes: Uint8Array;
  if (secretKey.startsWith('[') && secretKey.endsWith(']')) {
    secretBytes = new Uint8Array(JSON.parse(secretKey));
    secretKey = encodeBase58(secretBytes);
  } else {
    secretBytes = decodeBase58(secretKey);
  }

  let publicKey = explicitPubKey?.trim();
  if (!publicKey) {
    if (secretBytes.length >= 64) {
      publicKey = encodeBase58(secretBytes.slice(32, 64));
    } else if (secretBytes.length === 32) {
      const privKey = createPrivateKeyFromRaw(secretBytes);
      const pubKey = createPublicKey(privKey);
      const spkiDer = pubKey.export({ format: 'der', type: 'spki' });
      publicKey = encodeBase58(new Uint8Array(spkiDer.subarray(12)));
    }
  }

  return { publicKey: publicKey || '', secretKey };
}

export function getServerStore(): ICredaverStore {
  if (!globalThis.__credaverStore) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      globalThis.__credaverStore = new UpstashRedisStore({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          '[CredaVer Configuration Error] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in production. Silent in-memory fallback is disabled in production to guarantee multi-instance replay safety and audit persistence.'
        );
      }
      globalThis.__credaverStore = new MemoryStore();
    }
  }
  return globalThis.__credaverStore;
}

export function getServerPaymentKey(): string {
  if (process.env.DEVNET_PAYMENT_SECRET_KEY) {
    return process.env.DEVNET_PAYMENT_SECRET_KEY;
  }

  // Check root .devnet-payer.json if available
  const possiblePaths = [
    path.resolve(process.cwd(), '.devnet-payer.json'),
    path.resolve(process.cwd(), '../../.devnet-payer.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.secretKey) {
          return data.secretKey;
        }
      } catch {
        // Continue to fallback
      }
    }
  }

  // Fallback to ephemeral test key
  if (!globalThis.__credaverFallbackKey) {
    const ephemeral = generateEd25519Keypair();
    globalThis.__credaverFallbackKey = ephemeral.secretKey;
  }
  return globalThis.__credaverFallbackKey;
}

export function getServerPayerKeypair(): { publicKey: string; secretKey: string } {
  if (process.env.DEVNET_PAYMENT_SECRET_KEY) {
    return parseOrDeriveKeypair(
      process.env.DEVNET_PAYMENT_SECRET_KEY,
      process.env.DEVNET_PAYMENT_PUBLIC_KEY
    );
  }

  const possiblePaths = [
    path.resolve(process.cwd(), '.devnet-payer.json'),
    path.resolve(process.cwd(), '../../.devnet-payer.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (data.secretKey && data.publicKey) {
          return { publicKey: data.publicKey, secretKey: data.secretKey };
        }
      } catch {
        // Continue
      }
    }
  }

  const secretKey = getServerPaymentKey();
  return parseOrDeriveKeypair(
    secretKey,
    process.env.DEVNET_PAYMENT_PUBLIC_KEY || 'HnXPP38ctGbDqkfFrsr2B7y9DYLKmVZBiXLaiKMJomSS'
  );
}

export function getServerReceiptAuthorityKeypair(): { publicKey: string; secretKey: string } {
  if (process.env.RECEIPT_AUTHORITY_SECRET_KEY) {
    return parseOrDeriveKeypair(
      process.env.RECEIPT_AUTHORITY_SECRET_KEY,
      process.env.RECEIPT_AUTHORITY_PUBLIC_KEY
    );
  }
  return getServerPayerKeypair();
}

export function getServerAnchorKeypair(): { publicKey: string; secretKey: string } {
  if (process.env.ANCHOR_PAYER_SECRET_KEY) {
    return parseOrDeriveKeypair(
      process.env.ANCHOR_PAYER_SECRET_KEY,
      process.env.ANCHOR_PAYER_PUBLIC_KEY
    );
  }
  return getServerPayerKeypair();
}

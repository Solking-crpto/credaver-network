import { MemoryStore, ICredaverStore, UpstashRedisStore, generateEd25519Keypair } from '@credaver/core';
import fs from 'node:fs';
import path from 'node:path';

// Global singleton across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __credaverStore: ICredaverStore | undefined;
  // eslint-disable-next-line no-var
  var __credaverFallbackKey: string | undefined;
}

export function getServerStore(): ICredaverStore {
  if (!globalThis.__credaverStore) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      globalThis.__credaverStore = new UpstashRedisStore({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    } else {
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

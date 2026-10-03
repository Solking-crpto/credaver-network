import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './app/api/sign/route.js';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  createSignedPaymentProof,
  ReasonCode,
  verifyEd25519,
} from '@credaver/core';
import { getServerStore, getServerPaymentKey } from './lib/server-state.js';

describe('apps/web: POST /api/sign Constrained Signing Route', () => {
  let operator: ReturnType<typeof generateEd25519Keypair>;
  let agent: ReturnType<typeof generateEd25519Keypair>;
  let merchant: ReturnType<typeof generateEd25519Keypair>;
  const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const USDC_ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  beforeEach(() => {
    operator = generateEd25519Keypair();
    agent = generateEd25519Keypair();
    merchant = generateEd25519Keypair();
  });

  it('1. Returns 200 with Ed25519 signature when within policy cap', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-api-1',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-api-1',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const now = Date.now();
    const proof = createSignedPaymentProof(
      {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: USDC_ASSET,
        amount: '1000000', // 1 USDC
        audience: 'http://localhost:4020/api/weather',
        network: NETWORK,
        nonce: `nonce-${now}-1`,
        timestamp: now,
        expiresAt: now + 300000,
      },
      agent.secretKey
    );

    const mockTxMessage = new Uint8Array([1, 2, 3, 4, 5]);
    const b64TxMessage = Buffer.from(mockTxMessage).toString('base64');

    const req = new NextRequest('http://localhost:3000/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandateHash: mandate.mandateHash,
        proof,
        transactionMessageBytes: b64TxMessage,
        mandate,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.decision).toBe('ALLOW');
    expect(data.signature).toBeDefined();
    expect(data.receipt).toBeDefined();
    expect(data.receipt.decision).toBe('ALLOW');
  });

  it('2. Returns 403 DENY with reason code when payment exceeds cap', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-api-2',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '1000000', // 1 USDC max
        totalCap: '5000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-api-2',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const now = Date.now();
    const proof = createSignedPaymentProof(
      {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: USDC_ASSET,
        amount: '2000000', // 2 USDC violates 1 USDC cap
        audience: 'http://localhost:4020/api/weather',
        network: NETWORK,
        nonce: `nonce-${now}-2`,
        timestamp: now,
        expiresAt: now + 300000,
      },
      agent.secretKey
    );

    const mockTxMessage = new Uint8Array([6, 7, 8]);
    const b64TxMessage = Buffer.from(mockTxMessage).toString('base64');

    const req = new NextRequest('http://localhost:3000/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandateHash: mandate.mandateHash,
        proof,
        transactionMessageBytes: b64TxMessage,
        mandate,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.decision).toBe('DENY');
    expect(data.reasonCodes).toContain(ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT);
    expect(data.signature).toBeUndefined(); // Transaction NEVER signed
  });

  it('3. Returns 202 REVIEW when transaction triggers human review threshold', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-api-3',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '5000000',
        totalCap: '20000000',
        reviewThreshold: '2000000', // Review required for >= 2 USDC
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-api-3',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const now = Date.now();
    const proof = createSignedPaymentProof(
      {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: USDC_ASSET,
        amount: '2500000', // 2.5 USDC triggers review
        audience: 'http://localhost:4020/api/weather',
        network: NETWORK,
        nonce: `nonce-${now}-3`,
        timestamp: now,
        expiresAt: now + 300000,
      },
      agent.secretKey
    );

    const req = new NextRequest('http://localhost:3000/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandateHash: mandate.mandateHash,
        proof,
        transactionMessageBytes: Buffer.from(new Uint8Array([1, 2])).toString('base64'),
        mandate,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const data = await res.json();
    expect(data.decision).toBe('REVIEW');
    expect(data.reasonCodes).toContain(ReasonCode.HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW);
    expect(data.signature).toBeUndefined();
  });

  it('4. Enforces production fail-loud when Upstash credentials are missing in NODE_ENV=production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalStore = globalThis.__credaverStore;
    try {
      globalThis.__credaverStore = undefined;
      (process.env as any).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(() => getServerStore()).toThrowError(/Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in production/);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      globalThis.__credaverStore = originalStore;
    }
  });

  it('5. Rate limits rapid requests exceeding threshold returning 429', async () => {
    // Send 130 requests to trigger rate limit (configured for 120 per minute)
    let rateLimitedResponse = null;
    for (let i = 0; i < 130; i++) {
      const req = new NextRequest('http://localhost:3000/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.1', // Isolated test IP
        },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      if (res.status === 429) {
        rateLimitedResponse = res;
        break;
      }
    }

    expect(rateLimitedResponse).not.toBeNull();
    expect(rateLimitedResponse!.status).toBe(429);
    const data = await rateLimitedResponse!.json();
    expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(rateLimitedResponse!.headers.get('Retry-After')).toBeDefined();
  });
});

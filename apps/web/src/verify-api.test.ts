import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as verifyGetRoute, POST as verifyPostRoute } from './app/api/verify/route';
import { GET as authorityGetRoute } from './app/api/authority/route';
import { GET as receiptsGetRoute } from './app/api/receipts/route';
import {
  generateEd25519Keypair,
  issueSignedReceipt,
  SignedReceipt,
  SPL_MEMO_PROGRAM_ID,
} from '@credaver/core';
import { getServerStore, getServerReceiptAuthorityKeypair } from './lib/server-state';

describe('apps/web: /api/verify Verification Endpoints', () => {
  let operator: ReturnType<typeof generateEd25519Keypair>;
  let agent: ReturnType<typeof generateEd25519Keypair>;
  let merchant: ReturnType<typeof generateEd25519Keypair>;
  let receipt: SignedReceipt;

  beforeEach(async () => {
    operator = generateEd25519Keypair();
    agent = generateEd25519Keypair();
    merchant = generateEd25519Keypair();

    const authority = getServerReceiptAuthorityKeypair();

    receipt = issueSignedReceipt(
      {
        receiptId: `rcpt-test-verify-${Date.now()}`,
        mandateHash: 'a'.repeat(64),
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: `nonce-${Date.now()}`,
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: authority.publicKey,
      },
      authority.secretKey
    );

    const store = getServerStore();
    await store.saveReceipt(receipt);
  });

  it('1. GET /api/verify?receiptId=<id> verifies stored receipt', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/verify?receiptId=${receipt.receiptId}`
    );
    const res = await verifyGetRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.type).toBe('RECEIPT');
    expect(data.receipt.receiptId).toBe(receipt.receiptId);
    expect(data.verification.badges.hashMatches).toBe(true);
    expect(data.verification.badges.authorityValid).toBe(true);
  });

  it('2. POST /api/verify verifies direct JSON receipt payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt }),
    });
    const res = await verifyPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.type).toBe('RECEIPT');
    expect(data.verification.badges.hashMatches).toBe(true);
    expect(data.verification.badges.authorityValid).toBe(true);
  });

  it('3. GET /api/verify returns 404 for non-existent receiptId', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/verify?receiptId=non-existent-9999'
    );
    const res = await verifyGetRoute(req);
    expect(res.status).toBe(404);

    const data = await res.json();
    expect(data.error).toBe('RECEIPT_NOT_FOUND');
  });

  it('4. GET /api/verify returns 400 when missing query parameters', async () => {
    const req = new NextRequest('http://localhost:3000/api/verify');
    const res = await verifyGetRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('MISSING_PARAM');
  });

  it('5. POST /api/verify inspects on-chain transaction signature and links receipt', async () => {
    const mockTx = {
      slot: 506955056,
      blockTime: 1727950000,
      transaction: {
        message: {
          instructions: [
            {
              program: 'spl-memo',
              programId: SPL_MEMO_PROGRAM_ID,
              parsed: `credav:1:aaaaaaaa:${receipt.receiptHash}:ALLOW`,
            },
          ],
        },
      },
    };

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: mockTx }),
    })) as any;

    try {
      const req = new NextRequest('http://localhost:3000/api/verify', {
        method: 'POST',
        body: JSON.stringify({ txSignature: 'mockTxSignature123' }),
      });
      const res = await verifyPostRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.type).toBe('TRANSACTION');
      expect(data.onChain.isValid).toBe(true);
      expect(data.onChain.slot).toBe(506955056);
      expect(data.linkedReceipt).toBeDefined();
      expect(data.linkedReceipt.receiptId).toBe(receipt.receiptId);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('6. GET /api/authority returns configured CredaVer authority public key', async () => {
    const res = await authorityGetRoute();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.authorityPubkey).toBeDefined();
    expect(data.status).toBe('ACTIVE');
    expect(data.algorithm).toBe('Ed25519');
  });

  it('7. Flags receipt signed by a random key as UNKNOWN SIGNER', async () => {
    const randomAuthority = generateEd25519Keypair();
    const randomReceipt = issueSignedReceipt(
      {
        receiptId: `rcpt-test-random-${Date.now()}`,
        mandateHash: 'b'.repeat(64),
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: 'USDC',
        amount: '500000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: `nonce-random-${Date.now()}`,
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: randomAuthority.publicKey,
      },
      randomAuthority.secretKey
    );

    const req = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt: randomReceipt }),
    });
    const res = await verifyPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.verification.isValid).toBe(false);
    expect(data.verification.signerStatus).toBe('UNKNOWN SIGNER');
    expect(data.verification.badges.isConfiguredAuthority).toBe(false);
    expect(data.verification.badges.authorityValid).toBe(true);
    expect(data.verification.error).toContain('UNKNOWN SIGNER');
  });

  it('8. Flow "Verify my latest receipt": fetches from /api/receipts and verifies against deployment authority', async () => {
    // Save a fresh deployment receipt to store
    const authority = getServerReceiptAuthorityKeypair();
    const cleanReceipt = issueSignedReceipt(
      {
        receiptId: `rcpt-test-verify-latest-${Date.now()}`,
        mandateHash: 'c'.repeat(64),
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: `nonce-latest-${Date.now()}`,
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now() + 5000,
        authorityPubkey: authority.publicKey,
      },
      authority.secretKey
    );
    const store = getServerStore();
    await store.saveReceipt(cleanReceipt);

    // 1. Fetch latest receipt from /api/receipts
    const listReq = new NextRequest('http://localhost:3000/api/receipts');
    const listRes = await receiptsGetRoute(listReq);
    expect(listRes.status).toBe(200);

    const listData = await listRes.json();
    expect(listData.receipts).toBeDefined();
    expect(listData.receipts.length).toBeGreaterThan(0);

    // Pick the most recent receipt
    const latestReceipt = listData.receipts.sort(
      (a: any, b: any) => (b.issuedAt || 0) - (a.issuedAt || 0)
    )[0];
    expect(latestReceipt.receiptId).toBe(cleanReceipt.receiptId);

    // 2. Post to /api/verify
    const verifyReq = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt: latestReceipt }),
    });
    const verifyRes = await verifyPostRoute(verifyReq);
    expect(verifyRes.status).toBe(200);

    const verifyData = await verifyRes.json();
    expect(verifyData.type).toBe('RECEIPT');
    expect(verifyData.verification.isValid).toBe(true);
    expect(verifyData.verification.signerStatus).toBe('SIGNED BY CREDAVER AUTHORITY');
    expect(verifyData.verification.badges.isConfiguredAuthority).toBe(true);
    expect(verifyData.verification.badges.hashMatches).toBe(true);
    expect(verifyData.verification.badges.authorityValid).toBe(true);
  });

  it('9. Tampered receipt fails with hash mismatch and isValid: false', async () => {
    const listRes = await receiptsGetRoute(new NextRequest('http://localhost:3000/api/receipts'));
    const listData = await listRes.json();
    const original = listData.receipts[0];

    // Tamper with the amount field without re-signing
    const tampered = { ...original, amount: '999999999' };

    const verifyReq = new NextRequest('http://localhost:3000/api/verify', {
      method: 'POST',
      body: JSON.stringify({ receipt: tampered }),
    });
    const verifyRes = await verifyPostRoute(verifyReq);
    expect(verifyRes.status).toBe(200);

    const verifyData = await verifyRes.json();
    expect(verifyData.verification.isValid).toBe(false);
    expect(verifyData.verification.badges.hashMatches).toBe(false);
    expect(verifyData.verification.error).toContain('Receipt hash mismatch');
  });
});


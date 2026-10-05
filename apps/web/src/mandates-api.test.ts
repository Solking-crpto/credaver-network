import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createMandateRoute, GET as listMandatesRoute } from './app/api/mandates/route';
import { GET as getMandateDetailRoute } from './app/api/mandates/[id]/route';
import { POST as revokeMandateRoute } from './app/api/mandates/[id]/revoke/route';
import { GET as listReceiptsRoute } from './app/api/receipts/route';
import { GET as getReceiptDetailRoute } from './app/api/receipts/[id]/route';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  issueSignedReceipt,
  computeMandateHash,
  getMandateSigningBytes,
  signEd25519,
  ReasonCode,
} from '@credaver/core';
import { getServerStore } from './lib/server-state';

describe('apps/web: Mandates & Receipts REST API Endpoints', () => {
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

  it('1. POST /api/mandates creates valid mandate; GET /api/mandates lists it', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-rest-1',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '1500000',
        totalCap: '8000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}-1`,
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    // POST /api/mandates
    const createReq = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mandate),
    });

    const createRes = await createMandateRoute(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.mandate.mandateId).toBe('mandate-rest-1');

    // GET /api/mandates
    const listReq = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'GET',
    });
    const listRes = await listMandatesRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    const foundMandate = listData.mandates.find((m: any) => m.mandateId === 'mandate-rest-1');
    expect(foundMandate).toBeDefined();
    expect(foundMandate.currentSpend).toBe('0');

    // Record 1.00 USDC spend against mandate and confirm GET /api/mandates reflects it
    const store = getServerStore();
    await store.recordMandateSpend('mandate-rest-1', 1000000n);
    const listResAfterSpend = await listMandatesRoute(listReq);
    const listDataAfterSpend = await listResAfterSpend.json();
    const updatedMandate = listDataAfterSpend.mandates.find((m: any) => m.mandateId === 'mandate-rest-1');
    expect(updatedMandate.currentSpend).toBe('1000000');
  });

  it('2. GET /api/mandates/[id] returns mandate details; returns 404 for unknown', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-detail-test',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: ['*'],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}-2`,
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const store = getServerStore();
    await store.saveMandate(mandate);

    // Found
    const req = new NextRequest('http://localhost:3000/api/mandates/mandate-detail-test');
    const res = await getMandateDetailRoute(req, {
      params: Promise.resolve({ id: 'mandate-detail-test' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mandate.mandateId).toBe('mandate-detail-test');
    expect(data.currentSpend).toBe('0');

    // Not Found
    const unknownReq = new NextRequest('http://localhost:3000/api/mandates/non-existent');
    const unknownRes = await getMandateDetailRoute(unknownReq, {
      params: Promise.resolve({ id: 'non-existent' }),
    });
    expect(unknownRes.status).toBe(404);
  });

  it('3. POST /api/mandates/[id]/revoke revokes the mandate immediately', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-to-revoke',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}-3`,
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const store = getServerStore();
    await store.saveMandate(mandate);

    // Revoke
    const revokeReq = new NextRequest('http://localhost:3000/api/mandates/mandate-to-revoke/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Security compromise' }),
    });

    const revokeRes = await revokeMandateRoute(revokeReq, {
      params: Promise.resolve({ id: 'mandate-to-revoke' }),
    });
    expect(revokeRes.status).toBe(200);
    const revokeData = await revokeRes.json();
    expect(revokeData.success).toBe(true);
    expect(revokeData.mandate.revoked).toBe(true);
    expect(revokeData.mandate.revokedReason).toBe('Security compromise');

    // Confirm store has revoked status
    const fetched = await store.getMandate('mandate-to-revoke');
    expect(fetched?.revoked).toBe(true);
  });

  it('4. GET /api/receipts and /api/receipts/[id]', async () => {
    const store = getServerStore();
    const receipt = issueSignedReceipt(
      {
        receiptId: 'receipt-api-test-1',
        mandateHash: 'b'.repeat(64),
        agentPubkey: agent.publicKey,
        merchantPubkey: merchant.publicKey,
        asset: USDC_ASSET,
        amount: '1000000',
        network: NETWORK,
        nonce: 'nonce-api-r1',
        decision: 'ALLOW',
        reasonCodes: [ReasonCode.POLICY_PASSED_ALL_GATES],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: operator.publicKey,
      },
      operator.secretKey
    );

    await store.saveReceipt(receipt);

    // List receipts
    const listReq = new NextRequest('http://localhost:3000/api/receipts');
    const listRes = await listReceiptsRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.receipts.some((r: any) => r.receiptId === 'receipt-api-test-1')).toBe(true);

    // Get detail
    const detailReq = new NextRequest('http://localhost:3000/api/receipts/receipt-api-test-1');
    const detailRes = await getReceiptDetailRoute(detailReq, {
      params: Promise.resolve({ id: 'receipt-api-test-1' }),
    });
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.receipt.receiptId).toBe('receipt-api-test-1');
    expect(detailData.receipt.decision).toBe('ALLOW');
  });

  it('5. POST /api/mandates accepts mandate signed with readable CredaVer Mandate v1 prefix', async () => {
    const core = {
      mandateId: 'mandate-readable-prefix-1',
      operatorPubkey: operator.publicKey,
      agentPubkey: agent.publicKey,
      allowedMerchants: ['*'],
      allowedAssets: [USDC_ASSET],
      maxPerTx: '1000000',
      totalCap: '5000000',
      validFrom: Date.now() - 1000,
      expiresAt: Date.now() + 3600000,
      nonce: `nonce-read-${Date.now()}`,
      network: NETWORK,
    };
    const mandateHash = computeMandateHash(core);
    const signBytes = getMandateSigningBytes(core);
    const operatorSignature = signEd25519(signBytes, operator.secretKey);
    const agentCounterSignature = signEd25519(signBytes, agent.secretKey);

    const validMandate = {
      ...core,
      mandateHash,
      operatorSignature,
      agentCounterSignature,
      revoked: false,
    };

    const req = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validMandate),
    });

    const res = await createMandateRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.mandate.mandateId).toBe('mandate-readable-prefix-1');
  });

  it('6. POST /api/mandates rejects wrong signer (imposter operator key)', async () => {
    const imposter = generateEd25519Keypair();
    const core = {
      mandateId: 'mandate-imposter-test',
      operatorPubkey: operator.publicKey, // claims to be operator
      agentPubkey: agent.publicKey,
      allowedMerchants: ['*'],
      allowedAssets: [USDC_ASSET],
      maxPerTx: '1000000',
      totalCap: '5000000',
      validFrom: Date.now() - 1000,
      expiresAt: Date.now() + 3600000,
      nonce: `nonce-imposter-${Date.now()}`,
      network: NETWORK,
    };
    const mandateHash = computeMandateHash(core);
    const signBytes = getMandateSigningBytes(core);
    // Imposter signs instead of operator
    const invalidOperatorSig = signEd25519(signBytes, imposter.secretKey);
    const agentCounterSignature = signEd25519(signBytes, agent.secretKey);

    const imposterMandate = {
      ...core,
      mandateHash,
      operatorSignature: invalidOperatorSig,
      agentCounterSignature,
      revoked: false,
    };

    const req = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imposterMandate),
    });

    const res = await createMandateRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('INVALID_MANDATE_SIGNATURES');
  });

  it('7. POST /api/mandates rejects tampered fields (e.g. modified totalCap or mandateHash)', async () => {
    const core = {
      mandateId: 'mandate-tamper-test',
      operatorPubkey: operator.publicKey,
      agentPubkey: agent.publicKey,
      allowedMerchants: ['*'],
      allowedAssets: [USDC_ASSET],
      maxPerTx: '1000000',
      totalCap: '5000000',
      validFrom: Date.now() - 1000,
      expiresAt: Date.now() + 3600000,
      nonce: `nonce-tamper-${Date.now()}`,
      network: NETWORK,
    };
    const mandateHash = computeMandateHash(core);
    const signBytes = getMandateSigningBytes(core);
    const operatorSignature = signEd25519(signBytes, operator.secretKey);
    const agentCounterSignature = signEd25519(signBytes, agent.secretKey);

    // Case 7a: totalCap tampered from 5,000,000 to 999,999,999 without updating hash
    const tamperedCoreMandate = {
      ...core,
      totalCap: '999999999',
      mandateHash,
      operatorSignature,
      agentCounterSignature,
      revoked: false,
    };

    const reqA = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedCoreMandate),
    });

    const resA = await createMandateRoute(reqA);
    expect(resA.status).toBe(400);
    const dataA = await resA.json();
    expect(dataA.error).toBe('INVALID_MANDATE_SIGNATURES');
    expect(dataA.message).toContain('Mandate hash mismatch');

    // Case 7b: Attacker updates hash to match tampered totalCap, but signature is now invalid
    const tamperedCore = { ...core, totalCap: '999999999' };
    const forgedHash = computeMandateHash(tamperedCore);
    const tamperedHashMandate = {
      ...tamperedCore,
      mandateHash: forgedHash,
      operatorSignature, // Old signature over original core!
      agentCounterSignature,
      revoked: false,
    };

    const reqB = new NextRequest('http://localhost:3000/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedHashMandate),
    });

    const resB = await createMandateRoute(reqB);
    expect(resB.status).toBe(400);
    const dataB = await resB.json();
    expect(dataB.error).toBe('INVALID_MANDATE_SIGNATURES');
    expect(dataB.message).toContain('Invalid operator signature');
  });
});

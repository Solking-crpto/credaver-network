import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  createDemoMerchantApp,
  MERCHANT_WALLET,
  SOLANA_DEVNET_GENESIS,
  DEVNET_USDC_MINT,
} from './server.js';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  MemoryStore,
} from '@credaver/core';
import {
  createCredaverClientPolicy,
  CredaverAgentGuard,
} from '@credaver/x402-guard';

describe('S1 x402 on Devnet: Express Server + Client Policy Round Trip', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createDemoMerchantApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. GET /health returns 200 with SIMULATED merchant notice', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.simulated).toBe(true);
    expect(json.wallet).toBe(MERCHANT_WALLET);
  });

  it('2. GET /api/weather without payment returns 402 with PAYMENT-REQUIRED header', async () => {
    const res = await fetch(`${baseUrl}/api/weather`);
    expect(res.status).toBe(402);

    const paymentRequiredHeader =
      res.headers.get('payment-required') || res.headers.get('PAYMENT-REQUIRED');
    expect(paymentRequiredHeader).toBeDefined();

    const decoded = JSON.parse(
      Buffer.from(paymentRequiredHeader!, 'base64').toString('utf8')
    );

    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toBeInstanceOf(Array);
    expect(decoded.accepts[0].scheme).toBe('exact');
    expect(decoded.accepts[0].network).toBe(SOLANA_DEVNET_GENESIS);
    expect(decoded.accepts[0].payTo).toBe(MERCHANT_WALLET);
    expect(decoded.accepts[0].asset).toBe(DEVNET_USDC_MINT);
    expect(decoded.accepts[0].amount).toBe('1000000'); // 1 USDC
  });

  it('3. Round Trip: CredaVer Client Policy intercepts 402, verifies Mandate, generates proof & settles with 200 and PAYMENT-RESPONSE', async () => {
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair();
    const store = new MemoryStore();

    // Operator issues signed mandate authorizing payments to this merchant
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s1-test',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [MERCHANT_WALLET],
        allowedAssets: [DEVNET_USDC_MINT],
        maxPerTx: '2000000', // 2 USDC max
        totalCap: '10000000', // 10 USDC total
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-mandate-s1',
        network: SOLANA_DEVNET_GENESIS,
      },
      operator.secretKey,
      agent.secretKey
    );

    const guard = new CredaverAgentGuard({
      mandate,
      agentSecretKey: agent.secretKey,
      store,
    });

    // Step A: Initial call gets 402
    const initialRes = await fetch(`${baseUrl}/api/weather`);
    expect(initialRes.status).toBe(402);
    const headerB64 = initialRes.headers.get('payment-required')!;
    const paymentRequired = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));

    // Step B: Apply CredaVer client policy filter
    const policy = guard.getPolicy();
    const compliantRequirements = policy(paymentRequired.x402Version, paymentRequired.accepts);
    expect(compliantRequirements).toHaveLength(1);
    const req = compliantRequirements[0];

    // Step C: Pre-authorize with CredaVer guard
    const authResult = await guard.preAuthorizePayment({
      merchantPubkey: req.payTo,
      asset: req.asset,
      amount: req.amount,
      audience: `${baseUrl}/api/weather`,
    });

    expect(authResult.allowed).toBe(true);
    expect(authResult.decision).toBe('ALLOW');
    expect(authResult.receipt.receiptHash).toBeDefined();

    // Step D: Construct payment signature payload
    const paymentPayload = {
      x402Version: 2,
      scheme: req.scheme,
      network: req.network,
      payTo: req.payTo,
      amount: req.amount,
      asset: req.asset,
      signature: authResult.receipt.authoritySignature,
      mandateHash: mandate.mandateHash,
      receiptHash: authResult.receipt.receiptHash,
    };

    const paymentSigHeader = Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString(
      'base64'
    );

    // Step E: Retry request with PAYMENT-SIGNATURE
    const paidRes = await fetch(`${baseUrl}/api/weather`, {
      headers: {
        'Payment-Signature': paymentSigHeader,
      },
    });

    expect(paidRes.status).toBe(200);

    // Step F: Verify PAYMENT-RESPONSE header
    const paymentResponseHeader =
      paidRes.headers.get('payment-response') || paidRes.headers.get('PAYMENT-RESPONSE');
    expect(paymentResponseHeader).toBeDefined();

    const responseData = JSON.parse(
      Buffer.from(paymentResponseHeader!, 'base64').toString('utf8')
    );
    expect(responseData.x402Version).toBe(2);
    expect(responseData.success).toBe(true);
    expect(responseData.txSignature).toBeDefined();

    // Verify paid resource payload
    const body = await paidRes.json();
    expect(body.success).toBe(true);
    expect(body.data.city).toBe('Lagos');
  });

  it('4. Rejection: CredaVer Client Policy blocks payment when merchant is not in mandate', async () => {
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair();
    const store = new MemoryStore();

    // Mandate only allows a different merchant
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s1-block',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: ['OtherMerchant9999999999999999999999999999'],
        allowedAssets: [DEVNET_USDC_MINT],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-mandate-s1-block',
        network: SOLANA_DEVNET_GENESIS,
      },
      operator.secretKey,
      agent.secretKey
    );

    const guard = new CredaverAgentGuard({
      mandate,
      agentSecretKey: agent.secretKey,
      store,
    });

    const res = await fetch(`${baseUrl}/api/weather`);
    const paymentRequired = JSON.parse(
      Buffer.from(res.headers.get('payment-required')!, 'base64').toString('utf8')
    );

    // Policy filters out unauthorized merchant
    const compliant = guard.getPolicy()(paymentRequired.x402Version, paymentRequired.accepts);
    expect(compliant).toHaveLength(0); // Safely halted before payment
  });
});

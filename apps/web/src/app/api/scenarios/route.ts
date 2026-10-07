export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  createSignedPaymentProof,
  evaluateAndSignTransaction,
  ReasonCode,
  SignedReceipt,
} from '@credaver/core';
import {
  getServerStore,
  getServerPayerKeypair,
  getServerReceiptAuthorityKeypair,
  getServerAnchorKeypair,
} from '../../../lib/server-state';
import { checkRateLimit, checkRedisRateLimit, getClientIp } from '../../../lib/rate-limit';
import {
  checkDevnetPayerBalance,
  checkFacilitatorHealth,
  executeRealDevnetPayment,
} from '../../../lib/real-devnet-payment';
import { getOrCreateSessionId, attachSessionCookie } from '../../../lib/session';

import { z } from 'zod';

export type ScenarioType =
  | 'ALLOW'
  | 'OVER_CAP'
  | 'REVOKED'
  | 'EXPIRED'
  | 'REPLAY'
  | 'REVIEW'
  | 'REAL_DEVNET';

const ScenarioBodySchema = z.object({
  scenario: z.enum([
    'ALLOW',
    'OVER_CAP',
    'REVOKED',
    'EXPIRED',
    'REPLAY',
    'REVIEW',
    'REAL_DEVNET',
  ]),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const rawBody = await req.json();
    const parseResult = ScenarioBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_SCENARIO_REQUEST',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { scenario } = parseResult.data;
    const store = getServerStore();
    const payerKeypair = getServerPayerKeypair();
    const authorityKeypair = getServerReceiptAuthorityKeypair();
    const anchorKeypair = getServerAnchorKeypair();

    const { sessionId, isNew } = getOrCreateSessionId(req);
    const sendResponse = (body: any, init?: { status?: number }) => {
      const res = NextResponse.json(body, init);
      if (isNew) {
        attachSessionCookie(res, sessionId);
      }
      return res;
    };

    const baseSignOptions = {
      store,
      paymentSecretKey: payerKeypair.secretKey,
      payerPubkey: payerKeypair.publicKey,
      authoritySecretKey: authorityKeypair.secretKey,
      authorityPubkey: authorityKeypair.publicKey,
      anchorSecretKey: anchorKeypair.secretKey,
      anchorPubkey: anchorKeypair.publicKey,
      anchorOnChain: false,
    };

    const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
    const USDC_ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair();
    const merchant = generateEd25519Keypair();

    // 1. SCENARIO: ALLOW
    if (scenario === 'ALLOW') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-allow-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '5000000',
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-allow`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000', // 1.0 USDC
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-allow`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      signResult.receipt.sessionId = sessionId;
      await store.saveReceipt(signResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'ALLOW',
        statusCode: 200,
        decision: signResult.decision,
        latencyMs,
        details: 'Policy passed all 12 deterministic gates. Transaction signed and spend recorded.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 2. SCENARIO: OVER_CAP (Exceeds Per-Tx Limit)
    if (scenario === 'OVER_CAP') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-cap-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000', // 2.0 USDC max per tx
          totalCap: '10000000', // 10.0 USDC total cap
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-cap`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      // Attempt to spend 3.0 USDC (exceeds maxPerTx of 2.0 USDC)
      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '3000000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-cap`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      signResult.receipt.sessionId = sessionId;
      await store.saveReceipt(signResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'OVER_CAP',
        statusCode: 403,
        decision: signResult.decision,
        latencyMs,
        reasonCodes: signResult.receipt.reasonCodes,
        details: 'Requested payment exceeds per-transaction limit ($3.00 > $2.00 max). Transaction signature refused with AMOUNT_EXCEEDS_PER_TX.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 3. SCENARIO: REVOKED
    if (scenario === 'REVOKED') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-rev-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '5000000',
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-rev`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      // Explicitly revoke
      await store.revokeMandate(mandate.mandateId, 'Operator emergency revocation');
      const revokedMandate = await store.getMandate(mandate.mandateId);

      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-rev`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate: revokedMandate!,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      signResult.receipt.sessionId = sessionId;
      await store.saveReceipt(signResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'REVOKED',
        statusCode: 403,
        decision: signResult.decision,
        latencyMs,
        reasonCodes: signResult.receipt.reasonCodes,
        details: 'Mandate was explicitly revoked by operator. Fails closed immediately.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 4. SCENARIO: EXPIRED
    if (scenario === 'EXPIRED') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-exp-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '5000000',
          validFrom: Date.now() - 7200000,
          expiresAt: Date.now() - 60000, // Expired 1 minute ago
          nonce: `nonce-${Date.now()}-exp`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-exp`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      signResult.receipt.sessionId = sessionId;
      await store.saveReceipt(signResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'EXPIRED',
        statusCode: 403,
        decision: signResult.decision,
        latencyMs,
        reasonCodes: signResult.receipt.reasonCodes,
        details: 'Mandate validity window has passed. Signature denied due to EXPIRED_MANDATE.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 5. SCENARIO: REPLAY
    if (scenario === 'REPLAY') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-rep-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '5000000',
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-rep`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      const fixedNonce = `nonce-replay-target-${Date.now()}`;
      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '500000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: fixedNonce,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      // First run succeeds
      await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      // Second identical run with the SAME nonce fails
      const replayResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      replayResult.receipt.sessionId = sessionId;
      await store.saveReceipt(replayResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'REPLAY',
        statusCode: 403,
        decision: replayResult.decision,
        latencyMs,
        reasonCodes: replayResult.receipt.reasonCodes,
        details: 'Identical proof nonce sent twice. Atomic SET NX EX rejected second attempt with REPLAY_DETECTED.',
        mandateId: mandate.mandateId,
        receipt: replayResult.receipt,
      });
    }

    // 6. SCENARIO: REVIEW
    if (scenario === 'REVIEW') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-revw-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: ['*'],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '5000000',
          totalCap: '10000000',
          reviewThreshold: '1000000', // Threshold is 1.0 USDC
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-revw`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey,
        sessionId,
        'demo'
      );
      await store.saveMandate(mandate);

      // Attempt payment of 2.5 USDC (exceeds reviewThreshold)
      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '2500000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-revw`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        ...baseSignOptions,
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
      });

      signResult.receipt.sessionId = sessionId;
      await store.saveReceipt(signResult.receipt);

      const latencyMs = Date.now() - startTime;
      return sendResponse({
        scenario: 'REVIEW',
        statusCode: 202,
        decision: signResult.decision,
        latencyMs,
        reasonCodes: signResult.receipt.reasonCodes,
        details: 'Amount exceeds review threshold. Held in pending reviews awaiting operator approval or rejection.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 7. SCENARIO: REAL_DEVNET (Live Devnet Settlement via Constrained Signer)
    if (scenario === 'REAL_DEVNET') {
      const clientIp = getClientIp(req);

      // Check global daily cap in Redis (40/day)
      const today = new Date().toISOString().slice(0, 10);
      const dailyCap = await checkRedisRateLimit(
        `rl:real_devnet:daily:${today}`,
        40,
        86400,
        'Daily limit for live devnet payments reached (40/day). Please try again tomorrow.'
      );
      if (!dailyCap.allowed) {
        return sendResponse(
          {
            error: 'RATE_LIMIT_EXCEEDED',
            message: dailyCap.message,
          },
          { status: 429 }
        );
      }

      // Check per-IP cap in Redis (5 requests per 60 seconds)
      const ipCap = await checkRedisRateLimit(
        `rl:real_devnet:ip:${clientIp}`,
        5,
        60,
        'Per-IP rate limit exceeded for live devnet payments (5 requests per minute). Please wait before trying again.'
      );
      if (!ipCap.allowed) {
        return sendResponse(
          {
            error: 'RATE_LIMIT_EXCEEDED',
            message: ipCap.message,
          },
          { status: 429 }
        );
      }

      // Check public facilitator health first
      const facHealth = await checkFacilitatorHealth();
      if (!facHealth.ok) {
        return sendResponse(
          {
            error: 'FACILITATOR_UNAVAILABLE',
            message:
              facHealth.error ||
              'The public x402 facilitator at https://x402.org/facilitator is unreachable or degraded.',
          },
          { status: 503 }
        );
      }

      // Check devnet RPC connectivity and server payer balance
      const balanceCheck = await checkDevnetPayerBalance();
      if (!balanceCheck.ok) {
        return sendResponse(
          {
            error: 'INSUFFICIENT_DEVNET_FUNDS',
            message:
              balanceCheck.error ||
              'Server payer wallet has insufficient devnet funds. Please fund with devnet SOL and USDC.',
            payerPubkey: balanceCheck.payerPubkey,
            explorerUrl: balanceCheck.explorerUrl,
          },
          { status: 503 }
        );
      }

      // Execute live settlement
      try {
        const paymentResult = await executeRealDevnetPayment({
          sessionId,
        });

        return sendResponse({
          scenario: 'REAL_DEVNET',
          statusCode: 200,
          decision: 'ALLOW',
          settlementStatus: 'SETTLED',
          latencyMs: paymentResult.latencyMs,
          details:
            'Real x402 payment settled on Solana Devnet via CredaVer Constrained Signer and official public facilitator.',
          txSignature: paymentResult.txSignature,
          explorerUrl: paymentResult.explorerUrl,
          mandateId: paymentResult.mandate.mandateId,
          receipt: paymentResult.receipt,
          payerPubkey: paymentResult.payerPubkey,
          merchantPubkey: paymentResult.merchantPubkey,
          resourceData: paymentResult.resourceData,
          anchorTxSignature: paymentResult.anchorTxSignature,
          anchorExplorerUrl: paymentResult.anchorExplorerUrl,
          anchorStatus: paymentResult.anchorStatus,
        });
      } catch (payErr: any) {
        if (payErr.settlementFailed) {
          return sendResponse(
            {
              scenario: 'REAL_DEVNET',
              statusCode: 502,
              error: 'SETTLEMENT_FAILED',
              decision: 'ALLOW',
              settlementStatus: 'FAILED',
              message: 'Policy allowed, settlement failed',
              details: payErr.message || 'Policy allowed, settlement failed',
              latencyMs: payErr.latencyMs,
              mandateId: payErr.mandate?.mandateId,
              receipt: payErr.receipt,
            },
            { status: 502 }
          );
        }
        throw payErr;
      }
    }

    return sendResponse(
      { error: 'UNKNOWN_SCENARIO', message: `Scenario "${scenario}" is not supported` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SCENARIO_RUN_ERROR', message: err.message || 'Error running scenario' },
      { status: 500 }
    );
  }
}

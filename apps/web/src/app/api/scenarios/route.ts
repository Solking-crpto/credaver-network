import { NextRequest, NextResponse } from 'next/server';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  createSignedPaymentProof,
  evaluateAndSignTransaction,
  ReasonCode,
  SignedReceipt,
} from '@credaver/core';
import { getServerStore, getServerPayerKeypair } from '../../../lib/server-state';

import { z } from 'zod';

export type ScenarioType =
  | 'ALLOW'
  | 'OVER_CAP'
  | 'REVOKED'
  | 'EXPIRED'
  | 'REPLAY'
  | 'REVIEW';

const ScenarioBodySchema = z.object({
  scenario: z.enum(['ALLOW', 'OVER_CAP', 'REVOKED', 'EXPIRED', 'REPLAY', 'REVIEW']),
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
        agent.secretKey
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
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
        payerPubkey: payerKeypair.publicKey,
        anchorOnChain: false, // Fast execution for dashboard demo
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
        scenario: 'ALLOW',
        statusCode: 200,
        decision: signResult.decision,
        latencyMs,
        details: 'Policy passed all 12 deterministic gates. Transaction signed and spend recorded.',
        mandateId: mandate.mandateId,
        receipt: signResult.receipt,
      });
    }

    // 2. SCENARIO: OVER_CAP
    if (scenario === 'OVER_CAP') {
      const mandate = issueSignedMandate(
        {
          mandateId: `mandate-sc-cap-${Date.now()}`,
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '5000000', // Cap is 5.0 USDC
          validFrom: Date.now() - 5000,
          expiresAt: Date.now() + 3600000,
          nonce: `nonce-${Date.now()}-cap`,
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey
      );
      await store.saveMandate(mandate);

      // Attempt to spend 6.0 USDC (exceeds cap)
      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '6000000',
          audience: 'https://demo-merchant.solana/api/service',
          network: NETWORK,
          nonce: `nonce-${Date.now()}-proof-cap`,
          timestamp: Date.now(),
          expiresAt: Date.now() + 300000,
        },
        agent.secretKey
      );

      const signResult = await evaluateAndSignTransaction({
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
        scenario: 'OVER_CAP',
        statusCode: 403,
        decision: signResult.decision,
        latencyMs,
        reasonCodes: signResult.receipt.reasonCodes,
        details: 'Requested payment exceeds total mandate cap. Transaction signature refused.',
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
        agent.secretKey
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
        mandate: revokedMandate!,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
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
        agent.secretKey
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
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
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
        agent.secretKey
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
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      // Second identical run with the SAME nonce fails
      const replayResult = await evaluateAndSignTransaction({
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
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
        agent.secretKey
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
        mandate,
        proof,
        transactionMessageBytes: Buffer.from('mock-svm-tx-message-bytes').toString('base64'),
        store,
        paymentSecretKey: payerKeypair.secretKey,
      });

      const latencyMs = Date.now() - startTime;
      return NextResponse.json({
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

    return NextResponse.json(
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

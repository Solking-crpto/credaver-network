import { z } from 'zod';
import { createPrivateKeyFromRaw, encodeBase58, decodeBase58 } from './crypto.js';
import { sign } from 'node:crypto';
import { SignedMandate } from './mandate.js';
import { SignedPaymentProof, SignedPaymentProofSchema } from './proof.js';
import { evaluatePaymentPolicy, PolicyDecisionType, ReasonCodeType } from './policy.js';
import { issueSignedReceipt, SignedReceipt } from './receipt.js';
import { ICredaverStore } from './store/index.js';

export const SignRequestSchema = z.object({
  mandateHash: z.string(),
  proof: SignedPaymentProofSchema,
  transactionMessageBytes: z.string().describe('Base64-encoded raw transaction message bytes'),
  mandate: z.any().optional().describe('Optional full SignedMandate if not already cached in store'),
});

export type SignRequest = z.infer<typeof SignRequestSchema>;

export interface SignResultAllow {
  decision: 'ALLOW';
  signature: string; // Base58 encoded 64-byte Ed25519 signature
  signatureBytes: Uint8Array;
  receipt: SignedReceipt;
}

export interface SignResultDeny {
  decision: 'DENY';
  reasonCodes: ReasonCodeType[];
  receipt: SignedReceipt;
}

export interface SignResultReview {
  decision: 'REVIEW';
  reasonCodes: ReasonCodeType[];
  receipt: SignedReceipt;
}

export type SignResult = SignResultAllow | SignResultDeny | SignResultReview;

export interface EvaluateAndSignOptions {
  mandate: SignedMandate;
  proof: SignedPaymentProof;
  transactionMessageBytes: Uint8Array | string;
  store: ICredaverStore;
  paymentSecretKey: Uint8Array | string;
  authoritySecretKey?: Uint8Array | string;
  authorityPubkey?: string;
  now?: number;
}

/**
 * Server-side CredaVer Decision & Constrained Signing Service.
 * Evaluates agent payment proof against active operator mandate.
 * ONLY signs transactionMessageBytes if policy returns ALLOW.
 */
export async function evaluateAndSignTransaction(
  options: EvaluateAndSignOptions
): Promise<SignResult> {
  const {
    mandate,
    proof,
    transactionMessageBytes,
    store,
    paymentSecretKey,
    authoritySecretKey,
    authorityPubkey,
    now = Date.now(),
  } = options;

  // 1. Evaluate policy across all 12 deterministic gates
  const evalResult = await evaluatePaymentPolicy(mandate, proof, store, {
    evaluationTimestamp: now,
  });

  const receiptBody = {
    receiptId: `rcpt-${now}-${Math.random().toString(36).slice(2, 8)}`,
    mandateHash: mandate.mandateHash,
    agentPubkey: mandate.agentPubkey,
    merchantPubkey: proof.merchantPubkey,
    asset: proof.asset,
    amount: proof.amount,
    network: mandate.network,
    nonce: proof.nonce,
    decision: evalResult.decision,
    reasonCodes: evalResult.reasonCodes,
    policyVersion: 'credav-v1.0',
    issuedAt: now,
    authorityPubkey: authorityPubkey ?? mandate.operatorPubkey,
  };

  const receiptSignKey = authoritySecretKey ?? paymentSecretKey;
  const signedReceipt = issueSignedReceipt(receiptBody, receiptSignKey);
  await store.saveReceipt(signedReceipt);

  // 2. Branch on decision
  if (evalResult.decision === 'ALLOW') {
    // Record cumulative spend against mandate in store
    await store.recordMandateSpend(mandate.mandateId, BigInt(proof.amount));

    // Sign the transaction message with the server-held payment private key
    const msgBytes =
      typeof transactionMessageBytes === 'string'
        ? Buffer.from(transactionMessageBytes, 'base64')
        : Buffer.from(transactionMessageBytes);

    const privBytes =
      typeof paymentSecretKey === 'string'
        ? decodeBase58(paymentSecretKey)
        : paymentSecretKey;

    const privKey = createPrivateKeyFromRaw(privBytes.slice(0, 32));
    const sigBuffer = sign(null, msgBytes, privKey);
    const signatureBytes = new Uint8Array(sigBuffer);
    const signature = encodeBase58(signatureBytes);

    return {
      decision: 'ALLOW',
      signature,
      signatureBytes,
      receipt: signedReceipt,
    };
  }

  if (evalResult.decision === 'REVIEW') {
    return {
      decision: 'REVIEW',
      reasonCodes: evalResult.reasonCodes,
      receipt: signedReceipt,
    };
  }

  return {
    decision: 'DENY',
    reasonCodes: evalResult.reasonCodes,
    receipt: signedReceipt,
  };
}

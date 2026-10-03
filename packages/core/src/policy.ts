import { SignedMandate, verifySignedMandate } from './mandate.js';
import { SignedPaymentProof, verifySignedPaymentProof } from './proof.js';
import { ICredaverStore } from './store/index.js';

export type PolicyDecisionType = 'ALLOW' | 'DENY' | 'REVIEW';

export const ReasonCode = {
  // DENY codes
  REVOKED_MANDATE: 'REVOKED_MANDATE',
  EXPIRED_MANDATE: 'EXPIRED_MANDATE',
  DEPLETED_MANDATE: 'DEPLETED_MANDATE',
  NOT_YET_VALID: 'NOT_YET_VALID',
  MANDATE_NOT_YET_VALID: 'NOT_YET_VALID', // Backward-compatible alias
  AGENT_MISMATCH: 'AGENT_MISMATCH',
  NETWORK_MISMATCH: 'NETWORK_MISMATCH',
  MERCHANT_NOT_ALLOWED: 'MERCHANT_NOT_ALLOWED',
  ASSET_NOT_ALLOWED: 'ASSET_NOT_ALLOWED',
  AMOUNT_EXCEEDS_PER_TX: 'AMOUNT_EXCEEDS_PER_TX',
  AMOUNT_EXCEEDS_PER_TX_LIMIT: 'AMOUNT_EXCEEDS_PER_TX', // Backward-compatible alias
  AMOUNT_EXCEEDS_CAP: 'AMOUNT_EXCEEDS_CAP',
  AMOUNT_EXCEEDS_TOTAL_CAP: 'AMOUNT_EXCEEDS_CAP', // Backward-compatible alias
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_AGENT_PROOF_SIGNATURE: 'INVALID_SIGNATURE', // Backward-compatible alias
  INVALID_PROOF: 'INVALID_PROOF',
  INVALID_MANDATE_INTEGRITY: 'INVALID_PROOF', // Backward-compatible alias
  REPLAY_DETECTED: 'REPLAY_DETECTED',
  NONCE_REPLAYED: 'REPLAY_DETECTED', // Backward-compatible alias
  OPERATOR_REJECTED: 'OPERATOR_REJECTED',

  // REVIEW codes
  AMOUNT_EXCEEDS_REVIEW_THRESHOLD: 'AMOUNT_EXCEEDS_REVIEW_THRESHOLD',
  HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW: 'AMOUNT_EXCEEDS_REVIEW_THRESHOLD', // Backward-compatible alias
  UNKNOWN_MERCHANT_REQUIRES_REVIEW: 'UNKNOWN_MERCHANT_REQUIRES_REVIEW',

  // ALLOW codes
  POLICY_PASSED_ALL_GATES: 'POLICY_PASSED_ALL_GATES',
} as const;

export type ReasonCodeType = (typeof ReasonCode)[keyof typeof ReasonCode];

export interface PolicyEvaluationResult {
  decision: PolicyDecisionType;
  reasonCodes: ReasonCodeType[];
  details?: string;
  currentSpend: string;
  remainingCap: string;
  evaluatedAt: number;
  mandateHash: string;
  proofHash?: string;
}

export interface EvaluatePolicyOptions {
  allowUnknownMerchantsForReview?: boolean;
  evaluationTimestamp?: number;
}

/**
 * Pure deterministic policy evaluation gate.
 * Evaluates an agent's payment proof against its operator mandate.
 */
export async function evaluatePaymentPolicy(
  mandate: SignedMandate,
  proof: SignedPaymentProof,
  store: ICredaverStore,
  options?: EvaluatePolicyOptions
): Promise<PolicyEvaluationResult> {
  const evaluatedAt = options?.evaluationTimestamp ?? Date.now();
  const reasons: ReasonCodeType[] = [];

  // 1. Verify Mandate Cryptographic Integrity
  const mandateVerify = verifySignedMandate(mandate);
  if (!mandateVerify.isValid) {
    return {
      decision: 'DENY',
      reasonCodes: [ReasonCode.INVALID_MANDATE_INTEGRITY],
      details: mandateVerify.error,
      currentSpend: '0',
      remainingCap: '0',
      evaluatedAt,
      mandateHash: mandate.mandateHash,
      proofHash: proof.proofHash,
    };
  }

  // 2. Check Mandate Revocation Status
  if (mandate.revoked) {
    reasons.push(ReasonCode.REVOKED_MANDATE);
  }

  // 3. Check Mandate Time Validity Window
  if (evaluatedAt < mandate.validFrom) {
    reasons.push(ReasonCode.MANDATE_NOT_YET_VALID);
  }
  if (evaluatedAt > mandate.expiresAt) {
    reasons.push(ReasonCode.EXPIRED_MANDATE);
  }

  // 4. Verify Request-Bound Payment Proof Signature
  const proofVerify = verifySignedPaymentProof(proof, evaluatedAt);
  if (!proofVerify.isValid) {
    reasons.push(ReasonCode.INVALID_AGENT_PROOF_SIGNATURE);
  }

  // 5. Verify Mandate Hash Binding
  if (proof.mandateHash !== mandate.mandateHash) {
    reasons.push(ReasonCode.INVALID_MANDATE_INTEGRITY);
  }

  // 6. Verify Agent Public Key Binding
  if (proof.agentPubkey.trim() !== mandate.agentPubkey.trim()) {
    reasons.push(ReasonCode.AGENT_MISMATCH);
  }

  // 7. Verify Network Binding
  if (proof.network.trim().toLowerCase() !== mandate.network.trim().toLowerCase()) {
    reasons.push(ReasonCode.NETWORK_MISMATCH);
  }

  // 8. Verify Asset Allowlist
  const normalizedAsset = proof.asset.trim().toLowerCase();
  const isAssetAllowed =
    mandate.allowedAssets.includes('*') ||
    mandate.allowedAssets.map((a) => a.trim().toLowerCase()).includes(normalizedAsset);
  if (!isAssetAllowed) {
    reasons.push(ReasonCode.ASSET_NOT_ALLOWED);
  }

  // 9. Verify Merchant Allowlist
  const normalizedMerchant = proof.merchantPubkey.trim();
  const isMerchantAllowed =
    mandate.allowedMerchants.includes('*') ||
    mandate.allowedMerchants.map((m) => m.trim()).includes(normalizedMerchant);

  let reviewNeededForMerchant = false;
  if (!isMerchantAllowed) {
    if (options?.allowUnknownMerchantsForReview) {
      reviewNeededForMerchant = true;
    } else {
      reasons.push(ReasonCode.MERCHANT_NOT_ALLOWED);
    }
  }

  // 10. Financial Cap Evaluations
  const requestedAmount = BigInt(proof.amount);
  const maxPerTx = BigInt(mandate.maxPerTx);
  const totalCap = BigInt(mandate.totalCap);

  if (requestedAmount > maxPerTx) {
    reasons.push(ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT);
  }

  const currentSpend = await store.getMandateSpend(mandate.mandateId);
  const projectedSpend = currentSpend + requestedAmount;
  const remainingCapBig = totalCap > currentSpend ? totalCap - currentSpend : 0n;

  if (currentSpend >= totalCap) {
    reasons.push(ReasonCode.DEPLETED_MANDATE);
  }
  if (projectedSpend > totalCap) {
    reasons.push(ReasonCode.AMOUNT_EXCEEDS_CAP);
  }

  // 11. Check Replay Protection (Consume Nonce)
  const ttlSeconds = Math.max(60, Math.ceil((proof.expiresAt - evaluatedAt) / 1000) + 60);
  const nonceConsumed = await store.consumeNonce(proof.nonce, ttlSeconds);
  if (!nonceConsumed) {
    reasons.push(ReasonCode.NONCE_REPLAYED);
  }

  // If any hard denial condition occurred, return DENY immediately
  if (reasons.length > 0) {
    return {
      decision: 'DENY',
      reasonCodes: reasons,
      currentSpend: currentSpend.toString(),
      remainingCap: remainingCapBig.toString(),
      evaluatedAt,
      mandateHash: mandate.mandateHash,
      proofHash: proof.proofHash,
    };
  }

  // 12. Check REVIEW Thresholds
  let reviewNeededForAmount = false;
  if (mandate.reviewThreshold) {
    const threshold = BigInt(mandate.reviewThreshold);
    if (requestedAmount >= threshold) {
      reviewNeededForAmount = true;
    }
  }

  if (reviewNeededForMerchant || reviewNeededForAmount) {
    const reviewReasons: ReasonCodeType[] = [];
    if (reviewNeededForMerchant) {
      reviewReasons.push(ReasonCode.UNKNOWN_MERCHANT_REQUIRES_REVIEW);
    }
    if (reviewNeededForAmount) {
      reviewReasons.push(ReasonCode.HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW);
    }
    return {
      decision: 'REVIEW',
      reasonCodes: reviewReasons,
      currentSpend: currentSpend.toString(),
      remainingCap: remainingCapBig.toString(),
      evaluatedAt,
      mandateHash: mandate.mandateHash,
      proofHash: proof.proofHash,
    };
  }

  // 13. All gates passed -> ALLOW
  return {
    decision: 'ALLOW',
    reasonCodes: [ReasonCode.POLICY_PASSED_ALL_GATES],
    currentSpend: currentSpend.toString(),
    remainingCap: remainingCapBig.toString(),
    evaluatedAt,
    mandateHash: mandate.mandateHash,
    proofHash: proof.proofHash,
  };
}

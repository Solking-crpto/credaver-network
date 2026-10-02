import { z } from 'zod';
import { canonicalizeJson, hashCanonicalJson } from './canonical.js';
import { verifyEd25519, signEd25519 } from './crypto.js';

export const PaymentProofCoreSchema = z.object({
  mandateHash: z.string().length(64, 'mandateHash must be a 64-char sha256 hex string'),
  agentPubkey: z.string().min(32, 'agentPubkey must be valid Solana/Ed25519 public key'),
  merchantPubkey: z.string().min(1, 'merchantPubkey is required'),
  asset: z.string().min(1, 'asset identifier is required'),
  amount: z.string().regex(/^\d+$/, 'amount must be a positive integer in base units'),
  audience: z.string().min(1, 'audience URI/endpoint is required'),
  network: z.string().min(1, 'network is required (e.g. solana:devnet)'),
  nonce: z.string().min(8, 'nonce must be at least 8 characters'),
  timestamp: z.number().int().positive('timestamp ms required'),
  expiresAt: z.number().int().positive('expiresAt ms required'),
});

export type PaymentProofCore = z.infer<typeof PaymentProofCoreSchema>;

export const SignedPaymentProofSchema = PaymentProofCoreSchema.extend({
  proofHash: z.string().length(64),
  signature: z.string().min(64),
});

export type SignedPaymentProof = z.infer<typeof SignedPaymentProofSchema>;

export function computeProofHash(core: PaymentProofCore): string {
  const validated = PaymentProofCoreSchema.parse(core);
  return hashCanonicalJson(validated);
}

/**
 * Creates and signs a request-bound payment proof
 */
export function createSignedPaymentProof(
  core: PaymentProofCore,
  agentSecretKey: string | Uint8Array
): SignedPaymentProof {
  const validated = PaymentProofCoreSchema.parse(core);
  const proofHash = computeProofHash(validated);
  const canonicalBytes = Buffer.from(canonicalizeJson(validated), 'utf8');
  const signature = signEd25519(canonicalBytes, agentSecretKey);

  return SignedPaymentProofSchema.parse({
    ...validated,
    proofHash,
    signature,
  });
}

export interface ProofVerificationResult {
  isValid: boolean;
  error?: string;
  proofHash?: string;
}

/**
 * Verifies request-bound payment proof signature and schema
 */
export function verifySignedPaymentProof(proof: unknown, now: number = Date.now()): ProofVerificationResult {
  const parsed = SignedPaymentProofSchema.safeParse(proof);
  if (!parsed.success) {
    return {
      isValid: false,
      error: `Proof schema validation failed: ${parsed.error.message}`,
    };
  }

  const p = parsed.data;
  if (p.expiresAt < now) {
    return {
      isValid: false,
      error: `Payment proof expired at ${p.expiresAt}, current time is ${now}`,
      proofHash: p.proofHash,
    };
  }

  const coreOnly: PaymentProofCore = {
    mandateHash: p.mandateHash,
    agentPubkey: p.agentPubkey,
    merchantPubkey: p.merchantPubkey,
    asset: p.asset,
    amount: p.amount,
    audience: p.audience,
    network: p.network,
    nonce: p.nonce,
    timestamp: p.timestamp,
    expiresAt: p.expiresAt,
  };

  const expectedHash = computeProofHash(coreOnly);
  if (expectedHash !== p.proofHash) {
    return {
      isValid: false,
      error: `Proof hash mismatch: expected ${expectedHash}, got ${p.proofHash}`,
      proofHash: p.proofHash,
    };
  }

  const canonicalBytes = Buffer.from(canonicalizeJson(coreOnly), 'utf8');
  const isSigValid = verifyEd25519(canonicalBytes, p.signature, p.agentPubkey);
  if (!isSigValid) {
    return {
      isValid: false,
      error: 'Invalid agent signature on payment proof',
      proofHash: p.proofHash,
    };
  }

  return {
    isValid: true,
    proofHash: p.proofHash,
  };
}

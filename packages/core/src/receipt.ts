import { z } from 'zod';
import { canonicalizeJson, hashCanonicalJson } from './canonical.js';
import { verifyEd25519, signEd25519 } from './crypto.js';

export const ReceiptBodySchema = z.object({
  receiptId: z.string().min(1, 'receiptId is required'),
  mandateHash: z.string().length(64, 'mandateHash must be a 64-char hex string'),
  agentPubkey: z.string().min(32, 'agentPubkey is required'),
  merchantPubkey: z.string().min(1, 'merchantPubkey is required'),
  asset: z.string().min(1, 'asset is required'),
  amount: z.string().regex(/^\d+$/, 'amount must be integer string'),
  network: z.string().min(1, 'network is required'),
  nonce: z.string().min(1, 'nonce is required'),
  decision: z.enum(['ALLOW', 'DENY', 'REVIEW']),
  reasonCodes: z.array(z.string()).min(1),
  policyVersion: z.string().default('credav-v1.0'),
  issuedAt: z.number().int().positive('issuedAt ms required'),
  paymentTxSignature: z.string().optional(),
  reviewedBy: z.string().optional(),
  authorityPubkey: z.string().min(32, 'authorityPubkey is required'),
});

export type ReceiptBody = z.infer<typeof ReceiptBodySchema>;

export const SignedReceiptSchema = ReceiptBodySchema.extend({
  receiptHash: z.string().length(64),
  authoritySignature: z.string().min(64),
  onChainTxSignature: z.string().optional().nullable(),
  settlementTxSignature: z.string().optional().nullable(),
  settlementStatus: z.enum(['SETTLED', 'FAILED', 'PENDING']).optional().nullable(),
  sessionId: z.string().optional().nullable(),
});

export type SignedReceipt = z.infer<typeof SignedReceiptSchema>;

export function computeReceiptHash(body: ReceiptBody): string {
  const validated = ReceiptBodySchema.parse(body);
  return hashCanonicalJson(validated);
}

/**
 * Issues a cryptographically signed receipt from the CredaVer decision authority
 */
export function issueSignedReceipt(
  body: ReceiptBody,
  authoritySecretKey: string | Uint8Array,
  onChainTxSignature?: string | null,
  settlementTxSignature?: string | null,
  settlementStatus?: 'SETTLED' | 'FAILED' | 'PENDING' | null,
  sessionId?: string | null
): SignedReceipt {
  const validated = ReceiptBodySchema.parse(body);
  const receiptHash = computeReceiptHash(validated);
  const canonicalBytes = Buffer.from(canonicalizeJson(validated), 'utf8');
  const authoritySignature = signEd25519(canonicalBytes, authoritySecretKey);

  return SignedReceiptSchema.parse({
    ...validated,
    receiptHash,
    authoritySignature,
    onChainTxSignature: onChainTxSignature ?? null,
    settlementTxSignature: settlementTxSignature ?? null,
    settlementStatus: settlementStatus ?? null,
    sessionId: sessionId ?? null,
  });
}

export interface ReceiptVerificationResult {
  isValid: boolean;
  error?: string;
  receiptHash?: string;
  onChainTxSignature?: string | null;
  settlementTxSignature?: string | null;
}

/**
 * Independently re-verifies a receipt:
 * 1. Validates Zod schema
 * 2. Re-computes RFC 8785 canonical hash
 * 3. Verifies CredaVer authority Ed25519 signature
 */
export function verifySignedReceipt(receipt: unknown): ReceiptVerificationResult {
  const parsed = SignedReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    return {
      isValid: false,
      error: `Receipt schema validation failed: ${parsed.error.message}`,
    };
  }

  const r = parsed.data;
  const bodyOnly: ReceiptBody = {
    receiptId: r.receiptId,
    mandateHash: r.mandateHash,
    agentPubkey: r.agentPubkey,
    merchantPubkey: r.merchantPubkey,
    asset: r.asset,
    amount: r.amount,
    network: r.network,
    nonce: r.nonce,
    decision: r.decision,
    reasonCodes: r.reasonCodes,
    policyVersion: r.policyVersion,
    issuedAt: r.issuedAt,
    paymentTxSignature: r.paymentTxSignature,
    reviewedBy: r.reviewedBy,
    authorityPubkey: r.authorityPubkey,
  };

  const expectedHash = computeReceiptHash(bodyOnly);
  if (expectedHash !== r.receiptHash) {
    return {
      isValid: false,
      error: `Receipt hash mismatch: expected ${expectedHash}, got ${r.receiptHash}`,
      receiptHash: r.receiptHash,
    };
  }

  const canonicalBytes = Buffer.from(canonicalizeJson(bodyOnly), 'utf8');
  const isSigValid = verifyEd25519(canonicalBytes, r.authoritySignature, r.authorityPubkey);
  if (!isSigValid) {
    return {
      isValid: false,
      error: 'Invalid authority signature on receipt',
      receiptHash: r.receiptHash,
    };
  }

  return {
    isValid: true,
    receiptHash: r.receiptHash,
    onChainTxSignature: r.onChainTxSignature ?? null,
    settlementTxSignature: r.settlementTxSignature ?? null,
  };
}

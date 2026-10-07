import { z } from 'zod';
import { canonicalizeJson, hashCanonicalJson } from './canonical.js';
import { verifyEd25519, signEd25519 } from './crypto.js';

/**
 * Zod schema for Unsigned Mandate Core Parameters (the authoritative agreement)
 */
export const MandateCoreSchema = z.object({
  mandateId: z.string().min(1, 'mandateId is required'),
  operatorPubkey: z.string().min(32, 'operatorPubkey must be a valid Solana/Ed25519 public key'),
  agentPubkey: z.string().min(32, 'agentPubkey must be a valid Solana/Ed25519 public key'),
  allowedMerchants: z.array(z.string().min(1)).min(1, 'At least one allowed merchant or wildcard "*" required'),
  allowedAssets: z.array(z.string().min(1)).min(1, 'At least one allowed asset required'),
  maxPerTx: z.string().regex(/^\d+$/, 'maxPerTx must be a positive integer in base units'),
  totalCap: z.string().regex(/^\d+$/, 'totalCap must be a positive integer in base units'),
  reviewThreshold: z.string().regex(/^\d+$/).optional(),
  validFrom: z.number().int().nonnegative('validFrom must be a non-negative unix timestamp ms'),
  expiresAt: z.number().int().positive('expiresAt must be a positive unix timestamp ms'),
  nonce: z.string().min(1, 'nonce is required'),
  network: z.string().min(1, 'network is required (e.g. solana:devnet)'),
});

export type MandateCore = z.infer<typeof MandateCoreSchema>;

/**
 * Full Signed Mandate Schema
 */
export const SignedMandateSchema = MandateCoreSchema.extend({
  mandateHash: z.string().length(64, 'mandateHash must be a 64-char sha256 hex string'),
  operatorSignature: z.string().min(64, 'operatorSignature is required'),
  agentCounterSignature: z.string().min(64, 'agentCounterSignature is required'),
  revoked: z.boolean().default(false),
  revokedAt: z.number().optional(),
  revokedReason: z.string().optional(),
  sessionId: z.string().optional().nullable(),
  source: z.enum(['demo', 'user']).optional(),
});

export type SignedMandate = z.infer<typeof SignedMandateSchema>;

/**
 * Computes canonical hash of mandate core parameters
 */
export function computeMandateHash(core: MandateCore): string {
  const parsed = MandateCoreSchema.parse(core);
  return hashCanonicalJson(parsed);
}

/**
 * Issues a fully signed mandate given the core parameters and keypairs
 */
export function issueSignedMandate(
  core: MandateCore,
  operatorSecretKey: string | Uint8Array,
  agentSecretKey: string | Uint8Array,
  sessionId?: string | null,
  source?: 'demo' | 'user'
): SignedMandate {
  const validatedCore = MandateCoreSchema.parse(core);
  const mandateHash = computeMandateHash(validatedCore);
  const canonicalBytes = Buffer.from(canonicalizeJson(validatedCore), 'utf8');

  const operatorSignature = signEd25519(canonicalBytes, operatorSecretKey);
  const agentCounterSignature = signEd25519(canonicalBytes, agentSecretKey);

  const signedMandate: SignedMandate = {
    ...validatedCore,
    mandateHash,
    operatorSignature,
    agentCounterSignature,
    revoked: false,
    sessionId: sessionId ?? null,
    source,
  };

  return SignedMandateSchema.parse(signedMandate);
}

export const MANDATE_SIGN_PREFIX = 'CredaVer Mandate v1\n';

/**
 * Produces the human-readable signing bytes shown in Phantom and wallet popups:
 * "CredaVer Mandate v1\n" + canonical RFC 8785 JSON representation of the MandateCore.
 */
export function getMandateSigningBytes(core: MandateCore): Uint8Array {
  const json = canonicalizeJson(core);
  return Buffer.from(`${MANDATE_SIGN_PREFIX}${json}`, 'utf8');
}

export interface MandateVerificationResult {
  isValid: boolean;
  error?: string;
  mandateHash?: string;
}

/**
 * Verifies cryptographic integrity of a Signed Mandate:
 * 1. Zod schema validation
 * 2. Hash canonical equivalence
 * 3. Operator Ed25519 signature (rebuilds readable prefix "CredaVer Mandate v1\n" + canonical JSON, with raw fallback)
 * 4. Agent counter-signature
 */
export function verifySignedMandate(mandate: unknown): MandateVerificationResult {
  const parseResult = SignedMandateSchema.safeParse(mandate);
  if (!parseResult.success) {
    return {
      isValid: false,
      error: `Mandate schema validation failed: ${parseResult.error.message}`,
    };
  }

  const m = parseResult.data;
  const coreOnly: MandateCore = {
    mandateId: m.mandateId,
    operatorPubkey: m.operatorPubkey,
    agentPubkey: m.agentPubkey,
    allowedMerchants: m.allowedMerchants,
    allowedAssets: m.allowedAssets,
    maxPerTx: m.maxPerTx,
    totalCap: m.totalCap,
    reviewThreshold: m.reviewThreshold,
    validFrom: m.validFrom,
    expiresAt: m.expiresAt,
    nonce: m.nonce,
    network: m.network,
  };

  const expectedHash = computeMandateHash(coreOnly);
  if (expectedHash !== m.mandateHash) {
    return {
      isValid: false,
      error: `Mandate hash mismatch: expected ${expectedHash}, got ${m.mandateHash}`,
    };
  }

  const prefixedBytes = getMandateSigningBytes(coreOnly);
  const rawCanonicalBytes = Buffer.from(canonicalizeJson(coreOnly), 'utf8');

  // Verify Operator signature (checks readable prefixed bytes first, then raw canonical)
  const isOperatorValid =
    verifyEd25519(prefixedBytes, m.operatorSignature, m.operatorPubkey) ||
    verifyEd25519(rawCanonicalBytes, m.operatorSignature, m.operatorPubkey);

  if (!isOperatorValid) {
    return {
      isValid: false,
      error: 'Invalid operator signature on mandate',
      mandateHash: m.mandateHash,
    };
  }

  // Verify Agent counter-signature
  const isAgentValid =
    verifyEd25519(prefixedBytes, m.agentCounterSignature, m.agentPubkey) ||
    verifyEd25519(rawCanonicalBytes, m.agentCounterSignature, m.agentPubkey);

  if (!isAgentValid) {
    return {
      isValid: false,
      error: 'Invalid agent counter-signature on mandate',
      mandateHash: m.mandateHash,
    };
  }

  return {
    isValid: true,
    mandateHash: m.mandateHash,
  };
}

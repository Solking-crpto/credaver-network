import { decodeBase58, encodeBase58, signEd25519, verifyEd25519 } from './crypto.js';
import { canonicalizeJson } from './canonical.js';
import { computeReceiptHash, SignedReceipt, ReceiptBody } from './receipt.js';

export const SPL_MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

/**
 * Compact-u16 encoder for Solana wire format
 */
export function encodeCompactU16(val: number): number[] {
  const bytes: number[] = [];
  let rem = val;
  while (rem >= 0x80) {
    bytes.push((rem & 0x7f) | 0x80);
    rem >>= 7;
  }
  bytes.push(rem);
  return bytes;
}

/**
 * Builds standard CredaVer on-chain memo payload.
 * Format: credav:1:<mandateHash_first8>:<receiptHash>:<decision>
 */
export function buildMemoPayload(
  mandateHash: string,
  receiptHash: string,
  decision: 'ALLOW' | 'DENY' | 'REVIEW' | string
): string {
  const mandatePrefix = mandateHash.slice(0, 8);
  return `credav:1:${mandatePrefix}:${receiptHash}:${decision}`;
}

export interface ParsedMemoPayload {
  version: string;
  mandateHashPrefix: string;
  receiptHash: string;
  decision: string;
}

/**
 * Parses a CredaVer memo payload string.
 */
export function parseMemoPayload(memo: string): ParsedMemoPayload | null {
  if (!memo || typeof memo !== 'string') return null;

  // Handles raw string or string wrapped in quotes from Solana logs
  const cleaned = memo.trim().replace(/^"|"$/g, '');
  const parts = cleaned.split(':');
  if (parts.length !== 5 || parts[0] !== 'credav') {
    return null;
  }

  return {
    version: parts[1],
    mandateHashPrefix: parts[2],
    receiptHash: parts[3],
    decision: parts[4],
  };
}

/**
 * Assembles a valid Solana legacy wire transaction containing a single SPL Memo instruction.
 */
export function buildMemoTransaction(
  payerPubkeyBase58: string,
  payerSecretKey: string | Uint8Array,
  recentBlockhashBase58: string,
  memoText: string
): { wireTransactionBase64: string; expectedSignature: string; messageBytes: Uint8Array } {
  const payerPubkeyBytes = decodeBase58(payerPubkeyBase58);
  const memoProgramBytes = decodeBase58(SPL_MEMO_PROGRAM_ID);
  const blockhashBytes = decodeBase58(recentBlockhashBase58);
  const memoDataBytes = Buffer.from(memoText, 'utf8');

  // 1. Message Header: [numRequiredSignatures=1, numReadonlySignedAccounts=0, numReadonlyUnsignedAccounts=1]
  const header = [1, 0, 1];

  // 2. Account addresses: count (2) + payer (32) + memo program (32)
  const accountAddresses = [
    ...encodeCompactU16(2),
    ...Array.from(payerPubkeyBytes),
    ...Array.from(memoProgramBytes),
  ];

  // 3. Recent blockhash (32 bytes)
  const blockhash = Array.from(blockhashBytes);

  // 4. Instructions:
  // count (1) + programIdIndex (1) + accounts count (1) + [payer=0] + data length + memo bytes
  const instruction = [
    1, // programId is index 1 (Memo program)
    ...encodeCompactU16(1),
    0, // payer account is index 0
    ...encodeCompactU16(memoDataBytes.length),
    ...Array.from(memoDataBytes),
  ];

  const instructions = [
    ...encodeCompactU16(1),
    ...instruction,
  ];

  const messageBytes = new Uint8Array([
    ...header,
    ...accountAddresses,
    ...blockhash,
    ...instructions,
  ]);

  // Sign message
  const sigBase58 = signEd25519(messageBytes, payerSecretKey);
  const sigBytes = decodeBase58(sigBase58);

  // Wire transaction: 1 signature + messageBytes
  const wireBytes = Buffer.from([
    ...encodeCompactU16(1),
    ...Array.from(sigBytes),
    ...Array.from(messageBytes),
  ]);

  return {
    wireTransactionBase64: wireBytes.toString('base64'),
    expectedSignature: sigBase58,
    messageBytes,
  };
}

async function solanaRpc(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`Solana RPC HTTP error (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`Solana RPC error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

/**
 * Anchors a signed receipt to Solana devnet via SPL Memo program.
 */
export async function anchorReceiptOnChain(
  receipt: SignedReceipt,
  payerPubkey: string,
  payerSecretKey: string | Uint8Array,
  rpcUrl: string = DEFAULT_DEVNET_RPC
): Promise<{ txSignature: string; slot?: number }> {
  const memoPayload = buildMemoPayload(receipt.mandateHash, receipt.receiptHash, receipt.decision);

  // 1. Fetch recent blockhash
  const blockhashResult = await solanaRpc(rpcUrl, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const blockhash = blockhashResult?.value?.blockhash;
  if (!blockhash) {
    throw new Error('Failed to retrieve recent blockhash from Solana RPC');
  }

  // 2. Build and sign wire transaction
  const { wireTransactionBase64, expectedSignature } = buildMemoTransaction(
    payerPubkey,
    payerSecretKey,
    blockhash,
    memoPayload
  );

  // 3. Send transaction
  const txSignature = await solanaRpc(rpcUrl, 'sendTransaction', [
    wireTransactionBase64,
    { encoding: 'base64', preflightCommitment: 'confirmed' },
  ]);

  // 4. Poll for confirmation (up to 15 seconds)
  let confirmedSlot: number | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await solanaRpc(rpcUrl, 'getSignatureStatuses', [[txSignature]]);
    const status = statusRes?.value?.[0];
    if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
      confirmedSlot = status.slot;
      break;
    }
  }

  return {
    txSignature,
    slot: confirmedSlot,
  };
}

export interface OnChainMemoVerificationResult {
  isValid: boolean;
  error?: string;
  txSignature: string;
  slot?: number;
  blockTime?: number | null;
  memoPayload?: string;
  parsedMemo?: ParsedMemoPayload;
}

/**
 * Queries Solana devnet for a transaction signature and verifies that it contains
 * a valid CredaVer Memo matching expectedReceiptHash.
 */
export async function verifyOnChainMemo(
  txSignature: string,
  expectedReceiptHash?: string,
  rpcUrl: string = DEFAULT_DEVNET_RPC
): Promise<OnChainMemoVerificationResult> {
  try {
    const tx = await solanaRpc(rpcUrl, 'getTransaction', [
      txSignature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
    ]);

    if (!tx) {
      return {
        isValid: false,
        error: `Transaction ${txSignature} not found on devnet (may still be propagating or expired)`,
        txSignature,
      };
    }

    const slot = tx.slot;
    const blockTime = tx.blockTime;

    // Search parsed instructions for spl-memo
    const instructions = tx.transaction?.message?.instructions || [];
    let foundMemo: string | null = null;

    for (const ix of instructions) {
      if (ix.program === 'spl-memo' || ix.programId === SPL_MEMO_PROGRAM_ID) {
        if (typeof ix.parsed === 'string') {
          foundMemo = ix.parsed;
          break;
        }
      }
    }

    // Fallback: search logMessages for "Program log: Memo"
    if (!foundMemo && tx.meta?.logMessages) {
      for (const log of tx.meta.logMessages) {
        const match = log.match(/Program log: Memo(?: \(len \d+\))?: "(.*)"/);
        if (match) {
          foundMemo = match[1];
          break;
        }
      }
    }

    if (!foundMemo) {
      return {
        isValid: false,
        error: 'No SPL Memo instruction found in transaction',
        txSignature,
        slot,
        blockTime,
      };
    }

    const parsedMemo = parseMemoPayload(foundMemo);
    if (!parsedMemo) {
      return {
        isValid: false,
        error: `Instruction contains memo, but format does not match CredaVer specification: "${foundMemo}"`,
        txSignature,
        slot,
        blockTime,
        memoPayload: foundMemo,
      };
    }

    if (expectedReceiptHash && parsedMemo.receiptHash !== expectedReceiptHash) {
      return {
        isValid: false,
        error: `Receipt hash mismatch: expected ${expectedReceiptHash}, found ${parsedMemo.receiptHash} on-chain`,
        txSignature,
        slot,
        blockTime,
        memoPayload: foundMemo,
        parsedMemo,
      };
    }

    return {
      isValid: true,
      txSignature,
      slot,
      blockTime,
      memoPayload: foundMemo,
      parsedMemo,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Devnet RPC error: ${err.message}`,
      txSignature,
    };
  }
}

export interface CompleteReceiptVerificationResult {
  isValid: boolean;
  error?: string;
  receiptHash: string;
  authorityPubkey?: string;
  configuredAuthorityPubkey?: string;
  signerStatus: 'SIGNED BY CREDAVER AUTHORITY' | 'UNKNOWN SIGNER';
  badges: {
    hashMatches: boolean;
    authorityValid: boolean;
    isConfiguredAuthority: boolean;
    onChainAnchored: boolean | null;
    onChainVerified: boolean | null;
  };
  onChain?: {
    txSignature: string;
    slot?: number;
    blockTime?: number | null;
    memoPayload?: string;
    explorerUrl: string;
  };
}

/**
 * End-to-end full receipt verifier:
 * 1. Checks schema and canonical hash
 * 2. Checks authority Ed25519 signature
 * 3. Compares receipt.authorityPubkey to configured CredaVer authority
 * 4. Checks Solana devnet memo anchoring (if onChainTxSignature is present)
 */
export async function verifyCompleteReceipt(
  receipt: SignedReceipt,
  options?: {
    rpcUrl?: string;
    verifyOnChain?: boolean;
    configuredAuthorityPubkey?: string;
  }
): Promise<CompleteReceiptVerificationResult> {
  const bodyOnly: ReceiptBody = {
    receiptId: receipt.receiptId,
    mandateHash: receipt.mandateHash,
    agentPubkey: receipt.agentPubkey,
    merchantPubkey: receipt.merchantPubkey,
    asset: receipt.asset,
    amount: receipt.amount,
    network: receipt.network,
    nonce: receipt.nonce,
    decision: receipt.decision,
    reasonCodes: receipt.reasonCodes,
    policyVersion: receipt.policyVersion,
    issuedAt: receipt.issuedAt,
    paymentTxSignature: receipt.paymentTxSignature,
    reviewedBy: receipt.reviewedBy,
    authorityPubkey: receipt.authorityPubkey,
  };

  const expectedHash = computeReceiptHash(bodyOnly);
  const hashMatches = expectedHash === receipt.receiptHash;

  const canonicalBytes = Buffer.from(canonicalizeJson(bodyOnly), 'utf8');
  const authorityValid = verifyEd25519(canonicalBytes, receipt.authoritySignature, receipt.authorityPubkey);

  // Compare against configured CredaVer authority key
  const configuredAuthorityPubkey =
    options?.configuredAuthorityPubkey ??
    (typeof process !== 'undefined'
      ? process.env.CREDAVER_AUTHORITY_PUBLIC_KEY ||
        process.env.RECEIPT_AUTHORITY_PUBLIC_KEY
      : undefined);

  let isConfiguredAuthority = true;
  let signerStatus: 'SIGNED BY CREDAVER AUTHORITY' | 'UNKNOWN SIGNER' = 'SIGNED BY CREDAVER AUTHORITY';
  let authorityMismatchError: string | undefined = undefined;

  if (configuredAuthorityPubkey) {
    if (receipt.authorityPubkey !== configuredAuthorityPubkey) {
      isConfiguredAuthority = false;
      signerStatus = 'UNKNOWN SIGNER';
      authorityMismatchError = `Receipt signed by unknown authority (${receipt.authorityPubkey}); expected configured CredaVer authority (${configuredAuthorityPubkey}): UNKNOWN SIGNER`;
    }
  } else {
    if (!receipt.authorityPubkey || !authorityValid) {
      isConfiguredAuthority = false;
      signerStatus = 'UNKNOWN SIGNER';
    }
  }

  const hasOnChainSig = Boolean(receipt.onChainTxSignature);
  let onChainVerified: boolean | null = null;
  let onChainDetails: CompleteReceiptVerificationResult['onChain'];

  if (hasOnChainSig && options?.verifyOnChain !== false) {
    const rpcUrl = options?.rpcUrl ?? DEFAULT_DEVNET_RPC;
    const onChainResult = await verifyOnChainMemo(receipt.onChainTxSignature!, receipt.receiptHash, rpcUrl);
    onChainVerified = onChainResult.isValid;
    onChainDetails = {
      txSignature: receipt.onChainTxSignature!,
      slot: onChainResult.slot,
      blockTime: onChainResult.blockTime,
      memoPayload: onChainResult.memoPayload,
      explorerUrl: `https://explorer.solana.com/tx/${receipt.onChainTxSignature}?cluster=devnet`,
    };
  }

  const error = !hashMatches
    ? `Receipt hash mismatch: expected ${expectedHash}, got ${receipt.receiptHash}`
    : !authorityValid
    ? 'Invalid authority signature on receipt'
    : authorityMismatchError
    ? authorityMismatchError
    : hasOnChainSig && onChainVerified === false
    ? 'On-chain SPL Memo verification failed'
    : undefined;

  const isValid =
    hashMatches &&
    authorityValid &&
    isConfiguredAuthority &&
    (hasOnChainSig ? onChainVerified === true : true);

  return {
    isValid,
    error,
    receiptHash: receipt.receiptHash,
    authorityPubkey: receipt.authorityPubkey,
    configuredAuthorityPubkey,
    signerStatus,
    badges: {
      hashMatches,
      authorityValid,
      isConfiguredAuthority,
      onChainAnchored: hasOnChainSig,
      onChainVerified,
    },
    onChain: onChainDetails,
  };
}

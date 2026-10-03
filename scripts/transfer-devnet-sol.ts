/**
 * CredaVer Devnet SOL Transfer Utility
 *
 * Transfers test SOL on Solana Devnet from .devnet-payer.json to a destination address.
 * Safety controls:
 *   - Hard-coded Devnet RPC (mainnet transfers strictly prohibited)
 *   - Capped at 0.5 SOL per run
 *   - Destination validation (32-byte Ed25519 base58)
 *   - Refuses self-transfer
 *   - Enforces a minimum reserve of 0.05 SOL remaining in the sender wallet
 *   - ZERO secret key logging or echoing
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  decodeBase58,
  encodeBase58,
  signEd25519,
  generateEd25519Keypair,
} from '../packages/core/src/index.js';

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const MAX_TRANSFER_SOL = 0.5;
export const MIN_RESERVE_SOL = 0.05;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_PUBKEY = '11111111111111111111111111111111';

function encodeCompactU16(val: number): number[] {
  const bytes: number[] = [];
  let rem = val;
  while (rem >= 0x80) {
    bytes.push((rem & 0x7f) | 0x80);
    rem >>= 7;
  }
  bytes.push(rem);
  return bytes;
}

function u64ToLeBytes(val: bigint): number[] {
  const bytes: number[] = [];
  let rem = val;
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(rem & 0xffn));
    rem >>= 8n;
  }
  return bytes;
}

export interface ValidationParams {
  destination?: string;
  amountStr?: string;
  senderPubkey?: string;
  senderBalanceLamports?: bigint;
}

export interface ValidatedTransfer {
  destination: string;
  amountSol: number;
  lamports: bigint;
}

/**
 * Validates CLI arguments and balances for the transfer.
 */
export function validateTransferArgs(params: ValidationParams): ValidatedTransfer {
  const { destination, amountStr, senderPubkey, senderBalanceLamports } = params;

  if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
    throw new Error('Missing destination address. Usage: pnpm exec tsx scripts/transfer-devnet-sol.ts <destinationPubkey> <amountInSOL>');
  }

  const trimmedDest = destination.trim();

  // Validate destination address format (base58, decodes to 32 bytes)
  try {
    const destBytes = decodeBase58(trimmedDest);
    if (destBytes.length !== 32) {
      throw new Error(`Invalid destination public key length: expected 32 bytes, got ${destBytes.length}`);
    }
  } catch (err: any) {
    throw new Error(`Invalid destination base58 address: ${err.message}`);
  }

  // Refuse self-transfer
  if (senderPubkey && trimmedDest === senderPubkey.trim()) {
    throw new Error('Self-transfer is not permitted: destination address matches sender address.');
  }

  if (!amountStr || typeof amountStr !== 'string' || amountStr.trim().length === 0) {
    throw new Error('Missing transfer amount. Usage: pnpm exec tsx scripts/transfer-devnet-sol.ts <destinationPubkey> <amountInSOL>');
  }

  const amountSol = parseFloat(amountStr.trim());
  if (isNaN(amountSol) || !isFinite(amountSol) || amountSol <= 0) {
    throw new Error(`Invalid transfer amount "${amountStr}": must be a positive number of SOL.`);
  }

  // Cap at 0.5 SOL per run
  if (amountSol > MAX_TRANSFER_SOL) {
    throw new Error(`Transfer amount (${amountSol} SOL) exceeds maximum per-run safety limit of ${MAX_TRANSFER_SOL} SOL.`);
  }

  const lamports = BigInt(Math.round(amountSol * Number(LAMPORTS_PER_SOL)));
  if (lamports <= 0n) {
    throw new Error('Transfer amount is too small (rounds to 0 lamports).');
  }

  // If sender balance is provided, ensure at least 0.05 SOL remains behind
  if (senderBalanceLamports !== undefined) {
    const minReserveLamports = BigInt(Math.round(MIN_RESERVE_SOL * Number(LAMPORTS_PER_SOL)));
    const estimatedFee = 5000n; // Standard Solana transfer signature fee
    const totalRequired = lamports + estimatedFee;

    if (senderBalanceLamports < totalRequired) {
      const balanceSol = (Number(senderBalanceLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4);
      throw new Error(`Insufficient funds: sender balance is ${balanceSol} SOL, required is ${(Number(totalRequired) / Number(LAMPORTS_PER_SOL)).toFixed(4)} SOL.`);
    }

    const remaining = senderBalanceLamports - totalRequired;
    if (remaining < minReserveLamports) {
      const remainingSol = (Number(remaining) / Number(LAMPORTS_PER_SOL)).toFixed(4);
      throw new Error(
        `Safety rule violation: transfer would leave ${remainingSol} SOL in sender wallet. ` +
        `At least ${MIN_RESERVE_SOL} SOL must remain behind to cover future transaction fees.`
      );
    }
  }

  return {
    destination: trimmedDest,
    amountSol,
    lamports,
  };
}

/**
 * Builds and signs a legacy Solana wire transaction for SystemProgram Transfer.
 */
export function buildSystemTransferTransaction(
  senderPubkeyBase58: string,
  senderSecretKey: string | Uint8Array,
  recipientPubkeyBase58: string,
  lamports: bigint,
  recentBlockhashBase58: string
): { wireTransactionBase64: string; signatureBase58: string } {
  const senderBytes = decodeBase58(senderPubkeyBase58).slice(0, 32);
  const recipientBytes = decodeBase58(recipientPubkeyBase58).slice(0, 32);
  const systemProgBytes = new Uint8Array(32); // 32 zeros for 11111111111111111111111111111111
  const blockhashBytes = decodeBase58(recentBlockhashBase58).slice(0, 32);

  // Header: 1 signer, 0 readonly signed, 1 readonly unsigned (system program)
  const header = [1, 0, 1];
  const accountAddresses = [
    ...encodeCompactU16(3),
    ...Array.from(senderBytes),
    ...Array.from(recipientBytes),
    ...Array.from(systemProgBytes),
  ];
  const blockhash = Array.from(blockhashBytes);

  // Instruction: SystemProgram Transfer (instruction index 2)
  const instructionData = [
    2, 0, 0, 0, // Instruction 2: Transfer (u32 LE)
    ...u64ToLeBytes(lamports),
  ];

  const instruction = [
    2, // programId is index 2 (system program)
    ...encodeCompactU16(2), // 2 accounts
    0, // sender is index 0
    1, // recipient is index 1
    ...encodeCompactU16(instructionData.length),
    ...instructionData,
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

  const sigBase58 = signEd25519(messageBytes, senderSecretKey);
  const sigBytes = decodeBase58(sigBase58).slice(0, 64);

  const wireBytes = Buffer.from([
    ...encodeCompactU16(1),
    ...Array.from(sigBytes),
    ...Array.from(messageBytes),
  ]);

  return {
    wireTransactionBase64: wireBytes.toString('base64'),
    signatureBase58: sigBase58,
  };
}

async function solanaRpc(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
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

export function loadSenderKeypair(): { publicKey: string; secretKey: string } {
  const possiblePaths = [
    path.resolve(process.cwd(), '.devnet-payer.json'),
    path.resolve(process.cwd(), '../../.devnet-payer.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const data = JSON.parse(raw);
        if (data.secretKey && data.publicKey) {
          return { publicKey: data.publicKey, secretKey: data.secretKey };
        }
      } catch (err: any) {
        throw new Error(`Failed to parse ${p}: ${err.message}`);
      }
    }
  }

  throw new Error('Could not find .devnet-payer.json. Please ensure it exists in the repository root.');
}

async function runCli(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const isDryRun = rawArgs.includes('--dry-run');
  const args = rawArgs.filter((a) => a !== '--dry-run');
  const destination = args[0];
  const amountStr = args[1];

  console.log('--- CredaVer Devnet SOL Transfer Utility ---');
  if (isDryRun) {
    console.log('[DRY-RUN MODE ACTIVATED] Validating inputs & checking balances only. No transactions will be broadcast.');
  }
  console.log(`Target Network: Solana Devnet (${DEVNET_RPC})`);
  console.log(`Safety Limits : Max ${MAX_TRANSFER_SOL} SOL/run | Min Reserve ${MIN_RESERVE_SOL} SOL`);

  // 1. Load sender keypair
  const senderKeypair = loadSenderKeypair();
  console.log(`Sender Wallet : ${senderKeypair.publicKey}`);

  // 2. Fetch sender balance from devnet RPC
  const senderBalResult = await solanaRpc(DEVNET_RPC, 'getBalance', [senderKeypair.publicKey]);
  const senderBalanceLamports = BigInt(senderBalResult?.value ?? 0);
  const senderBalanceSol = (Number(senderBalanceLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4);
  console.log(`Sender Balance: ${senderBalanceSol} SOL`);

  // 3. Validate arguments and balance safety
  const validated = validateTransferArgs({
    destination,
    amountStr,
    senderPubkey: senderKeypair.publicKey,
    senderBalanceLamports,
  });

  // 4. Fetch initial recipient balance
  const recipientBalResult = await solanaRpc(DEVNET_RPC, 'getBalance', [validated.destination]);
  const recipientBalanceLamports = BigInt(recipientBalResult?.value ?? 0);
  const recipientBalanceSol = (Number(recipientBalanceLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4);
  console.log(`Recipient     : ${validated.destination}`);
  console.log(`Recip. Balance: ${recipientBalanceSol} SOL`);
  console.log(`Transferring  : ${validated.amountSol} SOL (${validated.lamports} lamports)...`);

  if (isDryRun) {
    const estimatedFeeLamports = 5000n;
    const projectedSenderLamports = senderBalanceLamports - validated.lamports - estimatedFeeLamports;
    const projectedRecipientLamports = recipientBalanceLamports + validated.lamports;
    const projectedSenderSol = (Number(projectedSenderLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4);
    const projectedRecipientSol = (Number(projectedRecipientLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4);

    console.log('\n--- [DRY-RUN] Simulation Summary ---');
    console.log(`Action          : SystemProgram Transfer`);
    console.log(`Network         : Solana Devnet (${DEVNET_RPC})`);
    console.log(`Sender Address  : ${senderKeypair.publicKey}`);
    console.log(`Recipient Address: ${validated.destination}`);
    console.log(`Transfer Amount : ${validated.amountSol} SOL (${validated.lamports} lamports)`);
    console.log(`Estimated Fee   : 0.000005 SOL (5000 lamports)`);
    console.log(`Current Sender  : ${senderBalanceSol} SOL`);
    console.log(`Current Recipient: ${recipientBalanceSol} SOL`);
    console.log(`Projected Sender: ${projectedSenderSol} SOL`);
    console.log(`Projected Recip : ${projectedRecipientSol} SOL`);
    console.log(`Safety Reserve  : ${MIN_RESERVE_SOL} SOL required -> ${(Number(projectedSenderLamports) / Number(LAMPORTS_PER_SOL)).toFixed(4)} SOL remaining (PASS)`);
    console.log(`Transfer Cap    : ${MAX_TRANSFER_SOL} SOL max -> ${validated.amountSol} SOL requested (PASS)`);
    console.log('\n[DRY-RUN COMPLETE] All validation and safety rules PASSED. No transactions broadcast.');
    return;
  }

  // 5. Get recent blockhash
  const bhResult = await solanaRpc(DEVNET_RPC, 'getLatestBlockhash', [{ commitment: 'finalized' }]);
  const blockhash = bhResult?.value?.blockhash;
  if (!blockhash) {
    throw new Error('Failed to retrieve recent blockhash from devnet RPC.');
  }

  // 6. Build and sign wire transaction
  const { wireTransactionBase64, signatureBase58 } = buildSystemTransferTransaction(
    senderKeypair.publicKey,
    senderKeypair.secretKey,
    validated.destination,
    validated.lamports,
    blockhash
  );

  // 7. Broadcast transaction to devnet
  console.log(`Broadcasting transaction signature: ${signatureBase58}...`);
  const txSig = await solanaRpc(DEVNET_RPC, 'sendTransaction', [
    wireTransactionBase64,
    { encoding: 'base64', preflightCommitment: 'confirmed' },
  ]);

  console.log('Awaiting confirmation on Solana Devnet...');
  // Poll for confirmation (up to 30 seconds)
  const maxWait = 30000;
  const start = Date.now();
  let confirmed = false;

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const statusRes = await solanaRpc(DEVNET_RPC, 'getSignatureStatuses', [[txSig]]);
      const status = statusRes?.value?.[0];
      if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
        confirmed = true;
        break;
      }
    } catch {
      // Continue polling
    }
  }

  // 8. Query post-transfer balances
  const postSenderBalResult = await solanaRpc(DEVNET_RPC, 'getBalance', [senderKeypair.publicKey]);
  const postSenderSol = (Number(postSenderBalResult?.value ?? 0) / Number(LAMPORTS_PER_SOL)).toFixed(4);
  const postRecipBalResult = await solanaRpc(DEVNET_RPC, 'getBalance', [validated.destination]);
  const postRecipSol = (Number(postRecipBalResult?.value ?? 0) / Number(LAMPORTS_PER_SOL)).toFixed(4);

  console.log('\n--- Transfer Completed Successfully ---');
  console.log(`Status        : ${confirmed ? 'CONFIRMED' : 'SUBMITTED (check explorer)'}`);
  console.log(`Signature     : ${txSig}`);
  console.log(`Solana Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
  console.log(`Sender Balance: ${senderBalanceSol} SOL -> ${postSenderSol} SOL`);
  console.log(`Recip. Balance: ${recipientBalanceSol} SOL -> ${postRecipSol} SOL`);
}

// Only execute when run directly from the command line
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/transfer-devnet-sol.ts');
if (isMain) {
  runCli().catch((err) => {
    console.error(`\n[TRANSFER ERROR]: ${err.message}`);
    process.exit(1);
  });
}

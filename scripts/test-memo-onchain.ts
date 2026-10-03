import fs from 'node:fs';
import path from 'node:path';
import { decodeBase58, encodeBase58, signEd25519 } from '../packages/core/src/crypto.js';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

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

async function rpc(method: string, params: any[]) {
  const res = await fetch(DEVNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

export function buildMemoTransaction(
  payerPubkeyBase58: string,
  payerSecretKey: string | Uint8Array,
  recentBlockhashBase58: string,
  memoText: string
): { wireTransactionBase64: string; expectedSignature: string } {
  const payerPubkeyBytes = decodeBase58(payerPubkeyBase58);
  const memoProgramBytes = decodeBase58(MEMO_PROGRAM_ID);
  const blockhashBytes = decodeBase58(recentBlockhashBase58);
  const memoDataBytes = Buffer.from(memoText, 'utf8');

  // Message serialization:
  // 1. Header: [numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts]
  // 1 signer (payer), 0 readonly signed, 1 readonly unsigned (memo program)
  const header = [1, 0, 1];

  // 2. Account addresses: compact-u16 count (2) + payer (32) + memo program (32)
  const accountAddresses = [
    ...encodeCompactU16(2),
    ...Array.from(payerPubkeyBytes),
    ...Array.from(memoProgramBytes),
  ];

  // 3. Recent blockhash (32 bytes)
  const blockhash = Array.from(blockhashBytes);

  // 4. Instructions:
  // compact-u16 count (1)
  // programIdIndex (1 byte) -> index 1
  // compact-u16 accounts count (1) -> [0]
  // compact-u16 data length -> memoDataBytes
  const instruction = [
    1, // programId index is 1 (Memo program)
    ...encodeCompactU16(1),
    0, // account index 0 (payer)
    ...encodeCompactU16(memoDataBytes.length),
    ...Array.from(memoDataBytes),
  ];

  const instructions = [
    ...encodeCompactU16(1),
    ...instruction,
  ];

  const messageBytes = Buffer.from([
    ...header,
    ...accountAddresses,
    ...blockhash,
    ...instructions,
  ]);

  // Sign message
  const sigBase58 = signEd25519(messageBytes, payerSecretKey);
  const sigBytes = decodeBase58(sigBase58);

  // Wire transaction:
  // compact-u16 signature count (1) + 64-byte signature + messageBytes
  const wireBytes = Buffer.from([
    ...encodeCompactU16(1),
    ...Array.from(sigBytes),
    ...Array.from(messageBytes),
  ]);

  return {
    wireTransactionBase64: wireBytes.toString('base64'),
    expectedSignature: sigBase58,
  };
}

async function main() {
  const payerFile = path.resolve(process.cwd(), '.devnet-payer.json');
  if (!fs.existsSync(payerFile)) {
    console.error('Missing .devnet-payer.json');
    process.exit(1);
  }
  const payer = JSON.parse(fs.readFileSync(payerFile, 'utf8'));

  console.log('Payer:', payer.publicKey);
  console.log('Fetching recent blockhash...');
  const blockhashRes = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const blockhash = blockhashRes.value.blockhash;
  console.log('Recent Blockhash:', blockhash);

  const memoPayload = `credav:1:testman1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:ALLOW`;
  console.log('Building memo tx with payload:', memoPayload);

  const { wireTransactionBase64, expectedSignature } = buildMemoTransaction(
    payer.publicKey,
    payer.secretKey,
    blockhash,
    memoPayload
  );

  console.log('Expected signature:', expectedSignature);
  console.log('Sending transaction to Solana devnet...');

  const txSig = await rpc('sendTransaction', [
    wireTransactionBase64,
    { encoding: 'base64', preflightCommitment: 'confirmed' },
  ]);

  console.log('Transaction sent successfully! Tx Sig:', txSig);
  console.log(`Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);

  console.log('Waiting for confirmation...');
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await rpc('getSignatureStatuses', [[txSig]]);
    const status = statusRes?.value?.[0];
    if (status) {
      console.log(`Status at check ${i + 1}: confirmationStatus=${status.confirmationStatus}, slot=${status.slot}`);
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        console.log('CONFIRMED ON-CHAIN!');
        break;
      }
    }
  }

  console.log('Querying transaction to verify memo content...');
  const txInfo = await rpc('getTransaction', [
    txSig,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
  ]);
  console.log('Transaction confirmed slot:', txInfo?.slot);
  const logMessages = txInfo?.meta?.logMessages || [];
  console.log('Log Messages:', logMessages);
  const instructions = txInfo?.transaction?.message?.instructions || [];
  console.log('Instructions:', JSON.stringify(instructions, null, 2));
}

main().catch(console.error);

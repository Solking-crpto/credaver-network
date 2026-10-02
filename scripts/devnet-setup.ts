import fs from 'node:fs';
import path from 'node:path';
import { generateEd25519Keypair, decodeBase58 } from '../packages/core/src/crypto.js';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const PAYER_FILE = path.resolve(process.cwd(), '.devnet-payer.json');
const MERCHANT_FILE = path.resolve(process.cwd(), '.devnet-merchant.json');

async function rpcCall(method: string, params: any[]) {
  const res = await fetch(DEVNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

function loadOrGenerateKey(filepath: string, label: string) {
  if (fs.existsSync(filepath)) {
    const raw = fs.readFileSync(filepath, 'utf8');
    const parsed = JSON.parse(raw);
    console.log(`[CredaVer] Loaded existing ${label} from ${path.basename(filepath)}: ${parsed.publicKey}`);
    return parsed;
  }
  const kp = generateEd25519Keypair();
  const data = {
    label,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    secretKeyArray: Array.from(kp.secretKeyBytes),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[CredaVer] Generated new throwaway ${label}: ${kp.publicKey}`);
  console.log(`[CredaVer] Saved to ${path.basename(filepath)} (git-ignored)`);
  return data;
}

async function main() {
  console.log('====================================================');
  console.log('  CredaVer Network — Solana Devnet Key & Account Setup');
  console.log('====================================================');
  console.log(`Devnet RPC: ${DEVNET_RPC}`);
  console.log(`USDC Mint:  ${DEVNET_USDC_MINT}\n`);

  const payer = loadOrGenerateKey(PAYER_FILE, 'Devnet Agent Payer');
  const merchant = loadOrGenerateKey(MERCHANT_FILE, 'Devnet Demo Merchant');

  // Check SOL balance
  console.log(`\nQuerying SOL balance for payer: ${payer.publicKey}...`);
  try {
    const balanceRes = await rpcCall('getBalance', [payer.publicKey]);
    const lamports = balanceRes?.value ?? 0;
    const sol = lamports / 1e9;
    console.log(`Payer SOL Balance: ${sol} SOL (${lamports} lamports)`);

    if (lamports === 0) {
      console.log('Attempting automated devnet airdrop (1 SOL)...');
      try {
        const sig = await rpcCall('requestAirdrop', [payer.publicKey, 1_000_000_000]);
        console.log(`Airdrop requested! Tx Signature: ${sig}`);
        console.log('Waiting 5s for confirmation...');
        await new Promise((r) => setTimeout(r, 5000));
        const updatedBal = await rpcCall('getBalance', [payer.publicKey]);
        console.log(`Updated SOL Balance: ${(updatedBal?.value ?? 0) / 1e9} SOL`);
      } catch (err: any) {
        console.warn(`Devnet faucet rate-limited or unavailable: ${err.message}`);
        console.log(`Please fund ${payer.publicKey} using https://faucet.solana.com`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to query SOL balance: ${err.message}`);
  }

  // Check USDC balance
  console.log(`\nQuerying devnet USDC token accounts for: ${payer.publicKey}...`);
  try {
    const tokenAccounts = await rpcCall('getTokenAccountsByOwner', [
      payer.publicKey,
      { mint: DEVNET_USDC_MINT },
      { encoding: 'jsonParsed' },
    ]);

    const accounts = tokenAccounts?.value || [];
    if (accounts.length === 0) {
      console.log(`No USDC token account found yet for ${payer.publicKey}.`);
      console.log(`Payer needs devnet USDC tokens from the devnet faucet.`);
    } else {
      for (const acc of accounts) {
        const info = acc.account.data.parsed.info;
        console.log(`USDC Account: ${acc.pubkey}`);
        console.log(`USDC Balance: ${info.tokenAmount.uiAmountString} USDC (${info.tokenAmount.amount} base units)`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to query token accounts: ${err.message}`);
  }

  console.log('\n----------------------------------------------------');
  console.log('Summary of Devnet Addresses:');
  console.log(`  Agent Payer:     ${payer.publicKey}`);
  console.log(`  Demo Merchant:   ${merchant.publicKey}`);
  console.log('----------------------------------------------------');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

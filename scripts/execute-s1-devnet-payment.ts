import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm';
import {
  createDemoMerchantApp,
  OFFICIAL_FACILITATOR_URL,
  SOLANA_DEVNET_GENESIS,
  DEVNET_USDC_MINT,
} from '../apps/demo-merchant/src/server.js';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  MemoryStore,
} from '../packages/core/src/index.js';
import { createCredaverClientPolicy, CredaverAgentGuard } from '../packages/x402-guard/src/index.js';

const DEVNET_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
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
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  console.log('================================================================');
  console.log('  CredaVer Network — Milestone 0 / Spike S1 Live Devnet Runner');
  console.log('================================================================');

  if (!fs.existsSync(PAYER_FILE) || !fs.existsSync(MERCHANT_FILE)) {
    console.error('Missing key files. Please run `npx tsx scripts/devnet-setup.ts` first.');
    process.exit(1);
  }

  const payerData = JSON.parse(fs.readFileSync(PAYER_FILE, 'utf8'));
  const merchantData = JSON.parse(fs.readFileSync(MERCHANT_FILE, 'utf8'));

  console.log(`Payer Address:    ${payerData.publicKey}`);
  console.log(`Merchant Address: ${merchantData.publicKey}`);
  console.log(`Facilitator:      ${OFFICIAL_FACILITATOR_URL}`);
  console.log(`RPC:              ${DEVNET_RPC}\n`);

  // Check balances
  console.log('Checking balances on Solana devnet...');
  const balRes = await rpcCall('getBalance', [payerData.publicKey]);
  const solLamports = balRes?.value ?? 0;
  console.log(`Payer SOL Balance:  ${solLamports / 1e9} SOL`);

  const tokenAccounts = await rpcCall('getTokenAccountsByOwner', [
    payerData.publicKey,
    { mint: DEVNET_USDC_MINT },
    { encoding: 'jsonParsed' },
  ]);

  const usdcAccounts = tokenAccounts?.value || [];
  let usdcBalance = 0;
  if (usdcAccounts.length > 0) {
    for (const acc of usdcAccounts) {
      const amount = Number(acc.account.data.parsed.info.tokenAmount.uiAmount || 0);
      usdcBalance += amount;
      console.log(`Found USDC Account: ${acc.pubkey} | Balance: ${amount} USDC`);
    }
  } else {
    console.log('Payer USDC Balance: 0 USDC (no ATA account found)');
  }

  if (solLamports === 0 || usdcBalance < 1) {
    console.log('\n----------------------------------------------------------------');
    console.log('⚠️ FUNDING NEEDED BEFORE LIVE DEVNET SETTLEMENT CAN EXECUTE:');
    console.log('----------------------------------------------------------------');
    console.log(`1. Devnet SOL (for rent/account creation if required):`);
    console.log(`   Address: ${payerData.publicKey}`);
    console.log(`   Faucet:  https://faucet.solana.com or \`solana airdrop 1 ${payerData.publicKey} --url devnet\``);
    console.log(`\n2. Devnet USDC (at least 1 USDC):`);
    console.log(`   Address: ${payerData.publicKey}`);
    console.log(`   Mint:    ${DEVNET_USDC_MINT}`);
    console.log(`   Faucet:  https://faucet.circle.com or https://spl-token-faucet.com`);
    console.log('----------------------------------------------------------------\n');
    console.log('[Notice] Skipping actual live transfer until funds arrive.');
    return;
  }

  // If funded, proceed with live payment through official x402 resource server
  console.log('\n[CredaVer] Sufficient devnet funds detected. Initializing demo merchant server...');
  console.log(`[CredaVer Debug] Configured network: "${SOLANA_DEVNET_GENESIS}"`);
  console.log(`[CredaVer Debug] Expected network:   "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`);
  console.log(`[CredaVer Debug] Exact match: ${SOLANA_DEVNET_GENESIS === 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'}`);

  process.env.MERCHANT_WALLET = merchantData.publicKey;

  const app = await createDemoMerchantApp({
    useOfficialResourceServer: true,
    facilitatorUrl: OFFICIAL_FACILITATOR_URL,
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(4025, '127.0.0.1', () => resolve()));
  const merchantUrl = 'http://127.0.0.1:4025';
  console.log(`Demo merchant running at ${merchantUrl}`);

  try {
    const signer = await createKeyPairSignerFromBytes(
      new Uint8Array(payerData.secretKeyArray)
    );

    // Operator issues Mandate
    const operator = generateEd25519Keypair();
    const store = new MemoryStore();
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s1-live',
        operatorPubkey: operator.publicKey,
        agentPubkey: payerData.publicKey,
        allowedMerchants: [merchantData.publicKey],
        allowedAssets: [DEVNET_USDC_MINT],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 5000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}`,
        network: SOLANA_DEVNET_GENESIS,
      },
      operator.secretKey,
      payerData.secretKey
    );

    console.log(`Mandate issued: ${mandate.mandateHash}`);

    const client = new x402Client();
    client.register(SOLANA_DEVNET_GENESIS, new ExactSvmScheme(signer));
    client.registerPolicy(createCredaverClientPolicy(mandate));

    const payingFetch = wrapFetchWithPayment(fetch, client);

    console.log('Requesting /api/weather via wrapFetchWithPayment (x402 flow)...');
    const response = await payingFetch(`${merchantUrl}/api/weather`);

    console.log(`Response Status: ${response.status}`);
    const paymentResponseHeader = response.headers.get('payment-response');
    let txSignature = '';
    if (paymentResponseHeader) {
      const decodedPaymentResp = Buffer.from(paymentResponseHeader, 'base64').toString('utf8');
      console.log('Payment Response Header (Raw JSON):', decodedPaymentResp);
      try {
        const parsedResp = JSON.parse(decodedPaymentResp);
        txSignature = parsedResp.txSignature || parsedResp.transaction || '';
      } catch {
        // ignore
      }
    }
    const responseBody = await response.json();
    console.log('Response Body:', JSON.stringify(responseBody, null, 2));

    if (txSignature) {
      console.log('\n========================================================================');
      console.log('✅ LIVE DEVNET SETTLEMENT CONFIRMED!');
      console.log(`Tx Signature:    ${txSignature}`);
      console.log(`Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
      console.log('========================================================================\n');
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Error during devnet payment test:', err);
  process.exit(1);
});

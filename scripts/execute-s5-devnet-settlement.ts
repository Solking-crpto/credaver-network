import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
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
  evaluateAndSignTransaction,
} from '../packages/core/src/index.js';
import {
  CredaverConstrainedSigner,
  createCredaverClientPolicy,
} from '../packages/x402-guard/src/index.js';

const PAYER_FILE = path.resolve(process.cwd(), '.devnet-payer.json');
const MERCHANT_FILE = path.resolve(process.cwd(), '.devnet-merchant.json');

async function main() {
  console.log('========================================================================');
  console.log('  CredaVer Network — Spike S5 Live Devnet Settlement via Constrained Signer');
  console.log('========================================================================\n');

  if (!fs.existsSync(PAYER_FILE) || !fs.existsSync(MERCHANT_FILE)) {
    console.error('Missing key files (.devnet-payer.json / .devnet-merchant.json)');
    process.exit(1);
  }

  const payerData = JSON.parse(fs.readFileSync(PAYER_FILE, 'utf8'));
  const merchantData = JSON.parse(fs.readFileSync(MERCHANT_FILE, 'utf8'));

  console.log(`Funding Wallet (Server Custody): ${payerData.publicKey}`);
  console.log(`Demo Merchant Wallet:           ${merchantData.publicKey}`);
  console.log(`Facilitator:                    ${OFFICIAL_FACILITATOR_URL}\n`);

  // 1. Initialize demo merchant server
  process.env.MERCHANT_WALLET = merchantData.publicKey;
  const app = await createDemoMerchantApp({
    useOfficialResourceServer: true,
    facilitatorUrl: OFFICIAL_FACILITATOR_URL,
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(4026, '127.0.0.1', () => resolve()));
  const merchantUrl = 'http://127.0.0.1:4026';
  console.log(`Demo merchant listening at ${merchantUrl}`);

  try {
    // 2. Generate Operator & Agent Keys
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair(); // Agent has ONLY its identity key!
    const store = new MemoryStore();

    console.log(`Operator Pubkey:        ${operator.publicKey}`);
    console.log(`Agent Identity Pubkey:  ${agent.publicKey}`);
    console.log(`[Security Invariant] Agent has ZERO access to funding wallet private key!\n`);

    // 3. Operator issues Mandate
    const mandate = issueSignedMandate(
      {
        mandateId: `mandate-s5-live-${Date.now()}`,
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchantData.publicKey],
        allowedAssets: [DEVNET_USDC_MINT],
        maxPerTx: '2000000',  // 2 USDC max
        totalCap: '10000000', // 10 USDC total cap
        validFrom: Date.now() - 5000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}`,
        network: SOLANA_DEVNET_GENESIS,
      },
      operator.secretKey,
      agent.secretKey
    );
    await store.saveMandate(mandate);
    console.log(`Mandate Activated: ${mandate.mandateHash}`);

    // 4. Initialize CredaverConstrainedSigner
    // In production, delegate calls POST /api/sign. Here we simulate the server-side signing endpoint.
    const constrainedSigner = new CredaverConstrainedSigner({
      fundingAddress: payerData.publicKey,
      mandate,
      agentSecretKey: agent.secretKey, // Identity key ONLY!
      localSignerDelegate: async (params) => {
        console.log('[CredaVer Server] Receiving constrained signing request...');
        return evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: payerData.secretKey, // Sever holds funding key in secure vault
        });
      },
    });

    // Provide context for impending x402 payment
    constrainedSigner.setContext({
      merchantPubkey: merchantData.publicKey,
      asset: DEVNET_USDC_MINT,
      amount: '1000000', // 1 USDC
      audience: `${merchantUrl}/api/weather`,
    });

    // 5. Register in x402 client
    const client = new x402Client();
    client.register(SOLANA_DEVNET_GENESIS, new ExactSvmScheme(constrainedSigner as any));
    client.registerPolicy(createCredaverClientPolicy(mandate));

    const payingFetch = wrapFetchWithPayment(fetch, client);

    console.log('\nExecuting payingFetch(/api/weather) through x402 + CredaverConstrainedSigner...');
    const response = await payingFetch(`${merchantUrl}/api/weather`);

    console.log(`Response Status: ${response.status}`);
    const paymentResponseHeader = response.headers.get('payment-response');
    let txSignature = '';
    if (paymentResponseHeader) {
      const decodedPaymentResp = Buffer.from(paymentResponseHeader, 'base64').toString('utf8');
      console.log('Payment Response Header:', decodedPaymentResp);
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
      console.log('✅ SPIKE S5 LIVE DEVNET SETTLEMENT VIA CONSTRAINED SIGNER PASSED!');
      console.log(`Tx Signature:    ${txSignature}`);
      console.log(`Solana Explorer: https://explorer.solana.com/tx/${txSignature}?cluster=devnet`);
      console.log('========================================================================\n');
    } else {
      console.log('\nPayment completed, but txSignature was not in payment-response header.');
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('\n[FATAL] Error in S5 live runner:', err);
  process.exit(1);
});

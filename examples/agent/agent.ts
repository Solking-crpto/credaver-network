/**
 * CredaVer Network — Example Autonomous AI Agent
 *
 * Demonstrates an autonomous AI agent interacting with an x402 resource server
 * WITHOUT holding any private keys to the funding wallet.
 *
 * Security Invariant:
 * The agent holds ONLY an Ed25519 identity keypair used to sign request-bound
 * payment proofs. The Solana funding wallet private key resides securely in
 * the CredaVer Policy Decision & Signing service.
 */

import { generateEd25519Keypair, issueSignedMandate, SignedMandate } from '@credaver/core';
import { CredaverConstrainedSigner, createCredaverClientPolicy } from '@credaver/x402-guard';
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm';

const CREDAVER_SIGNING_URL = process.env.CREDAVER_URL || 'http://localhost:3000/api/sign';
const MERCHANT_URL = process.env.MERCHANT_URL || 'http://localhost:4025/api/weather';

async function runAutonomousAgent() {
  console.log('========================================================================');
  console.log('  CredaVer Network — Autonomous Agent with Zero Funding Key Custody');
  console.log('========================================================================\n');

  // 1. Generate Agent Identity Keypair
  // Notice: This is strictly an IDENTITY key (Ed25519), NOT a Solana funding key.
  const agentIdentity = generateEd25519Keypair();
  console.log(`[Agent Identity] Public Key: ${agentIdentity.publicKey}`);
  console.log('[Agent Security] Funding Key Custody: NONE (Zero keys held by agent)\n');

  // 2. Mock Operator Mandate (in production, passed via environment or operator API)
  const operator = generateEd25519Keypair();
  const fundingAddress = 'HnXPP38ctGbDqkfFrsr2B7y9DYLKmVZBiXLaiKMJomSS'; // Server-custodied wallet
  const merchantAddress = 'D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW'; // Demo Merchant
  const usdcMint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
  const devnetGenesis = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

  console.log('[Operator] Issuing cryptographically signed mandate...');
  const mandate: SignedMandate = issueSignedMandate(
    {
      mandateId: `mandate-agent-demo-${Date.now()}`,
      operatorPubkey: operator.publicKey,
      agentPubkey: agentIdentity.publicKey,
      allowedMerchants: [merchantAddress],
      allowedAssets: [usdcMint],
      maxPerTx: '2000000', // 2.00 USDC max per transaction
      totalCap: '10000000', // 10.00 USDC total spend cap
      validFrom: Date.now() - 5000,
      expiresAt: Date.now() + 3600000, // 1 hour validity
      nonce: `nonce-${Date.now()}`,
      network: devnetGenesis,
    },
    operator.secretKey,
    agentIdentity.secretKey
  );
  console.log(`[Mandate] ID: ${mandate.mandateId}`);
  console.log(`[Mandate] Hash: ${mandate.mandateHash}\n`);

  // 3. Configure CredaverConstrainedSigner
  // When an x402 402 Payment Required response arrives, this signer delegates
  // signing to the CredaVer Decision & Signing API endpoint (/api/sign).
  const constrainedSigner = new CredaverConstrainedSigner({
    fundingAddress,
    mandate,
    agentSecretKey: agentIdentity.secretKey,
    credaverApiUrl: CREDAVER_SIGNING_URL,
  });

  // Provide upcoming payment context
  constrainedSigner.setContext({
    merchantPubkey: merchantAddress,
    asset: usdcMint,
    amount: '1000000', // 1.00 USDC
    audience: MERCHANT_URL,
  });

  // 4. Register with @x402 Client
  const client = new x402Client();
  client.register(devnetGenesis, new ExactSvmScheme(constrainedSigner as any));
  client.registerPolicy(createCredaverClientPolicy(mandate));

  // 5. Wrap Fetch with Payment Capability
  const payingFetch = wrapFetchWithPayment(fetch, client);

  console.log(`[Agent] Calling x402 protected resource at ${MERCHANT_URL}...`);
  try {
    const response = await payingFetch(MERCHANT_URL);
    console.log(`[Agent] Response HTTP Status: ${response.status}`);

    const paymentResponse = response.headers.get('payment-response');
    if (paymentResponse) {
      const decoded = Buffer.from(paymentResponse, 'base64').toString('utf8');
      console.log(`[Agent] Settlement Proof Header: ${decoded}`);
    }

    if (response.ok) {
      const data = await response.json();
      console.log('\n[Agent] Successfully received paid telemetry:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`[Agent] Payment or service error: ${errorText}`);
    }
  } catch (err: any) {
    console.error(`[Agent] Execution failed: ${err.message}`);
  }
}

// Only execute directly when run as script
if (process.argv[1]?.endsWith('agent.ts')) {
  runAutonomousAgent().catch(console.error);
}

export { runAutonomousAgent };

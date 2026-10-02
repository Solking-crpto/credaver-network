import {
  generateEd25519Keypair,
  issueSignedMandate,
  MemoryStore,
  verifyEd25519,
  evaluateAndSignTransaction,
  ReasonCode,
} from '../packages/core/src/index.js';
import {
  CredaverConstrainedSigner,
  CredaverSignatureDeniedError,
  CredaverSignatureReviewRequiredError,
} from '../packages/x402-guard/src/index.js';

async function main() {
  console.log('========================================================================');
  console.log('  CredaVer Network — Spike S5: Constrained Signer Verification');
  console.log('========================================================================\n');

  const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const USDC_ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  // 1. Entities
  const operator = generateEd25519Keypair();
  const agent = generateEd25519Keypair();
  const fundingWallet = generateEd25519Keypair(); // Private key held ONLY by CredaVer
  const merchant = generateEd25519Keypair();
  const store = new MemoryStore();

  console.log('1. Generated Cryptographic Identities:');
  console.log(`   Operator Pubkey:        ${operator.publicKey}`);
  console.log(`   Agent Identity Pubkey:  ${agent.publicKey}`);
  console.log(`   Funding Wallet (Payer): ${fundingWallet.publicKey} [Custody: CredaVer Server]`);
  console.log(`   Demo Merchant Pubkey:   ${merchant.publicKey}\n`);

  // 2. Operator issues Mandate
  const mandate = issueSignedMandate(
    {
      mandateId: 'mandate-s5-demo',
      operatorPubkey: operator.publicKey,
      agentPubkey: agent.publicKey,
      allowedMerchants: [merchant.publicKey],
      allowedAssets: [USDC_ASSET],
      maxPerTx: '1500000', // 1.5 USDC cap
      totalCap: '5000000',  // 5.0 USDC cap
      reviewThreshold: '1100000', // >= 1.1 USDC requires human review
      validFrom: Date.now() - 1000,
      expiresAt: Date.now() + 3600000,
      nonce: `nonce-${Date.now()}`,
      network: NETWORK,
    },
    operator.secretKey,
    agent.secretKey
  );
  await store.saveMandate(mandate);

  console.log('2. Operator Mandate Activated:');
  console.log(`   Mandate Hash:     ${mandate.mandateHash}`);
  console.log(`   Per-Tx Cap:       1.50 USDC (1,500,000 base units)`);
  console.log(`   Total Cap:        5.00 USDC (5,000,000 base units)`);
  console.log(`   Review Threshold: 1.10 USDC (1,100,000 base units)\n`);

  // 3. Initialize Agent Constrained Signer
  // Agent has ZERO private keys for fundingWallet!
  const signer = new CredaverConstrainedSigner({
    fundingAddress: fundingWallet.publicKey,
    mandate,
    agentSecretKey: agent.secretKey, // Identity key ONLY
    localSignerDelegate: async (params) => {
      // Server-side CredaVer policy evaluation & constrained signing
      return evaluateAndSignTransaction({
        mandate: params.mandate,
        proof: params.proof,
        transactionMessageBytes: params.transactionMessageBytes,
        store,
        paymentSecretKey: fundingWallet.secretKey, // In real deployment, loaded from KMS/Vault
      });
    },
  });

  // Test Case A: Valid Payment (1.0 USDC)
  console.log('--- Scenario A: Compliant Payment Request (1.0 USDC) ---');
  signer.setContext({
    merchantPubkey: merchant.publicKey,
    asset: USDC_ASSET,
    amount: '1000000', // 1.0 USDC
    audience: 'https://demo-merchant.credaver.network/api/weather',
  });

  const txA = { messageBytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) };
  const signaturesA = await signer.signTransactions([txA]);
  const sigA = signaturesA[0][fundingWallet.publicKey];

  console.log(`[CredaVer PDP] Policy Decision: ALLOW`);
  console.log(`[CredaVer Signer] Signature Generated: ${Buffer.from(sigA).toString('hex').slice(0, 32)}...`);
  console.log(`[Audit Receipt] Receipt Hash: ${signer.getLastReceipt()?.receiptHash}`);

  // Cryptographic verification
  const validPayerSig = verifyEd25519(txA.messageBytes, sigA, fundingWallet.publicKey);
  console.log(`[Verification] Signature valid under Funding Wallet: ${validPayerSig}`);
  const validAgentSig = verifyEd25519(txA.messageBytes, sigA, agent.publicKey);
  console.log(`[Verification] Signature matches Agent key:         ${validAgentSig} (Expected FALSE)`);

  const currentSpendA = await store.getMandateSpend(mandate.mandateId);
  console.log(`[Ledger] Cumulative Mandate Spend: ${Number(currentSpendA) / 1e6} USDC\n`);

  // Test Case B: Policy Violation - Amount Exceeds Per-Tx Cap (2.0 USDC)
  console.log('--- Scenario B: Policy Violation - Cap Exceeded (2.0 USDC > 1.5 USDC) ---');
  signer.setContext({
    merchantPubkey: merchant.publicKey,
    asset: USDC_ASSET,
    amount: '2000000', // Exceeds 1.5 USDC cap
    audience: 'https://demo-merchant.credaver.network/api/weather',
  });

  const txB = { messageBytes: new Uint8Array([9, 10, 11, 12]) };
  try {
    await signer.signTransactions([txB]);
    console.error('FAILED: Transaction should have been rejected!');
  } catch (err: any) {
    if (err instanceof CredaverSignatureDeniedError) {
      console.log(`[CredaVer PDP] Policy Decision: DENY`);
      console.log(`[CredaVer PDP] Reason Codes:     ${err.reasonCodes.join(', ')}`);
      console.log(`[Audit Receipt] Denial Receipt:  ${err.receipt.receiptHash}`);
      console.log('[Security] Transaction was NOT signed. Funds remain secure.');
    } else {
      throw err;
    }
  }

  const currentSpendB = await store.getMandateSpend(mandate.mandateId);
  console.log(`[Ledger] Cumulative Mandate Spend: ${Number(currentSpendB) / 1e6} USDC (Unchanged)\n`);

  // Test Case C: Policy Violation - Unauthorized Merchant
  console.log('--- Scenario C: Policy Violation - Unauthorized Merchant ---');
  const rogueMerchant = generateEd25519Keypair();
  signer.setContext({
    merchantPubkey: rogueMerchant.publicKey,
    asset: USDC_ASSET,
    amount: '500000', // 0.5 USDC
    audience: 'https://rogue-merchant.example.com/api/drain',
  });

  const txC = { messageBytes: new Uint8Array([13, 14, 15, 16]) };
  try {
    await signer.signTransactions([txC]);
    console.error('FAILED: Transaction should have been rejected!');
  } catch (err: any) {
    if (err instanceof CredaverSignatureDeniedError) {
      console.log(`[CredaVer PDP] Policy Decision: DENY`);
      console.log(`[CredaVer PDP] Reason Codes:     ${err.reasonCodes.join(', ')}`);
      console.log('[Security] Transaction was NOT signed.');
    } else {
      throw err;
    }
  }

  // Test Case D: Review Gate - High Value (1.2 USDC)
  console.log('\n--- Scenario D: Human Review Required (1.2 USDC >= 1.1 USDC) ---');
  signer.setContext({
    merchantPubkey: merchant.publicKey,
    asset: USDC_ASSET,
    amount: '1200000', // 1.2 USDC triggers review
    audience: 'https://demo-merchant.credaver.network/api/weather',
  });

  const txD = { messageBytes: new Uint8Array([17, 18, 19, 20]) };
  try {
    await signer.signTransactions([txD]);
    console.error('FAILED: Transaction should have been held for review!');
  } catch (err: any) {
    if (err instanceof CredaverSignatureReviewRequiredError) {
      console.log(`[CredaVer PDP] Policy Decision: REVIEW`);
      console.log(`[CredaVer PDP] Reason Codes:     ${err.reasonCodes.join(', ')}`);
      console.log(`[Audit Receipt] Review Receipt:  ${err.receipt.receiptHash}`);
      console.log('[Workflow] Held in pending queue until operator approves in Dashboard.');
    } else {
      throw err;
    }
  }

  console.log('\n========================================================================');
  console.log('✅ Milestone 1 / Spike S5 Constrained Signer Verification COMPLETE');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

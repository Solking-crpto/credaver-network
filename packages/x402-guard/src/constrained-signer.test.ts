import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  MemoryStore,
  verifyEd25519,
  evaluateAndSignTransaction,
  ReasonCode,
} from '@credaver/core';
import {
  CredaverConstrainedSigner,
  CredaverSignatureDeniedError,
  CredaverSignatureReviewRequiredError,
} from './constrained-signer.js';

describe('Milestone 1: Constrained Signer Spike S5 (Policy-Gated Key Custody)', () => {
  let operator: ReturnType<typeof generateEd25519Keypair>;
  let agent: ReturnType<typeof generateEd25519Keypair>;
  let fundingWallet: ReturnType<typeof generateEd25519Keypair>;
  let merchant: ReturnType<typeof generateEd25519Keypair>;
  let store: MemoryStore;

  const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const USDC_ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  beforeEach(() => {
    operator = generateEd25519Keypair();
    agent = generateEd25519Keypair();
    fundingWallet = generateEd25519Keypair();
    merchant = generateEd25519Keypair();
    store = new MemoryStore();
  });

  it('1. Happy Path: Agent with ZERO private keys gets transaction signed when within cap', async () => {
    // Operator issues mandate authorizing agent up to 2 USDC per tx, 10 USDC total
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s5-happy',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '2000000',
        totalCap: '10000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-s5-1',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );
    await store.saveMandate(mandate);

    // Agent holds ONLY its own agent.secretKey (NOT fundingWallet.secretKey!)
    const signer = new CredaverConstrainedSigner({
      fundingAddress: fundingWallet.publicKey,
      mandate,
      agentSecretKey: agent.secretKey,
      localSignerDelegate: async (params) => {
        return evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: fundingWallet.secretKey, // Held in CredaVer custody
        });
      },
    });

    expect(signer.address).toBe(fundingWallet.publicKey);

    // Set payment intent (1 USDC = 1000000 base units)
    signer.setContext({
      merchantPubkey: merchant.publicKey,
      asset: USDC_ASSET,
      amount: '1000000',
      audience: 'https://merchant.example.com/api/weather',
    });

    // Dummy transaction message bytes representing an SVM transaction
    const mockTxMessage = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const tx = { messageBytes: mockTxMessage };

    // Agent requests signing through standard @solana/kit signTransactions interface
    const signatures = await signer.signTransactions([tx]);

    expect(signatures).toHaveLength(1);
    const sigMap = signatures[0];
    const signatureBytes = sigMap[fundingWallet.publicKey];
    expect(signatureBytes).toBeDefined();
    expect(signatureBytes).toHaveLength(64);

    // Verify cryptographic signature matches the FUNDING WALLET public key, NOT agent key!
    const isValidUnderFundingKey = verifyEd25519(
      mockTxMessage,
      signatureBytes,
      fundingWallet.publicKey
    );
    expect(isValidUnderFundingKey).toBe(true);

    const isValidUnderAgentKey = verifyEd25519(
      mockTxMessage,
      signatureBytes,
      agent.publicKey
    );
    expect(isValidUnderAgentKey).toBe(false);

    // Verify receipt was issued and stored
    const receipt = signer.getLastReceipt();
    expect(receipt).toBeDefined();
    expect(receipt?.decision).toBe('ALLOW');
    expect(receipt?.amount).toBe('1000000');

    // Verify cumulative spend in store
    const totalSpend = await store.getMandateSpend(mandate.mandateId);
    expect(totalSpend).toBe(1000000n);
  });

  it('2. Policy Violation: Agent cannot sign payment exceeding maxPerTx cap', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s5-cap',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '1000000', // 1 USDC max
        totalCap: '5000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-s5-2',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );
    await store.saveMandate(mandate);

    const signer = new CredaverConstrainedSigner({
      fundingAddress: fundingWallet.publicKey,
      mandate,
      agentSecretKey: agent.secretKey,
      localSignerDelegate: async (params) => {
        return evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: fundingWallet.secretKey,
        });
      },
    });

    // Agent attempts to pay 2 USDC (violates 1 USDC maxPerTx)
    signer.setContext({
      merchantPubkey: merchant.publicKey,
      asset: USDC_ASSET,
      amount: '2000000',
      audience: 'https://merchant.example.com/api/weather',
    });

    const mockTxMessage = new Uint8Array([11, 22, 33, 44]);
    const tx = { messageBytes: mockTxMessage };

    // Expect transaction signing to be cleanly rejected
    await expect(signer.signTransactions([tx])).rejects.toThrow(CredaverSignatureDeniedError);

    const receipt = signer.getLastReceipt();
    expect(receipt?.decision).toBe('DENY');
    expect(receipt?.reasonCodes).toContain(ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT);

    // Cumulative spend remains ZERO
    const totalSpend = await store.getMandateSpend(mandate.mandateId);
    expect(totalSpend).toBe(0n);
  });

  it('3. Policy Violation: Agent cannot pay unlisted merchant', async () => {
    const unauthorizedMerchant = generateEd25519Keypair();

    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s5-merchant',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey], // ONLY authorized merchant
        allowedAssets: [USDC_ASSET],
        maxPerTx: '1000000',
        totalCap: '5000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-s5-3',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const signer = new CredaverConstrainedSigner({
      fundingAddress: fundingWallet.publicKey,
      mandate,
      agentSecretKey: agent.secretKey,
      localSignerDelegate: async (params) => {
        return evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: fundingWallet.secretKey,
        });
      },
    });

    signer.setContext({
      merchantPubkey: unauthorizedMerchant.publicKey,
      asset: USDC_ASSET,
      amount: '500000',
      audience: 'https://rogue-merchant.example.com/api/drain',
    });

    const mockTxMessage = new Uint8Array([99, 88, 77]);
    await expect(signer.signTransactions([{ messageBytes: mockTxMessage }])).rejects.toThrow(
      CredaverSignatureDeniedError
    );

    const receipt = signer.getLastReceipt();
    expect(receipt?.decision).toBe('DENY');
    expect(receipt?.reasonCodes).toContain('MERCHANT_NOT_ALLOWED');
  });

  it('4. Human Review Gate: Payment exceeding reviewThreshold triggers 202 REVIEW', async () => {
    const mandate = issueSignedMandate(
      {
        mandateId: 'mandate-s5-review',
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchant.publicKey],
        allowedAssets: [USDC_ASSET],
        maxPerTx: '5000000',
        totalCap: '20000000',
        reviewThreshold: '2000000', // Any payment >= 2 USDC triggers human review
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'nonce-s5-4',
        network: NETWORK,
      },
      operator.secretKey,
      agent.secretKey
    );

    const signer = new CredaverConstrainedSigner({
      fundingAddress: fundingWallet.publicKey,
      mandate,
      agentSecretKey: agent.secretKey,
      localSignerDelegate: async (params) => {
        return evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: fundingWallet.secretKey,
        });
      },
    });

    // 2.5 USDC exceeds 2.0 USDC review threshold
    signer.setContext({
      merchantPubkey: merchant.publicKey,
      asset: USDC_ASSET,
      amount: '2500000',
      audience: 'https://merchant.example.com/api/weather',
    });

    const mockTxMessage = new Uint8Array([1, 2, 3]);
    await expect(signer.signTransactions([{ messageBytes: mockTxMessage }])).rejects.toThrow(
      CredaverSignatureReviewRequiredError
    );

    const receipt = signer.getLastReceipt();
    expect(receipt?.decision).toBe('REVIEW');
    expect(receipt?.reasonCodes).toContain(ReasonCode.HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW);

    // No funds spent while awaiting review
    const totalSpend = await store.getMandateSpend(mandate.mandateId);
    expect(totalSpend).toBe(0n);
  });

  it('5. Agent Cannot Bypass: Attempting to sign without CredaVer fails Solana verification', async () => {
    // The rogue agent tries to forge a signature on mockTxMessage using its own agent.secretKey
    const mockTxMessage = new Uint8Array([42, 42, 42, 42]);
    const forgedSignature = agent.secretKey; // Agent only has its own key

    // Sign message with agent's key
    const { signEd25519 } = await import('@credaver/core');
    const forgedSig = signEd25519(mockTxMessage, forgedSignature);

    // Verifying against the actual funding wallet (payer) FAILS
    const isValidPayerSignature = verifyEd25519(
      mockTxMessage,
      forgedSig,
      fundingWallet.publicKey
    );
    expect(isValidPayerSignature).toBe(false);
  });
});

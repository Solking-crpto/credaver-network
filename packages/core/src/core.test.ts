import { describe, it, expect, beforeEach } from 'vitest';
import { canonicalizeJson, hashCanonicalJson } from './canonical.js';
import {
  generateEd25519Keypair,
  encodeBase58,
  decodeBase58,
  signEd25519,
  verifyEd25519,
} from './crypto.js';
import {
  issueSignedMandate,
  verifySignedMandate,
  MandateCore,
} from './mandate.js';
import {
  createSignedPaymentProof,
  verifySignedPaymentProof,
  PaymentProofCore,
} from './proof.js';
import {
  evaluatePaymentPolicy,
  ReasonCode,
} from './policy.js';
import {
  issueSignedReceipt,
  verifySignedReceipt,
  ReceiptBody,
} from './receipt.js';
import { MemoryStore } from './store/index.js';

describe('S4 Crypto Core & JCS Canonicalization', () => {
  describe('1. RFC 8785 JCS Canonicalization', () => {
    it('produces identical canonical string regardless of property order', () => {
      const objA = { z: 1, a: 'hello', m: { b: 2, a: 1 } };
      const objB = { m: { a: 1, b: 2 }, a: 'hello', z: 1 };

      const canonA = canonicalizeJson(objA);
      const canonB = canonicalizeJson(objB);

      expect(canonA).toBe(canonB);
      expect(hashCanonicalJson(objA)).toBe(hashCanonicalJson(objB));
    });

    it('correctly handles arrays, primitives, and nulls', () => {
      const complex = {
        arr: [3, 2, 1],
        flag: true,
        empty: null,
        num: 42,
      };
      const canon = canonicalizeJson(complex);
      expect(canon).toBe('{"arr":[3,2,1],"empty":null,"flag":true,"num":42}');
    });
  });

  describe('2. Ed25519 & Base58 Crypto', () => {
    it('generates valid keypairs and handles Base58 roundtrip', () => {
      const kp = generateEd25519Keypair();
      expect(kp.publicKey).toBeDefined();
      expect(kp.secretKey).toBeDefined();

      const decodedPub = decodeBase58(kp.publicKey);
      expect(decodedPub.length).toBe(32);
      expect(encodeBase58(decodedPub)).toBe(kp.publicKey);
    });

    it('signs and verifies messages correctly', () => {
      const kp = generateEd25519Keypair();
      const message = 'Authorize CredaVer devnet spend';
      const sig = signEd25519(message, kp.secretKey);

      expect(sig.length).toBeGreaterThan(60);
      expect(verifyEd25519(message, sig, kp.publicKey)).toBe(true);
    });

    it('fails verification on tampered message or wrong key', () => {
      const kp1 = generateEd25519Keypair();
      const kp2 = generateEd25519Keypair();
      const message = 'Original message';
      const sig = signEd25519(message, kp1.secretKey);

      // Wrong key
      expect(verifyEd25519(message, sig, kp2.publicKey)).toBe(false);
      // Tampered message
      expect(verifyEd25519('Mutated message', sig, kp1.publicKey)).toBe(false);
    });
  });

  describe('3. Agent Mandates', () => {
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair();

    const sampleCore: MandateCore = {
      mandateId: 'mandate-dev-001',
      operatorPubkey: operator.publicKey,
      agentPubkey: agent.publicKey,
      allowedMerchants: ['Merchant111111111111111111111111111111111111'],
      allowedAssets: ['USDC', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
      maxPerTx: '5000000', // 5 USDC
      totalCap: '50000000', // 50 USDC
      reviewThreshold: '2000000', // 2 USDC
      validFrom: Date.now() - 1000,
      expiresAt: Date.now() + 86400000, // +1 day
      nonce: 'mandate-nonce-001',
      network: 'solana:devnet',
    };

    it('issues and verifies a valid mandate with mutual signatures', () => {
      const mandate = issueSignedMandate(sampleCore, operator.secretKey, agent.secretKey);

      expect(mandate.mandateHash).toHaveLength(64);
      expect(mandate.operatorSignature).toBeDefined();
      expect(mandate.agentCounterSignature).toBeDefined();

      const verification = verifySignedMandate(mandate);
      expect(verification.isValid).toBe(true);
      expect(verification.mandateHash).toBe(mandate.mandateHash);
    });

    it('rejects a mandate with a tampered spend limit', () => {
      const mandate = issueSignedMandate(sampleCore, operator.secretKey, agent.secretKey);
      const tampered = { ...mandate, maxPerTx: '999999999' };

      const verification = verifySignedMandate(tampered);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('hash mismatch');
    });

    it('rejects a mandate with an invalid operator signature', () => {
      const imposter = generateEd25519Keypair();
      const mandate = issueSignedMandate(sampleCore, imposter.secretKey, agent.secretKey);

      const verification = verifySignedMandate(mandate);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('Invalid operator signature');
    });
  });

  describe('4. Request-Bound Payment Proofs', () => {
    const agent = generateEd25519Keypair();
    const now = Date.now();

    const sampleProofCore: PaymentProofCore = {
      mandateHash: 'a'.repeat(64),
      agentPubkey: agent.publicKey,
      merchantPubkey: 'Merchant111111111111111111111111111111111111',
      asset: 'USDC',
      amount: '1000000', // 1 USDC
      audience: 'https://demo-merchant.credav.local/api/weather',
      network: 'solana:devnet',
      nonce: 'nonce-proof-abc-12345',
      timestamp: now,
      expiresAt: now + 300000, // +5 min
    };

    it('creates and verifies a signed payment proof', () => {
      const proof = createSignedPaymentProof(sampleProofCore, agent.secretKey);
      expect(proof.proofHash).toHaveLength(64);

      const verification = verifySignedPaymentProof(proof);
      expect(verification.isValid).toBe(true);
    });

    it('rejects an expired payment proof', () => {
      const expiredCore: PaymentProofCore = {
        ...sampleProofCore,
        expiresAt: now - 1000, // Expired 1 second ago
      };
      const proof = createSignedPaymentProof(expiredCore, agent.secretKey);
      const verification = verifySignedPaymentProof(proof);

      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('Payment proof expired');
    });

    it('rejects payment proof with tampered amount', () => {
      const proof = createSignedPaymentProof(sampleProofCore, agent.secretKey);
      const tampered = { ...proof, amount: '9999999' };

      const verification = verifySignedPaymentProof(tampered);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('Proof hash mismatch');
    });
  });

  describe('5. Policy Engine Deterministic Decision Gates', () => {
    let store: MemoryStore;
    let operator = generateEd25519Keypair();
    let agent = generateEd25519Keypair();
    let now = Date.now();

    const baseCore: MandateCore = {
      mandateId: 'mandate-pol-001',
      operatorPubkey: operator.publicKey,
      agentPubkey: agent.publicKey,
      allowedMerchants: ['ApprovedMerchant111111111111111111111111111'],
      allowedAssets: ['USDC'],
      maxPerTx: '2000000', // 2 USDC max per tx
      totalCap: '10000000', // 10 USDC total cap
      reviewThreshold: '1500000', // 1.5 USDC requires review
      validFrom: now - 10000,
      expiresAt: now + 3600000,
      nonce: 'mandate-pol-nonce-001',
      network: 'solana:devnet',
    };

    beforeEach(() => {
      store = new MemoryStore();
      now = Date.now();
    });

    it('ALLOW: passes all gates for valid payment within thresholds', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000', // 1 USDC (< reviewThreshold 1.5 USDC)
        audience: 'https://merchant.api/service',
        network: 'solana:devnet',
        nonce: 'req-nonce-allow-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store);
      expect(result.decision).toBe('ALLOW');
      expect(result.reasonCodes).toContain(ReasonCode.POLICY_PASSED_ALL_GATES);
    });

    it('DENY: rejects payment when amount exceeds per-transaction limit', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '3000000', // 3 USDC > maxPerTx (2 USDC)
        audience: 'https://merchant.api/service',
        network: 'solana:devnet',
        nonce: 'req-nonce-over-tx-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store);
      expect(result.decision).toBe('DENY');
      expect(result.reasonCodes).toContain(ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT);
    });

    it('DENY: rejects payment when cumulative spend cap is exceeded', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      // Pre-record spend of 9.5 USDC
      await store.recordMandateSpend(mandate.mandateId, 9500000n);

      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000', // 1 USDC + 9.5 USDC = 10.5 USDC > totalCap (10 USDC)
        audience: 'https://merchant.api/service',
        network: 'solana:devnet',
        nonce: 'req-nonce-cap-exceed-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store);
      expect(result.decision).toBe('DENY');
      expect(result.reasonCodes).toContain(ReasonCode.AMOUNT_EXCEEDS_TOTAL_CAP);
    });

    it('DENY: rejects payment when mandate is revoked', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      mandate.revoked = true;

      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '500000',
        audience: 'https://merchant.api/service',
        network: 'solana:devnet',
        nonce: 'req-nonce-revoked-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store);
      expect(result.decision).toBe('DENY');
      expect(result.reasonCodes).toContain(ReasonCode.REVOKED_MANDATE);
    });

    it('REVIEW: triggers review when amount exceeds review threshold', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '1800000', // 1.8 USDC >= reviewThreshold (1.5 USDC) and <= maxPerTx (2.0 USDC)
        audience: 'https://merchant.api/service',
        network: 'solana:devnet',
        nonce: 'req-nonce-review-thresh-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store);
      expect(result.decision).toBe('REVIEW');
      expect(result.reasonCodes).toContain(ReasonCode.HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW);
    });

    it('REVIEW: triggers review when unknown merchant is encountered with review option enabled', async () => {
      const mandate = issueSignedMandate(baseCore, operator.secretKey, agent.secretKey);
      const proofCore: PaymentProofCore = {
        mandateHash: mandate.mandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'UnknownMerchant222222222222222222222222222',
        asset: 'USDC',
        amount: '500000',
        audience: 'https://unknown.merchant/api',
        network: 'solana:devnet',
        nonce: 'req-nonce-unknown-merchant-01',
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000,
      };
      const proof = createSignedPaymentProof(proofCore, agent.secretKey);

      const result = await evaluatePaymentPolicy(mandate, proof, store, {
        allowUnknownMerchantsForReview: true,
      });
      expect(result.decision).toBe('REVIEW');
      expect(result.reasonCodes).toContain(ReasonCode.UNKNOWN_MERCHANT_REQUIRES_REVIEW);
    });
  });

  describe('6. Nonce Replay & Atomic Race Protection (Item 2 Adaptation)', () => {
    it('rejects sequential replay with the same nonce', async () => {
      const store = new MemoryStore();
      const operator = generateEd25519Keypair();
      const agent = generateEd25519Keypair();

      const mandate = issueSignedMandate(
        {
          mandateId: 'mandate-nonce-seq',
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: ['*'],
          allowedAssets: ['USDC'],
          maxPerTx: '10000000',
          totalCap: '100000000',
          validFrom: Date.now() - 1000,
          expiresAt: Date.now() + 3600000,
          nonce: 'nonce-mandate-01',
          network: 'solana:devnet',
        },
        operator.secretKey,
        agent.secretKey
      );

      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: 'MerchantX',
          asset: 'USDC',
          amount: '500000',
          audience: 'https://api.merchant.com',
          network: 'solana:devnet',
          nonce: 'unique-nonce-fixed-12345',
          timestamp: Date.now(),
          expiresAt: Date.now() + 60000,
        },
        agent.secretKey
      );

      // First call succeeds
      const firstResult = await evaluatePaymentPolicy(mandate, proof, store);
      expect(firstResult.decision).toBe('ALLOW');

      // Second call with same proof / nonce is rejected as replay
      const secondResult = await evaluatePaymentPolicy(mandate, proof, store);
      expect(secondResult.decision).toBe('DENY');
      expect(secondResult.reasonCodes).toContain(ReasonCode.NONCE_REPLAYED);
    });

    it('CONCURRENCY RACE TEST: exactly one of two concurrent identical requests succeeds', async () => {
      const store = new MemoryStore();
      const operator = generateEd25519Keypair();
      const agent = generateEd25519Keypair();

      const mandate = issueSignedMandate(
        {
          mandateId: 'mandate-race-01',
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: ['*'],
          allowedAssets: ['USDC'],
          maxPerTx: '10000000',
          totalCap: '100000000',
          validFrom: Date.now() - 1000,
          expiresAt: Date.now() + 3600000,
          nonce: 'nonce-mandate-race',
          network: 'solana:devnet',
        },
        operator.secretKey,
        agent.secretKey
      );

      const proof = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: 'MerchantRace',
          asset: 'USDC',
          amount: '1000000',
          audience: 'https://api.merchant.com/endpoint',
          network: 'solana:devnet',
          nonce: 'race-condition-target-nonce-999',
          timestamp: Date.now(),
          expiresAt: Date.now() + 60000,
        },
        agent.secretKey
      );

      // Fire two identical requests concurrently
      const [resA, resB] = await Promise.all([
        evaluatePaymentPolicy(mandate, proof, store),
        evaluatePaymentPolicy(mandate, proof, store),
      ]);

      const decisions = [resA.decision, resB.decision];
      expect(decisions).toContain('ALLOW');
      expect(decisions).toContain('DENY');

      const denied = resA.decision === 'DENY' ? resA : resB;
      expect(denied.reasonCodes).toContain(ReasonCode.NONCE_REPLAYED);
    });
  });

  describe('7. Verifiable Receipts', () => {
    it('issues and independently verifies a signed decision receipt', () => {
      const authority = generateEd25519Keypair();
      const receiptBody: ReceiptBody = {
        receiptId: 'receipt-2026-10-02-0001',
        mandateHash: 'b'.repeat(64),
        agentPubkey: 'AgentPubkey11111111111111111111111111111111',
        merchantPubkey: 'Merchant111111111111111111111111111111111111',
        asset: 'USDC',
        amount: '1500000',
        network: 'solana:devnet',
        nonce: 'nonce-receipt-001',
        decision: 'ALLOW',
        reasonCodes: [ReasonCode.POLICY_PASSED_ALL_GATES],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        paymentTxSignature: '5J4...DevnetSolanaTxSignature...XYZ',
        authorityPubkey: authority.publicKey,
      };

      const signedReceipt = issueSignedReceipt(receiptBody, authority.secretKey);
      expect(signedReceipt.receiptHash).toHaveLength(64);
      expect(signedReceipt.authoritySignature).toBeDefined();

      const verification = verifySignedReceipt(signedReceipt);
      expect(verification.isValid).toBe(true);
      expect(verification.receiptHash).toBe(signedReceipt.receiptHash);
    });

    it('rejects tampered decision receipt', () => {
      const authority = generateEd25519Keypair();
      const receiptBody: ReceiptBody = {
        receiptId: 'receipt-tamper-001',
        mandateHash: 'c'.repeat(64),
        agentPubkey: 'AgentPubkey11111111111111111111111111111111',
        merchantPubkey: 'Merchant111111111111111111111111111111111111',
        asset: 'USDC',
        amount: '500000',
        network: 'solana:devnet',
        nonce: 'nonce-tamper-001',
        decision: 'DENY',
        reasonCodes: [ReasonCode.AMOUNT_EXCEEDS_TOTAL_CAP],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: authority.publicKey,
      };

      const signedReceipt = issueSignedReceipt(receiptBody, authority.secretKey);
      // Tamper with decision from DENY to ALLOW
      const tampered = { ...signedReceipt, decision: 'ALLOW' as const };

      const verification = verifySignedReceipt(tampered);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('Receipt hash mismatch');
    });
  });
});

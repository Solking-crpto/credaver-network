import { describe, it, expect } from 'vitest';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  MandateCore,
  MemoryStore,
} from '@credaver/core';
import {
  createCredaverClientPolicy,
  CredaverAgentGuard,
} from './index.js';
import type { PaymentRequirements } from '@x402/core/types';

describe('packages/x402-guard: x402 Integration & Guard', () => {
  const operator = generateEd25519Keypair();
  const agent = generateEd25519Keypair();
  const authority = generateEd25519Keypair();

  const sampleCore: MandateCore = {
    mandateId: 'mandate-guard-01',
    operatorPubkey: operator.publicKey,
    agentPubkey: agent.publicKey,
    allowedMerchants: ['ApprovedMerchant111111111111111111111111111'],
    allowedAssets: ['USDC'],
    maxPerTx: '2000000', // 2 USDC
    totalCap: '10000000', // 10 USDC
    validFrom: Date.now() - 1000,
    expiresAt: Date.now() + 3600000,
    nonce: 'nonce-guard-01',
    network: 'solana:devnet',
  };

  const mandate = issueSignedMandate(sampleCore, operator.secretKey, agent.secretKey);

  describe('createCredaverClientPolicy filter', () => {
    const policy = createCredaverClientPolicy(mandate);

    it('retains requirement that complies with mandate constraints', () => {
      const validReq: PaymentRequirements = {
        scheme: 'exact',
        network: 'solana:devnet',
        asset: 'USDC',
        amount: '1000000',
        payTo: 'ApprovedMerchant111111111111111111111111111',
      };

      const filtered = policy(2, [validReq]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(validReq);
    });

    it('filters out requirement that exceeds maxPerTx', () => {
      const excessiveReq: PaymentRequirements = {
        scheme: 'exact',
        network: 'solana:devnet',
        asset: 'USDC',
        amount: '5000000', // 5 USDC > 2 USDC maxPerTx
        payTo: 'ApprovedMerchant111111111111111111111111111',
      };

      const filtered = policy(2, [excessiveReq]);
      expect(filtered).toHaveLength(0);
    });

    it('filters out requirement from unapproved merchant', () => {
      const unapprovedMerchantReq: PaymentRequirements = {
        scheme: 'exact',
        network: 'solana:devnet',
        asset: 'USDC',
        amount: '1000000',
        payTo: 'UnknownMerchant999999999999999999999999999',
      };

      const filtered = policy(2, [unapprovedMerchantReq]);
      expect(filtered).toHaveLength(0);
    });

    it('filters out requirement with mismatched network (e.g. mainnet attempt)', () => {
      const mainnetReq: PaymentRequirements = {
        scheme: 'exact',
        network: 'solana:mainnet',
        asset: 'USDC',
        amount: '1000000',
        payTo: 'ApprovedMerchant111111111111111111111111111',
      };

      const filtered = policy(2, [mainnetReq]);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('CredaverAgentGuard pre-flight authorization', () => {
    it('authorizes valid spend, generates signed receipt, and tracks cumulative spend', async () => {
      const store = new MemoryStore();
      const guard = new CredaverAgentGuard({
        mandate,
        agentSecretKey: agent.secretKey,
        store,
        authoritySecretKey: authority.secretKey,
        authorityPubkey: authority.publicKey,
      });

      const result = await guard.preAuthorizePayment({
        merchantPubkey: 'ApprovedMerchant111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        audience: 'https://api.merchant.com/weather',
      });

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('ALLOW');
      expect(result.receipt.receiptHash).toHaveLength(64);
      expect(result.receipt.authoritySignature).toBeDefined();

      // Verify spend tracked in store
      const currentSpend = await store.getMandateSpend(mandate.mandateId);
      expect(currentSpend).toBe(1000000n);
    });
  });
});

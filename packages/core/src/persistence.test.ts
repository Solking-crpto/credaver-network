import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  createSignedPaymentProof,
  evaluatePaymentPolicy,
  issueSignedReceipt,
  MemoryStore,
  RedisStore,
  ReasonCode,
} from './index.js';

describe('Milestone 2: Persistence Layer & Mandate Lifecycle', () => {
  let operator: ReturnType<typeof generateEd25519Keypair>;
  let agent: ReturnType<typeof generateEd25519Keypair>;
  let merchant: ReturnType<typeof generateEd25519Keypair>;

  const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const USDC_ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  beforeEach(() => {
    operator = generateEd25519Keypair();
    agent = generateEd25519Keypair();
    merchant = generateEd25519Keypair();
  });

  describe('MemoryStore Lifecycle & Policy Integration', () => {
    it('1. Mandate CRUD and filter queries', async () => {
      const store = new MemoryStore();
      const mandate1 = issueSignedMandate(
        {
          mandateId: 'm-1',
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: ['*'],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '1000000',
          totalCap: '5000000',
          validFrom: Date.now() - 1000,
          expiresAt: Date.now() + 3600000,
          nonce: 'nonce-m1',
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey
      );

      const otherAgent = generateEd25519Keypair();
      const mandate2 = issueSignedMandate(
        {
          mandateId: 'm-2',
          operatorPubkey: operator.publicKey,
          agentPubkey: otherAgent.publicKey,
          allowedMerchants: ['*'],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '10000000',
          validFrom: Date.now(),
          expiresAt: Date.now() + 3600000,
          nonce: 'nonce-m2',
          network: NETWORK,
        },
        operator.secretKey,
        otherAgent.secretKey
      );

      await store.saveMandate(mandate1);
      await store.saveMandate(mandate2);

      // Fetch by ID
      const fetched = await store.getMandate('m-1');
      expect(fetched).toBeDefined();
      expect(fetched?.mandateId).toBe('m-1');

      // Fetch by Hash
      const fetchedByHash = await store.getMandateByHash(mandate1.mandateHash);
      expect(fetchedByHash).toBeDefined();
      expect(fetchedByHash?.mandateId).toBe('m-1');

      // List all
      const all = await store.listMandates();
      expect(all).toHaveLength(2);

      // Filter by agent
      const agent1Mandates = await store.listMandates({ agentPubkey: agent.publicKey });
      expect(agent1Mandates).toHaveLength(1);
      expect(agent1Mandates[0].mandateId).toBe('m-1');
    });

    it('2. Immediate Policy Rejection after Mandate Revocation', async () => {
      const store = new MemoryStore();
      const mandate = issueSignedMandate(
        {
          mandateId: 'm-revoke-test',
          operatorPubkey: operator.publicKey,
          agentPubkey: agent.publicKey,
          allowedMerchants: [merchant.publicKey],
          allowedAssets: [USDC_ASSET],
          maxPerTx: '2000000',
          totalCap: '10000000',
          validFrom: Date.now() - 1000,
          expiresAt: Date.now() + 3600000,
          nonce: 'nonce-rev-1',
          network: NETWORK,
        },
        operator.secretKey,
        agent.secretKey
      );
      await store.saveMandate(mandate);

      const now = Date.now();
      const proof1 = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000',
          audience: 'http://localhost:4020/api/weather',
          network: NETWORK,
          nonce: `nonce-${now}-1`,
          timestamp: now,
          expiresAt: now + 300000,
        },
        agent.secretKey
      );

      // A. Before revocation: ALLOW
      const res1 = await evaluatePaymentPolicy(mandate, proof1, store);
      expect(res1.decision).toBe('ALLOW');

      // B. Operator revokes mandate
      await store.revokeMandate('m-revoke-test', 'Compromised agent key suspected');
      const revokedMandate = await store.getMandate('m-revoke-test');
      expect(revokedMandate?.revoked).toBe(true);
      expect(revokedMandate?.revokedReason).toBe('Compromised agent key suspected');

      // C. Subsequent evaluation immediately returns DENY with REVOKED_MANDATE
      const proof2 = createSignedPaymentProof(
        {
          mandateHash: mandate.mandateHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000',
          audience: 'http://localhost:4020/api/weather',
          network: NETWORK,
          nonce: `nonce-${now}-2`,
          timestamp: now + 10,
          expiresAt: now + 300010,
        },
        agent.secretKey
      );

      const res2 = await evaluatePaymentPolicy(revokedMandate!, proof2, store);
      expect(res2.decision).toBe('DENY');
      expect(res2.reasonCodes).toContain(ReasonCode.REVOKED_MANDATE);
    });

    it('3. Receipts & Audit Events storage and filtering', async () => {
      const store = new MemoryStore();
      const now = Date.now();

      const validHash = 'a'.repeat(64);
      const receiptAllow = issueSignedReceipt(
        {
          receiptId: 'r-1',
          mandateHash: validHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '1000000',
          network: NETWORK,
          nonce: 'n-1',
          decision: 'ALLOW',
          reasonCodes: [ReasonCode.POLICY_PASSED_ALL_GATES],
          policyVersion: 'credav-v1.0',
          issuedAt: now - 1000,
          authorityPubkey: operator.publicKey,
        },
        operator.secretKey
      );

      const receiptDeny = issueSignedReceipt(
        {
          receiptId: 'r-2',
          mandateHash: validHash,
          agentPubkey: agent.publicKey,
          merchantPubkey: merchant.publicKey,
          asset: USDC_ASSET,
          amount: '5000000',
          network: NETWORK,
          nonce: 'n-2',
          decision: 'DENY',
          reasonCodes: [ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT],
          policyVersion: 'credav-v1.0',
          issuedAt: now,
          authorityPubkey: operator.publicKey,
        },
        operator.secretKey
      );

      await store.saveReceipt(receiptAllow);
      await store.saveReceipt(receiptDeny);

      // Get receipt by ID
      const r1 = await store.getReceipt('r-1');
      expect(r1?.decision).toBe('ALLOW');

      // Filter receipts by decision
      const allows = await store.listReceipts({ decision: 'ALLOW' });
      expect(allows).toHaveLength(1);
      expect(allows[0].receiptId).toBe('r-1');

      const denies = await store.listReceipts({ decision: 'DENY' });
      expect(denies).toHaveLength(1);
      expect(denies[0].receiptId).toBe('r-2');

      // Audit Events
      await store.saveAuditEvent({
        eventId: 'aud-1',
        type: 'MANDATE_CREATED',
        entityId: 'm-1',
        timestamp: now,
        data: { name: 'Audit Test' },
      });

      const auditList = await store.listAuditEvents({ entityId: 'm-1' });
      expect(auditList).toHaveLength(1);
      expect(auditList[0].type).toBe('MANDATE_CREATED');
    });
  });

  describe('RedisStore Atomic SET NX EX & Concurrency', () => {
    it('1. RedisStore REST integration with atomic SET NX EX replay prevention', async () => {
      // Mock global fetch for Upstash REST client
      const memoryKVs = new Map<string, string>();

      const mockFetch = vi.fn(async (_url: any, init: any) => {
        const command = JSON.parse(init.body) as (string | number)[];
        const cmd = String(command[0]).toUpperCase();

        if (cmd === 'SET') {
          const key = String(command[1]);
          const val = String(command[2]);
          const isNX = command.includes('NX');

          if (isNX) {
            if (memoryKVs.has(key)) {
              return { ok: true, json: async () => ({ result: null }) };
            }
            memoryKVs.set(key, val);
            return { ok: true, json: async () => ({ result: 'OK' }) };
          }

          memoryKVs.set(key, val);
          return { ok: true, json: async () => ({ result: 'OK' }) };
        }

        if (cmd === 'GET') {
          const key = String(command[1]);
          return { ok: true, json: async () => ({ result: memoryKVs.get(key) || null }) };
        }

        if (cmd === 'SADD' || cmd === 'RPUSH') {
          return { ok: true, json: async () => ({ result: 1 }) };
        }

        if (cmd === 'SMEMBERS') {
          return { ok: true, json: async () => ({ result: [] }) };
        }

        return { ok: true, json: async () => ({ result: 'OK' }) };
      });

      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        const redisStore = new RedisStore({
          url: 'https://mock-redis.upstash.io',
          token: 'mock-token',
        });

        // First consume of nonce: succeeds
        const first = await redisStore.consumeNonce('unique-atomic-nonce', 300);
        expect(first).toBe(true);

        // Immediate duplicate consume of identical nonce: rejected atomically
        const second = await redisStore.consumeNonce('unique-atomic-nonce', 300);
        expect(second).toBe(false);

        // Concurrent race condition: 10 parallel requests with identical nonce
        const nonceKey = 'concurrent-race-nonce';
        const results = await Promise.all([
          redisStore.consumeNonce(nonceKey, 300),
          redisStore.consumeNonce(nonceKey, 300),
          redisStore.consumeNonce(nonceKey, 300),
          redisStore.consumeNonce(nonceKey, 300),
          redisStore.consumeNonce(nonceKey, 300),
        ]);

        const successes = results.filter((r) => r === true);
        const rejections = results.filter((r) => r === false);

        expect(successes).toHaveLength(1); // EXACTLY ONE WINNER
        expect(rejections).toHaveLength(4); // ALL OTHERS REJECTED
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});

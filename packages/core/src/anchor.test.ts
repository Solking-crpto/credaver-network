import { describe, it, expect, vi } from 'vitest';
import {
  buildMemoPayload,
  parseMemoPayload,
  buildMemoTransaction,
  verifyOnChainMemo,
  verifyCompleteReceipt,
  SPL_MEMO_PROGRAM_ID,
} from './anchor.js';
import { generateEd25519Keypair, verifyEd25519 } from './crypto.js';
import { issueSignedReceipt, ReceiptBody } from './receipt.js';

describe('Milestone 4: Solana Devnet Memo Anchoring & Verification', () => {
  const operator = generateEd25519Keypair();
  const agent = generateEd25519Keypair();
  const payer = generateEd25519Keypair();

  const sampleMandateHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const sampleReceiptHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  describe('4.1 Memo Payload Construction and Parsing', () => {
    it('constructs standard memo payload conforming to specification', () => {
      const payload = buildMemoPayload(sampleMandateHash, sampleReceiptHash, 'ALLOW');
      expect(payload).toBe(`credav:1:a1b2c3d4:${sampleReceiptHash}:ALLOW`);
    });

    it('parses valid memo payloads into structured components', () => {
      const payload = `credav:1:a1b2c3d4:${sampleReceiptHash}:ALLOW`;
      const parsed = parseMemoPayload(payload);

      expect(parsed).toBeDefined();
      expect(parsed?.version).toBe('1');
      expect(parsed?.mandateHashPrefix).toBe('a1b2c3d4');
      expect(parsed?.receiptHash).toBe(sampleReceiptHash);
      expect(parsed?.decision).toBe('ALLOW');
    });

    it('strips quotes from RPC log formatted memo strings', () => {
      const rawLogMemo = `"credav:1:a1b2c3d4:${sampleReceiptHash}:DENY"`;
      const parsed = parseMemoPayload(rawLogMemo);

      expect(parsed).toBeDefined();
      expect(parsed?.decision).toBe('DENY');
      expect(parsed?.receiptHash).toBe(sampleReceiptHash);
    });

    it('rejects malformed or unversioned memo payloads', () => {
      expect(parseMemoPayload('')).toBeNull();
      expect(parseMemoPayload('random text on memo')).toBeNull();
      expect(parseMemoPayload('otherapp:1:prefix:hash:ALLOW')).toBeNull();
      expect(parseMemoPayload('credav:1:prefix:hash')).toBeNull(); // Missing segment
    });
  });

  describe('4.2 Wire Transaction Builder', () => {
    it('creates a signed Solana wire transaction with SPL Memo instruction', () => {
      const blockhash = 'J9wq3wtFXK9KJpASYEvY7HCpj3FMpvgZxT4BY6nJVttC';
      const memoText = buildMemoPayload(sampleMandateHash, sampleReceiptHash, 'ALLOW');

      const { wireTransactionBase64, expectedSignature, messageBytes } = buildMemoTransaction(
        payer.publicKey,
        payer.secretKey,
        blockhash,
        memoText
      );

      expect(wireTransactionBase64).toBeDefined();
      expect(typeof wireTransactionBase64).toBe('string');
      expect(expectedSignature).toBeDefined();

      // Signature verification
      const isSigValid = verifyEd25519(messageBytes, expectedSignature, payer.publicKey);
      expect(isSigValid).toBe(true);

      // Wire bytes validation
      const wireBuffer = Buffer.from(wireTransactionBase64, 'base64');
      // Starts with compact-u16 count of 1 (0x01) followed by 64-byte signature
      expect(wireBuffer[0]).toBe(1);
      expect(wireBuffer.length).toBeGreaterThan(65);
    });
  });

  describe('4.3 On-Chain Memo Verification via RPC', () => {
    it('successfully extracts and validates memo from parsed instructions', async () => {
      const mockTx = {
        slot: 506955056,
        blockTime: 1727950000,
        transaction: {
          message: {
            instructions: [
              {
                program: 'spl-memo',
                programId: SPL_MEMO_PROGRAM_ID,
                parsed: `credav:1:a1b2c3d4:${sampleReceiptHash}:ALLOW`,
              },
            ],
          },
        },
        meta: {
          logMessages: [
            'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr invoke [1]',
            `Program log: Memo (len 88): "credav:1:a1b2c3d4:${sampleReceiptHash}:ALLOW"`,
            'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr success',
          ],
        },
      };

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: mockTx }),
      })) as any;

      try {
        const result = await verifyOnChainMemo('mockTxSignature123', sampleReceiptHash);
        expect(result.isValid).toBe(true);
        expect(result.slot).toBe(506955056);
        expect(result.parsedMemo?.receiptHash).toBe(sampleReceiptHash);
        expect(result.parsedMemo?.decision).toBe('ALLOW');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('rejects verification if receipt hash does not match on-chain memo', async () => {
      const mockTx = {
        slot: 506955056,
        transaction: {
          message: {
            instructions: [
              {
                program: 'spl-memo',
                programId: SPL_MEMO_PROGRAM_ID,
                parsed: `credav:1:a1b2c3d4:${sampleReceiptHash}:ALLOW`,
              },
            ],
          },
        },
      };

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: mockTx }),
      })) as any;

      try {
        const wrongHash = 'f'.repeat(64);
        const result = await verifyOnChainMemo('mockTxSignature123', wrongHash);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Receipt hash mismatch');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('handles non-existent transaction gracefully', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: null }),
      })) as any;

      try {
        const result = await verifyOnChainMemo('nonExistentTxSig', sampleReceiptHash);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not found on devnet');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe('4.4 Complete Receipt Verification', () => {
    it('verifies valid receipt without on-chain signature', async () => {
      const body: ReceiptBody = {
        receiptId: 'rcpt-test-401',
        mandateHash: sampleMandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'MerchantAddress111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: 'nonce-test-401',
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: operator.publicKey,
      };

      const receipt = issueSignedReceipt(body, operator.secretKey);

      const verification = await verifyCompleteReceipt(receipt, { verifyOnChain: false });
      expect(verification.isValid).toBe(true);
      expect(verification.badges.hashMatches).toBe(true);
      expect(verification.badges.authorityValid).toBe(true);
      expect(verification.badges.onChainAnchored).toBe(false);
    });

    it('detects tampered receipt body', async () => {
      const body: ReceiptBody = {
        receiptId: 'rcpt-test-tamper',
        mandateHash: sampleMandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'MerchantAddress111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: 'nonce-tamper-402',
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: operator.publicKey,
      };

      const receipt = issueSignedReceipt(body, operator.secretKey);
      // Tamper amount
      const tampered = { ...receipt, amount: '999999999' };

      const verification = await verifyCompleteReceipt(tampered as any, { verifyOnChain: false });
      expect(verification.isValid).toBe(false);
      expect(verification.badges.hashMatches).toBe(false);
    });

    it('detects invalid authority signature', async () => {
      const body: ReceiptBody = {
        receiptId: 'rcpt-test-sig',
        mandateHash: sampleMandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'MerchantAddress111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: 'nonce-sig-403',
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: operator.publicKey,
      };

      const imposter = generateEd25519Keypair();
      // Signed with imposter key but claims operator authorityPubkey
      const forgedReceipt = issueSignedReceipt(body, imposter.secretKey);

      const verification = await verifyCompleteReceipt(forgedReceipt, { verifyOnChain: false });
      expect(verification.isValid).toBe(false);
      expect(verification.badges.authorityValid).toBe(false);
    });

    it('verifies receipt matching configured CredaVer authority and sets SIGNED BY CREDAVER AUTHORITY', async () => {
      const configuredAuthority = generateEd25519Keypair();
      const body: ReceiptBody = {
        receiptId: 'rcpt-test-auth-match',
        mandateHash: sampleMandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'MerchantAddress111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: 'nonce-auth-match',
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: configuredAuthority.publicKey,
      };

      const receipt = issueSignedReceipt(body, configuredAuthority.secretKey);
      const verification = await verifyCompleteReceipt(receipt, {
        verifyOnChain: false,
        configuredAuthorityPubkey: configuredAuthority.publicKey,
      });

      expect(verification.isValid).toBe(true);
      expect(verification.signerStatus).toBe('SIGNED BY CREDAVER AUTHORITY');
      expect(verification.badges.isConfiguredAuthority).toBe(true);
      expect(verification.badges.authorityValid).toBe(true);
    });

    it('flags receipt signed by a random key as UNKNOWN SIGNER and rejects verification', async () => {
      const configuredAuthority = generateEd25519Keypair();
      const randomAuthority = generateEd25519Keypair();

      const body: ReceiptBody = {
        receiptId: 'rcpt-test-random-authority',
        mandateHash: sampleMandateHash,
        agentPubkey: agent.publicKey,
        merchantPubkey: 'MerchantAddress111111111111111111111111111',
        asset: 'USDC',
        amount: '1000000',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        nonce: 'nonce-random-auth',
        decision: 'ALLOW',
        reasonCodes: ['POLICY_PASSED_ALL_GATES'],
        policyVersion: 'credav-v1.0',
        issuedAt: Date.now(),
        authorityPubkey: randomAuthority.publicKey,
      };

      // Valid Ed25519 signature by randomAuthority
      const receipt = issueSignedReceipt(body, randomAuthority.secretKey);

      // Verify against configuredAuthority
      const verification = await verifyCompleteReceipt(receipt, {
        verifyOnChain: false,
        configuredAuthorityPubkey: configuredAuthority.publicKey,
      });

      expect(verification.isValid).toBe(false);
      expect(verification.signerStatus).toBe('UNKNOWN SIGNER');
      expect(verification.badges.isConfiguredAuthority).toBe(false);
      expect(verification.badges.authorityValid).toBe(true); // Signature valid for the random key, but not the authority!
      expect(verification.error).toContain('UNKNOWN SIGNER');
    });
  });
});

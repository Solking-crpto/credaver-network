# `@credaver/core`

Cryptographic authorization primitives, deterministic Policy Decision Point (PDP) engine, state machines, and Solana on-chain anchoring for CredaVer Network.

## Features

- **RFC 8785 Canonical JSON (JCS)**: Deterministic, byte-level object hashing for mandates, payment proofs, and decision receipts.
- **Ed25519 Cryptography**: Keypair generation, signing, and signature verification with Base58 / Base64 interoperability.
- **Mandate Lifecycle**: Explicit state machine (`DRAFT` → `ACTIVE` → `REVOKED` | `EXPIRED` | `DEPLETED`).
- **Payment Request Lifecycle**: Explicit state transitions (`RECEIVED` → `EVALUATING` → `ALLOWED` | `DENIED` | `PENDING_REVIEW`).
- **12 Deterministic Policy Gates**: Fail-closed evaluation of signatures, expiration windows, allowlists, per-transaction caps, cumulative limits, atomic replay checks, and human review thresholds.
- **Dual Storage Adapters**: In-memory store (`MemoryStore`) for unit testing and local development; Upstash Redis store (`UpstashRedisStore`) for atomic `SET NX EX` nonces and multi-instance persistence.
- **SPL Memo Anchoring**: Solana devnet on-chain anchoring of decision receipt hashes via the SPL Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).

## Installation

```bash
pnpm add @credaver/core
```

## Quick Usage

```typescript
import {
  generateEd25519Keypair,
  issueSignedMandate,
  createSignedPaymentProof,
  evaluateAndSignTransaction,
  MemoryStore,
} from '@credaver/core';

// 1. Generate identity keys
const operator = generateEd25519Keypair();
const agent = generateEd25519Keypair();

// 2. Issue scoped mandate
const mandate = issueSignedMandate(
  {
    mandateId: 'mandate-101',
    operatorPubkey: operator.publicKey,
    agentPubkey: agent.publicKey,
    allowedMerchants: ['D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW'],
    allowedAssets: ['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'],
    maxPerTx: '2000000',
    totalCap: '10000000',
    validFrom: Date.now() - 1000,
    expiresAt: Date.now() + 3600000,
    nonce: 'nonce-init',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  },
  operator.secretKey,
  agent.secretKey
);

// 3. Evaluate proof and sign transaction
const store = new MemoryStore();
await store.saveMandate(mandate);

const result = await evaluateAndSignTransaction({
  mandate,
  proof,
  transactionMessageBytes,
  store,
  paymentSecretKey: serverFundingKey,
});

console.log('Decision:', result.decision); // 'ALLOW' | 'DENY' | 'REVIEW'
```

## Testing

```bash
pnpm test packages/core
```

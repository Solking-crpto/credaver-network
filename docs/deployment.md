# CredaVer Network: Deployment Guide & Checklist

This document details the configuration, required environment variables, and pre-flight checklist for deploying CredaVer Network to production environments.

> [!IMPORTANT]
> **No Deploying During Preparation**: This document is a deployment readiness specification. Do not deploy or create cloud infrastructure without explicit operator approval.

---

## 1. Required Environment Variables

When running in `NODE_ENV=production`, the application strictly enforces the presence of multi-instance persistence credentials. Silent fallback to in-memory storage is disabled.

| Variable Name | Required | Encoding / Format | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | String (`production`) | Enables production optimizations and disables silent in-memory fallback. |
| `UPSTASH_REDIS_REST_URL` | **Yes (in prod)** | URL string | Upstash Redis REST endpoint for atomic `SET NX EX` replay protection and persistence. |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes (in prod)** | Token string | Upstash Redis REST bearer token. |
| `DEVNET_PAYMENT_SECRET_KEY` | Optional (Prod) | Base58 string or JSON array | Solana funding wallet private key held in custody by the CredaVer signer. If omitted, falls back to local throwaway key. |
| `DEVNET_PAYMENT_PUBLIC_KEY` | Optional | Base58 string (Solana address) | Public address of the funding wallet (auto-derived if omitted). |
| `RECEIPT_AUTHORITY_SECRET_KEY` | Optional | Base58 string or JSON array | Ed25519 private key used to sign canonical RFC 8785 receipts. Falls back to payment key if omitted. |
| `RECEIPT_AUTHORITY_PUBLIC_KEY` | Optional | Base58 string (Solana address) | Public key of the receipt signing authority (auto-derived if omitted). |
| `ANCHOR_PAYER_SECRET_KEY` | Optional | Base58 string or JSON array | Solana devnet payer key used to broadcast SPL Memo anchor transactions. Falls back to payment key if omitted. |
| `ANCHOR_PAYER_PUBLIC_KEY` | Optional | Base58 string (Solana address) | Public address of the anchor fee payer (auto-derived if omitted). |
| `DEVNET_MERCHANT_SECRET_KEY` | Optional | Base58 string or JSON array | Demo merchant private key used for x402 resource server settlement. |
| `DEVNET_MERCHANT_PUBLIC_KEY` | Optional | Base58 string (Solana address) | Demo merchant destination address for x402 payments. |
| `SOLANA_RPC_URL` | Optional | URL string | Solana JSON-RPC endpoint for on-chain memo extraction and slot verification. |
| `OFFICIAL_FACILITATOR_URL` | Optional | URL string | x402 public facilitator endpoint for Solana settlement (`https://x402.org/facilitator`). |
| `ANCHOR_ON_CHAIN` | Optional | Boolean string (`true`/`false`) | When `true`, automatically broadcasts SPL Memo transactions to Solana devnet on every `ALLOW` decision. |

---

## 2. Production Fail-Loud Safety Policy

In `apps/web/src/lib/server-state.ts`, CredaVer enforces:

```typescript
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[CredaVer Configuration Error] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in production. Silent in-memory fallback is disabled in production to guarantee multi-instance replay safety and audit persistence.'
    );
  }
  globalThis.__credaverStore = new MemoryStore();
}
```

**Why this is essential**:
In serverless or horizontally scaled environments (such as Vercel, AWS ECS, or Kubernetes), each instance has its own isolated memory heap. If nodes fall back silently to `MemoryStore`, an attacker could replay nonces across different container instances. CredaVer therefore crashes loudly on startup if persistent Redis is unconfigured in production.

---

## 3. Pre-Flight Deployment Checklist

### Step 1: Upstream & Secrets Check
- [ ] Ensure `.devnet-payer.json` and `.devnet-merchant.json` are listed in `.gitignore` and never committed.
- [ ] Run secret scanner: `git log -p | grep "PRIVATE KEY"`.
- [ ] Confirm zero `.env` files are tracked in git.

### Step 2: Test & Build Verification
- [ ] Run full test suite: `pnpm test` (all 12 suites / 104 tests must pass).
- [ ] Run linter and typechecker: `pnpm lint`.
- [ ] Run production build: `pnpm build`.

### Step 3: Upstash Redis Provisioning
- [ ] Create a free Upstash Redis database in the target cloud region (e.g. US-East).
- [ ] Retrieve REST URL and REST Token.
- [ ] Test connectivity:
  ```bash
  curl -H "Authorization: Bearer <TOKEN>" "<URL>/set/test_key/ok"
  ```

### Step 4: Host Configuration (e.g., Vercel / Railway / Render)
- [ ] Set Root Directory to `apps/web` (or configure monorepo build command `pnpm build`).
- [ ] Configure Environment Variables:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `DEVNET_PAYMENT_SECRET_KEY`
  - `NODE_ENV=production`
- [ ] Ensure standard security headers are applied via `next.config.mjs`.

### Step 5: Post-Deployment Smoke Test
- [ ] Navigate to `/health` or `/api/receipts` — confirm HTTP 200 response.
- [ ] Open `/` — execute `ALLOW` scenario and confirm sub-10ms response.
- [ ] Open `/verify` — execute preset verification check and confirm all green badges.
- [ ] Test rate limiting by sending 70 rapid requests to `/api/auth/challenge` and verify HTTP 429 response.

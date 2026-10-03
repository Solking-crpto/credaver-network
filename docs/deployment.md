# CredaVer Network: Deployment Guide & Checklist

This document details the configuration, required environment variables, and pre-flight checklist for deploying CredaVer Network to production environments (such as Vercel).

> [!IMPORTANT]
> **No Deploying During Preparation**: This document is a deployment readiness specification. Do not deploy or create cloud infrastructure without explicit operator approval.

---

## 1. Production Environment Variables: Secret vs Config

When running in `NODE_ENV=production`, the application strictly enforces the presence of multi-instance persistence credentials and signing keys. Silent fallback to in-memory storage or ephemeral keys is disabled.

Variables are strictly categorized into **Secrets** (confidential private keys and auth tokens that must NEVER be committed or leaked) and **Config** (non-sensitive URLs, flags, and public addresses).

### A. Secrets (Confidential — Store in Secure Cloud Env Only)

| Variable Name | Required | Encoding / Format | Purpose & Description |
|---|---|---|---|
| `DEVNET_PAYMENT_SECRET_KEY` | **Yes (in prod)** | Base58 string or JSON array | **Secret**: Solana funding wallet private key held in custody by the CredaVer constrained signer for settling agent transactions. |
| `CREDAVER_AUTHORITY_SECRET_KEY`<br>*(alias: `RECEIPT_AUTHORITY_SECRET_KEY`)* | **Yes (in prod)** | Base58 string or JSON array | **Secret**: Dedicated Ed25519 private key used to sign canonical RFC 8785 receipts. Cryptographically separated from the payment key; never reused for transactions. |
| `ANCHOR_SECRET_KEY`<br>*(alias: `ANCHOR_PAYER_SECRET_KEY`)* | **Yes (if `ANCHOR_ON_CHAIN=true` in prod)** | Base58 string or JSON array | **Secret**: Solana devnet payer key used to broadcast SPL Memo anchor transactions. |
| `UPSTASH_REDIS_REST_TOKEN`<br>*(alias: `KV_REST_API_TOKEN`)* | **Yes (in prod)** | Bearer token string | **Secret**: Upstash Redis REST bearer token (or Vercel KV REST Token) for authenticating atomic `SET NX EX` replay checks and state persistence. |
| `DEVNET_MERCHANT_SECRET_KEY` | Optional | Base58 string or JSON array | **Secret**: Demo merchant private key used for local x402 resource server settlement. |

### B. Config (Non-Sensitive — Safe for Standard App Config)

| Variable Name | Required | Type / Format | Purpose & Description |
|---|---|---|---|
| `NODE_ENV` | Yes | String (`production`) | **Config**: Enables production optimizations and disables silent in-memory/ephemeral fallbacks. |
| `ANCHOR_ON_CHAIN` | Optional | Boolean string (`true`/`false`) | **Config**: When `true`, automatically broadcasts SPL Memo transactions to Solana devnet on every `ALLOW` decision. |
| `UPSTASH_REDIS_REST_URL`<br>*(alias: `KV_REST_API_URL`)* | **Yes (in prod)** | URL string | **Config**: Upstash Redis REST endpoint (or Vercel KV REST URL) for state storage. |
| `DEVNET_PAYMENT_PUBLIC_KEY` | Optional | Base58 string (Solana address) | **Config**: Public address of the funding wallet (auto-derived from `DEVNET_PAYMENT_SECRET_KEY` if omitted). |
| `CREDAVER_AUTHORITY_PUBLIC_KEY`<br>*(alias: `RECEIPT_AUTHORITY_PUBLIC_KEY`)* | Optional | Base58 string (Solana address) | **Config**: Public address of the receipt signing authority (auto-derived from `CREDAVER_AUTHORITY_SECRET_KEY` if omitted). |
| `ANCHOR_PUBLIC_KEY`<br>*(alias: `ANCHOR_PAYER_PUBLIC_KEY`)* | Optional | Base58 string (Solana address) | **Config**: Public address of the anchor fee payer (auto-derived from `ANCHOR_SECRET_KEY` if omitted). |
| `DEVNET_MERCHANT_PUBLIC_KEY` | Optional | Base58 string (Solana address) | **Config**: Demo merchant destination address for x402 payments. |
| `SOLANA_RPC_URL` | Optional | URL string | **Config**: Solana JSON-RPC endpoint for on-chain memo extraction and slot verification (defaults to `https://api.devnet.solana.com`). |
| `OFFICIAL_FACILITATOR_URL` | Optional | URL string | **Config**: x402 public facilitator endpoint for Solana settlement (`https://x402.org/facilitator`). |

---

## 2. Production Fail-Loud Safety Policy

In `apps/web/src/lib/server-state.ts`, CredaVer strictly validates configuration in production:

```typescript
// 1. Persistence Validation
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!redisUrl || !redisToken) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[CredaVer Configuration Error] Missing UPSTASH_REDIS_REST_URL (or KV_REST_API_URL) / UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN) in production. Silent in-memory fallback is disabled in production to guarantee multi-instance replay safety and audit persistence.'
    );
  }
}

// 2. Production Key Validation
if (process.env.NODE_ENV === 'production') {
  if (!process.env.DEVNET_PAYMENT_SECRET_KEY) {
    throw new Error('[CredaVer Configuration Error] Missing DEVNET_PAYMENT_SECRET_KEY in production.');
  }
  if (!process.env.CREDAVER_AUTHORITY_SECRET_KEY && !process.env.RECEIPT_AUTHORITY_SECRET_KEY) {
    throw new Error('[CredaVer Configuration Error] Missing CREDAVER_AUTHORITY_SECRET_KEY in production.');
  }
  if (process.env.ANCHOR_ON_CHAIN === 'true' && !process.env.ANCHOR_SECRET_KEY && !process.env.ANCHOR_PAYER_SECRET_KEY) {
    throw new Error('[CredaVer Configuration Error] Missing ANCHOR_SECRET_KEY in production when ANCHOR_ON_CHAIN=true.');
  }
}
```

**Why this is essential**:
- **Multi-Instance Replay Protection**: In serverless/cloud environments (e.g. Vercel, AWS), instances have isolated memory heaps. Falling back silently to in-memory storage would let an agent replay nonces across instances.
- **Key Separation**: The payment key (Solana wallet with spendable funds) and the authority key (RFC 8785 receipt signer) are cryptographically distinct. The server never reuses the payment key as the receipt authority.
- **No Ephemeral Keys in Prod**: In production, ephemeral keys are forbidden so all audit receipts remain verifiably signed by the operator's known authority pubkey.

---

## 3. Vercel Configuration & Package Manager Compatibility

### Root Directory & vercel.json
When deploying to Vercel with **Root Directory set to `apps/web`**:
Add `apps/web/vercel.json`:
```json
{
  "installCommand": "cd ../.. && pnpm install",
  "buildCommand": "cd ../.. && pnpm build"
}
```
`pnpm build` from the monorepo root compiles all workspace packages (`@credaver/core`, `@credaver/x402-guard`, `apps/demo-merchant`) and builds Next.js into `apps/web/.next`.

### Package Manager (`pnpm@12.8.1` vs Vercel)
Vercel's default build container images officially support pnpm versions **6, 7, 8, 9, and 10**.
- **Issue**: `pnpm@12.8.1` is not in Vercel's default build image and can trigger build errors.
- **Solution**:
  1. Set `"packageManager": "pnpm@9.15.9"` (or `pnpm@10.5.2`) in root `package.json`, which aligns with the lockfile's `lockfileVersion: '9.0'`.
  2. Alternatively, in Vercel Project Settings > Environment Variables, add:
     ```env
     ENABLE_EXPERIMENTAL_COREPACK=1
     ```

---

## 4. Pre-Flight Deployment Checklist

### Step 1: Upstream & Secrets Check
- [ ] Ensure `.devnet-payer.json` and `.devnet-merchant.json` are listed in `.gitignore` and never committed.
- [ ] Run secret scanner: `git log -p | grep "PRIVATE KEY"`.
- [ ] Confirm zero `.env` files are tracked in git.

### Step 2: Test & Build Verification
- [ ] Run full test suite: `pnpm test` (all test suites must pass).
- [ ] Run linter and typechecker: `pnpm lint`.
- [ ] Run production build: `pnpm build` (confirms `apps/web/.next` output).

### Step 3: Deployment Key Generation
- [ ] Run `pnpm generate-deploy-keys` (terminal only; does not write to disk).
- [ ] Record the Base58 values for `DEVNET_PAYMENT_SECRET_KEY`, `CREDAVER_AUTHORITY_SECRET_KEY`, `ANCHOR_SECRET_KEY`, and `DEVNET_MERCHANT_SECRET_KEY`.
- [ ] Fund `DEVNET_PAYMENT_PUBLIC_KEY` with Devnet USDC and ~0.1 Devnet SOL.
- [ ] Fund `ANCHOR_PUBLIC_KEY` with ~0.1 - 0.2 Devnet SOL (if `ANCHOR_ON_CHAIN=true`).

### Step 4: Upstash Redis Provisioning
- [ ] Create a free Upstash Redis database or attach Vercel KV.
- [ ] Ensure `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) are configured.

### Step 5: Post-Deployment Smoke Test
- [ ] `GET /api/authority` — confirm HTTP 200 with `{ status: "ACTIVE", authorityPubkey: "..." }`.
- [ ] Open `/` — execute `ALLOW` scenario and confirm sub-10ms response.
- [ ] Open `/verify` — verify a receipt and confirm `SIGNED BY CREDAVER AUTHORITY` badge.

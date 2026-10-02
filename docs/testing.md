# CredaVer Network: Testing Strategy & Verification Matrix

CredaVer uses **Vitest** for deterministic, sub-second test execution across all monorepo packages.

## Test Suites & Coverage

| Package / App | Test File | Tests Run | Result | Key Invariants Verified |
|---|---|---|---|---|
| `@credaver/core` | `packages/core/src/core.test.ts` | 34 | **PASS** | RFC 8785 JCS canonicalization, Ed25519 keypair generation, Base58 encode/decode, Mandate mutual signing/verification, Request-bound proofs, 12 Policy Engine gates (ALLOW, DENY reason codes, REVIEW thresholds), Sequential Replay, Concurrent Atomic Replay Race (Promise.all), and 13 boundary tests. |
| `@credaver/x402-guard` | `packages/x402-guard/src/guard.test.ts` | 5 | **PASS** | `createCredaverClientPolicy` filter for `x402Client.registerPolicy()`, enforcement of allowed assets/merchants/networks/caps, `CredaverAgentGuard` pre-authorization flow, and cumulative spend ledger tracking. |
| `@credaver/x402-guard` | `packages/x402-guard/src/constrained-signer.test.ts` | 5 | **PASS** | **Milestone 1 Constrained Signer Spike S5**: Agent zero-key custody proof, `@solana/kit` partial signing delegation, policy-gated signing, cap violation rejection, unlisted merchant rejection, review threshold gate, and cryptographic proof that agent cannot self-sign. |
| `apps/web` | `apps/web/src/sign-api.test.ts` | 3 | **PASS** | **Next.js `POST /api/sign` endpoint**: Full request validation, policy evaluation, 200 ALLOW with transaction signature, 403 DENY with reason code, and 202 REVIEW with pending audit receipt. |
| `apps/web` | `apps/web/src/wallet.test.ts` | 4 | **PASS** | Phantom Connect / Wallet Standard challenge generation, Ed25519 challenge signing, server-side signature verification, imposter key rejection, and challenge tampering rejection. |
| `apps/demo-merchant` | `apps/demo-merchant/src/merchant.test.ts` | 4 | **PASS** | Express server initialization on ephemeral port, free health route, 402 `PAYMENT-REQUIRED` header generation, full x402 V2 round trip with CredaVer client guard, 200 `PAYMENT-RESPONSE` settlement, and unauthorized merchant payment blocking. |

**Total Verified Tests**: **55 passing tests across 6 test suites (0 failures, 0 skips)**.

---

## Running the Automated Test Suite

```bash
# Run all vitest suites
pnpm test

# Run in watch mode
pnpm test:watch
```

---

## Live Solana Devnet S1 Test Harness

In addition to fast in-memory vitest test doubles, CredaVer includes a live Solana devnet test harness connected to the official `@x402/express` + `@x402/svm` resource server and the public x402 facilitator (`https://x402.org/facilitator`).

### Setup & Address Generation
Run the setup script to initialize or inspect the throwaway devnet keypairs:
```bash
pnpm exec tsx scripts/devnet-setup.ts
```
- **Agent Payer (Devnet)**: `HnXPP38ctGbDqkfFrsr2B7y9DYLKmVZBiXLaiKMJomSS` (saved in git-ignored `.devnet-payer.json`)
- **Demo Merchant (Devnet)**: `D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW` (saved in git-ignored `.devnet-merchant.json`)
- **Devnet USDC Mint**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **Official Facilitator**: `https://x402.org/facilitator`

### Live Devnet Execution
```bash
pnpm exec tsx scripts/execute-s1-devnet-payment.ts
```
When funded with devnet SOL and devnet USDC:
1. Spins up the demo merchant with official `@x402/express` middleware.
2. The agent issues a scoped mandate and wraps `fetch` using `ExactSvmScheme` + `CredaverAgentGuard`.
3. Calls `/api/weather`, gets 402, constructs the devnet SPL transfer transaction, signs as payer, submits to the facilitator.
4. Facilitator cosigns as fee payer, broadcasts to Solana devnet, and returns the on-chain transaction signature.
5. The live transaction can be inspected on [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet).

---

## Milestone 1: Spike S5 Constrained Signer Verification

To execute and observe the autonomous agent zero-key custody model:
```bash
pnpm exec tsx scripts/verify-s5-constrained-signer.ts
```
This runnable script proves:
1. **Agent Zero-Key Custody**: The agent holds only its identity Ed25519 keypair and has NO access to the funding wallet's private key.
2. **ALLOW Flow**: Agent sends proof of intent within the mandate cap; CredaVer verifies policy, signs the SVM transaction message, issues a signed audit receipt, and increments the cumulative spend ledger.
3. **DENY on Cap Violation**: Agent attempts payment exceeding `maxPerTx`; CredaVer rejects with 403 `AMOUNT_EXCEEDS_PER_TX_LIMIT`. The transaction is NEVER signed, and cumulative spend remains unchanged.
4. **DENY on Rogue Merchant**: Agent attempts payment to an unlisted merchant; CredaVer rejects with 403 `MERCHANT_NOT_ALLOWED`.
5. **REVIEW Gate**: Payment exceeding `reviewThreshold` returns 202 `HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW` and is held pending operator review.
6. **Bypass Resistance**: If the agent attempts to self-sign the transaction message using its identity key, the signature fails Solana verification against the funding wallet address.

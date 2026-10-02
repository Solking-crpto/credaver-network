# CredaVer Network: Testing Strategy & Verification Matrix

CredaVer uses **Vitest** for deterministic, sub-second test execution across all monorepo packages.

## Test Suites & Coverage

| Package / App | Test File | Tests Run | Result | Key Invariants Verified |
|---|---|---|---|---|
| `@credaver/core` | `packages/core/src/core.test.ts` | 21 | **PASS** | RFC 8785 JCS canonicalization, Ed25519 keypair generation, Base58 encode/decode, Mandate mutual signing/verification, Request-bound proofs, 12 Policy Engine gates (ALLOW, DENY reason codes, REVIEW thresholds), Sequential Replay, and **Concurrent Atomic Replay Race (Promise.all)**. |
| `@credaver/x402-guard` | `packages/x402-guard/src/guard.test.ts` | 5 | **PASS** | `createCredaverClientPolicy` filter for `x402Client.registerPolicy()`, enforcement of allowed assets/merchants/networks/caps, `CredaverAgentGuard` pre-authorization flow, and cumulative spend ledger tracking. |
| `apps/demo-merchant` | `apps/demo-merchant/src/merchant.test.ts` | 4 | **PASS** | Express server initialization on ephemeral port, free health route, 402 `PAYMENT-REQUIRED` header generation, full x402 V2 round trip with CredaVer client guard, 200 `PAYMENT-RESPONSE` settlement, and unauthorized merchant payment blocking. |
| `apps/web` | `apps/web/src/wallet.test.ts` | 4 | **PASS** | Phantom Connect / Wallet Standard challenge generation, Ed25519 challenge signing, server-side signature verification, imposter key rejection, and challenge tampering rejection. |

**Total Verified Tests**: **34 passing tests across 4 test suites (0 failures, 0 skips)**.

---

## Running the Test Suite

```bash
# Run all tests once
pnpm test

# Run tests in watch mode during development
pnpm test:watch
```

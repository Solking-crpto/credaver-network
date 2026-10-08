# CredaVer Network

> **The Cryptographic Authorization Layer Between AI Agents and Solana Wallets.**  
> Built for the **Crypto World's Fair** (Colosseum Hackathon 2026).

[![Tests](https://img.shields.io/badge/tests-154%20passing-brightgreen)](./docs/testing.md)
[![Solana Devnet](https://img.shields.io/badge/solana-devnet%20verified-blue)](https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet)
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg)](./LICENSE)

---

## Live Demo & Video Links

- **Production Deployment**: [https://www.credavernetwork.xyz](https://www.credavernetwork.xyz)
- **Vercel Backup**: [https://credaver-network.vercel.app](https://credaver-network.vercel.app)
- **Technical Demo Video (3m 0s)**: [https://youtu.be/GwVPDWF0YwA](https://youtu.be/GwVPDWF0YwA)
- **Founder Pitch Video**: [https://www.youtube.com/shorts/KwWjFe-36JE](https://www.youtube.com/shorts/KwWjFe-36JE)
- **On-Chain Settlement Tx (Devnet)**: [`5SbhMnaU...`](https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet)
- **On-Chain SPL Memo Anchor Tx (Devnet)**: [`3qbTwf6Y...`](https://explorer.solana.com/tx/3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ?cluster=devnet) (Slot 506955056)

---

## Judge Quickstart (3 Minutes, No Login Required)

Judges can test the entire authorization and verification lifecycle without entering credentials or depositing funds:

1. **Open the Live App**: Visit [https://www.credavernetwork.xyz](https://www.credavernetwork.xyz) and navigate to [/mandates](https://www.credavernetwork.xyz/mandates).
2. **Connect Phantom Wallet**: Click **Connect Wallet** (Phantom or any Wallet Standard provider; works on any network, zero SOL required).
3. **Issue an Agent Mandate**: Click **Issue Agent Mandate**. Inspect the human-readable Phantom message (`CredaVer Mandate v1`) with granular caps, allowed merchant, and expiry, then approve the signature.
4. **Test an Allowed Payment**: In the Agent Test Console, click **Test Allowed ($1.00)**. The policy engine evaluates all 12 gates and approves the payment; cumulative spend advances from `$0.00` to `$1.00 / $5.00`.
5. **Test Fail-Closed Over-Cap**: Click **Test Over-Cap ($10.00)**. The policy engine immediately rejects the request with HTTP `403 AMOUNT_EXCEEDS_CAP`. The spend bar does not budge, and no transaction is signed.
6. **Revoke Mandate**: Click **Revoke** on your active mandate. Status changes to **Revoked** immediately. Subsequent payment attempts are permanently blocked (`403 REVOKED_MANDATE`).
7. **Verify Cryptographic Receipt**: Navigate to [/receipts](https://www.credavernetwork.xyz/receipts) or click **Verify this receipt**. The verification gateway at [/verify](https://www.credavernetwork.xyz/verify) validates the RFC 8785 canonical hash, confirms the Ed25519 signature from `CREDAVER_AUTHORITY_PUBKEY`, and checks the on-chain Solana SPL Memo anchor.

---

## 1. The Core Problem

Autonomous AI agents are beginning to transact over HTTP via the **x402 payment standard** on Solana. However, current agent architectures force builders into an all-or-nothing trap:
1. **Starve the agent of autonomy** by requiring human approval for every micro-transaction.
2. **Give the LLM raw wallet private keys**, leaving the entire treasury vulnerable to prompt injections, malicious dependencies, or rogue merchant APIs.

**CredaVer Network resolves this dilemma with Agent Mandates.**

---

## 2. Architecture & How It Works

CredaVer acts as a **Deterministic Policy Decision Point (PDP)** and **Policy Enforcement Point (PEP)** between autonomous agents and Solana funding wallets.

```
┌─────────────────────────┐       1. 402 Payment Required       ┌─────────────────────────┐
│     x402 Merchant       │ ─────────────────────────────────>  │    Autonomous Agent     │
│   (Weather Telemetry)   │ <─────────────────────────────────  │ (Identity Key ONLY)     │
└─────────────────────────┘       5. 200 Settled Telemetry      └────────────┬────────────┘
                                                                             │
                                                          2. Proof of Intent │
                                                          (No Funding Keys)  │
                                                                             v
                                                                ┌─────────────────────────┐
                                                                │  CredaVer Decision Node │
                                                                │     (PDP / Custody)     │
                                                                └────────────┬────────────┘
                                                                             │
                                                    3. Policy Gates & Sign   │
                                                    (Only if ALLOW)          │
                                                                             v
                                                                ┌─────────────────────────┐
                                                                │     Solana Devnet       │
                                                                │  + Public Facilitator   │
                                                                └─────────────────────────┘
```

### The 12 Deterministic Policy Gates

Every agent transaction request submitted to CredaVer passes through 12 fail-closed verification gates (`packages/core/src/policy.ts`):

1. **Mandate Cryptographic Integrity**: Recomputes the RFC 8785 canonical digest and verifies the operator's Ed25519 signature (`INVALID_MANDATE_INTEGRITY`).
2. **Mandate Revocation Status**: Confirms the mandate has not been revoked by the operator (`REVOKED_MANDATE`).
3. **Mandate Time Validity Window**: Rejects payments before `validFrom` or after `validUntil` (`NOT_YET_VALID`, `EXPIRED_MANDATE`).
4. **Request-Bound Payment Proof**: Verifies the agent's Ed25519 signature over the challenge payload (`INVALID_AGENT_PROOF_SIGNATURE`).
5. **Mandate Hash Binding**: Ensures the agent proof explicitly commits to the active mandate digest (`INVALID_MANDATE_INTEGRITY`).
6. **Agent Public Key Binding**: Validates that the signing agent matches the authorized `agentPubkey` in the mandate (`AGENT_MISMATCH`).
7. **Network Binding**: Enforces exact match against authorized blockchain network identifier (`NETWORK_MISMATCH`).
8. **Asset Allowlist**: Restricts settlement tokens to pre-authorized mints e.g. Devnet USDC (`ASSET_NOT_ALLOWED`).
9. **Merchant Allowlist**: Blocks unauthorized destination addresses and unlisted vendors (`MERCHANT_NOT_ALLOWED`).
10. **Per-Transaction Cap**: Rejects single transfers exceeding the per-transaction limit (`AMOUNT_EXCEEDS_PER_TX_LIMIT`).
11. **Cumulative Spend Cap**: Tracks aggregate spend atomically against the mandate maximum (`AMOUNT_EXCEEDS_CAP`, `DEPLETED_MANDATE`).
12. **Atomic Replay Protection**: Redis atomic `SET NX EX` on payment nonces prevents concurrent or repeated replay attacks (`REPLAY_DETECTED`).

*Human Review Thresholds*: Payments exceeding review limits or unknown merchants trigger status `202 REVIEW` (`AMOUNT_EXCEEDS_REVIEW_THRESHOLD`, `UNKNOWN_MERCHANT_REQUIRES_REVIEW`), queuing the receipt for operator authorization in `/reviews`.

### Separation of Concerns

| Pillar | Concept | CredaVer Implementation |
|---|---|---|
| **Identity** | Key control, NOT real-world KYC | Phantom Wallet Standard / Ed25519 challenge-response auth |
| **Authority** | Scoped, expiring spending envelope | RFC 8785 Canonical JSON Mandates signed by Operator & Agent |
| **Evidence** | Request-bound proof & settlement | Signed payment proofs binding endpoint, asset, merchant, and nonce |
| **Performance** | Verifiable decision & receipts history | Cryptographic receipts trail (no arbitrary subjective score) |
| **Payment** | Micropayment settlement | x402 V2 protocol on Solana Devnet with USDC |

---

## 3. Dedicated Route Directory

The CredaVer web application is organized into dedicated, focused routes:

- **`/` (Home)**: Landing page with core value proposition, compact 3-step workflow, direct links to console views, and proof strip.
- **`/demo`**: Interactive Scenario Runner (6 policy simulations), Honesty Audit, and featured Real Devnet Settlement with live inline result.
- **`/mandates`**: Operator Mandates Console — issue mandates with connected Phantom wallet, test agent spend, and execute 1-click revocations.
- **`/receipts`**: Comprehensive Signed Decision Receipts ledger with decision filters, Solana Explorer links, and direct verification buttons.
- **`/proof`**: Solana Devnet proof center displaying live settlement signatures, SPL Memo anchors, and verifiable slot timestamps.
- **`/verify`**: Public cryptographic verification gateway supporting receipt re-hashing, Ed25519 authority signature checking, and Solana RPC memo lookup.
- **`/how-it-works`**: In-depth architecture walkthrough, 5 core pillars, and transparent "What is real vs simulated" disclosures.
- **`/concepts`**: Interactive architectural breakdown covering Identity, Authority, Evidence, Performance, and Payment.
- **`/docs`**: Complete technical documentation, security threat model, domain models, and developer guides.
- **`/early-access`**: Developer early-access waitlist with persona selection and rate-limited submission.
- **`/reviews`**: Operator review queue for inspecting, approving, or rejecting human-in-the-loop transactions.

---

## 4. What Is Implemented vs. What Is Simulated

In keeping with our transparency principles, we explicitly disclose the boundaries of the Hackathon MVP:

### What Is Real & Implemented:
- **Zero-Key Agent Custody**: The agent holds strictly its Ed25519 identity key (`agentSecretKey`) and has **zero access** to the Solana funding wallet's private keys.
- **12 Deterministic Policy Gates**: Fail-closed evaluation of signatures, expiration windows, allowlists, per-transaction caps, cumulative limits, atomic replay checks, and review thresholds.
- **Live Solana Devnet Settlement**: Autonomous payment executed live on-chain via `@x402/svm` and the official public facilitator (`https://x402.org/facilitator`).
  - **Settlement Tx**: [`5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF`](https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet)
- **Solana SPL Memo Anchoring**: Immutably commits decision receipt hashes on-chain (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).
  - **Format**: `credav:1:<mandateHashFirst8>:<receiptHash>:<decision>` (anchored exclusively for `ALLOW` decisions).
  - **Anchored Memo Tx**: [`3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ`](https://explorer.solana.com/tx/3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ?cluster=devnet) (Slot 506955056).
- **Public Verification Portal (`/verify`)**: Live cryptographic hash recomputation, Ed25519 authority signature checking, and Solana RPC memo lookup.
- **Atomic Replay Protection**: Upstash Redis atomic `SET NX EX` eliminates concurrency race conditions (tested with 5 parallel requests).
- **Full Test Suite**: **154 passing tests across 16 test suites** with 0 skips and 0 failures.
- **Security Hardening**: Sliding-window rate limiting on `/api/sign` and `/api/auth/*`, strict Next.js security headers (CSP, X-Frame-Options: DENY, nosniff), and Zod validation on 100% of endpoints.

### What Is Simulated:
- **Interactive Scenario Buttons (`/demo`)**: The 5 quick non-payment scenario buttons (`OVER_CAP`, `REVOKED`, `EXPIRED`, `REPLAY`, `REVIEW`) run against the **real policy engine** without payment; `ALLOW` uses simulated SVM transaction wire-bytes to provide instant sub-10ms response without exhausting devnet faucet tokens. The featured **Real Devnet Settlement** button executes live on-chain settlement.
- **Demo Merchant Telemetry**: The weather telemetry payload returned by `apps/demo-merchant` is simulated.
- **Devnet Test Assets**: All tokens (Devnet USDC, Devnet SOL) are free test assets with zero monetary value.

---

## 5. Known MVP Limitations & Production Roadmap

We explicitly reject the false marketing claim of "trustless" for an offchain authorization service. CredaVer operates on Solana Devnet, has not been audited by a third-party security firm, and requires trust in the CredaVer Policy Decision Point service during MVP stage.

| MVP Status (Current) | Production Architecture (Roadmap) |
|---|---|
| **Centralized PDP Service**: CredaVer server holds the demo Solana devnet funding key in secure environment variables. | **Decentralized Signer Network**: Distributed multi-party computation (MPC) / Threshold Ed25519 signing across multiple independent validator nodes. |
| **Server-Side Cap Tracking**: Cumulative spend is tracked in Upstash Redis. | **On-Chain Mandate Enforcement**: Solana Smart Contract (Anchor Program) verifying PDP zero-knowledge receipts or multisig co-signing. |
| **Single Authority Signature**: Receipts are signed by CredaVer authority keypair. | **Consensus Receipt Quorum**: Quorum of 3-of-5 validators co-signing decision receipts before on-chain anchoring. |
| **Throwaway Devnet Keypairs**: All payer and merchant keypairs are devnet-only test assets. | **Mainnet Hardware Signers**: Ledger / Fireblocks custody integration. |

---

## 6. Development & AI Assistance Disclosure

In compliance with **Section 9 of the Official Rules (Colosseum Hackathon)**:
- **Project Initiation**: CredaVer Network was created in a fresh repository during the hackathon competition period (root commit: October 2, 2026).
- **Code Reuse**: Four isolated patterns (Upstash Redis REST client transport, challenge-response auth concept, UI styling primitives, and canonical hashing concept) were adapted from the author's prior exploratory work (`trustmesh`, commit `3540f9d`). Full disclosures, line-by-line diffs, security enhancements, and third-party library licenses are documented in [`NOTICE.md`](./NOTICE.md).
- **AI Assistance**: Built with AI assistance from Claude (architecture research, review, and documentation copy) and Google Antigravity (code implementation, refactoring, test suites, and debugging). All logic, architectural decisions, and security invariants were directed, designed, verified, and reviewed by the founder.

---

## 7. Monorepo Structure

```
credaver-network/
├── packages/
│   ├── core/           # RFC 8785 JCS canonicalization, Ed25519, state machines,
│   │                   # 12-gate deterministic policy engine, dual store adapters, memo anchoring
│   └── x402-guard/     # CredaverConstrainedSigner & pre-flight client policy guard
├── apps/
│   ├── demo-merchant/  # Express + @x402/express resource server with live facilitator sync
│   └── web/            # Next.js 15 app with dedicated /demo, /mandates, /receipts, /verify routes
├── examples/
│   └── agent/          # Autonomous AI agent script demonstrating zero funding keys
├── docs/               # Architecture, domain model, security threat model, testing matrix
├── scripts/            # S1 live devnet runner, S5 constrained signer runner, memo verification
├── NOTICE.md           # Third-party code reuse disclosures & library licenses (Colosseum Section 9)
└── LICENSE             # MIT License
```

---

## 8. Getting Started

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 10.0.0 (`npm install -g pnpm`)

### Installation & Verification
```bash
# Clone the repository
git clone https://github.com/Solking-crpto/credaver-network.git
cd credaver-network

# Install dependencies (zero external secrets required for test suite)
pnpm install

# Run the complete test suite (154 passing tests across 16 test suites)
pnpm test

# Typecheck and lint all packages
pnpm lint

# Build all packages and applications
pnpm build
```

### Running the Services Locally
```bash
# 1. Start the CredaVer Web Console and Policy Decision Service (port 3000)
pnpm --filter @credaver/web dev

# 2. In a second terminal, start the x402 Demo Merchant (port 4025)
pnpm --filter @credaver/demo-merchant start

# 3. In a third terminal, run the autonomous agent example
pnpm --filter @credaver/example-agent start
```

Visit `http://localhost:3000` to interact with the Operator Console and `http://localhost:3000/verify` to verify decision receipts.

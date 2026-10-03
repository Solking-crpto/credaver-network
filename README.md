# CredaVer Network

> **The Cryptographic Authorization Layer Between AI Agents and Solana Wallets.**  
> Built for the **Crypto World's Fair** (Colosseum Hackathon 2026).

[![Tests](https://img.shields.io/badge/tests-106%20passing-brightgreen)](file:///c:/Users/DELL/Hackathon/credaver-network/docs/testing.md)
[![Solana Devnet](https://img.shields.io/badge/solana-devnet%20verified-blue)](https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet)
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg)](./LICENSE)

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

### Core Separation of Concerns

| Pillar | Concept | CredaVer Implementation |
|---|---|---|
| **Identity** | Key control, NOT real-world KYC | Phantom Wallet Standard / Ed25519 challenge-response auth |
| **Authority** | Scoped, expiring spending envelope | RFC 8785 Canonical JSON Mandates signed by Operator & Agent |
| **Evidence** | Request-bound proof & settlement | Signed payment proofs binding endpoint, asset, merchant, and nonce |
| **Performance** | Verifiable decision & receipts history | Cryptographic receipts trail (no arbitrary subjective score) |
| **Payment** | Micropayment settlement | x402 V2 protocol on Solana Devnet with USDC |

---

## 3. What Is Implemented vs. What Is Simulated

In keeping with our transparency principles, we explicitly disclose the boundaries of the Hackathon MVP:

### What Is Real & Implemented:
- **Zero-Key Agent Custody**: The agent holds strictly its Ed25519 identity key (`agentSecretKey`) and has **zero access** to the Solana funding wallet's private keys.
- **12 Deterministic Policy Gates**: Fail-closed evaluation of signatures, expiration windows, allowlists, per-transaction caps, cumulative limits, atomic replay checks, and review thresholds.
- **Live Solana Devnet Settlement**: Autonomous payment executed live on-chain via `@x402/svm` and the official public facilitator (`https://x402.org/facilitator`).
  - **Settlement Tx**: [`5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF`](https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet)
- **Solana SPL Memo Anchoring**: Immutably commits decision receipt hashes on-chain (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`).
  - **Anchored Memo Tx**: [`3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ`](https://explorer.solana.com/tx/3qbTwf6YAnSjFrkdD85R2C4w16wznA7qkt2hVWR2qxBtqUfBfbjJBxEYuosPY5tkyWhSZivEF3H1QRhDjXgHLwMQ?cluster=devnet) (Slot 506955056).
- **Public Verification Portal (`/verify`)**: Live cryptographic hash recomputation, Ed25519 authority signature checking, and Solana RPC memo lookup.
- **Atomic Replay Protection**: Redis atomic `SET NX EX` eliminates concurrency race conditions (tested with 5 parallel requests).
- **Full Test Suite**: **104 passed tests across 12 test suites** with 0 skips and 0 failures.
- **Security Hardening**: Sliding-window rate limiting on `/api/sign` and `/api/auth/*`, strict Next.js security headers (CSP, X-Frame-Options: DENY, nosniff), and Zod validation on 100% of endpoints.

### What Is Simulated:
- **In-Browser Scenario Runner**: The 6 interactive buttons on the homepage (`ALLOW`, `OVER_CAP`, `REVOKED`, etc.) run against the **real policy engine**, but use simulated SVM transaction wire-bytes to provide instant sub-10ms latency without consuming judge testnet tokens.
- **Demo Merchant Telemetry**: The weather telemetry payload returned by `apps/demo-merchant` is simulated.
- **Devnet Test Assets**: All tokens (Devnet USDC, Devnet SOL) are free test assets with zero monetary value.

---

## 4. Known MVP Limitations & Production Roadmap

We explicitly reject the false marketing claim of "trustless" for an offchain authorization service.

| MVP Status (Current) | Production Architecture (Roadmap) |
|---|---|
| **Centralized PDP Service**: CredaVer server holds the demo Solana devnet funding key in secure environment variables. | **Decentralized Signer Network**: Distributed multi-party computation (MPC) / Threshold Ed25519 signing across multiple independent validator nodes. |
| **Server-Side Cap Tracking**: Cumulative spend is tracked in Upstash Redis. | **On-Chain Mandate Enforcement**: Solana Smart Contract (Anchor Program) verifying PDP zero-knowledge receipts or multisig co-signing. |
| **Single Authority Signature**: Receipts are signed by CredaVer authority keypair. | **Consensus Receipt Quorum**: Quorum of 3-of-5 validators co-signing decision receipts before on-chain anchoring. |
| **Throwaway Devnet Keypairs**: All payer and merchant keypairs are devnet-only test assets. | **Mainnet Hardware Signers**: Ledger / Fireblocks custody integration. |

---

## 5. Third-Party Code Reuse Disclosure

In compliance with **Section 9 of the Official Rules (Colosseum Hackathon)**:
- CredaVer Network was developed in a fresh repository during the hackathon competition period.
- Four isolated architectural patterns (Upstash Redis REST client transport, cryptographic auth concept, UI primitive styles, and canonical hashing concept) were adapted from the author's prior exploratory work (`trustmesh`, commit `3540f9d`).
- Full details, line-by-line diffs, security enhancements (atomic `SET NX EX` fix and pure Ed25519 migration), and strict exclusions are documented in [`NOTICE.md`](./NOTICE.md).

---

## 6. Monorepo Structure

```
credaver-network/
├── packages/
│   ├── core/           # RFC 8785 JCS canonicalization, Ed25519, state machines,
│   │                   # 12-gate deterministic policy engine, dual store adapters, memo anchoring
│   └── x402-guard/     # CredaverConstrainedSigner & pre-flight client policy guard
├── apps/
│   ├── demo-merchant/  # Express + @x402/express resource server with live facilitator sync
│   └── web/            # Next.js 15 dashboard, scenario runner, and /verify portal
├── examples/
│   └── agent/          # Autonomous AI agent script demonstrating zero funding keys
├── docs/               # Architecture, domain model, security threat model, testing matrix
├── scripts/            # S1 live devnet runner, S5 constrained signer runner, memo verification
├── NOTICE.md           # Third-party code reuse disclosures (Colosseum Section 9)
└── LICENSE             # MIT License
```

---

## 7. Getting Started

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

# Run the complete test suite (104 tests across 12 suites)
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

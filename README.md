# CredaVer Network

> **The Cryptographic Authorization Layer Between AI Agents and Solana Wallets.**  
> Built for the **Crypto World's Fair** (Colosseum Hackathon 2026).

---

## Overview

AI agents are gaining economic agency, but handing them raw private keys is a critical security vulnerability. CredaVer solves this through **Agent Mandates**: Ed25519-signed, scoped, expiring, revocable spending authorizations issued by a human operator or DAO.

Before an autonomous agent executes a payment via the **x402 payment standard** on Solana, CredaVer acts as a **Deterministic Policy Decision Point (PDP)**. It validates the payment request against the Mandate and returns:
- **ALLOW**: Within all limits, allowed merchant, allowed asset.
- **DENY**: Structured reason codes (`EXPIRED_MANDATE`, `REVOKED_MANDATE`, `MERCHANT_NOT_ALLOWED`, `AMOUNT_EXCEEDS_PER_TX_LIMIT`, `AMOUNT_EXCEEDS_TOTAL_CAP`, `NONCE_REPLAYED`).
- **REVIEW**: High-value transactions or unknown merchants trigger an operator approval workflow.

Every decision produces a cryptographically signed, independently verifiable **Receipt**.

---

## Separation of Concerns (Five Core Pillars)

| Pillar | What It Is | Mechanism |
|---|---|---|
| **1. Identity** | Cryptographic key control (not KYC) | Phantom Wallet Standard (Ed25519 challenge signing) |
| **2. Authority** | Scoped, expiring spending envelope | RFC 8785 Canonical JSON Mandates signed by Operator & Agent |
| **3. Evidence** | Request-bound proof & settlement receipts | Audience, recipient, nonce, amount, and Solana tx hash |
| **4. Performance** | Verifiable decision & receipts history | Cryptographic receipts trail (no arbitrary reputation score) |
| **5. Payment** | Micropayment settlement | x402 V2 protocol on Solana devnet using USDC |

---

## Architectural Transparency & Disclosure

> **Important**: CredaVer is a **Policy Decision Point (PDP)**. We do not make false claims of "trustlessness". Offchain policies are evaluated deterministically by CredaVer software, backed by signed receipts that third parties can independently verify against the Solana blockchain. All demo funds and demo merchants are simulated on Solana devnet.

---

## Repository Structure

```
credaver-network/
├── packages/
│   ├── core/           # Framework-free TS: Mandates, JCS (RFC 8785), Ed25519,
│   │                   # Policy Engine (ALLOW/DENY/REVIEW), Store, Receipts
│   └── x402-guard/     # x402 client registerPolicy hook & pre-flight guard
├── apps/
│   ├── demo-merchant/  # Simulated x402 merchant API (PAYMENT-REQUIRED / PAYMENT-RESPONSE)
│   └── web/            # Next.js 15 + Tailwind CSS dashboard with Phantom Connect
├── docs/               # Architecture, domain model, security, testing, demo script
├── NOTICE.md           # Colosseum Section 9 third-party code reuse disclosure
└── LICENSE             # MIT License
```

---

## Quickstart & Verification

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 10.0.0 (installed globally: `npm install -g pnpm`)

### Install Dependencies
```bash
pnpm install
```

### Run Tests
Execute the full Vitest suite (34 unit and integration tests covering crypto, canonicalization, policy gates, concurrent replay race protection, x402 round trip, and wallet auth):
```bash
pnpm test
```

### Build All Packages and Applications
```bash
pnpm build
```

---

## Open Source & Third-Party Attribution
CredaVer Network is licensed under the **MIT License**. In compliance with Section 9 of the Colosseum Official Rules, all reused or adapted code patterns (specifically Upstash Redis REST transport and atomic replay protection adaptations derived from our prior hackathon exploratory work) are explicitly documented in [`NOTICE.md`](./NOTICE.md).

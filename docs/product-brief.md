# CredaVer Network: Product Brief

**Status**: Phase 2 Verified Scaffold & Technical Spikes  
**Target Event**: Crypto World's Fair (Colosseum Hackathon 2026)  
**Submission Deadline**: Mon Oct 12, 2026, 11:59pm PT (Aiming for Mon Oct 12, ~10:00am PT / 6:00pm WAT)  
**Chain & Protocol**: Solana Devnet • x402 V2  

---

## 1. The Problem: The Agent Wallet Vulnerability

As AI agents gain economic agency, developers and DAOs are handing them direct access to crypto wallets to buy paid APIs, compute, dataset feeds, and micro-services. Today, teams face an unacceptable dilemma:

1. **Unconstrained Hot Keys**: Giving the agent a raw private key. A prompt injection, hallucination, or compromised dependency can drain the entire wallet balance in seconds.
2. **Ad-Hoc, Brittle Scripts**: Hardcoded limits that cannot handle scoped delegation, have no cryptographically verifiable receipts, and fail to provide human review workflows.
3. **Overclaimed "Trustless" AI**: Projects falsely claiming AI can self-enforce onchain safety or judge disputes impartially.

---

## 2. The Solution & Wedge: "Agent Mandates"

**CredaVer is the cryptographic authorization layer between an AI agent and its Solana wallet.**

Instead of granting an agent unrestricted wallet access or trusting its reasoning, a human operator or DAO issues an **Ed25519-signed, scoped, expiring, revocable Mandate**. 

Before the agent pays any resource protected by the **x402 payment standard** on Solana, CredaVer acts as a **Deterministic Policy Decision Point (PDP)**. It intercepts the HTTP 402 payment requirements, validates the exact payment against the Mandate, and returns:
- **ALLOW**: All financial, merchant, asset, network, and replay gates passed. Payment proceeds to Solana devnet settlement.
- **DENY**: Structured reason codes (`EXPIRED_MANDATE`, `REVOKED_MANDATE`, `MERCHANT_NOT_ALLOWED`, `AMOUNT_EXCEEDS_PER_TX_LIMIT`, `AMOUNT_EXCEEDS_TOTAL_CAP`, `NONCE_REPLAYED`). Payment is safely halted before any funds move.
- **REVIEW**: High-value transactions or unknown merchants trigger an approval flow requiring an operator wallet signature.

Every decision produces an **independently verifiable cryptographic receipt** containing the mandate hash, request digest, policy version, and decision signature.

---

## 3. Strict Separation of Concerns (Zero Conflation)

CredaVer enforces clean conceptual boundaries across 5 pillars:

| Pillar | Mechanism | What It Proves / Does | What It Does NOT Claim |
|---|---|---|---|
| **Identity** | Phantom Wallet Standard (Ed25519) | Proves cryptographic control over a Solana keypair | Does NOT claim KYC, legal identity, or biometric personhood |
| **Authority** | RFC 8785 Canonical Mandates | Operator grants explicit spending envelope to agent key | AI never grants itself authority; authority is strictly bounded |
| **Evidence** | Request-bound Proofs & Tx Hashes | Cryptographic binding to audience, amount, nonce, and Solana tx | Does NOT rely on unanchored offchain claims |
| **Performance** | Verifiable Receipts Ledger | Auditable history of signed ALLOW/DENY/REVIEW receipts | No subjective reputation score or fake credit scores |
| **Payment** | x402 V2 Protocol on Solana | Trust-minimized micropayment settlement via devnet USDC | CredaVer is NOT a new token or custom settlement rail |

---

## 4. What is Onchain vs. What Stays Offchain

- **Onchain**:
  - Solana x402 payment settlement (devnet USDC / SOL transfers).
  - Transaction signatures anchored in receipts for independent third-party verification.
  - *Future Upgrade*: Hard spend caps anchored into the Subscriptions Delegation Program (`De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`).
- **Offchain (CredaVer PDP)**:
  - Mandate issuance, mutual counter-signing, and storage.
  - Deterministic policy engine evaluation (ALLOW / DENY / REVIEW).
  - High-speed atomic nonce replay prevention (`SET NX EX`).
  - Cryptographic receipt generation and verification explorer.

> **Honest Architectural Disclosure**: CredaVer is a Policy Decision Point. We do not claim trustlessness; we provide verifiable, deterministic containment. Offchain policy evaluation is executed cleanly by CredaVer software, backed by signed receipts that any third party can independently verify.

# CredaVer Network: Security Architecture, Threat Model & Privacy Specification

**Contest**: Crypto World's Fair Hackathon 2026 (Colosseum)  
**Status**: Milestone 6 Complete — Formal Security Threat Specification & Verification  
**Classification**: Public Architecture & Defense Specification  

---

## 1. Executive Security Architecture

CredaVer operates as a deterministic **Policy Decision Point (PDP)** and **Policy Enforcement Point (PEP)** between autonomous AI agents and Solana funding wallets.

```
┌─────────────────┐       1. 402 Payment Required       ┌─────────────────────┐
│  x402 Resource  │ ─────────────────────────────────>  │  Autonomous Agent   │
│ (Demo Merchant) │ <─────────────────────────────────  │ (Identity Key ONLY) │
└─────────────────┘       5. 200 Settled Telemetry      └──────────┬──────────┘
                                                                   │
                                                2. Proof of Intent │
                                                (No Funding Keys)  │
                                                                   v
                                                        ┌─────────────────────┐
                                                        │  CredaVer Decision  │
                                                        │   & Signing Node    │
                                                        │ (PDP/PEP Custody)   │
                                                        └──────────┬──────────┘
                                                                   │
                                          3. Policy Verification   │
                                          & Custodial SVM Signing  │
                                                                   v
                                                        ┌─────────────────────┐
                                                        │   Solana Devnet     │
                                                        │   & Facilitator     │
                                                        └─────────────────────┘
```

### Core Architectural Axioms
1. **AI Never Grants Itself Financial Authority**: Authority is derived strictly from human/DAO cryptographic Ed25519 signatures over deterministic Mandate parameters.
2. **Policy Evaluation is Pure Code, Not LLM Output**: The decision engine never executes LLM prompts or probabilistic heuristics to decide financial approval. Decisions are deterministic Boolean logic evaluated over RFC 8785 canonical JSON and validated Zod schemas.
3. **Fail-Closed by Design**: If any cryptographic signature is missing or corrupted, if the store is unavailable, or if financial bounds are exceeded, the decision engine defaults to `DENY`.
4. **Agent Zero-Key Custody**: The agent holds **ONLY** its own Ed25519 identity key (`agentSecretKey`) used to sign request-bound payment proofs. It possesses **NO private keys** for the Solana funding wallet (`paymentSecretKey`). The custody key is held strictly by the CredaVer Decision & Signing Service and is invoked **ONLY** when policy evaluation returns `ALLOW`.
5. **Request-Bound Intent**: Proofs commit immutably to audience endpoint, destination merchant, asset mint, amount, network, timestamp, and unique nonce. Proofs cannot be altered, substituted, or replayed.

---

## 2. Comprehensive Analysis of the 12 Attack Vectors

### Vector 1: Compromised Agent Key
* **Attack Scenario**: A malicious prompt injection, side-channel leak, or malicious dependency compromises the AI agent's private key (`agentSecretKey`).
* **Impact Without CredaVer**: An attacker with wallet keys immediately drains the entire balance to an external address.
* **CredaVer Mitigation**:
  - The agent key is **ONLY an identity key**; it cannot sign Solana transactions directly.
  - The agent's authority is bounded by the operator's active mandate:
    1. Maximum per-transaction spend limit (`maxPerTx`).
    2. Hard cumulative spend ceiling (`totalCap`).
    3. Strict merchant public key allowlist (`allowedMerchants`).
    4. Strict mint/token allowlist (`allowedAssets`).
    5. Time-bound validity window (`validFrom` to `expiresAt`).
  - Even if completely subverted, the compromised agent key cannot spend more than the remaining cap, cannot send funds to an unlisted wallet, and cannot spend after the mandate expires. Worst-case financial loss is strictly mathematically bounded.

### Vector 2: Rogue Merchant Attempting Overcharge
* **Attack Scenario**: A malicious or compromised merchant API returns an x402 Payment Required challenge asking for 100 USDC when the service cost is only 1 USDC.
* **Impact Without CredaVer**: An autonomous agent with a wallet might pay the exorbitant fee without human awareness.
* **CredaVer Mitigation**:
  - The agent signs an explicit, request-bound `PaymentProofCore` containing `amount: "1000000"`.
  - CredaVer checks `proof.amount <= mandate.maxPerTx` (Gate 10) and checks `proof.amount <= remainingCap`.
  - The transaction message signed by CredaVer strictly transfers the amount authorized in the proof. If the merchant demands an amount exceeding `maxPerTx` or `reviewThreshold`, the request is immediately rejected (`AMOUNT_EXCEEDS_PER_TX`) or held for human review (`AMOUNT_EXCEEDS_REVIEW_THRESHOLD`).

### Vector 3: Replay Attacks
* **Attack Scenario**: An eavesdropper intercepts a valid agent payment proof and replays it multiple times to drain funds.
* **Impact Without CredaVer**: Multiple duplicate payments could execute on-chain.
* **CredaVer Mitigation**:
  - Every payment proof requires a unique cryptographic `nonce` generated by the agent.
  - Nonces are consumed atomically via Redis single-operation `SET NX EX`:
    ```redis
    SET credav:nonce:<nonce> "consumed" NX EX <ttlSeconds>
    ```
  - If the nonce was already used, `SET NX` returns `null`. The policy engine immediately rejects the request with `REPLAY_DETECTED` (or `NONCE_REPLAYED`).
  - Nonce TTL covers the validity window plus clock skew margin.

### Vector 4: Post-Revocation Spend Attempt
* **Attack Scenario**: An operator discovers suspicious activity and clicks **Revoke Mandate**. The agent attempts to rush transactions through before revocation propagates.
* **Impact Without CredaVer**: Slow on-chain revocations or cached states allow transactions to sneak through.
* **CredaVer Mitigation**:
  - Revocations in CredaVer are instantaneous state mutations stored in high-performance Upstash Redis / Memory Store (`credav:mandate:<id>`).
  - Gate 2 checks `mandate.revoked === true` before evaluating any signatures or caps.
  - Subsequent requests are denied within milliseconds with `REVOKED_MANDATE`.

### Vector 5: Cross-Network Replay
* **Attack Scenario**: An attacker captures a valid devnet payment proof and attempts to execute it against a mainnet wallet or different blockchain.
* **Impact Without CredaVer**: Potential cross-chain double spend.
* **CredaVer Mitigation**:
  - Every mandate and payment proof explicitly binds the network genesis identifier (e.g. `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` for Devnet).
  - Gate 7 verifies `proof.network.toLowerCase() === mandate.network.toLowerCase()`.
  - Network mismatches are immediately denied with `NETWORK_MISMATCH`.

### Vector 6: Asset Substitution
* **Attack Scenario**: An agent authorized to spend devnet USDC attempts to transfer SOL, governance tokens, or worthless meme tokens to bypass token controls.
* **Impact Without CredaVer**: Wallet token balances depleted or manipulated.
* **CredaVer Mitigation**:
  - The mandate specifies an explicit array of allowed mint addresses (`allowedAssets`).
  - Gate 8 normalizes and validates `proof.asset` against the allowlist.
  - Unauthorized asset transfers fail closed with `ASSET_NOT_ALLOWED`.

### Vector 7: Fee-Payer Draining
* **Attack Scenario**: An attacker repeatedly triggers failed or micro-transactions to exhaust the Solana funding wallet's SOL balance via transaction gas fees.
* **Impact Without CredaVer**: The wallet becomes unable to transact due to lack of gas fees.
* **CredaVer Mitigation**:
  - Under the official x402 protocol on Solana, transaction network fees are sponsored by the **facilitator** (e.g., fee-payer `CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5` on `https://x402.org/facilitator`).
  - CredaVer rejects unauthorized requests **off-chain** before any Solana transaction is signed or broadcast. Zero network gas fees are consumed by denied requests.

### Vector 8: Concurrent Race Condition (Parallel Proof Submission)
* **Attack Scenario**: An attacker simultaneously fires 5 parallel HTTP requests with the exact same nonce and proof, attempting to exploit a race condition between reading the spend ledger and writing it.
* **Impact Without CredaVer**: In naive read-then-write architectures, all 5 requests pass because they read an unspent balance simultaneously.
* **CredaVer Mitigation**:
  - Nonce consumption utilizes Redis atomic `SET NX EX`.
  - In our automated concurrency suite (`packages/core/src/persistence.test.ts`), 5 simultaneous racing requests with identical nonces are fired concurrently.
  - Result: **Exactly 1 request succeeds (winner); exactly 4 requests are rejected atomically**.

### Vector 9: Forged Decision Receipts
* **Attack Scenario**: An untrusted intermediary produces a fabricated receipt claiming CredaVer authorized a payment that never occurred.
* **Impact Without CredaVer**: False evidence presented to downstream accounting systems.
* **CredaVer Mitigation**:
  - Every receipt is canonically hashed using RFC 8785 (JCS) and signed using the CredaVer decision authority's Ed25519 key (`authoritySignature`).
  - Anyone can verify the receipt offline via `verifySignedReceipt()` or online at `/verify`.
  - For `ALLOW` decisions, the receipt hash is anchored immutably to Solana devnet using the SPL Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`). Tampering with any field invalidates both the Ed25519 signature and the on-chain memo hash.

### Vector 10: Man-in-the-Middle (MITM) on Facilitator / Gateway
* **Attack Scenario**: A network proxy tampers with payment requirements in transit between the merchant, client, and facilitator.
* **Impact Without CredaVer**: Redirected funds or altered payment requirements.
* **CredaVer Mitigation**:
  - All facilitator communications mandate TLS 1.3 encryption.
  - Payment proof audience binding (`proof.audience`) commits to the exact merchant endpoint URI.
  - The merchant resource server explicitly syncs supported payment schemes and networks with the facilitator at startup, aborting immediately if communication is compromised.

### Vector 11: Timing Attacks on Mandate Expiration
* **Attack Scenario**: An attacker attempts to exploit server clock drift or boundary conditions to submit proofs just after expiration.
* **Impact Without CredaVer**: Out-of-window spends accepted.
* **CredaVer Mitigation**:
  - Gate 3 evaluates `evaluatedAt < mandate.validFrom` (`NOT_YET_VALID`) and `evaluatedAt > mandate.expiresAt` (`EXPIRED_MANDATE`).
  - Time checks are executed against synchronized server epoch milliseconds.
  - Nonces carry explicit TTLs bound to expiration timestamps, preventing stale reuse.

### Vector 12: Operator Key Compromise
* **Attack Scenario**: The human operator's master Ed25519 private key is leaked or compromised.
* **Impact**: An attacker could issue new malicious mandates.
* **CredaVer Mitigation & Procedures**:
  - **Cold Storage & Hardware Wallets**: In production, operator keys should reside in hardware wallets (Ledger/Phantom via Wallet Standard).
  - **Operator Key Rotation Procedure**:
    1. Operator connects recovery wallet and revokes all active mandates via `POST /api/mandates/:id/revoke`.
    2. Operator issues fresh mandates bound to the new operator public key.
    3. Future roadmap incorporates multi-signature threshold approval (e.g. Squads multisig on Solana) for high-value mandate issuance.

---

## 3. Privacy & Minimal Disclosure

* **Offchain Encapsulation**: Mandates and proofs are evaluated offchain at the Policy Decision Point, preventing internal business limits or agent IDs from leaking to public mempools before payment.
* **Public Receipts**: Receipts record the mandate hash, transaction signature, decision, and timestamp, proving that an authorized mandate was respected without disclosing the operator's internal risk thresholds.
* **Zero KYC**: CredaVer operates on cryptographic keypair control; it never collects real-world identities, biometric data, or custodial funds.

---

## 4. Honest Disclosure of MVP Limitations & Production Roadmap

We explicitly reject the false marketing claim of "trustless" for an offchain authorization service. In the Colosseum Hackathon MVP:

| MVP Status (Current) | Production Architecture (Roadmap) |
|---|---|
| **Centralized PDP Service**: CredaVer server holds the demo Solana devnet funding key in secure environment variables. | **Decentralized Signer Network**: Distributed multi-party computation (MPC) / Threshold Ed25519 signing across multiple independent validator nodes. |
| **Server-Side Cap Tracking**: Cumulative spend is tracked in Upstash Redis. | **On-Chain Mandate Enforcement**: Solana Smart Contract (Anchor Program) verifying PDP zero-knowledge receipts or multisig co-signing. |
| **Single Authority Signature**: Receipts are signed by CredaVer authority keypair. | **Consensus Receipt Quorum**: Quorum of 3-of-5 validators co-signing decision receipts before on-chain anchoring. |
| **Throwaway Devnet Keypairs**: All payer and merchant keypairs are devnet-only test assets. | **Mainnet Hardware Signers**: Ledger / Fireblocks custody integration. |

---

## 5. Security Verification Checklist

- [x] All 12 deterministic policy gates covered by automated boundary tests (`packages/core/src/core.test.ts`).
- [x] Atomic `SET NX EX` race condition verified with 5 concurrent requests (`packages/core/src/persistence.test.ts`).
- [x] Mandate revocation tested with instant policy rejection (`packages/core/src/persistence.test.ts`).
- [x] Replay protection verified with duplicate nonces (`apps/web/src/scenarios-api.test.ts`).
- [x] On-chain memo receipt anchoring verified on Solana devnet slot 506955056 (`packages/core/src/anchor.test.ts`).
- [x] Rate limiting active on signing and authentication endpoints (`apps/web/src/lib/rate-limit.ts`).
- [x] Strict HTTP security headers configured (CSP, X-Frame-Options: DENY, nosniff, Referrer-Policy).
- [x] Public verification gateway active at `/verify` and `/api/verify`.

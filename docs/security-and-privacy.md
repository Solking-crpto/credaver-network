# CredaVer Network: Security, Threat Model & Privacy

## 1. Core Security Invariants

1. **AI Never Grants Itself Financial Authority**: Authority is derived strictly from human/DAO Ed25519 signatures over deterministic Mandate parameters.
2. **Policy Evaluation is Pure Code, Not LLM Output**: The decision engine does not execute LLM prompts or heuristic evaluations to decide financial approval. Decisions are deterministic Boolean logic evaluated over validated Zod schemas.
3. **Fail-Closed by Design**: If any cryptographic signature is missing or corrupted, if the store is unavailable, or if limits are exceeded, the decision engine defaults to `DENY`.
4. **No Raw Secrets in CredaVer**: CredaVer nodes and frontend components never store or log operator private keys. Devnet agent keys are throwaway and constrained to mandate envelopes.

---

## 2. Threat Analysis & Mitigations

### Threat A: Confused Deputy & Cross-Domain Replay
* **Attack**: An attacker takes a signed payment proof intended for low-cost Merchant A and submits it to high-cost Merchant B, or attempts to replay a devnet proof on mainnet.
* **Mitigation**: Every payment proof explicitly binds `audience` (target endpoint URI), `merchantPubkey` (specific recipient), `network` (`solana:devnet`), `asset`, `amount`, and `nonce`. Mutating any field breaks the Ed25519 signature.

### Threat B: Concurrency Race Condition in Nonce Replay
* **Attack**: An attacker sends two identical payment requests simultaneously. In naive systems (e.g. `GET nonce` followed by `SET nonce`), both requests pass before either writes the consumed nonce.
* **Mitigation**: CredaVer uses single-operation atomic check-and-set:
  ```
  SET credav:nonce:<nonce> "consumed" NX EX <ttlSeconds>
  ```
  If the key already existed, Redis returns `null` and the store returns `false`. Exactly one concurrent request can ever succeed; all racing duplicates are immediately rejected with `NONCE_REPLAYED`.

### Threat C: Prompt Injection Compromising the Agent
* **Attack**: A malicious user injects instructions into an AI agent prompt commanding it to drain funds to an attacker's wallet.
* **Mitigation**: Even if the AI agent's reasoning is completely compromised, it cannot pay the attacker's wallet because the merchant address is not on the Mandate's `allowedMerchants` allowlist, and the payment amount is strictly bound by `maxPerTx` and `totalCap`. The CredaVer guard halts payment before any transaction is signed.

### Threat D: Mandate Tampering
* **Attack**: An agent or intermediary modifies `totalCap` or `expiresAt` in the Mandate JSON.
* **Mitigation**: The operator signs the RFC 8785 (JCS) canonical hash of the parameters. Modifying a single character alters the hash and invalidates the operator's Ed25519 signature.

---

## 3. Privacy & Minimal Disclosure

* **Offchain Encapsulation**: Mandates and proofs are evaluated offchain at the Policy Decision Point, preventing internal business limits or agent IDs from leaking to public mempools before payment.
* **Public Receipts**: Receipts record the mandate hash, transaction signature, decision, and timestamp, proving that an authorized mandate was respected without disclosing the operator's internal risk thresholds.
* **Zero KYC**: CredaVer operates on cryptographic keypair control; it never collects real-world identities, biometric data, or custodial funds.

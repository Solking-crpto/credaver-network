# CredaVer Network: System Architecture

```mermaid
flowchart TD
    subgraph Operator ["1. Human / DAO Operator"]
        PW["Phantom Wallet (Wallet Standard)"]
        Challenge["Sign Auth Challenge"]
        Issue["Issue Scoped Mandate (RFC 8785)"]
    end

    subgraph Agent ["2. Autonomous AI Agent"]
        AK["Agent Ed25519 Keypair"]
        Counter["Counter-sign Mandate"]
        CallAPI["Call Paid API (GET /api/weather)"]
        Guard["CredaVer Client Guard (@credaver/x402-guard)"]
    end

    subgraph PDP ["3. CredaVer Policy Decision Point"]
        PE["Deterministic Policy Engine"]
        Store["Atomic Store (SET NX EX Replay Protection)"]
        ReceiptEngine["Receipt Issuer (Ed25519)"]
    end

    subgraph Merchant ["4. Simulated Merchant (x402 Server)"]
        MApp["Express Resource Server"]
        M402["HTTP 402 PAYMENT-REQUIRED"]
        M200["HTTP 200 PAYMENT-RESPONSE"]
    end

    subgraph Solana ["5. Solana Devnet (Settlement)"]
        USDC["Devnet USDC Transfer"]
        Tx["Onchain Transaction Signature"]
    end

    PW -->|Connect & Sign| Challenge
    Challenge -->|Verify Ed25519| Issue
    Issue -->|Mutual Binding| Counter
    Counter --> AK
    AK --> CallAPI
    CallAPI -->|Initial Request (Unpaid)| MApp
    MApp -->|402 Header| M402
    M402 --> Guard
    Guard -->|Pre-Authorize| PE
    PE <--> Store
    PE -->|Decision: ALLOW| ReceiptEngine
    ReceiptEngine -->|Signed Receipt| Guard
    Guard -->|Payment Payload + Proof| MApp
    MApp -->|Settle| USDC
    USDC -->|Confirm| Tx
    Tx --> M200
    M200 -->|Resource Payload| Agent
```

---

## 1. Core Component Breakdown

### A. `@credaver/core` (Composable Open-Source Library)
* **Zero-dependency framework-free TypeScript engine**.
* **Canonicalization**: RFC 8785 JSON Canonicalization Scheme (JCS) via `canonicalize` ensuring cross-language byte-for-byte serialization.
* **Cryptography**: Ed25519 key handling, Base58 encoding/decoding, digital signatures.
* **Mandate Schema**: Zod-validated data structures capturing operator pubkey, agent pubkey, merchant allowlist, asset allowlist, per-tx limit, cumulative cap, validity dates, nonce, and network (`solana:devnet`).
* **Proof Generator**: Request-bound payment authorization proofs binding audience URI, merchant recipient, token asset, amount, and single-use nonce.
* **Policy Engine**: Deterministic evaluator with 12 strict security gates returning `ALLOW`, `DENY` with reason codes, or `REVIEW`.
* **Receipt Engine**: Verifiable receipt issuer and independent verification function.
* **Storage Layer**: Interface supporting in-memory store and Upstash Redis REST store with atomic `SET NX EX` replay prevention.

### B. `@credaver/x402-guard` (Agent Policy Interceptor)
* Plugs directly into the `@x402/fetch` HTTP client via `registerPolicy(policy)`.
* Intercepts HTTP 402 Payment Required responses from merchant APIs.
* Evaluates incoming `PaymentRequirements` against the active Mandate.
* Drops any requirements that exceed caps, use unapproved assets, or target unknown merchants before keys or signatures are exposed.

### C. `apps/demo-merchant` (Simulated Merchant API)
* Express server running protected routes (`/api/weather`, `/api/compute`).
* Fully conforms to the x402 V2 specification:
  * Responds with status 402 and `PAYMENT-REQUIRED` header when unpaid.
  * Verifies incoming `PAYMENT-SIGNATURE` header.
  * Responds with status 200, paid telemetry, and `PAYMENT-RESPONSE` header with transaction signature.
* Explicitly branded and watermarked as **SIMULATED MERCHANT**.

### D. `apps/web` (Operator Dashboard & Verification Portal)
* Next.js 15, React 19, Tailwind CSS.
* **CredaVer Cybernetic Theme**: Deep navy/black (`#050711`), blue-cyan (`#00f2fe`), violet accents (`#7f00ff`), restrained magenta (`#f857a6`), and subtle glow.
* Native **Phantom Connect & Wallet Standard** (no legacy `@solana/web3.js` bloat).
* Header designed with dedicated drop-in slot for founder brand logo (`apps/web/public/brand/logo.png`).
* Visual inspector for Mandates, Policy evaluations, and independently verified Receipts.

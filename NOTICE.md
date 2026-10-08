# CredaVer Network - Third-Party & Code Reuse Disclosures

In accordance with Section 9 of the Crypto World's Fair Official Rules (Colosseum Hackathon), this document explicitly identifies and attributes any prior art, third-party libraries, and code patterns derived or adapted from prior open-source repositories.

## 1. Upstream Reference Repository

- **Repository**: VeriqoMesh Network (`trustmesh`)
- **Branch**: `envio`
- **Source Commit Hash**: `3540f9d`
- **Author**: Tochukwu SN (`Solking-crpto`)
- **License**: MIT

VeriqoMesh is a separate earlier project by the same author. It is not entered in this hackathon. No contracts, chain config, brand assets, audio or video from it are reused.

---

## 2. Reused & Adapted Components Allowlist

The following four items represent the **exclusive** reuse allowlist authorized for CredaVer Network. All other contracts, EVM/Monad configurations, escrow mechanics, dispute logic, and test fixtures from VeriqoMesh are strictly prohibited and excluded.

### Item 1: Upstash Redis REST Client
- **Source File**: `apps/web/src/lib/redis.ts` (Commit `3540f9d`)
- **Classification**: REUSE with Enhancement
- **Target Location**: `packages/core/src/store/redis.ts` and `apps/web/src/lib/redis.ts`
- **Modifications**:
  - Maintained zero-dependency Upstash REST API transport (`fetch`-based).
  - **Added Atomic Replay Protection Primitive**: Implemented `redisSetNX(key, value, ttlSeconds)` executing `SET key value NX EX ttl`.
  - Ensures atomic check-and-set semantics to eliminate race conditions in nonce verification.

### Item 2: Cryptographic Authorization & Nonce Protection Pattern
- **Source File**: `apps/web/src/lib/mutation-auth.ts` (Commit `3540f9d`)
- **Classification**: ADAPT (Major Security Fix & Solana Transition)
- **Target Location**: `packages/core/src/proof.ts` and `packages/core/src/store/`
- **Modifications**:
  - **Replaced EVM EIP-191 / ethers**: Migrated to native Ed25519 signatures and RFC 8785 (JCS) deterministic canonicalization.
  - **Fixed TOCTOU Replay Race Condition**: Upstream performed separate `GET` then `SET`, allowing two concurrent requests with identical nonces to race and both succeed. CredaVer consumes nonces atomically via `SET NX EX` where failed `NX` is treated immediately as a rejected replay.
  - **Expanded Context Binding**: Signed payloads now strictly bind audience, network (`solana:devnet`), amount, asset, recipient, and nonce to eliminate confused-deputy attacks.

### Item 3: UI Component Primitives & Layout Shell
- **Source File**: `apps/web/src/components/ui/*` (Commit `3540f9d`)
- **Classification**: ADAPT
- **Target Location**: `apps/web/src/components/ui/*`
- **Modifications**:
  - Restyled completely from VeriqoMesh styling to the **CredaVer visual brand system** (deep navy/black `#060814`, blue-cyan `#00f2fe`, violet accents `#7f00ff`, restrained magenta `#f857a6`, and dark cybernetic elevation glows).
  - Striped out all escrow, dispute, and multi-judge UI elements.
  - Configured specifically for Agent Mandate management, Policy evaluation logs, and Verifiable Receipt explorer.

### Item 4: Deterministic Hashing Concept
- **Source File**: `packages/sdk/src/hashing.ts` (Commit `3540f9d`)
- **Classification**: ADAPT (Architectural concept only)
- **Target Location**: `packages/core/src/canonical.ts` and `packages/core/src/crypto.ts`
- **Modifications**:
  - Replaced custom key-sorting and `ethers.sha256` with strict **RFC 8785 JSON Canonicalization Scheme (JCS)** and standard SHA-256 / Ed25519.
  - No EVM dependencies or `ethers` imports are permitted in CredaVer.

---

## 3. Strict Non-Reuse Exclusions

The following modules from VeriqoMesh are **NEVER** copied into CredaVer Network:
- All Solidity smart contracts (`TrustMeshEscrow.sol`, `TrustReceiptRegistry.sol`, interfaces).
- Monad Metropolis EVM chain configuration (Chain ID 10143, RPC endpoints, MetaMask / EVM wallet hooks).
- Escrow locking, releasing, fee splits, or dispute adjudication models.
- Multi-judge human consensus mechanisms and basis-point split calculations.
- VeriqoMesh brand marks, logos, icons, audio, and pitch video recordings.
- Legacy EVM test fixtures and sample IDs (`VM-T564-24CG`, etc.).

---

## 4. Third-Party Open-Source Libraries

The following open-source dependencies are utilized in CredaVer Network (licenses verified directly against respective package manifests):

| Package | Version | License | Role |
|---|---|---|---|
| `@x402/core` | `2.28.0` | Apache-2.0 | Official x402 payment protocol definitions & schemas |
| `@x402/fetch` | `2.28.0` | Apache-2.0 | Official x402 client fetch wrapper |
| `@x402/svm` | `2.28.0` | Apache-2.0 | Official SVM payment scheme implementation |
| `@x402/express` | `2.28.0` | Apache-2.0 | Official Express middleware for 402 payment challenges |
| `@solana/kit` | `5.5.1` | MIT | Solana cryptographic primitives, keypairs & transaction wire format |
| `@wallet-standard/base` | `1.1.1` | Apache-2.0 | Standard wallet interface specifications |
| `@wallet-standard/app` | `1.1.1` | Apache-2.0 | Standard wallet detection and connection |
| `next` | `15.1.0` | MIT | React full-stack application framework |
| `react` / `react-dom` | `19.0.0` | MIT | User interface rendering engine |
| `tailwindcss` | `3.4.17` | MIT | Utility-first CSS framework |
| `zod` | `3.24.1` | MIT | Runtime schema validation |
| `canonicalize` | `2.1.0` | Apache-2.0 | RFC 8785 JSON Canonicalization Scheme (JCS) |
| `express` | `4.21.2` | MIT | Demo resource merchant HTTP server |
| `vitest` | `3.0.5` | MIT | Unit and integration test runner |
| `lucide-react` | `0.475.0` | ISC | Icon system |
| `clsx` / `tailwind-merge` | `2.1.1` / `2.5.4` | MIT | ClassName resolution utilities |

*Note on Upstash Redis*: Persistence utilizes a native, zero-dependency HTTP client communicating over the standard Upstash Redis REST protocol via global `fetch`.

---

## 5. AI Assistance Disclosure

Built with AI assistance: **Claude** (research, review, copy) and **Google Antigravity** (code), directed and reviewed by the founder.  
First commit: **Oct 2, 2026** (built during the hackathon).

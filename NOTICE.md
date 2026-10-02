# CredaVer Network - Third-Party & Code Reuse Disclosures

In accordance with Section 9 of the Crypto World's Fair Official Rules (Colosseum Hackathon), this document explicitly identifies and attributes any prior art, third-party libraries, and code patterns derived or adapted from prior open-source repositories.

## 1. Upstream Reference Repository

- **Repository**: VeriqoMesh Network (`trustmesh`)
- **Branch**: `envio`
- **Source Commit Hash**: `3540f9d`
- **Author**: Tochukwu SN (`Solking-crpto`)
- **License**: MIT / Proprietary hackathon draft

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

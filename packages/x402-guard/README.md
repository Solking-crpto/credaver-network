# `@credaver/x402-guard`

Policy Enforcement Point (PEP) client adapter and constrained signer for autonomous AI agents paying x402 resource servers on Solana.

## Core Purpose

In typical x402 setups, the agent holds the private key to the funding wallet. If the agent's LLM is prompt-injected or compromised, the wallet can be completely drained.

`@credaver/x402-guard` solves this by enforcing **Agent Zero-Key Custody**:
1. The agent holds **ONLY** an Ed25519 identity key (`agentSecretKey`).
2. The agent has **ZERO** access to the Solana funding wallet's private key (`paymentSecretKey`).
3. When an x402 resource returns `402 Payment Required`, `CredaverConstrainedSigner` creates a request-bound proof of intent and delegates signing to the CredaVer Policy Decision & Signing service.
4. Only if all 12 policy gates pass does the CredaVer server sign the transaction using its securely held funding key.

## Installation

```bash
pnpm add @credaver/x402-guard @credaver/core
```

## Components

### 1. `CredaverConstrainedSigner`
Implements the `@x402/svm` / `@solana/kit` signer interface expected by `ExactSvmScheme`:
```typescript
import { CredaverConstrainedSigner } from '@credaver/x402-guard';

const constrainedSigner = new CredaverConstrainedSigner({
  fundingAddress: 'HnXPP38ctGbDqkfFrsr2B7y9DYLKmVZBiXLaiKMJomSS',
  mandate,
  agentSecretKey: agentIdentityKey.secretKey, // Identity key ONLY!
  credaverApiUrl: 'http://localhost:3000/api/sign',
});

// Provide impending payment context
constrainedSigner.setContext({
  merchantPubkey: 'D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW',
  asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  amount: '1000000',
  audience: 'https://demo-merchant.solana/api/weather',
});
```

### 2. `createCredaverClientPolicy`
Pre-flight client policy hook registered directly into `x402Client`:
```typescript
import { x402Client } from '@x402/core/client';
import { createCredaverClientPolicy } from '@credaver/x402-guard';

const client = new x402Client();
client.registerPolicy(createCredaverClientPolicy(mandate));
```

## Testing

```bash
pnpm test packages/x402-guard
```

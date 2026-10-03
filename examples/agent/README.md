# CredaVer Autonomous Agent Example (`examples/agent`)

Demonstrates an autonomous AI agent interacting with an x402 resource server **without holding any private keys** to the Solana funding wallet.

## The Security Paradigm

Traditional agent architectures hand the funding wallet's private key directly to the agent runtime. If the agent's LLM is subverted by a malicious prompt injection, the agent can drain the wallet to an attacker's address immediately.

CredaVer enforces **Agent Zero-Key Custody**:
- **Agent Identity**: The agent holds only its own Ed25519 identity key (`agentIdentity`).
- **Cryptographic Mandate**: The human operator defines an allowable budget envelope (`maxPerTx`, `totalCap`, `allowedMerchants`, `allowedAssets`, `expiresAt`).
- **Request Delegation**: When paying an x402 endpoint, `@credaver/x402-guard` constructs a cryptographically signed proof of intent and submits it to the CredaVer decision service (`/api/sign`).
- **Policy Enforcement**: The CredaVer server checks all 12 deterministic gates. Only if the request satisfies the mandate does CredaVer sign the SVM transaction with the securely custodied funding key.

## Running the Agent Example

1. Start the demo merchant server in one terminal:
```bash
pnpm --filter @credaver/demo-merchant start
```

2. Start the CredaVer web API service in a second terminal:
```bash
pnpm --filter @credaver/web dev
```

3. Run the autonomous agent:
```bash
pnpm --filter @credaver/example-agent start
```

You will observe the agent autonomously handle the x402 402 challenge, delegate signing to CredaVer, obtain the signed transaction, and receive the paid data, all without holding any funding keys.

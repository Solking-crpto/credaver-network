# CredaVer Network: 2-Minute Technical Demo Script

**Target Video Duration**: 1:50 - 2:00 (strictly under Colosseum's 2-minute rule)  
**Actors / Personas**: 
1. **Human Operator (Alice)**: Managing an autonomous market-making / weather data AI agent.
2. **Autonomous Agent (Bob)**: Tasked with purchasing real-time weather satellite telemetry via x402 on Solana.
3. **Simulated Merchant**: Weather API provider charging 1 USDC per query.

---

## Storyboard & Timeline

### Scene 1: The Agent Wallet Problem (0:00 - 0:25)
- **Visual**: Terminal showing an AI agent attempting to query paid resources, with a prompt injection attempting to command the agent to drain the wallet balance.
- **Narrator**: *"AI agents are gaining economic agency, but handing them hot private keys is a recipe for disaster. One prompt injection or hallucination can drain an entire wallet in seconds. Today's tools offer only all-or-nothing keys or brittle custom code."*

### Scene 2: Issuing an Agent Mandate (0:25 - 0:50)
- **Visual**: CredaVer web dashboard (`http://localhost:3000`). Alice connects her Phantom wallet, signs an Ed25519 challenge to verify wallet control, and configures an **Agent Mandate**:
  - Allowed merchant: Weather Telemetry API
  - Allowed asset: devnet USDC
  - Max per-transaction: 2 USDC
  - Total cumulative cap: 10 USDC
  - Expiry: 24 hours
- **Narrator**: *"Enter CredaVer Network: the cryptographic authorization layer between an AI agent and its Solana wallet. The operator signs a scoped, expiring, revocable Mandate. The agent counter-signs, creating a mutually bound cryptographic agreement."*

### Scene 3: Live x402 Payment & ALLOW Decision (0:50 - 1:20)
- **Visual**: Agent queries `GET /api/weather`. The simulated merchant returns HTTP 402 with `PAYMENT-REQUIRED`.
- The CredaVer Client Guard intercepts the requirement, evaluates it against the Mandate, issues an **ALLOW** decision, anchors a signed receipt, and completes the payment on Solana devnet.
- Terminal & UI show: HTTP 200 returned with satellite telemetry and a verified `PAYMENT-RESPONSE` header with transaction hash.
- **Narrator**: *"When the agent calls the API, the merchant returns HTTP 402. CredaVer's policy engine checks the requirement in under 1 millisecond. Within limits? ALLOW. Payment settles on Solana devnet, and CredaVer generates an independently verifiable receipt."*

### Scene 4: Security Gates in Action — DENY & REVIEW (1:20 - 1:45)
- **Visual**: Split screen testing failure cases:
  1. **Over-cap attempt**: Agent attempts to buy a 5 USDC compute job (`AMOUNT_EXCEEDS_PER_TX_LIMIT` -> DENY).
  2. **Unapproved merchant attempt**: Malicious injection directs funds to an unknown address (`MERCHANT_NOT_ALLOWED` -> DENY).
  3. **Replay attempt**: Re-submitting an identical payment proof (`NONCE_REPLAYED` -> DENY).
  4. **High-value review**: Operator is prompted in the UI to sign an approval for a large payment.
- **Narrator**: *"When limits are breached, CredaVer fails closed. Over-cap? DENY. Unauthorized recipient? DENY. Replay attack? DENY. Every decision is recorded with a cryptographic receipt that anyone can audit."*

### Scene 5: Conclusion & The Future (1:45 - 2:00)
- **Visual**: CredaVer architecture diagram highlighting open-source `@credaver/core` and Solana devnet integration.
- **Narrator**: *"CredaVer brings verifiable accountability and safe autonomy to AI agent payments on Solana. Built with open standards, RFC 8785 canonicalization, and x402 V2. Explore the code and live demo at credaver.network."*

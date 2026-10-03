# CredaVer Network: 3-Minute Demo Video & Presentation Script

**Contest**: Crypto World's Fair Hackathon 2026 (Colosseum)  
**Track**: AI Agents & Payments on Solana  
**Target Video Duration**: 2:45 - 3:00  
**Live URL**: `http://localhost:3000` (Dashboard) and `/verify` (Verification Gateway)  

---

## Roles & Setup

| Role | Persona | Device / Screen |
|---|---|---|
| **Operator (Alice)** | Human / Fund Administrator | CredaVer Dashboard (`http://localhost:3000`) |
| **Agent (Bob)** | Autonomous LLM Data Ingestion Agent | Terminal running `@credaver/x402-guard` |
| **Demo Merchant** | Weather Telemetry Service | Running `@x402/express` on Solana Devnet |

---

## Step-by-Step Script & Storyboard

### 1. The Autonomous Agent Dilemma (0:00 - 0:30)
- **Visual**: Terminal showing an AI agent executing tools. Split with a diagram showing the "All-or-Nothing Key Trap": handing raw Solana wallet private keys to an LLM.
- **Narrator Voiceover**:
  > *"Autonomous AI agents are beginning to transact on Solana. But today, builders face a terrifying dilemma: either starve the agent of autonomy, or hand the LLM full private keys to a funded wallet. One prompt injection, hallucination, or rogue merchant API, and the entire treasury is drained in a single transaction. We cannot build the agent economy on all-or-nothing private keys."*

### 2. The Solution: CredaVer Agent Mandates (0:30 - 1:00)
- **Visual**: Switch to browser at `http://localhost:3000`. Show the interactive CredaVer dashboard.
- **Action**: Highlight the Mandate parameters:
  - Allowed Merchant: Demo Weather API (`8ijvv56h...`)
  - Allowed Token: Devnet USDC
  - Per-Transaction Limit: 1.50 USDC
  - Total Spend Cap: 5.00 USDC
  - Validity: 1 hour window
- **Narrator Voiceover**:
  > *"CredaVer Network solves this. We are the cryptographic authorization layer between AI agents and Solana wallets. Operators sign scoped, expiring, revocable Mandates. The agent holds zero private keys to the funding wallet — only an identity key to sign request-bound payment proofs. CredaVer deterministically evaluates every payment before signing."*

### 3. Demo 1: Autonomous Payment & Live Devnet Settlement (1:00 - 1:45)
- **Visual**: Click **"1. Normal Payment (ALLOW)"** in the Scenario Runner.
- **Action**:
  - Show response returning in **12ms** with status `200 ALLOW`.
  - Highlight the cumulative spend progress bar updating on the active mandate (1.00 USDC of 5.00 USDC consumed).
  - Show the signed RFC 8785 canonical receipt generated.
  - Show the live on-chain SPL Memo anchor link.
- **Narrator Voiceover**:
  > *"When the agent calls the weather merchant, the API requests payment via the x402 protocol. CredaVer evaluates the proof across 12 deterministic gates. All gates pass! CredaVer returns ALLOW, signs the transaction message with the server-held custody key, and settles on Solana Devnet. An SPL Memo transaction anchors the cryptographic receipt hash immutably on-chain."*

### 4. Demo 2: Rogue Over-Cap Attempt Blocked (1:45 - 2:15)
- **Visual**: Click **"2. Exceeds Cap (DENY)"** in the Scenario Runner.
- **Action**:
  - Show immediate `403 DENY` response with reason code `AMOUNT_EXCEEDS_CAP`.
  - Highlight the cumulative spend bar remaining unchanged.
  - Zero transaction is signed; zero funds leave the funding wallet.
- **Narrator Voiceover**:
  > *"Now, what if the agent gets exploited or a rogue vendor attempts an overcharge? The agent requests 6 USDC — exceeding the 5 USDC cap. CredaVer evaluates the request, detects the cap violation, and fails closed immediately with 403 AMOUNT_EXCEEDS_CAP. The transaction is never signed. Zero funds are lost."*

### 5. Demo 3: Instant Operator Revocation (2:15 - 2:40)
- **Visual**: In the Active Mandates view, click the red **"Revoke"** button on a mandate.
- **Action**:
  - The badge immediately updates to `REVOKED`.
  - Click **"3. Revoked Mandate (DENY)"** to simulate the agent trying to spend.
  - Response returns `403 DENY` with reason code `REVOKED_MANDATE`.
- **Narrator Voiceover**:
  > *"Operators maintain absolute containment. If suspicious activity occurs, the operator clicks Revoke. The revocation is instant. Any subsequent agent request fails closed within milliseconds. No waiting for block confirmations or smart contract unbonding."*

### 6. Public Zero-Trust Verification (2:40 - 3:00)
- **Visual**: Navigate to `/verify` (Verification Portal). Click the preset button **"⚓ Anchored Memo Tx (Devnet)"**.
- **Action**:
  - Show green verification badges pop up:
    - [✓] Valid Canonical RFC 8785 Hash
    - [✓] Valid Ed25519 Authority Signature
    - [✓] Solana Devnet SPL Memo Match (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`)
    - [✓] Confirmed Slot (`#506955056`)
- **Narrator Voiceover**:
  > *"Finally, zero-trust verification. Anyone — an auditor, accounting system, or Colosseum judge — can paste a receipt or Solana transaction signature into our verification portal. Green badges confirm cryptographic integrity, authority signatures, and on-chain memo anchoring. CredaVer brings safe, verifiable economic agency to autonomous AI agents on Solana. Built for the Crypto World's Fair."*

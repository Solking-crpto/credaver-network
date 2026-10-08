# CredaVer Network: Submission Videos & Demo Walkthrough

**Contest**: Crypto World's Fair Hackathon 2026 (Colosseum)  
**Live Production URL**: [https://www.credavernetwork.xyz](https://www.credavernetwork.xyz) (Backup: [https://credaver-network.vercel.app](https://credaver-network.vercel.app))  
**Founder Pitch Video**: [https://www.youtube.com/shorts/KwWjFe-36JE](https://www.youtube.com/shorts/KwWjFe-36JE)  
**Technical Demo Video**: [https://youtu.be/GwVPDWF0YwA](https://youtu.be/GwVPDWF0YwA) (Duration: 3m 0s)  

> [!NOTE]
> **Submission Videos Completed**: Both required submission videos have been recorded, verified, and published:
> 1. **Founder Pitch Video**: Team background, motivation, agentic market opportunity, customer acquisition strategy, and breakout product potential.
> 2. **Technical Demo Video**: Complete end-to-end working demonstration showing Phantom mandate issuance, 6 policy scenarios, live Solana devnet x402 settlement, and cryptographic on-chain verification.

---

## Technical Demo Flow & Key Visuals

| Segment | Timing | Duration | Key Visual |
|---|---|---|---|
| **1. Problem** | 0:00 - 0:25 | 25s | Terminal prompt injection / "All-or-Nothing Key Trap" |
| **2. Mandate** | 0:25 - 0:55 | 30s | Operator Mandates Console (`/mandates`) with Phantom Wallet |
| **3. Live Payment** | 0:55 - 1:40 | 45s | Live Demo (`/demo`) + Solana Explorer Devnet Settlement |
| **4. Blocked Over-Cap** | 1:40 - 2:05 | 25s | Policy Gate `OVER_CAP` + Instant 403 DENY |
| **5. Receipt Verify** | 2:05 - 2:40 | 35s | Public Verification Portal (`/verify`) showing all green badges |
| **6. Why Solana** | 2:40 - 3:00 | 20s | Final summary: Solana throughput, x402 V2, on-chain proof |

---

## Word-for-Word Script & Visual Cues

### 1. The Problem: The All-or-Nothing Key Trap (0:00 - 0:25)
* **Visual**: Screen split — terminal running an autonomous agent paying an API, next to a graphic showing an LLM holding a raw private key.
* **Audio / Voiceover**:
  > *"Autonomous AI agents are transacting on Solana via x402. But builders face a dangerous dilemma: either starve the agent of autonomy, or hand the LLM raw private keys to a funded wallet. One prompt injection or rogue merchant API, and the entire treasury is drained. We cannot build the agentic economy on all-or-nothing private keys."*

### 2. The Mandate: Zero-Key Agent Authority (0:25 - 0:55)
* **Visual**: CredaVer Mandates Console (`/mandates`). Connect Phantom wallet, issue an agent mandate with human-readable signature.
* **Action**: Review Mandate parameters:
  - Allowed Merchant: `D9KxfDqX...` (Demo Weather API)
  - Allowed Token: Devnet USDC (`4zMMC9sr...`)
  - Per-Tx Limit: 2.00 USDC
  - Total Cap: 10.00 USDC
* **Audio / Voiceover**:
  > *"CredaVer Network is the cryptographic authorization layer between AI agents and Solana wallets. Operators sign scoped, expiring, revocable Mandates. The agent holds ZERO funding keys — only an identity key to sign request-bound payment proofs. Financial policy is deterministic code, never LLM guesswork."*

### 3. Allowed Payment & Live Devnet Settlement (0:55 - 1:40)
* **Visual**: Navigate to `/demo`. Click **"Execute Live Devnet Payment"** in the featured settlement card.
* **Action**:
  - Response displays live settlement transaction on Solana Devnet.
  - Switch tab to Solana Devnet Explorer showing verified on-chain settlement:
    `https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet`
* **Audio / Voiceover**:
  > *"When the agent calls the merchant, it receives an x402 payment challenge. Our Constrained Signer delegates to CredaVer. All 12 policy gates pass! CredaVer signs the SVM transaction with server-custodied keys, settling live on Solana Devnet via the official x402 facilitator. A cryptographically signed audit receipt is issued instantly."*

### 4. Blocked Over-Cap: Fail-Closed Protection (1:40 - 2:05)
* **Visual**: In Scenario Runner, click **"2. Exceeds Cap (DENY)"** (or click "Test Over-Cap" on `/mandates`).
* **Action**:
  - Response chip immediately turns red (`403 DENY`) with reason code `AMOUNT_EXCEEDS_CAP`.
  - Highlight: Spend bar does not budge. No Solana transaction signed.
* **Audio / Voiceover**:
  > *"What if the agent is prompt-injected or a rogue vendor overcharges? The agent attempts a payment exceeding its cap. CredaVer fails closed immediately with 403 AMOUNT_EXCEEDS_CAP. Zero funds leave the wallet. Operators can also revoke authority in one click."*

### 5. Public Receipt Verification (2:05 - 2:40)
* **Visual**: Switch to `/verify` (Verification Portal). Click preset **"⚓ Anchored Memo Tx (Devnet)"**.
* **Action**:
  - Four green badges instantly light up:
    - [✓] RFC 8785 Hash Valid
    - [✓] Authority Ed25519 Signature Valid
    - [✓] Devnet SPL Memo Match
    - [✓] Confirmed Slot #506955056
* **Audio / Voiceover**:
  > *"Every decision produces an independently verifiable receipt, anchored immutably to Solana Devnet via SPL Memo. Anyone — auditors or smart contracts — can verify authority without trusting CredaVer."*

### 6. Why Solana (2:40 - 3:00)
* **Visual**: Final branded title screen with GitHub link and Colosseum logo.
* **Audio / Voiceover**:
  > *"Sub-second finality, micro-cent fees, and x402 make Solana the home of autonomous agents. CredaVer makes them safe."*

# CredaVer Network: Strict 2-Minute Pitch Video & Demo Script

**Contest**: Crypto World's Fair Hackathon 2026 (Colosseum)  
**Strict Video Limit**: **120 Seconds (2:00)**  
**Target Duration**: 1:55 - 2:00  
**Live URL**: `http://localhost:3000` (Dashboard) and `/verify` (Verification Portal)  

---

## Timing Breakdown

| Segment | Timing | Duration | Key Visual |
|---|---|---|---|
| **1. Problem** | 0:00 - 0:25 | 25s | Terminal prompt injection / "All-or-Nothing Key Trap" |
| **2. Mandate** | 0:25 - 0:50 | 25s | Dashboard Mandates View (`http://localhost:3000`) |
| **3. Allowed Payment** | 0:50 - 1:20 | 30s | Click `ALLOW` + Show Solana Explorer S5 Devnet Tx |
| **4. Blocked Over-Cap** | 1:20 - 1:40 | 20s | Click `OVER_CAP` + Instant 403 DENY |
| **5. Receipt Verify** | 1:40 - 1:55 | 15s | `/verify` portal showing 4 green verification badges |
| **6. Why Chain** | 1:55 - 2:00 | 5s | Final title card: CredaVer Network on Solana |

---

## Word-for-Word Script & Visual Cues

### 1. The Problem: The All-or-Nothing Key Trap (0:00 - 0:25) [25s]
* **Visual**: Screen split — terminal running an autonomous agent paying an API, next to a graphic showing an LLM holding a raw private key.
* **Audio / Voiceover**:
  > *"Autonomous AI agents are transacting on Solana via x402. But builders face a dangerous dilemma: either starve the agent of autonomy, or hand the LLM raw private keys to a funded wallet. One prompt injection or rogue merchant API, and the entire treasury is drained. We cannot build the agentic economy on all-or-nothing private keys."*

### 2. The Mandate: Zero-Key Agent Authority (0:25 - 0:50) [25s]
* **Visual**: Cut to CredaVer Dashboard (`http://localhost:3000`). Highlight the active mandate card.
* **Action**: Cursor hovers over Mandate parameters:
  - Allowed Merchant: `D9KxfDqX...` (Demo Weather API)
  - Allowed Token: Devnet USDC (`4zMMC9sr...`)
  - Per-Tx Limit: 2.00 USDC
  - Total Cap: 10.00 USDC
* **Audio / Voiceover**:
  > *"CredaVer Network is the cryptographic authorization layer between AI agents and Solana wallets. Operators sign scoped, expiring, revocable Mandates. The agent holds ZERO funding keys — only an identity key to sign request-bound payment proofs. Financial policy is deterministic code, never LLM guesswork."*

### 3. Allowed Payment & S5 Live Devnet Settlement (0:50 - 1:20) [30s]
* **Visual**: Click **"1. Normal Payment (ALLOW)"** in the Scenario Runner.
* **Action**:
  - Response chip turns green (`200 ALLOW`) in 4ms. Spend bar advances to 1.00 / 10.00 USDC.
  - Switch tab to Solana Devnet Explorer showing verified on-chain settlement:
    `https://explorer.solana.com/tx/5SbhMnaUcDQiQ8aPM8b8oPGWbcUoAeaQEnHvtNdnCqMc97MCEb2GiB1jQLiXwDsjCCaJoYtbrXtFpz65vN4JCzMF?cluster=devnet`
* **Audio / Voiceover**:
  > *"When the agent calls the merchant, it receives an x402 payment challenge. Our Constrained Signer delegates to CredaVer. All 12 policy gates pass! CredaVer signs the SVM transaction with server-custodied keys, settling live on Solana Devnet via the official x402 facilitator. A cryptographically signed audit receipt is issued instantly."*

### 4. Blocked Over-Cap: Fail-Closed Protection (1:20 - 1:40) [20s]
* **Visual**: Click **"2. Exceeds Cap (DENY)"** in the Scenario Runner.
* **Action**:
  - Response chip immediately turns red (`403 DENY`) with reason code `AMOUNT_EXCEEDS_CAP`.
  - Highlight: Spend bar does not budge. No Solana transaction signed.
* **Audio / Voiceover**:
  > *"What if the agent is prompt-injected or a rogue vendor overcharges? The agent attempts a 6 USDC payment exceeding its cap. CredaVer fails closed immediately with 403 AMOUNT_EXCEEDS_CAP. Zero funds leave the wallet. Operators can also revoke authority in one click."*

### 5. Public Receipt Verification (1:40 - 1:55) [15s]
* **Visual**: Switch to `/verify` (Verification Portal). Click preset **"⚓ Anchored Memo Tx (Devnet)"**.
* **Action**:
  - Four green badges instantly light up:
    - [✓] RFC 8785 Hash Valid
    - [✓] Authority Ed25519 Signature Valid
    - [✓] Devnet SPL Memo Match
    - [✓] Confirmed Slot #506955056
* **Audio / Voiceover**:
  > *"Every decision produces an independently verifiable receipt, anchored immutably to Solana Devnet via SPL Memo. Anyone — auditors or smart contracts — can verify authority without trusting CredaVer."*

### 6. Why Solana (1:55 - 2:00) [5s]
* **Visual**: Final branded title screen with GitHub link and Colosseum logo.
* **Audio / Voiceover**:
  > *"Sub-second finality, micro-cent fees, and x402 make Solana the home of autonomous agents. CredaVer makes them safe."*

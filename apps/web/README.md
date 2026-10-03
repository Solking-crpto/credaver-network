# CredaVer Web Console & Policy Service (`apps/web`)

Next.js 15 web application providing the interactive operator dashboard console, the public cryptographic verification portal, and the Policy Decision Point (PDP) REST API endpoints.

## Features

- **Interactive Operator Console (`/`)**:
  - 6-scenario quick-runner testing all deterministic policy gates (`ALLOW`, `OVER_CAP`, `REVOKED`, `EXPIRED`, `REPLAY`, `REVIEW`).
  - Active Mandate management with live spend progress bars and 1-click revocation.
  - Decision receipts log with deep links to the verification portal.
  - Real-time Human Review Queue with Approve / Reject operator controls.
- **Public Verification Portal (`/verify`)**:
  - Independent offline/online recomputation of RFC 8785 receipt hashes.
  - Ed25519 authority signature validation.
  - Live on-chain SPL Memo extraction and slot confirmation on Solana Devnet.
- **Security Hardening**:
  - **Rate Limiting**: Sliding-window rate limiter protecting `POST /api/sign`, `GET /api/auth/challenge`, and `POST /api/auth/verify`.
  - **Security Headers**: Strict HTTP headers configured in `next.config.mjs` (Content Security Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy).
  - **Zod Schema Validation**: 100% of API endpoints validate request query params and body payloads with Zod.
  - **Production Fail-Loud**: In `NODE_ENV === 'production'`, throws fatal error if Upstash Redis credentials are missing, preventing unpersisted multi-instance memory fallbacks.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/sign` | Evaluates payment proof against mandate and signs SVM transaction message if allowed. |
| `GET`, `POST` | `/api/mandates` | Lists mandates or creates a mutually signed mandate. |
| `GET` | `/api/mandates/:id` | Retrieves mandate details and current cumulative spend. |
| `POST` | `/api/mandates/:id/revoke` | Revokes an active mandate immediately. |
| `GET` | `/api/receipts` | Lists historical decision receipts with optional filters. |
| `GET` | `/api/receipts/:id` | Retrieves single decision receipt. |
| `GET`, `POST` | `/api/reviews` | Lists pending reviews or approves/rejects high-value transaction requests. |
| `GET`, `POST` | `/api/verify` | Verifies receipt hash or queries Solana Devnet SPL memo transaction. |
| `POST` | `/api/scenarios` | Runs interactive test scenarios against the real policy engine. |
| `GET` | `/api/auth/challenge` | Generates cryptographic challenge for operator wallet connect. |
| `POST` | `/api/auth/verify` | Verifies operator Ed25519 signature over challenge. |

## Running Locally

```bash
pnpm --filter @credaver/web dev
```
Open `http://localhost:3000` in your browser.

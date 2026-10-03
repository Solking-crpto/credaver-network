# Demo Merchant Service (`apps/demo-merchant`)

An x402 resource server implemented with Express, `@x402/express`, and `@x402/svm`, connected to the public Solana facilitator (`https://x402.org/facilitator`).

## Endpoints

- `GET /health`: Free health check endpoint returning server status and initialized payment schemes.
- `GET /api/weather`: Paid telemetry endpoint. Returns `402 Payment Required` with an x402 V2 payment challenge demanding 1.00 USDC (`1,000,000` base units) on Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`). Upon valid payment response, returns simulated weather telemetry.

## Startup Invariant: Facilitator Synchronization

To prevent running in a half-configured state:
1. The server calls `await resourceServer.initialize()` during startup.
2. It synchronizes with the public facilitator (`https://x402.org/facilitator`) to verify supported schemes and networks (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`).
3. If synchronization fails, the server exits immediately with a fatal error instead of accepting requests.

## Running the Server

```bash
# Start the demo merchant on port 4025
pnpm --filter @credaver/demo-merchant start
```

## Running Tests

```bash
pnpm test apps/demo-merchant
```

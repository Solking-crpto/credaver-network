import express, { Request, Response, Express } from 'express';
import { createServer } from 'node:http';

export const MERCHANT_NAME = 'SIMULATED MERCHANT (CredaVer Hackathon Sandbox)';
export const MERCHANT_WALLET = 'CredavMerchant1111111111111111111111111111';
export const SOLANA_DEVNET_GENESIS = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export function createDemoMerchantApp(): Express {
  const app: Express = express();
  app.use(express.json());

  // CORS and custom x402 header exposure
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header(
      'Access-Control-Expose-Headers',
      'payment-required, payment-response, x-credaver-merchant, x-credaver-simulated'
    );
    res.header('x-credaver-merchant', MERCHANT_NAME);
    res.header('x-credaver-simulated', 'true');
    next();
  });

  // Free health endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      merchant: MERCHANT_NAME,
      wallet: MERCHANT_WALLET,
      simulated: true,
      timestamp: Date.now(),
    });
  });

  // Protected route: Weather Data API (1 USDC)
  app.get('/api/weather', (req: Request, res: Response) => {
    const paymentSigHeader =
      req.header('payment-signature') || req.header('Payment-Signature');

    if (!paymentSigHeader) {
      // 402 Payment Required
      const paymentRequiredPayload = {
        x402Version: 2,
        resource: {
          url: `${req.protocol}://${req.get('host')}/api/weather`,
          description: 'Real-time satellite weather telemetry feed',
          mimeType: 'application/json',
        },
        accepts: [
          {
            scheme: 'exact',
            network: SOLANA_DEVNET_GENESIS,
            asset: DEVNET_USDC_MINT,
            amount: '1000000', // 1 USDC
            payTo: MERCHANT_WALLET,
            maxTimeoutSeconds: 300,
            extra: {
              symbol: 'USDC',
              rate: '1.00 USD',
            },
          },
        ],
      };

      const base64Payload = Buffer.from(
        JSON.stringify(paymentRequiredPayload),
        'utf8'
      ).toString('base64');

      res.status(402);
      res.setHeader('payment-required', base64Payload);
      res.setHeader('PAYMENT-REQUIRED', base64Payload);
      res.json({
        error: 'PAYMENT_REQUIRED',
        message: 'This resource requires an authorized x402 payment',
        merchantNotice: 'SIMULATED MERCHANT — devnet USDC only',
        paymentRequired: paymentRequiredPayload,
      });
      return;
    }

    // Process payment payload
    let decodedSig: any = {};
    try {
      decodedSig = JSON.parse(
        Buffer.from(paymentSigHeader, 'base64').toString('utf8')
      );
    } catch {
      decodedSig = { raw: paymentSigHeader };
    }

    const txSignature =
      decodedSig.txSignature ||
      decodedSig.signature ||
      `tx-devnet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const paymentResponsePayload = {
      x402Version: 2,
      success: true,
      network: SOLANA_DEVNET_GENESIS,
      payTo: MERCHANT_WALLET,
      amount: '1000000',
      asset: DEVNET_USDC_MINT,
      txSignature,
      settledAt: Date.now(),
    };

    const base64Response = Buffer.from(
      JSON.stringify(paymentResponsePayload),
      'utf8'
    ).toString('base64');

    res.status(200);
    res.setHeader('payment-response', base64Response);
    res.setHeader('PAYMENT-RESPONSE', base64Response);
    res.json({
      success: true,
      resource: 'weather_telemetry',
      merchantNotice: 'SIMULATED MERCHANT (devnet test funds)',
      data: {
        city: 'Lagos',
        temperatureC: 28.5,
        humidity: '79%',
        conditions: 'Partly Cloudy',
        satelliteFeed: 'METEOSAT-11-DEVNET',
        retrievedAt: new Date().toISOString(),
      },
      payment: paymentResponsePayload,
    });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const PORT = process.env.PORT_DEMO_MERCHANT || 4020;
  const app = createDemoMerchantApp();
  createServer(app).listen(PORT, () => {
    console.log(`[CredaVer] ${MERCHANT_NAME} listening on port ${PORT}`);
    console.log(`[CredaVer] PayTo: ${MERCHANT_WALLET} | Network: ${SOLANA_DEVNET_GENESIS}`);
  });
}

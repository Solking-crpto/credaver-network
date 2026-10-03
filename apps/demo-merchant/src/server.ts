import express, { Request, Response, Express } from 'express';
import { createServer } from 'node:http';
import { paymentMiddleware } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import type { RoutesConfig } from '@x402/core/server';

export const MERCHANT_NAME = 'SIMULATED MERCHANT (CredaVer Hackathon Sandbox)';
export const MERCHANT_WALLET =
  process.env.MERCHANT_WALLET || 'D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW';
export const SOLANA_DEVNET_GENESIS = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const OFFICIAL_FACILITATOR_URL = 'https://x402.org/facilitator';

export interface DemoMerchantOptions {
  useOfficialResourceServer?: boolean;
  facilitatorUrl?: string;
}

/**
 * Creates the demo merchant Express app with official @x402/express + @x402/svm resource server.
 */
export async function createDemoMerchantApp(options: DemoMerchantOptions = {}): Promise<Express> {
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
      facilitator: options.facilitatorUrl || OFFICIAL_FACILITATOR_URL,
      timestamp: Date.now(),
    });
  });

  // Check if official @x402 resource server middleware is enabled
  if (options.useOfficialResourceServer) {
    const facilitatorUrl = options.facilitatorUrl || OFFICIAL_FACILITATOR_URL;

    // Character-for-character network confirmation debug log
    console.log(`[CredaVer Debug] Configured network: "${SOLANA_DEVNET_GENESIS}"`);
    console.log(`[CredaVer Debug] Expected network:   "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`);
    console.log(`[CredaVer Debug] Exact match: ${SOLANA_DEVNET_GENESIS === 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'}`);
    console.log(`[CredaVer] Initializing resource server with facilitator: ${facilitatorUrl}...`);

    const facilitator = new HTTPFacilitatorClient({
      url: facilitatorUrl,
    });
    const resourceServer = new x402ResourceServer([facilitator]).register(
      SOLANA_DEVNET_GENESIS,
      new ExactSvmScheme()
    );

    try {
      await resourceServer.initialize();
    } catch (err: any) {
      const msg = `[CredaVer FATAL] Failed to sync with x402 facilitator at ${facilitatorUrl}: ${err.message}`;
      console.error(msg);
      throw new Error(msg, { cause: err });
    }

    // Startup log line listing the scheme and network pairs learned from facilitator
    try {
      const supported = await facilitator.getSupported();
      const pairs = supported.kinds
        .map((k) => `${k.scheme} on ${k.network} (v${k.x402Version})`)
        .join(', ');
      console.log(`[CredaVer] Facilitator sync successful. Learned scheme/network pairs: [${pairs}]`);
    } catch (err: any) {
      console.warn(`[CredaVer] Warning: Could not list supported kinds: ${err.message}`);
    }

    const routes: RoutesConfig = {
      '/api/weather': {
        accepts: [
          {
            scheme: 'exact',
            network: SOLANA_DEVNET_GENESIS,
            price: '1.00',
            payTo: MERCHANT_WALLET,
          },
        ],
      },
    };

    app.use(paymentMiddleware(routes, resourceServer, undefined, undefined, true));
  } else {
    // Test double middleware for deterministic local tests without external network dependencies
    app.use('/api/weather', (req: Request, res: Response, next) => {
      const paymentSigHeader = req.header('payment-signature') || req.header('Payment-Signature');
      if (!paymentSigHeader) {
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

        const base64Payload = Buffer.from(JSON.stringify(paymentRequiredPayload), 'utf8').toString('base64');
        res.status(402);
        res.setHeader('payment-required', base64Payload);
        res.setHeader('PAYMENT-REQUIRED', base64Payload);
        return res.json({
          error: 'PAYMENT_REQUIRED',
          message: 'This resource requires an authorized x402 payment',
          merchantNotice: 'SIMULATED MERCHANT — devnet USDC only (test double)',
          paymentRequired: paymentRequiredPayload,
        });
      }

      // If payment signature is present, attach mock response header
      let decodedSig: any = {};
      try {
        decodedSig = JSON.parse(Buffer.from(paymentSigHeader, 'base64').toString('utf8'));
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

      const base64Response = Buffer.from(JSON.stringify(paymentResponsePayload), 'utf8').toString('base64');
      res.setHeader('payment-response', base64Response);
      res.setHeader('PAYMENT-RESPONSE', base64Response);
      next();
    });
  }

  // Weather data handler
  app.get('/api/weather', (_req: Request, res: Response) => {
    res.status(200).json({
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
    });
  });

  return app;
}

const isDirectRun =
  Boolean(process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js') ||
  process.env.RUN_DEMO_MERCHANT === 'true');

if (isDirectRun && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  (async () => {
    const PORT = process.env.PORT_DEMO_MERCHANT || 4020;
    try {
      const app = await createDemoMerchantApp({ useOfficialResourceServer: true });
      createServer(app).listen(PORT, () => {
        console.log(`[CredaVer] ${MERCHANT_NAME} listening on port ${PORT}`);
        console.log(`[CredaVer] Facilitator: ${OFFICIAL_FACILITATOR_URL}`);
        console.log(`[CredaVer] PayTo: ${MERCHANT_WALLET} | Network: ${SOLANA_DEVNET_GENESIS}`);
      });
    } catch (err: any) {
      console.error(`[CredaVer] Aborting startup: ${err.message}`);
      process.exit(1);
    }
  })();
}

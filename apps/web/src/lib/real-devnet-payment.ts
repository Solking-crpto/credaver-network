import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm';
import {
  createDemoMerchantApp,
  OFFICIAL_FACILITATOR_URL,
  SOLANA_DEVNET_GENESIS,
  DEVNET_USDC_MINT,
  MERCHANT_WALLET,
} from '@credaver/demo-merchant';
import {
  generateEd25519Keypair,
  issueSignedMandate,
  evaluateAndSignTransaction,
  SignedReceipt,
  SignedMandate,
  anchorReceiptOnChain,
} from '@credaver/core';
import {
  CredaverConstrainedSigner,
  createCredaverClientPolicy,
} from '@credaver/x402-guard';
import {
  getServerStore,
  getServerPayerKeypair,
  getServerReceiptAuthorityKeypair,
  getServerAnchorKeypair,
} from './server-state';

export interface DevnetCheckResult {
  ok: boolean;
  solBalanceLamports?: number;
  usdcBalanceBaseUnits?: number;
  payerPubkey: string;
  error?: string;
  explorerUrl: string;
}

export async function checkDevnetPayerBalance(): Promise<DevnetCheckResult> {
  const payerKeypair = getServerPayerKeypair();
  const explorerUrl = `https://explorer.solana.com/address/${payerKeypair.publicKey}?cluster=devnet`;
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const solRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [payerKeypair.publicKey],
      }),
      signal: controller.signal,
    });
    const solData = await solRes.json();
    const solBalanceLamports = solData?.result?.value ?? 0;

    const tokenRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'getTokenAccountsByOwner',
        params: [
          payerKeypair.publicKey,
          { mint: DEVNET_USDC_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const tokenData = await tokenRes.json();
    const accounts = tokenData?.result?.value || [];
    let usdcBalanceBaseUnits = 0;
    if (accounts.length > 0) {
      usdcBalanceBaseUnits = Number(
        accounts[0].account?.data?.parsed?.info?.tokenAmount?.amount || '0'
      );
    }

    if (usdcBalanceBaseUnits < 1000000) {
      return {
        ok: false,
        solBalanceLamports,
        usdcBalanceBaseUnits,
        payerPubkey: payerKeypair.publicKey,
        error: `Insufficient devnet USDC balance (${(usdcBalanceBaseUnits / 1e6).toFixed(2)} USDC available, 1.00 USDC required).`,
        explorerUrl,
      };
    }

    return {
      ok: true,
      solBalanceLamports,
      usdcBalanceBaseUnits,
      payerPubkey: payerKeypair.publicKey,
      explorerUrl,
    };
  } catch (err: any) {
    return {
      ok: false,
      payerPubkey: payerKeypair.publicKey,
      error: `Devnet RPC balance check failed: ${err.message}`,
      explorerUrl,
    };
  }
}

export async function checkFacilitatorHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${OFFICIAL_FACILITATOR_URL}/supported`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return {
        ok: false,
        error: `Public x402 facilitator at ${OFFICIAL_FACILITATOR_URL} returned HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      error: `Public x402 facilitator at ${OFFICIAL_FACILITATOR_URL} unreachable: ${err.message}`,
    };
  }
}

export interface RealPaymentExecutionResult {
  success: boolean;
  txSignature: string;
  explorerUrl: string;
  latencyMs: number;
  mandate: SignedMandate;
  receipt?: SignedReceipt;
  resourceData?: any;
  payerPubkey: string;
  merchantPubkey: string;
  anchorTxSignature?: string;
  anchorExplorerUrl?: string;
  anchorStatus?: string;
}

export async function executeRealDevnetPayment(options?: {
  anchorOnChain?: boolean;
  sessionId?: string;
  simulatedFailure?: boolean;
}): Promise<RealPaymentExecutionResult> {
  const startTime = Date.now();
  const payerKeypair = getServerPayerKeypair();
  const authorityKeypair = getServerReceiptAuthorityKeypair();
  const anchorKeypair = getServerAnchorKeypair();
  const store = getServerStore();
  const merchantWallet = process.env.MERCHANT_WALLET || MERCHANT_WALLET;

  // 1. Initialize demo merchant Express app synced with official facilitator
  const app = await createDemoMerchantApp({
    useOfficialResourceServer: true,
    facilitatorUrl: OFFICIAL_FACILITATOR_URL,
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const merchantUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 2. Generate Operator & Agent Keys
    const operator = generateEd25519Keypair();
    const agent = generateEd25519Keypair(); // Identity only

    // 3. Issue Mandate with $2 limit, $10 cap
    const mandate = issueSignedMandate(
      {
        mandateId: `mandate-real-devnet-${Date.now()}`,
        operatorPubkey: operator.publicKey,
        agentPubkey: agent.publicKey,
        allowedMerchants: [merchantWallet],
        allowedAssets: [DEVNET_USDC_MINT],
        maxPerTx: '2000000', // 2 USDC max
        totalCap: '10000000', // 10 USDC total cap
        validFrom: Date.now() - 5000,
        expiresAt: Date.now() + 3600000,
        nonce: `nonce-${Date.now()}-real`,
        network: SOLANA_DEVNET_GENESIS,
      },
      operator.secretKey,
      agent.secretKey,
      options?.sessionId ?? null
    );
    await store.saveMandate(mandate);

    let capturedReceipt: SignedReceipt | undefined;

    // 4. Initialize CredaverConstrainedSigner
    const constrainedSigner = new CredaverConstrainedSigner({
      fundingAddress: payerKeypair.publicKey,
      mandate,
      agentSecretKey: agent.secretKey, // Identity key ONLY!
      localSignerDelegate: async (params) => {
        const signResult = await evaluateAndSignTransaction({
          mandate: params.mandate,
          proof: params.proof,
          transactionMessageBytes: params.transactionMessageBytes,
          store,
          paymentSecretKey: payerKeypair.secretKey,
          payerPubkey: payerKeypair.publicKey,
          authoritySecretKey: authorityKeypair.secretKey,
          authorityPubkey: authorityKeypair.publicKey,
          anchorSecretKey: anchorKeypair.secretKey,
          anchorPubkey: anchorKeypair.publicKey,
          anchorOnChain: false,
        });

        if (options?.sessionId) {
          signResult.receipt.sessionId = options.sessionId;
        }
        capturedReceipt = signResult.receipt;
        return signResult;
      },
    });

    constrainedSigner.setContext({
      merchantPubkey: merchantWallet,
      asset: DEVNET_USDC_MINT,
      amount: '1000000', // 1 USDC
      audience: `${merchantUrl}/api/weather`,
    });

    // 5. Register in x402 client and execute payment
    const client = new x402Client();
    client.register(SOLANA_DEVNET_GENESIS, new ExactSvmScheme(constrainedSigner as any));
    client.registerPolicy(createCredaverClientPolicy(mandate));

    const payingFetch = wrapFetchWithPayment(fetch, client);
    
    let response: any = null;
    let paymentError: Error | null = null;
    let txSignature = '';
    let responseBody: any = null;

    try {
      response = await payingFetch(`${merchantUrl}/api/weather`);

      if (options?.simulatedFailure) {
        throw new Error('Settlement failed: facilitator connection timeout during settlement');
      }

      const paymentResponseHeader = response.headers?.get('payment-response');
      if (paymentResponseHeader) {
        const decodedPaymentResp = Buffer.from(paymentResponseHeader, 'base64').toString('utf8');
        try {
          const parsedResp = JSON.parse(decodedPaymentResp);
          txSignature = parsedResp.txSignature || parsedResp.transaction || '';
        } catch {
          // ignore
        }
      }

      if (response.ok) {
        responseBody = await response.json();
      } else {
        const errText = await response.text().catch(() => '');
        throw new Error(
          `Facilitator or merchant returned HTTP ${response.status}: ${errText || response.statusText}`
        );
      }

      if (!txSignature) {
        throw new Error('Settlement failed: no transaction signature returned by facilitator');
      }
    } catch (err: any) {
      paymentError = err;
    }

    // SETTLEMENT INTEGRITY CHECK:
    // If facilitator settlement fails after policy ALLOW, do not leave an ALLOW receipt
    // or recorded mandate spend. Mark settlementStatus: FAILED, reverse spend, and save receipt.
    if (paymentError || !txSignature) {
      if (capturedReceipt) {
        capturedReceipt.settlementStatus = 'FAILED';
        // reverse recorded spend in store
        await store.recordMandateSpend(mandate.mandateId, -BigInt(capturedReceipt.amount));
        await store.saveReceipt(capturedReceipt);
      }

      const latencyMs = Date.now() - startTime;
      const failureError: any = new Error(
        paymentError?.message || 'Policy allowed, settlement failed'
      );
      failureError.settlementFailed = true;
      failureError.decision = 'ALLOW';
      failureError.settlementStatus = 'FAILED';
      failureError.mandate = mandate;
      failureError.receipt = capturedReceipt;
      failureError.latencyMs = latencyMs;
      throw failureError;
    }

    const latencyMs = Date.now() - startTime;
    const explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;

    // 6. Optional On-Chain Anchoring via SPL Memo on Solana Devnet
    let anchorTxSignature: string | undefined;
    let anchorExplorerUrl: string | undefined;
    let anchorStatus: string | undefined;

    const shouldAnchor =
      (process.env.ANCHOR_ON_CHAIN === 'true' || options?.anchorOnChain === true) &&
      !!(process.env.ANCHOR_SECRET_KEY || process.env.ANCHOR_PAYER_SECRET_KEY || anchorKeypair?.secretKey);

    if (shouldAnchor && capturedReceipt) {
      try {
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const anchorResult = await anchorReceiptOnChain(
          capturedReceipt,
          anchorKeypair.publicKey,
          anchorKeypair.secretKey,
          rpcUrl
        );
        anchorTxSignature = anchorResult.txSignature;
        anchorExplorerUrl = `https://explorer.solana.com/tx/${anchorResult.txSignature}?cluster=devnet`;
        anchorStatus = 'anchored';
        capturedReceipt.onChainTxSignature = anchorResult.txSignature;
      } catch (anchorErr: any) {
        console.warn('[CredaVer] Devnet receipt anchoring failed:', anchorErr.message);
        anchorStatus = `anchor failed: ${anchorErr.message}`;
      }
    }

    // Persist settlement transaction signature & anchor memo signature on saved receipt record
    if (capturedReceipt) {
      capturedReceipt.settlementStatus = 'SETTLED';
      capturedReceipt.settlementTxSignature = txSignature;
      if (anchorTxSignature) {
        capturedReceipt.onChainTxSignature = anchorTxSignature;
      }
      await store.saveReceipt(capturedReceipt);
    }

    return {
      success: true,
      txSignature,
      explorerUrl,
      latencyMs,
      mandate,
      receipt: capturedReceipt,
      resourceData: responseBody,
      payerPubkey: payerKeypair.publicKey,
      merchantPubkey: merchantWallet,
      anchorTxSignature,
      anchorExplorerUrl,
      anchorStatus,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

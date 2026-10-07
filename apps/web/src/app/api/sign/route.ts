import { NextRequest, NextResponse } from 'next/server';
import {
  SignRequestSchema,
  evaluateAndSignTransaction,
  SignedMandateSchema,
} from '@credaver/core';
import {
  getServerStore,
  getServerPaymentKey,
  getServerPayerKeypair,
  getServerReceiptAuthorityKeypair,
  getServerAnchorKeypair,
} from '../../../lib/server-state';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`sign:${clientIp}`, { windowMs: 60000, maxRequests: 120 });
    if (!rl.success) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many signing requests. Please throttle agent requests.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        }
      );
    }

    const rawBody = await req.json();
    const parseResult = SignRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_SIGN_REQUEST',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { mandateHash, proof, transactionMessageBytes, mandate: rawMandate } = parseResult.data;
    const store = getServerStore();

    // 1. Resolve mandate via getMandateByHash first (with ID fallback)
    let storedMandate = await store.getMandateByHash(mandateHash);
    if (!storedMandate) {
      storedMandate = await store.getMandate(mandateHash);
    }

    let mandate = storedMandate;

    // 2. If the request also carries a mandate payload
    if (rawMandate) {
      const parsedMandate = SignedMandateSchema.safeParse(rawMandate);
      if (parsedMandate.success) {
        const clientMandate = parsedMandate.data;
        const existingById = await store.getMandate(clientMandate.mandateId);
        const existing = existingById || storedMandate;

        if (existing) {
          // NEVER overwrite an existing stored record (revocation state always comes from store)
          mandate = existing;
        } else {
          // Only save it if no stored mandate exists with that mandateId
          await store.saveMandate(clientMandate);
          mandate = clientMandate;
        }
      }
    }

    if (!mandate) {
      return NextResponse.json(
        {
          error: 'MANDATE_NOT_FOUND',
          message: `Mandate with hash ${mandateHash} was not found in the registry`,
        },
        { status: 404 }
      );
    }

    const payerKeypair = getServerPayerKeypair();
    const authorityKeypair = getServerReceiptAuthorityKeypair();
    const anchorKeypair = getServerAnchorKeypair();
    const shouldAnchor =
      req.nextUrl.searchParams.get('anchor') === 'true' ||
      process.env.ANCHOR_ON_CHAIN === 'true';

    const signResult = await evaluateAndSignTransaction({
      mandate,
      proof,
      transactionMessageBytes,
      store,
      paymentSecretKey: payerKeypair.secretKey,
      payerPubkey: payerKeypair.publicKey,
      authoritySecretKey: authorityKeypair.secretKey,
      authorityPubkey: authorityKeypair.publicKey,
      anchorSecretKey: anchorKeypair.secretKey,
      anchorPubkey: anchorKeypair.publicKey,
      anchorOnChain: shouldAnchor,
    });

    if (signResult.decision === 'ALLOW') {
      return NextResponse.json(
        {
          decision: 'ALLOW',
          signature: signResult.signature,
          signatureBytes: Array.from(signResult.signatureBytes),
          receipt: signResult.receipt,
        },
        { status: 200 }
      );
    }

    if (signResult.decision === 'REVIEW') {
      return NextResponse.json(
        {
          decision: 'REVIEW',
          reasonCodes: signResult.reasonCodes,
          receipt: signResult.receipt,
        },
        { status: 202 }
      );
    }

    // DENY
    return NextResponse.json(
      {
        decision: 'DENY',
        reasonCodes: signResult.reasonCodes,
        receipt: signResult.receipt,
      },
      { status: 403 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_SIGNING_ERROR',
        message: err.message || 'An unexpected error occurred during signing evaluation',
      },
      { status: 500 }
    );
  }
}

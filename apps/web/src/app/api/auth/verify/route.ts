import { NextRequest, NextResponse } from 'next/server';
import { verifyEd25519 } from '@credaver/core';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

const VerifyBodySchema = z
  .object({
    pubkey: z.string().min(32).max(44),
    challenge: z.string().min(1),
    signatureBase64: z.string().optional(),
    signatureBase58: z.string().optional(),
    nonce: z.string().optional(),
  })
  .refine((d) => !!(d.signatureBase64 || d.signatureBase58), {
    message: 'Either signatureBase64 or signatureBase58 is required',
  });

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`auth-verify:${clientIp}`, { windowMs: 60000, maxRequests: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many verify requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const parseResult = VerifyBodySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_VERIFY_REQUEST', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { pubkey, signatureBase64, signatureBase58, challenge } = parseResult.data;

    // Convert base64 or base58 signature to Uint8Array
    let sigBytes: Uint8Array;
    if (signatureBase64) {
      const binaryString = atob(signatureBase64);
      sigBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        sigBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      sigBytes = Buffer.from(signatureBase58!, 'hex');
    }

    // Server-side Ed25519 signature verification
    const isValid = verifyEd25519(challenge, sigBytes, pubkey);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Ed25519 signature: wallet challenge verification failed' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      wallet: pubkey,
      role: 'operator',
      verifiedAt: Date.now(),
      notice: 'Wallet control verified. No KYC or real-world identity claimed.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Authentication error' },
      { status: 500 }
    );
  }
}

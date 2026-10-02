import { NextRequest, NextResponse } from 'next/server';
import { verifyEd25519 } from '@credaver/core';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pubkey, signatureBase64, signatureBase58, challenge, nonce } = body;

    if (!pubkey || !challenge || (!signatureBase64 && !signatureBase58)) {
      return NextResponse.json(
        { error: 'Missing required fields: pubkey, challenge, and signature' },
        { status: 400 }
      );
    }

    // Convert base64 or base58 signature to Uint8Array
    let sigBytes: Uint8Array;
    if (signatureBase64) {
      const binaryString = atob(signatureBase64);
      sigBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        sigBytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      sigBytes = Buffer.from(signatureBase58, 'hex');
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

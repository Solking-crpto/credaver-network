import { NextResponse } from 'next/server';
import { getServerReceiptAuthorityKeypair } from '../../../lib/server-state';

export async function GET() {
  try {
    const authorityKeypair = getServerReceiptAuthorityKeypair();
    return NextResponse.json({
      authorityPubkey: authorityKeypair.publicKey,
      publicKey: authorityKeypair.publicKey,
      status: 'ACTIVE',
      algorithm: 'Ed25519',
      standard: 'RFC 8785 Canonical JSON',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'AUTHORITY_CONFIG_ERROR',
        message: err.message || 'Failed to resolve CredaVer authority key',
      },
      { status: 500 }
    );
  }
}

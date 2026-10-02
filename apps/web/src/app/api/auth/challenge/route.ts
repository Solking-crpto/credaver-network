import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pubkey = searchParams.get('pubkey');

  if (!pubkey) {
    return NextResponse.json({ error: 'pubkey query parameter is required' }, { status: 400 });
  }

  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const challenge = `CredaVer Operator Authentication\nWallet: ${pubkey}\nNonce: ${nonce}\nTimestamp: ${timestamp}\nTarget: colosseum-hackathon-devnet`;

  return NextResponse.json({
    challenge,
    nonce,
    timestamp,
    pubkey,
  });
}

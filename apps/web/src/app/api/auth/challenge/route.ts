import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

const ChallengeQuerySchema = z.object({
  pubkey: z.string().min(32).max(44),
});

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`auth-challenge:${clientIp}`, { windowMs: 60000, maxRequests: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many auth requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const parseResult = ChallengeQuerySchema.safeParse({
    pubkey: searchParams.get('pubkey') || undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { pubkey } = parseResult.data;
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

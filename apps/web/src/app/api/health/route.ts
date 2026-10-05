import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'CredaVer Policy Decision Point',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    cluster: 'devnet',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
}

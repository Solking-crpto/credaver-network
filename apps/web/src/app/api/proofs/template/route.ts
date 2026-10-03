import { NextRequest, NextResponse } from 'next/server';
import {
  PaymentProofCoreSchema,
  computeProofHash,
  canonicalizeJson,
} from '@credaver/core';
import { z } from 'zod';

const ProofTemplateBodySchema = z.object({
  mandateHash: z.string().length(64),
  agentPubkey: z.string().min(32),
  merchantPubkey: z
    .string()
    .optional()
    .default('D9KxfDqX46pHjs6HdCPrFGkrcEKjP9FAf41pHwkMGbBW'),
  asset: z
    .string()
    .optional()
    .default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  amount: z.string().regex(/^\d+$/).optional().default('1000000'), // $1.00 USDC
  audience: z
    .string()
    .optional()
    .default('https://demo-merchant.solana/api/weather'),
  network: z.string().optional().default('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
  ttlSeconds: z.number().int().positive().optional().default(300),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = ProofTemplateBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_PROOF_REQUEST', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const now = Date.now();
    const nonce = `proof-nonce-${now}-${Math.random().toString(36).slice(2, 10)}`;

    const core = {
      mandateHash: data.mandateHash,
      agentPubkey: data.agentPubkey,
      merchantPubkey: data.merchantPubkey,
      asset: data.asset,
      amount: data.amount,
      audience: data.audience,
      network: data.network,
      nonce,
      timestamp: now,
      expiresAt: now + data.ttlSeconds * 1000,
    };

    const validatedCore = PaymentProofCoreSchema.parse(core);
    const proofHash = computeProofHash(validatedCore);
    const canonicalJson = canonicalizeJson(validatedCore);

    return NextResponse.json({
      success: true,
      core: validatedCore,
      proofHash,
      canonicalJson,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'TEMPLATE_FAILED', message: err.message || 'Failed to create proof template' },
      { status: 500 }
    );
  }
}

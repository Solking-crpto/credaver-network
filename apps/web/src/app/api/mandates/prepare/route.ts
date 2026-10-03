import { NextRequest, NextResponse } from 'next/server';
import {
  MandateCoreSchema,
  computeMandateHash,
  getMandateSigningBytes,
  canonicalizeJson,
  MANDATE_SIGN_PREFIX,
} from '@credaver/core';
import { z } from 'zod';

const PrepareMandateBodySchema = z.object({
  operatorPubkey: z.string().min(32),
  agentPubkey: z.string().min(32),
  maxPerTx: z.string().optional().default('2000000'), // $2.00 USDC
  totalCap: z.string().optional().default('5000000'), // $5.00 USDC
  reviewThreshold: z.string().optional(),
  allowedMerchants: z.array(z.string()).optional().default(['*']),
  allowedAssets: z
    .array(z.string())
    .optional()
    .default(['4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU']),
  network: z.string().optional().default('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'),
  expiresInMinutes: z.number().int().positive().optional().default(60),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = PrepareMandateBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_PREPARE_REQUEST', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const now = Date.now();
    const mandateId = `mandate-phantom-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nonce = `nonce-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const core = {
      mandateId,
      operatorPubkey: data.operatorPubkey,
      agentPubkey: data.agentPubkey,
      allowedMerchants: data.allowedMerchants,
      allowedAssets: data.allowedAssets,
      maxPerTx: data.maxPerTx,
      totalCap: data.totalCap,
      reviewThreshold: data.reviewThreshold,
      validFrom: now - 5000,
      expiresAt: now + data.expiresInMinutes * 60 * 1000,
      nonce,
      network: data.network,
    };

    const validatedCore = MandateCoreSchema.parse(core);
    const mandateHash = computeMandateHash(validatedCore);
    const canonicalJson = canonicalizeJson(validatedCore);
    const signingMessage = `${MANDATE_SIGN_PREFIX}${canonicalJson}`;

    return NextResponse.json({
      success: true,
      core: validatedCore,
      mandateHash,
      signingMessage,
      prefix: MANDATE_SIGN_PREFIX,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'PREPARE_FAILED', message: err.message || 'Failed to prepare mandate' },
      { status: 500 }
    );
  }
}

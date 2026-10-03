import { NextRequest, NextResponse } from 'next/server';
import { SignedMandateSchema, verifySignedMandate } from '@credaver/core';
import { getServerStore } from '../../../lib/server-state';
import { z } from 'zod';

const MandatesQuerySchema = z.object({
  operatorPubkey: z.string().optional(),
  agentPubkey: z.string().optional(),
  revoked: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = SignedMandateSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_MANDATE_PAYLOAD',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const mandate = parseResult.data;

    // Verify mutual Ed25519 signatures
    const verification = verifySignedMandate(mandate);
    if (!verification.isValid) {
      return NextResponse.json(
        {
          error: 'INVALID_MANDATE_SIGNATURES',
          message: verification.error || 'Operator or Agent signature verification failed',
        },
        { status: 400 }
      );
    }

    const store = getServerStore();
    await store.saveMandate(mandate);

    await store.saveAuditEvent({
      eventId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'MANDATE_CREATED',
      entityId: mandate.mandateId,
      timestamp: Date.now(),
      data: {
        mandateHash: mandate.mandateHash,
        operatorPubkey: mandate.operatorPubkey,
        agentPubkey: mandate.agentPubkey,
        maxPerTx: mandate.maxPerTx,
        totalCap: mandate.totalCap,
      },
    });

    return NextResponse.json(
      {
        success: true,
        mandate,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to create mandate',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parseResult = MandatesQuerySchema.safeParse({
      operatorPubkey: searchParams.get('operatorPubkey') || undefined,
      agentPubkey: searchParams.get('agentPubkey') || undefined,
      revoked: searchParams.get('revoked') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_QUERY', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { operatorPubkey, agentPubkey, revoked: revokedParam } = parseResult.data;
    const revoked = revokedParam !== undefined ? revokedParam === 'true' : undefined;

    const store = getServerStore();
    const mandates = await store.listMandates({
      operatorPubkey,
      agentPubkey,
      revoked,
    });

    return NextResponse.json({
      mandates,
      count: mandates.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to list mandates',
      },
      { status: 500 }
    );
  }
}

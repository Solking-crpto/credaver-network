import { NextRequest, NextResponse } from 'next/server';
import { SignedMandateSchema, verifySignedMandate } from '@credaver/core';
import { getServerStore } from '../../../lib/server-state';

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
    const isValid = verifySignedMandate(mandate);
    if (!isValid) {
      return NextResponse.json(
        {
          error: 'INVALID_MANDATE_SIGNATURES',
          message: 'Operator or Agent signature verification failed',
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
    const operatorPubkey = searchParams.get('operatorPubkey') || undefined;
    const agentPubkey = searchParams.get('agentPubkey') || undefined;
    const revokedParam = searchParams.get('revoked');
    const revoked = revokedParam !== null ? revokedParam === 'true' : undefined;

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

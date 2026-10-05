import { NextRequest, NextResponse } from 'next/server';
import { SignedMandateSchema, verifySignedMandate } from '@credaver/core';
import { getServerStore } from '../../../lib/server-state';
import { getOrCreateSessionId, attachSessionCookie, SESSION_COOKIE_NAME } from '../../../lib/session';
import { z } from 'zod';

const MandatesQuerySchema = z.object({
  operatorPubkey: z.string().optional(),
  agentPubkey: z.string().optional(),
  revoked: z.string().optional(),
  showAll: z.string().optional(),
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

    const { sessionId, isNew } = getOrCreateSessionId(req);
    const mandateWithSession = {
      ...mandate,
      sessionId: mandate.sessionId || sessionId,
    };

    const store = getServerStore();
    await store.saveMandate(mandateWithSession);

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
        sessionId,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        mandate: {
          ...mandateWithSession,
          currentSpend: '0',
        },
      },
      { status: 201 }
    );

    if (isNew) {
      attachSessionCookie(res, sessionId);
    }
    return res;
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
      showAll: searchParams.get('showAll') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_QUERY', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { operatorPubkey, agentPubkey, revoked: revokedParam, showAll: showAllParam } = parseResult.data;
    const revoked = revokedParam !== undefined ? revokedParam === 'true' : undefined;
    const showAll = showAllParam === 'true';

    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const store = getServerStore();
    const mandates = await store.listMandates({
      operatorPubkey,
      agentPubkey,
      revoked,
      sessionId: sessionCookie || undefined,
      activeOnly: !showAll && revokedParam === undefined,
    });

    const limitedMandates = mandates.slice(0, 20);
    const enrichedMandates = await Promise.all(
      limitedMandates.map(async (m) => {
        const currentSpend = await store.getMandateSpend(m.mandateId);
        return {
          ...m,
          currentSpend: currentSpend.toString(),
        };
      })
    );

    return NextResponse.json({
      mandates: enrichedMandates,
      count: enrichedMandates.length,
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

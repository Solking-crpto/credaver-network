import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../../../lib/server-state';
import { z } from 'zod';

const RevokeBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RevokeBodySchema.safeParse(rawBody);
    const reason =
      (parseResult.success ? parseResult.data.reason : null) ||
      'Operator revocation via CredaVer Console';

    const store = getServerStore();
    const existing = await store.getMandate(id);

    if (!existing) {
      return NextResponse.json(
        {
          error: 'MANDATE_NOT_FOUND',
          message: `Mandate with ID ${id} was not found`,
        },
        { status: 404 }
      );
    }

    await store.revokeMandate(id, reason);
    const updated = await store.getMandate(id);

    await store.saveAuditEvent({
      eventId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'MANDATE_REVOKED',
      entityId: id,
      timestamp: Date.now(),
      data: {
        mandateHash: existing.mandateHash,
        operatorPubkey: existing.operatorPubkey,
        revokedReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Mandate successfully revoked',
      mandate: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to revoke mandate',
      },
      { status: 500 }
    );
  }
}

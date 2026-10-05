import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../lib/server-state';
import { z } from 'zod';

const ReceiptsQuerySchema = z.object({
  agentPubkey: z.string().optional(),
  merchantPubkey: z.string().optional(),
  decision: z.enum(['ALLOW', 'DENY', 'REVIEW']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parseResult = ReceiptsQuerySchema.safeParse({
      agentPubkey: searchParams.get('agentPubkey') || undefined,
      merchantPubkey: searchParams.get('merchantPubkey') || undefined,
      decision: searchParams.get('decision') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_QUERY', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { agentPubkey, merchantPubkey, decision } = parseResult.data;

    const sessionCookie = req.cookies.get('credav_session')?.value;
    const store = getServerStore();
    const receipts = await store.listReceipts({
      agentPubkey,
      merchantPubkey,
      decision,
      sessionId: sessionCookie || undefined,
    });

    const limitedReceipts = receipts.slice(0, 20);

    return NextResponse.json({
      receipts: limitedReceipts,
      count: limitedReceipts.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to list receipts',
      },
      { status: 500 }
    );
  }
}

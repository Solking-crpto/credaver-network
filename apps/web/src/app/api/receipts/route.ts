import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../lib/server-state';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentPubkey = searchParams.get('agentPubkey') || undefined;
    const merchantPubkey = searchParams.get('merchantPubkey') || undefined;
    const decisionParam = searchParams.get('decision');
    const decision =
      decisionParam === 'ALLOW' || decisionParam === 'DENY' || decisionParam === 'REVIEW'
        ? decisionParam
        : undefined;

    const store = getServerStore();
    const receipts = await store.listReceipts({
      agentPubkey,
      merchantPubkey,
      decision,
    });

    return NextResponse.json({
      receipts,
      count: receipts.length,
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

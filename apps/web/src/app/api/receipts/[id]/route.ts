import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../../lib/server-state';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = getServerStore();
    const receipt = await store.getReceipt(id);

    if (!receipt) {
      return NextResponse.json(
        {
          error: 'RECEIPT_NOT_FOUND',
          message: `Receipt with ID ${id} was not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      receipt,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to retrieve receipt',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../../lib/server-state';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = getServerStore();
    const mandate = await store.getMandate(id);

    if (!mandate) {
      return NextResponse.json(
        {
          error: 'MANDATE_NOT_FOUND',
          message: `Mandate with ID ${id} was not found`,
        },
        { status: 404 }
      );
    }

    const currentSpend = await store.getMandateSpend(id);

    return NextResponse.json({
      mandate,
      currentSpend: currentSpend.toString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to retrieve mandate',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerStore } from '../../../../lib/server-state';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawParams = await params;
    const parseResult = ParamsSchema.safeParse(rawParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_PARAMS', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { id } = parseResult.data;
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

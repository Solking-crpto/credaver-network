import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRedisRateLimit } from '../../../lib/rate-limit';
import { getServerStore } from '../../../lib/server-state';

const EarlyAccessSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email cannot exceed 255 characters'),
  agentDescription: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .default(''),
});

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Rate limit: 5 submissions per hour per IP
    const rl = await checkRedisRateLimit(
      `rl:early_access:ip:${ip}`,
      5,
      3600,
      'Too many requests from your IP. Please try again in an hour.'
    );

    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', message: rl.message },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = EarlyAccessSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid input',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { email, agentDescription } = parseResult.data;
    const store = getServerStore();

    // Store through existing audit event abstraction
    await store.saveAuditEvent({
      eventId: `ea-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'MANDATE_CREATED' as any,
      entityId: `early-access:${email.toLowerCase()}`,
      timestamp: Date.now(),
      data: {
        email: email.toLowerCase(),
        agentDescription: agentDescription || null,
        submittedAt: new Date().toISOString(),
        ip,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you for requesting early access. We will reach out when the next cohort opens.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: err.message || 'Failed to submit early access request' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE_NAME = 'credav_session';

export function getOrCreateSessionId(req: NextRequest): { sessionId: string; isNew: boolean } {
  const existing = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (existing && existing.trim().length > 0) {
    return { sessionId: existing.trim(), isNew: false };
  }
  const newId = `sess_${crypto.randomUUID()}`;
  return { sessionId: newId, isNew: true };
}

export function attachSessionCookie(res: NextResponse, sessionId: string): NextResponse {
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400, // 30 days
  });
  return res;
}

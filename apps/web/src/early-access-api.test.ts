import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as earlyAccessPostRoute } from './app/api/early-access/route';
import { getServerStore } from './lib/server-state';
import { resetRateLimits } from './lib/rate-limit';

describe('apps/web: Early Access API', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('1. Accepts valid early access submission with email and description', async () => {
    const req = new NextRequest('http://localhost:3000/api/early-access', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.195' },
      body: JSON.stringify({
        email: 'operator@example.com',
        agentDescription: 'Autonomous market making and x402 telemetry agent',
      }),
    });

    const res = await earlyAccessPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('early access');

    // Verify stored in audit store
    const store = getServerStore();
    const events = await store.listAuditEvents({ entityId: 'early-access:operator@example.com' });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].data.email).toBe('operator@example.com');
  });

  it('2. Accepts submission without optional agent description', async () => {
    const req = new NextRequest('http://localhost:3000/api/early-access', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.196' },
      body: JSON.stringify({
        email: 'founder@solana.org',
      }),
    });

    const res = await earlyAccessPostRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('3. Rejects invalid email address with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/early-access', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.197' },
      body: JSON.stringify({
        email: 'not-an-email',
      }),
    });

    const res = await earlyAccessPostRoute(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('4. Enforces IP rate limiting after 5 requests', async () => {
    const testIp = '198.51.100.77';

    for (let i = 0; i < 5; i++) {
      const req = new NextRequest('http://localhost:3000/api/early-access', {
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: JSON.stringify({ email: `user${i}@example.com` }),
      });
      const res = await earlyAccessPostRoute(req);
      expect(res.status).toBe(200);
    }

    // 6th request fails with 429
    const req6 = new NextRequest('http://localhost:3000/api/early-access', {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: JSON.stringify({ email: 'user6@example.com' }),
    });
    const res6 = await earlyAccessPostRoute(req6);
    expect(res6.status).toBe(429);
  });
});

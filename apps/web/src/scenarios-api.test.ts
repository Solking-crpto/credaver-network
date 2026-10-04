import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as scenarioPostRoute } from './app/api/scenarios/route';
import { GET as reviewsGetRoute, POST as reviewsPostRoute } from './app/api/reviews/route';
import { ReasonCode } from '@credaver/core';
import { checkRedisRateLimit, resetRateLimits } from './lib/rate-limit';

describe('apps/web: Milestone 5 Interactive Scenarios & Reviews API', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  afterEach(() => {
    resetRateLimits();
  });
  it('1. Scenario ALLOW: returns 200, ALLOW decision, and valid receipt', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'ALLOW' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scenario).toBe('ALLOW');
    expect(data.decision).toBe('ALLOW');
    expect(data.receipt).toBeDefined();
    expect(data.receipt.decision).toBe('ALLOW');
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('2. Scenario OVER_CAP: returns 403, DENY, and AMOUNT_EXCEEDS_CAP', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'OVER_CAP' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200); // Route itself returns 200 JSON with statusCode: 403

    const data = await res.json();
    expect(data.decision).toBe('DENY');
    expect(data.statusCode).toBe(403);
    expect(data.reasonCodes).toContain(ReasonCode.AMOUNT_EXCEEDS_CAP);
  });

  it('3. Scenario REVOKED: returns 403, DENY, and REVOKED_MANDATE', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'REVOKED' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.decision).toBe('DENY');
    expect(data.statusCode).toBe(403);
    expect(data.reasonCodes).toContain(ReasonCode.REVOKED_MANDATE);
  });

  it('4. Scenario EXPIRED: returns 403, DENY, and EXPIRED_MANDATE', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'EXPIRED' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.decision).toBe('DENY');
    expect(data.statusCode).toBe(403);
    expect(data.reasonCodes).toContain(ReasonCode.EXPIRED_MANDATE);
  });

  it('5. Scenario REPLAY: atomic nonce check returns 403, DENY, and REPLAY_DETECTED', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'REPLAY' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.decision).toBe('DENY');
    expect(data.statusCode).toBe(403);
    expect(data.reasonCodes).toContain(ReasonCode.REPLAY_DETECTED);
  });

  it('6. Scenario REVIEW: returns 202, REVIEW, and enters review queue', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'REVIEW' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.decision).toBe('REVIEW');
    expect(data.statusCode).toBe(202);
    expect(data.receipt).toBeDefined();

    // Verify it appears in GET /api/reviews
    const listRes = await reviewsGetRoute();
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.reviews.length).toBeGreaterThan(0);
  });

  it('7. Operator Reviews API: can approve a pending review', async () => {
    // Generate a review receipt
    const scReq = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'REVIEW' }),
    });
    const scRes = await scenarioPostRoute(scReq);
    const scData = await scRes.json();
    const receiptId = scData.receipt.receiptId;

    // Operator Approves
    const approveReq = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        receiptId,
        action: 'APPROVE',
        reason: 'Authorized high-value transaction',
      }),
    });
    const approveRes = await reviewsPostRoute(approveReq);
    expect(approveRes).toBeDefined();
    expect(approveRes!.status).toBe(200);

    const approveData = await approveRes!.json();
    expect(approveData.action).toBe('APPROVE');
    expect(approveData.decision).toBe('ALLOW');
    expect(approveData.signature).toBeDefined();
    expect(approveData.receipt.decision).toBe('ALLOW');
  });

  it('8. Operator Reviews API: can reject a pending review', async () => {
    // Generate a review receipt
    const scReq = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      body: JSON.stringify({ scenario: 'REVIEW' }),
    });
    const scRes = await scenarioPostRoute(scReq);
    const scData = await scRes.json();
    const receiptId = scData.receipt.receiptId;

    // Operator Rejects
    const rejectReq = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        receiptId,
        action: 'REJECT',
        reason: 'Unapproved transaction',
      }),
    });
    const rejectRes = await reviewsPostRoute(rejectReq);
    expect(rejectRes).toBeDefined();
    expect(rejectRes!.status).toBe(200);

    const rejectData = await rejectRes!.json();
    expect(rejectData.action).toBe('REJECT');
    expect(rejectData.decision).toBe('DENY');
    expect(rejectData.reasonCodes).toContain(ReasonCode.OPERATOR_REJECTED);
  });

  it('9. Scenario REAL_DEVNET: validates scenario enum and returns structured response or graceful fallback', async () => {
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.99' },
      body: JSON.stringify({ scenario: 'REAL_DEVNET' }),
    });
    const res = await scenarioPostRoute(req);
    // Either 200 (live settlement executed) or 503 (graceful facilitator / devnet funds notice)
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    if (res.status === 200) {
      expect(data.scenario).toBe('REAL_DEVNET');
      expect(data.decision).toBe('ALLOW');
      expect(data.txSignature).toBeDefined();
      expect(data.explorerUrl).toContain('https://explorer.solana.com/tx/');
    } else {
      expect(['FACILITATOR_UNAVAILABLE', 'INSUFFICIENT_DEVNET_FUNDS']).toContain(data.error);
      expect(data.message).toBeDefined();
    }
  }, 60000);

  it('10. Scenario REAL_DEVNET: enforces per-IP rate limit failing closed with 429', async () => {
    const testIp = '198.51.100.42';
    // Consume the 5 allowed requests
    for (let i = 0; i < 5; i++) {
      const rlResult = await checkRedisRateLimit(`rl:real_devnet:ip:${testIp}`, 5, 60);
      expect(rlResult.allowed).toBe(true);
    }
    // 6th request from this IP must hit 429
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      headers: { 'x-forwarded-for': testIp },
      body: JSON.stringify({ scenario: 'REAL_DEVNET' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(data.message).toContain('Per-IP rate limit exceeded');
  });

  it('11. Scenario REAL_DEVNET: enforces global daily cap returning 429', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Artificially saturate the daily cap of 40
    const dailyKey = `rl:real_devnet:daily:${today}`;
    for (let i = 0; i < 40; i++) {
      await checkRedisRateLimit(dailyKey, 40, 86400);
    }
    // Next request from any IP must hit 429 due to daily cap
    const req = new NextRequest('http://localhost:3000/api/scenarios', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.1' },
      body: JSON.stringify({ scenario: 'REAL_DEVNET' }),
    });
    const res = await scenarioPostRoute(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(data.message).toContain('Daily limit for live devnet payments reached');
  });
});



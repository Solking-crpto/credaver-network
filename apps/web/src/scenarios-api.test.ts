import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as scenarioPostRoute } from './app/api/scenarios/route';
import { GET as reviewsGetRoute, POST as reviewsPostRoute } from './app/api/reviews/route';
import { ReasonCode } from '@credaver/core';

describe('apps/web: Milestone 5 Interactive Scenarios & Reviews API', () => {
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
  }, 30000);
});


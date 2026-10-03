import { describe, it, expect, beforeEach } from 'vitest';
import {
  MandateLifecycle,
  RequestLifecycle,
  computeMandateState,
  validateMandateTransition,
  validateRequestTransition,
  isMandateTerminalState,
  isRequestTerminalState,
  InvalidStateTransitionError,
  MandateState,
  RequestState,
} from './state-machine.js';
import { issueSignedMandate, SignedMandate } from './mandate.js';
import { generateEd25519Keypair } from './crypto.js';
import { MemoryStore } from './store/index.js';
import { ReasonCode } from './policy.js';

describe('Milestone 3: State Machines and Audit Trail', () => {
  let operatorKey: ReturnType<typeof generateEd25519Keypair>;
  let agentKey: ReturnType<typeof generateEd25519Keypair>;
  let mandate: SignedMandate;
  let store: MemoryStore;

  beforeEach(() => {
    operatorKey = generateEd25519Keypair();
    agentKey = generateEd25519Keypair();
    store = new MemoryStore();

    mandate = issueSignedMandate(
      {
        mandateId: 'mandate-sm-001',
        operatorPubkey: operatorKey.publicKey,
        agentPubkey: agentKey.publicKey,
        allowedMerchants: ['*'],
        allowedAssets: ['*'],
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        maxPerTx: '1000000',
        totalCap: '5000000',
        validFrom: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
        nonce: 'mandate-sm-nonce-001',
      },
      operatorKey.secretKey,
      agentKey.secretKey
    );
  });

  describe('3.1 Mandate State Machine', () => {
    it('validates allowed transitions correctly', () => {
      expect(validateMandateTransition('DRAFT', 'ACTIVE')).toBe(true);
      expect(validateMandateTransition('ACTIVE', 'REVOKED')).toBe(true);
      expect(validateMandateTransition('ACTIVE', 'EXPIRED')).toBe(true);
      expect(validateMandateTransition('ACTIVE', 'DEPLETED')).toBe(true);
      expect(validateMandateTransition('DEPLETED', 'REVOKED')).toBe(true);

      // Disallowed transitions
      expect(validateMandateTransition('REVOKED', 'ACTIVE')).toBe(false);
      expect(validateMandateTransition('EXPIRED', 'ACTIVE')).toBe(false);
      expect(validateMandateTransition('DRAFT', 'REVOKED')).toBe(false);
      expect(validateMandateTransition('ACTIVE', 'DRAFT')).toBe(false);
    });

    it('identifies terminal mandate states', () => {
      expect(isMandateTerminalState('REVOKED')).toBe(true);
      expect(isMandateTerminalState('EXPIRED')).toBe(true);
      expect(isMandateTerminalState('ACTIVE')).toBe(false);
      expect(isMandateTerminalState('DRAFT')).toBe(false);
      expect(isMandateTerminalState('DEPLETED')).toBe(false);
    });

    it('allows valid state progression: DRAFT -> ACTIVE -> REVOKED', async () => {
      const lifecycle = new MandateLifecycle(mandate, 'DRAFT', store);
      expect(lifecycle.getState()).toBe('DRAFT');

      await lifecycle.transition('ACTIVE');
      expect(lifecycle.getState()).toBe('ACTIVE');

      await lifecycle.transition('REVOKED', 'Security rotation');
      expect(lifecycle.getState()).toBe('REVOKED');
      expect(mandate.revoked).toBe(true);
      expect(mandate.revokedReason).toBe('Security rotation');
    });

    it('allows transition: ACTIVE -> DEPLETED -> REVOKED', async () => {
      const lifecycle = new MandateLifecycle(mandate, 'ACTIVE', store);
      await lifecycle.transition('DEPLETED');
      expect(lifecycle.getState()).toBe('DEPLETED');

      await lifecycle.transition('REVOKED', 'Revoking depleted mandate');
      expect(lifecycle.getState()).toBe('REVOKED');
    });

    it('throws InvalidStateTransitionError on disallowed transitions', async () => {
      const lifecycle = new MandateLifecycle(mandate, 'ACTIVE', store);
      await lifecycle.transition('REVOKED');

      await expect(lifecycle.transition('ACTIVE')).rejects.toThrow(InvalidStateTransitionError);
      await expect(lifecycle.transition('DRAFT')).rejects.toThrow(InvalidStateTransitionError);
    });

    it('computes dynamic mandate state accurately', () => {
      const now = Date.now();

      // Normal active
      expect(computeMandateState(mandate, 0n, now)).toBe('ACTIVE');

      // Depleted by spend
      expect(computeMandateState(mandate, 5000000n, now)).toBe('DEPLETED');
      expect(computeMandateState(mandate, 6000000n, now)).toBe('DEPLETED');

      // Expired by time
      expect(computeMandateState(mandate, 0n, mandate.expiresAt + 1000)).toBe('EXPIRED');

      // Revoked takes precedence
      const revokedMandate = { ...mandate, revoked: true };
      expect(computeMandateState(revokedMandate, 0n, now)).toBe('REVOKED');
    });

    it('records audit events for mandate transitions in store', async () => {
      const lifecycle = new MandateLifecycle(mandate, 'ACTIVE', store);
      await lifecycle.transition('REVOKED', 'Test revoke');

      const events = await store.listAuditEvents({ entityId: mandate.mandateId });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('MANDATE_REVOKED');
      expect(events[0].data.fromState).toBe('ACTIVE');
      expect(events[0].data.toState).toBe('REVOKED');
      expect(events[0].data.reason).toBe('Test revoke');
    });
  });

  describe('3.2 Request State Machine', () => {
    it('validates allowed request transitions correctly', () => {
      expect(validateRequestTransition('RECEIVED', 'EVALUATING')).toBe(true);
      expect(validateRequestTransition('EVALUATING', 'ALLOWED')).toBe(true);
      expect(validateRequestTransition('EVALUATING', 'DENIED')).toBe(true);
      expect(validateRequestTransition('EVALUATING', 'PENDING_REVIEW')).toBe(true);
      expect(validateRequestTransition('PENDING_REVIEW', 'APPROVED')).toBe(true);
      expect(validateRequestTransition('PENDING_REVIEW', 'REJECTED')).toBe(true);
      expect(validateRequestTransition('APPROVED', 'ALLOWED')).toBe(true);
      expect(validateRequestTransition('REJECTED', 'DENIED')).toBe(true);
      expect(validateRequestTransition('ALLOWED', 'SETTLED')).toBe(true);
      expect(validateRequestTransition('ALLOWED', 'FAILED')).toBe(true);

      // Terminal and invalid transitions
      expect(validateRequestTransition('DENIED', 'ALLOWED')).toBe(false);
      expect(validateRequestTransition('SETTLED', 'FAILED')).toBe(false);
      expect(validateRequestTransition('FAILED', 'SETTLED')).toBe(false);
      expect(validateRequestTransition('RECEIVED', 'ALLOWED')).toBe(false);
      expect(validateRequestTransition('PENDING_REVIEW', 'SETTLED')).toBe(false);
    });

    it('identifies terminal request states', () => {
      expect(isRequestTerminalState('DENIED')).toBe(true);
      expect(isRequestTerminalState('SETTLED')).toBe(true);
      expect(isRequestTerminalState('FAILED')).toBe(true);
      expect(isRequestTerminalState('RECEIVED')).toBe(false);
      expect(isRequestTerminalState('EVALUATING')).toBe(false);
      expect(isRequestTerminalState('PENDING_REVIEW')).toBe(false);
      expect(isRequestTerminalState('APPROVED')).toBe(false);
      expect(isRequestTerminalState('ALLOWED')).toBe(false);
    });

    it('executes the happy path: RECEIVED -> EVALUATING -> ALLOWED -> SETTLED', async () => {
      const requestId = 'req-happy-101';
      const req = new RequestLifecycle(requestId, store);

      expect(req.getState()).toBe('RECEIVED');
      await req.transition('EVALUATING');
      expect(req.getState()).toBe('EVALUATING');
      await req.transition('ALLOWED', { txSignature: 'sig123' });
      expect(req.getState()).toBe('ALLOWED');
      await req.transition('SETTLED', { onChainSlot: 506947263 });
      expect(req.getState()).toBe('SETTLED');

      const events = await store.listAuditEvents({ entityId: requestId });
      expect(events).toHaveLength(3);
      // Chronological order: most recent first in listAuditEvents
      expect(events[0].type).toBe('PAYMENT_SETTLED');
    });

    it('executes human review path: RECEIVED -> EVALUATING -> PENDING_REVIEW -> APPROVED -> ALLOWED -> SETTLED', async () => {
      const requestId = 'req-review-app-102';
      const req = new RequestLifecycle(requestId, store);

      await req.transition('EVALUATING');
      await req.transition('PENDING_REVIEW', { reason: 'AMOUNT_EXCEEDS_REVIEW_THRESHOLD' });
      expect(req.getState()).toBe('PENDING_REVIEW');

      await req.transition('APPROVED', { reviewedBy: 'operator-1' });
      expect(req.getState()).toBe('APPROVED');

      await req.transition('ALLOWED');
      await req.transition('SETTLED', { txSignature: 'final-sig' });
      expect(req.getState()).toBe('SETTLED');

      const events = await store.listAuditEvents({ entityId: requestId });
      const types = events.map((e) => e.type);
      expect(types).toContain('REVIEW_REQUESTED');
      expect(types).toContain('REVIEW_APPROVED');
      expect(types).toContain('PAYMENT_SETTLED');
    });

    it('executes review rejection path: PENDING_REVIEW -> REJECTED -> DENIED', async () => {
      const requestId = 'req-review-rej-103';
      const req = new RequestLifecycle(requestId, store);

      await req.transition('EVALUATING');
      await req.transition('PENDING_REVIEW', { reason: 'UNKNOWN_MERCHANT_REQUIRES_REVIEW' });
      await req.transition('REJECTED', { reviewerReason: 'Unrecognized vendor' });
      await req.transition('DENIED', { reasonCode: ReasonCode.OPERATOR_REJECTED });
      expect(req.getState()).toBe('DENIED');

      const events = await store.listAuditEvents({ entityId: requestId });
      const types = events.map((e) => e.type);
      expect(types).toContain('REVIEW_REJECTED');
      expect(types).toContain('POLICY_DENIED');
    });

    it('throws InvalidStateTransitionError when transitioning from terminal states', async () => {
      const requestId = 'req-terminal-104';
      const req = new RequestLifecycle(requestId, store);

      await req.transition('EVALUATING');
      await req.transition('DENIED');

      await expect(req.transition('ALLOWED')).rejects.toThrow(InvalidStateTransitionError);
      await expect(req.transition('EVALUATING')).rejects.toThrow(InvalidStateTransitionError);
    });
  });

  describe('3.3 Standardized Reason Codes', () => {
    it('defines all 14 mandatory standardized reason codes', () => {
      const mandatoryCodes = [
        'EXPIRED_MANDATE',
        'REVOKED_MANDATE',
        'DEPLETED_MANDATE',
        'NOT_YET_VALID',
        'MERCHANT_NOT_ALLOWED',
        'ASSET_NOT_ALLOWED',
        'NETWORK_MISMATCH',
        'AMOUNT_EXCEEDS_CAP',
        'AMOUNT_EXCEEDS_PER_TX',
        'AMOUNT_EXCEEDS_REVIEW_THRESHOLD',
        'REPLAY_DETECTED',
        'INVALID_SIGNATURE',
        'INVALID_PROOF',
        'OPERATOR_REJECTED',
      ];

      for (const code of mandatoryCodes) {
        expect(ReasonCode).toHaveProperty(code);
        expect((ReasonCode as any)[code]).toBe(code);
      }
    });

    it('maintains backwards compatibility for legacy aliases', () => {
      expect(ReasonCode.AMOUNT_EXCEEDS_TOTAL_CAP).toBe(ReasonCode.AMOUNT_EXCEEDS_CAP);
      expect(ReasonCode.AMOUNT_EXCEEDS_PER_TX_LIMIT).toBe(ReasonCode.AMOUNT_EXCEEDS_PER_TX);
      expect(ReasonCode.NONCE_REPLAYED).toBe(ReasonCode.REPLAY_DETECTED);
      expect(ReasonCode.INVALID_AGENT_PROOF_SIGNATURE).toBe(ReasonCode.INVALID_SIGNATURE);
      expect(ReasonCode.INVALID_MANDATE_INTEGRITY).toBe(ReasonCode.INVALID_PROOF);
      expect(ReasonCode.HIGH_VALUE_TRANSACTION_REQUIRES_REVIEW).toBe(
        ReasonCode.AMOUNT_EXCEEDS_REVIEW_THRESHOLD
      );
    });
  });

  describe('3.4 Chronological Audit Log Inspection', () => {
    it('records and retrieves a coherent chronological audit trail', async () => {
      const entityId = 'audit-test-trail-200';
      const req = new RequestLifecycle(entityId, store);

      await req.transition('EVALUATING');
      await req.transition('PENDING_REVIEW', { step: 1 });
      await req.transition('APPROVED', { step: 2 });
      await req.transition('ALLOWED', { step: 3 });
      await req.transition('SETTLED', { step: 4, signature: 'tx-audit-hash' });

      const auditTrail = await store.listAuditEvents({ entityId });
      expect(auditTrail).toHaveLength(5);

      // Verify each event has timestamp, entityId, eventId, and step data
      for (const event of auditTrail) {
        expect(event.entityId).toBe(entityId);
        expect(event.eventId).toBeDefined();
        expect(typeof event.timestamp).toBe('number');
      }

      // Check chronologically: newest is first in listAuditEvents (b.timestamp - a.timestamp)
      expect(auditTrail[0].type).toBe('PAYMENT_SETTLED');
      expect(auditTrail[0].data.signature).toBe('tx-audit-hash');
    });
  });
});

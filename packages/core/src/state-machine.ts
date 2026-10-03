import { SignedMandate } from './mandate.js';
import { ICredaverStore, AuditEvent } from './store/index.js';

export class InvalidStateTransitionError extends Error {
  public readonly entity: 'MANDATE' | 'REQUEST';
  public readonly fromState: string;
  public readonly toState: string;

  constructor(
    entity: 'MANDATE' | 'REQUEST',
    fromState: string,
    toState: string,
    message?: string
  ) {
    super(
      message ||
        `Invalid ${entity} state transition from "${fromState}" to "${toState}". This transition is not allowed.`
    );
    this.name = 'InvalidStateTransitionError';
    this.entity = entity;
    this.fromState = fromState;
    this.toState = toState;
  }
}

// ============================================================================
// MANDATE STATE MACHINE
// ============================================================================

export type MandateState = 'DRAFT' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'DEPLETED';

export const MANDATE_ALLOWED_TRANSITIONS: Record<MandateState, readonly MandateState[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['REVOKED', 'EXPIRED', 'DEPLETED'],
  REVOKED: [], // Terminal
  EXPIRED: [], // Terminal
  DEPLETED: ['REVOKED'], // Can be explicitly revoked while depleted
};

export function validateMandateTransition(fromState: MandateState, toState: MandateState): boolean {
  const allowed = MANDATE_ALLOWED_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

export function isMandateTerminalState(state: MandateState): boolean {
  return state === 'REVOKED' || state === 'EXPIRED';
}

/**
 * Computes dynamic mandate status based on timestamps and cumulative spend.
 */
export function computeMandateState(
  mandate: SignedMandate,
  currentSpend: bigint,
  now: number = Date.now()
): MandateState {
  if (mandate.revoked) {
    return 'REVOKED';
  }
  if (now > mandate.expiresAt) {
    return 'EXPIRED';
  }
  const cap = BigInt(mandate.totalCap);
  if (currentSpend >= cap) {
    return 'DEPLETED';
  }
  return 'ACTIVE';
}

export class MandateLifecycle {
  private currentState: MandateState;
  private mandate: SignedMandate;
  private store?: ICredaverStore;

  constructor(mandate: SignedMandate, initialState: MandateState = 'ACTIVE', store?: ICredaverStore) {
    this.mandate = mandate;
    this.currentState = initialState;
    this.store = store;
  }

  getState(): MandateState {
    return this.currentState;
  }

  async transition(toState: MandateState, reason?: string): Promise<MandateState> {
    if (!validateMandateTransition(this.currentState, toState)) {
      throw new InvalidStateTransitionError(
        'MANDATE',
        this.currentState,
        toState,
        `Cannot transition Mandate ${this.mandate.mandateId} from "${this.currentState}" to "${toState}". Allowed: [${MANDATE_ALLOWED_TRANSITIONS[this.currentState].join(', ')}]`
      );
    }

    const fromState = this.currentState;
    this.currentState = toState;

    if (toState === 'REVOKED') {
      this.mandate.revoked = true;
      this.mandate.revokedAt = Date.now();
      this.mandate.revokedReason = reason ?? 'Operator revocation';
      if (this.store) {
        await this.store.saveMandate(this.mandate);
      }
    }

    if (this.store) {
      const event: AuditEvent = {
        eventId: `audit-mandate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: toState === 'REVOKED' ? 'MANDATE_REVOKED' : 'MANDATE_STATE_CHANGED',
        entityId: this.mandate.mandateId,
        timestamp: Date.now(),
        data: {
          fromState,
          toState,
          reason,
          mandateHash: this.mandate.mandateHash,
        },
      };
      await this.store.saveAuditEvent(event);
    }

    return this.currentState;
  }
}

// ============================================================================
// REQUEST STATE MACHINE
// ============================================================================

export type RequestState =
  | 'RECEIVED'
  | 'EVALUATING'
  | 'ALLOWED'
  | 'DENIED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SETTLED'
  | 'FAILED';

export const REQUEST_ALLOWED_TRANSITIONS: Record<RequestState, readonly RequestState[]> = {
  RECEIVED: ['EVALUATING'],
  EVALUATING: ['ALLOWED', 'DENIED', 'PENDING_REVIEW'],
  ALLOWED: ['SETTLED', 'FAILED'],
  DENIED: [], // Terminal
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['ALLOWED'],
  REJECTED: ['DENIED'],
  SETTLED: [], // Terminal
  FAILED: [],  // Terminal
};

export function validateRequestTransition(fromState: RequestState, toState: RequestState): boolean {
  const allowed = REQUEST_ALLOWED_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

export function isRequestTerminalState(state: RequestState): boolean {
  return state === 'DENIED' || state === 'SETTLED' || state === 'FAILED';
}

export class RequestLifecycle {
  private currentState: RequestState = 'RECEIVED';
  private requestId: string;
  private store?: ICredaverStore;

  constructor(requestId: string, store?: ICredaverStore) {
    this.requestId = requestId;
    this.store = store;
  }

  getState(): RequestState {
    return this.currentState;
  }

  async transition(toState: RequestState, metadata?: Record<string, any>): Promise<RequestState> {
    if (!validateRequestTransition(this.currentState, toState)) {
      throw new InvalidStateTransitionError(
        'REQUEST',
        this.currentState,
        toState,
        `Cannot transition Request ${this.requestId} from "${this.currentState}" to "${toState}". Allowed: [${REQUEST_ALLOWED_TRANSITIONS[this.currentState].join(', ')}]`
      );
    }

    const fromState = this.currentState;
    this.currentState = toState;

    if (this.store) {
      let eventType: AuditEvent['type'] = 'REQUEST_TRANSITION';
      if (toState === 'DENIED') {
        eventType = 'POLICY_DENIED';
      } else if (toState === 'PENDING_REVIEW') {
        eventType = 'REVIEW_REQUESTED';
      } else if (toState === 'APPROVED') {
        eventType = 'REVIEW_APPROVED';
      } else if (toState === 'REJECTED') {
        eventType = 'REVIEW_REJECTED';
      } else if (toState === 'SETTLED') {
        eventType = 'PAYMENT_SETTLED';
      } else if (toState === 'FAILED') {
        eventType = 'PAYMENT_FAILED';
      }

      const event: AuditEvent = {
        eventId: `audit-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: eventType,
        entityId: this.requestId,
        timestamp: Date.now(),
        data: {
          fromState,
          toState,
          ...metadata,
        },
      };
      await this.store.saveAuditEvent(event);
    }

    return this.currentState;
  }
}

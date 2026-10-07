import { SignedMandate } from '../mandate.js';
import { SignedReceipt } from '../receipt.js';

export interface MandateFilter {
  operatorPubkey?: string;
  agentPubkey?: string;
  revoked?: boolean;
  sessionId?: string;
  activeOnly?: boolean;
}

export interface ReceiptFilter {
  agentPubkey?: string;
  merchantPubkey?: string;
  decision?: 'ALLOW' | 'DENY' | 'REVIEW';
  sessionId?: string;
}

export interface AuditEvent {
  eventId: string;
  type:
    | 'MANDATE_CREATED'
    | 'MANDATE_REVOKED'
    | 'MANDATE_STATE_CHANGED'
    | 'REQUEST_TRANSITION'
    | 'POLICY_EVALUATED'
    | 'PAYMENT_PROCESSED'
    | 'POLICY_DENIED'
    | 'REVIEW_REQUESTED'
    | 'REVIEW_APPROVED'
    | 'REVIEW_REJECTED'
    | 'PAYMENT_SETTLED'
    | 'PAYMENT_FAILED';
  entityId: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface ICredaverStore {
  /**
   * Atomically consumes a nonce with a TTL.
   * Returns true if the nonce was newly consumed.
   * Returns false if the nonce had already been consumed (REPLAY).
   */
  consumeNonce(nonce: string, ttlSeconds: number): Promise<boolean>;

  getMandateSpend(mandateId: string): Promise<bigint>;
  recordMandateSpend(mandateId: string, amount: bigint): Promise<bigint>;

  getMandate(mandateId: string): Promise<SignedMandate | null>;
  getMandateByHash(mandateHash: string): Promise<SignedMandate | null>;
  saveMandate(mandate: SignedMandate): Promise<void>;
  revokeMandate(mandateId: string, reason?: string): Promise<void>;
  listMandates(filter?: MandateFilter): Promise<SignedMandate[]>;

  saveReceipt(receipt: SignedReceipt): Promise<void>;
  getReceipt(receiptId: string): Promise<SignedReceipt | null>;
  listReceipts(filter?: ReceiptFilter): Promise<SignedReceipt[]>;

  saveAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(filter?: { entityId?: string }): Promise<AuditEvent[]>;
}

/**
 * In-Memory Store for unit tests, local development, and embedded runtimes.
 * Fully thread-safe / event-loop atomic for JavaScript concurrency.
 */
export class MemoryStore implements ICredaverStore {
  private nonces = new Map<string, number>(); // nonce -> expiryMs
  private spends = new Map<string, bigint>();
  private mandates = new Map<string, SignedMandate>();
  private mandateHashes = new Map<string, string>(); // mandateHash -> mandateId
  private receipts = new Map<string, SignedReceipt>();
  private auditEvents: AuditEvent[] = [];

  async consumeNonce(nonce: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const existingExpiry = this.nonces.get(nonce);
    if (existingExpiry && existingExpiry > now) {
      return false; // Replay rejected
    }

    const expiryMs = now + ttlSeconds * 1000;
    this.nonces.set(nonce, expiryMs);
    return true; // Successfully consumed
  }

  async getMandateSpend(mandateId: string): Promise<bigint> {
    return this.spends.get(mandateId) ?? 0n;
  }

  async recordMandateSpend(mandateId: string, amount: bigint): Promise<bigint> {
    const current = this.spends.get(mandateId) ?? 0n;
    const updated = current + amount;
    this.spends.set(mandateId, updated);
    return updated;
  }

  async getMandate(mandateId: string): Promise<SignedMandate | null> {
    return this.mandates.get(mandateId) ?? null;
  }

  async getMandateByHash(mandateHash: string): Promise<SignedMandate | null> {
    const mandateId = this.mandateHashes.get(mandateHash);
    if (!mandateId) return null;
    return this.getMandate(mandateId);
  }

  async saveMandate(mandate: SignedMandate): Promise<void> {
    this.mandates.set(mandate.mandateId, mandate);
    if (mandate.mandateHash) {
      this.mandateHashes.set(mandate.mandateHash, mandate.mandateId);
    }
  }

  async revokeMandate(mandateId: string, reason?: string): Promise<void> {
    const existing = this.mandates.get(mandateId);
    if (existing) {
      existing.revoked = true;
      existing.revokedAt = Date.now();
      existing.revokedReason = reason ?? 'Operator revocation';
      this.mandates.set(mandateId, existing);
    }
  }

  async listMandates(filter?: MandateFilter): Promise<SignedMandate[]> {
    let list = Array.from(this.mandates.values());
    if (filter?.sessionId) {
      list = list.filter((m) => m.sessionId === filter.sessionId);
    }
    if (filter?.operatorPubkey) {
      list = list.filter((m) => m.operatorPubkey === filter.operatorPubkey);
    }
    if (filter?.agentPubkey) {
      list = list.filter((m) => m.agentPubkey === filter.agentPubkey);
    }
    if (filter?.revoked !== undefined) {
      list = list.filter((m) => Boolean(m.revoked) === filter.revoked);
    }
    if (filter?.activeOnly) {
      const now = Date.now();
      list = list.filter((m) => !m.revoked && m.expiresAt > now);
    }
    return list.sort((a, b) => b.validFrom - a.validFrom);
  }

  async saveReceipt(receipt: SignedReceipt): Promise<void> {
    this.receipts.set(receipt.receiptId, receipt);
  }

  async getReceipt(receiptId: string): Promise<SignedReceipt | null> {
    return this.receipts.get(receiptId) ?? null;
  }

  async listReceipts(filter?: ReceiptFilter): Promise<SignedReceipt[]> {
    let list = Array.from(this.receipts.values());
    if (filter?.sessionId) {
      list = list.filter((r) => r.sessionId === filter.sessionId);
    }
    if (filter?.agentPubkey) {
      list = list.filter((r) => r.agentPubkey === filter.agentPubkey);
    }
    if (filter?.merchantPubkey) {
      list = list.filter((r) => r.merchantPubkey === filter.merchantPubkey);
    }
    if (filter?.decision) {
      list = list.filter((r) => r.decision === filter.decision);
    }
    return list.sort((a, b) => b.issuedAt - a.issuedAt);
  }

  async saveAuditEvent(event: AuditEvent): Promise<void> {
    this.auditEvents.push(event);
  }

  async listAuditEvents(filter?: { entityId?: string }): Promise<AuditEvent[]> {
    let list = [...this.auditEvents];
    if (filter?.entityId) {
      list = list.filter((e) => e.entityId === filter.entityId);
    }
    return list.reverse().sort((a, b) => b.timestamp - a.timestamp);
  }

  clear(): void {
    this.nonces.clear();
    this.spends.clear();
    this.mandates.clear();
    this.mandateHashes.clear();
    this.receipts.clear();
    this.auditEvents = [];
  }
}

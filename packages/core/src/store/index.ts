import { SignedMandate } from '../mandate.js';
import { SignedReceipt } from '../receipt.js';

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
  saveMandate(mandate: SignedMandate): Promise<void>;
  revokeMandate(mandateId: string, reason?: string): Promise<void>;

  saveReceipt(receipt: SignedReceipt): Promise<void>;
  getReceipt(receiptId: string): Promise<SignedReceipt | null>;
}

/**
 * In-Memory Store for unit tests, local development, and embedded runtimes.
 * Fully thread-safe / event-loop atomic for JavaScript concurrency.
 */
export class MemoryStore implements ICredaverStore {
  private nonces = new Map<string, number>(); // nonce -> expiryMs
  private spends = new Map<string, bigint>();
  private mandates = new Map<string, SignedMandate>();
  private receipts = new Map<string, SignedReceipt>();

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

  async saveMandate(mandate: SignedMandate): Promise<void> {
    this.mandates.set(mandate.mandateId, mandate);
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

  async saveReceipt(receipt: SignedReceipt): Promise<void> {
    this.receipts.set(receipt.receiptId, receipt);
  }

  async getReceipt(receiptId: string): Promise<SignedReceipt | null> {
    return this.receipts.get(receiptId) ?? null;
  }

  clear(): void {
    this.nonces.clear();
    this.spends.clear();
    this.mandates.clear();
    this.receipts.clear();
  }
}

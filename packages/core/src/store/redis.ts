import { ICredaverStore, MandateFilter, ReceiptFilter, AuditEvent } from './index.js';
import { SignedMandate } from '../mandate.js';
import { SignedReceipt } from '../receipt.js';

export interface RedisCredentials {
  url: string;
  token: string;
}

function getCredentials(config?: Partial<RedisCredentials>): RedisCredentials {
  const url = config?.url ?? process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = config?.token ?? process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Upstash Redis credentials (KV_REST_API_URL, KV_REST_API_TOKEN) are not configured.');
  }

  return { url, token };
}

/**
 * Executes a raw Redis command array over the Upstash REST interface.
 * Adapted from VeriqoMesh apps/web/src/lib/redis.ts (Commit 3540f9d).
 */
export async function redisCommand<T = unknown>(
  command: (string | number)[],
  config?: Partial<RedisCredentials>
): Promise<T> {
  const { url, token } = getCredentials(config);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Redis REST error (${res.status}): ${errorText}`);
  }

  const json = (await res.json()) as { error?: string; result?: unknown };
  if (json.error) {
    throw new Error(`Redis command error: ${json.error}`);
  }

  return json.result as T;
}

/**
 * ATOMIC SET NX EX PRIMITIVE
 * Executes 'SET key value NX EX ttlSeconds'.
 *
 * In Redis semantics:
 * - If key did NOT exist, sets the key and returns 'OK'.
 * - If key ALREADY existed, returns null (command is a no-op).
 *
 * This provides guaranteed single-operation atomic check-and-set,
 * preventing race conditions between concurrent requests with identical nonces.
 */
export async function redisSetNX(
  key: string,
  value: unknown,
  ttlSeconds: number,
  config?: Partial<RedisCredentials>
): Promise<boolean> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const result = await redisCommand<string | null>(['SET', key, serialized, 'NX', 'EX', ttlSeconds], config);
  return result === 'OK';
}

export async function redisGet<T = unknown>(key: string, config?: Partial<RedisCredentials>): Promise<T | null> {
  const raw = await redisCommand<string | null>(['GET', key], config);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 30 * 86400,
  config?: Partial<RedisCredentials>
): Promise<boolean> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const args: (string | number)[] = ['SET', key, serialized];
  if (ttlSeconds > 0) {
    args.push('EX', ttlSeconds);
  }
  const result = await redisCommand<string>(args, config);
  return result === 'OK';
}

export async function redisDel(key: string, config?: Partial<RedisCredentials>): Promise<boolean> {
  const count = await redisCommand<number>(['DEL', key], config);
  return count > 0;
}

/**
 * Redis implementation of ICredaverStore using Upstash REST client
 * with atomic SET NX EX replay protection.
 */
export class RedisStore implements ICredaverStore {
  constructor(private config?: Partial<RedisCredentials>) {}

  async consumeNonce(nonce: string, ttlSeconds: number): Promise<boolean> {
    const key = `credav:nonce:${nonce}`;
    return redisSetNX(key, 'consumed', ttlSeconds, this.config);
  }

  async getMandateSpend(mandateId: string): Promise<bigint> {
    const val = await redisGet<string>(`credav:spend:${mandateId}`, this.config);
    return val ? BigInt(val) : 0n;
  }

  async recordMandateSpend(mandateId: string, amount: bigint): Promise<bigint> {
    const key = `credav:spend:${mandateId}`;
    const current = await this.getMandateSpend(mandateId);
    const updated = current + amount;
    await redisSet(key, updated.toString(), 365 * 86400, this.config);
    return updated;
  }

  async getMandate(mandateId: string): Promise<SignedMandate | null> {
    return redisGet<SignedMandate>(`credav:mandate:${mandateId}`, this.config);
  }

  async saveMandate(mandate: SignedMandate): Promise<void> {
    await redisSet(`credav:mandate:${mandate.mandateId}`, mandate, 365 * 86400, this.config);
    await redisCommand(['SADD', 'credav:mandates:all', mandate.mandateId], this.config);
  }

  async revokeMandate(mandateId: string, reason?: string): Promise<void> {
    const mandate = await this.getMandate(mandateId);
    if (mandate) {
      mandate.revoked = true;
      mandate.revokedAt = Date.now();
      mandate.revokedReason = reason ?? 'Operator revocation';
      await this.saveMandate(mandate);
    }
  }

  async listMandates(filter?: MandateFilter): Promise<SignedMandate[]> {
    const ids = (await redisCommand<string[]>(['SMEMBERS', 'credav:mandates:all'], this.config)) || [];
    const list: SignedMandate[] = [];
    for (const id of ids) {
      const m = await this.getMandate(id);
      if (m) list.push(m);
    }
    let filtered = list;
    if (filter?.operatorPubkey) {
      filtered = filtered.filter((m) => m.operatorPubkey === filter.operatorPubkey);
    }
    if (filter?.agentPubkey) {
      filtered = filtered.filter((m) => m.agentPubkey === filter.agentPubkey);
    }
    if (filter?.revoked !== undefined) {
      filtered = filtered.filter((m) => Boolean(m.revoked) === filter.revoked);
    }
    return filtered.sort((a, b) => b.validFrom - a.validFrom);
  }

  async saveReceipt(receipt: SignedReceipt): Promise<void> {
    await redisSet(`credav:receipt:${receipt.receiptId}`, receipt, 365 * 86400, this.config);
    await redisCommand(['SADD', 'credav:receipts:all', receipt.receiptId], this.config);
  }

  async getReceipt(receiptId: string): Promise<SignedReceipt | null> {
    return redisGet<SignedReceipt>(`credav:receipt:${receiptId}`, this.config);
  }

  async listReceipts(filter?: ReceiptFilter): Promise<SignedReceipt[]> {
    const ids = (await redisCommand<string[]>(['SMEMBERS', 'credav:receipts:all'], this.config)) || [];
    const list: SignedReceipt[] = [];
    for (const id of ids) {
      const r = await this.getReceipt(id);
      if (r) list.push(r);
    }
    let filtered = list;
    if (filter?.agentPubkey) {
      filtered = filtered.filter((r) => r.agentPubkey === filter.agentPubkey);
    }
    if (filter?.merchantPubkey) {
      filtered = filtered.filter((r) => r.merchantPubkey === filter.merchantPubkey);
    }
    if (filter?.decision) {
      filtered = filtered.filter((r) => r.decision === filter.decision);
    }
    return filtered.sort((a, b) => b.issuedAt - a.issuedAt);
  }

  async saveAuditEvent(event: AuditEvent): Promise<void> {
    await redisSet(`credav:audit:${event.eventId}`, event, 365 * 86400, this.config);
    await redisCommand(['RPUSH', 'credav:audit:all', event.eventId], this.config);
  }

  async listAuditEvents(filter?: { entityId?: string }): Promise<AuditEvent[]> {
    const ids = (await redisCommand<string[]>(['LRANGE', 'credav:audit:all', 0, -1], this.config)) || [];
    const list: AuditEvent[] = [];
    for (const id of ids) {
      const e = await redisGet<AuditEvent>(`credav:audit:${id}`, this.config);
      if (e) list.push(e);
    }
    let filtered = list;
    if (filter?.entityId) {
      filtered = filtered.filter((e) => e.entityId === filter.entityId);
    }
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }
}

export { RedisStore as UpstashRedisStore };

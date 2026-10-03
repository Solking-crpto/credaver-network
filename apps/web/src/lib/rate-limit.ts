import { redisCommand, redisSetNX } from '@credaver/core';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Reset all in-memory rate limits (primarily for unit testing)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Clean up expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000).unref?.();

export interface RedisRateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  message?: string;
  resetInSeconds?: number;
}

/**
 * Redis-backed atomic rate limiter using SET NX / INCR with TTL.
 * Enforces global and per-IP caps. Fails closed in production.
 */
export async function checkRedisRateLimit(
  key: string,
  limit: number,
  ttlSeconds: number,
  customMessage?: string
): Promise<RedisRateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (redisUrl && redisToken) {
    try {
      // 1. SET NX: atomic initialize if not exists
      const setNxOk = await redisSetNX(key, '1', ttlSeconds, { url: redisUrl, token: redisToken });
      let current = 1;
      if (!setNxOk) {
        // Key already exists, increment atomically
        current = await redisCommand<number>(['INCR', key], { url: redisUrl, token: redisToken });
      }

      if (current > limit) {
        return {
          allowed: false,
          current,
          limit,
          message:
            customMessage ||
            `Rate limit exceeded (${current}/${limit}). Please wait before trying again.`,
        };
      }

      return { allowed: true, current, limit };
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        // Fail closed in production
        return {
          allowed: false,
          current: limit + 1,
          limit,
          message: `Rate limiter unavailable in production: ${err.message}`,
        };
      }
      // Fall through to in-memory in dev/test
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Fail closed in production without Redis credentials
    return {
      allowed: false,
      current: limit + 1,
      limit,
      message: 'Rate limiting requires Redis credentials in production.',
    };
  }

  // In-memory fallback for non-production environments
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + ttlSeconds * 1000,
    });
    return { allowed: true, current: 1, limit };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      current: existing.count,
      limit,
      message:
        customMessage ||
        `Rate limit exceeded (${existing.count}/${limit}). Please wait before trying again.`,
      resetInSeconds: Math.ceil((existing.resetTime - now) / 1000),
    };
  }

  return { allowed: true, current: existing.count, limit };
}

/**
 * Check and record a rate limit hit for a given key.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 30 }
): {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      reset: now + options.windowMs,
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      reset: existing.resetTime,
    };
  }

  existing.count += 1;
  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - existing.count,
    reset: existing.resetTime,
  };
}

/**
 * Extract client IP identifier from request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

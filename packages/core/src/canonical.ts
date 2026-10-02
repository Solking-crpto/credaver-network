import canonicalizeFn from 'canonicalize';
import { createHash } from 'node:crypto';

// Handle CJS / ESM default export interop under NodeNext resolution
const canonicalize: (input: unknown) => string | undefined =
  typeof canonicalizeFn === 'function' ? canonicalizeFn : (canonicalizeFn as any).default;

/**
 * Deterministic RFC 8785 (JSON Canonicalization Scheme - JCS) serialization.
 *
 * Guarantees:
 * - Deterministic property key sorting in UTF-16 code point order.
 * - Whitespace removal outside strings.
 * - Deterministic float and integer serialization per IEEE 754.
 * - Strict unicode escaping.
 */
export function canonicalizeJson(obj: unknown): string {
  const canonical = canonicalize(obj);
  if (canonical === undefined) {
    throw new Error('Failed to canonicalize object: undefined is not valid JSON');
  }
  return canonical;
}

/**
 * Computes deterministic SHA-256 hex digest of any serializable object
 * using RFC 8785 canonicalization.
 */
export function hashCanonicalJson(obj: unknown): string {
  const canonicalStr = canonicalizeJson(obj);
  return createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
}

/**
 * Computes deterministic SHA-256 hex digest of raw bytes or string.
 */
export function hashBytes(data: Uint8Array | string): string {
  const hash = createHash('sha256');
  if (typeof data === 'string') {
    hash.update(data, 'utf8');
  } else {
    hash.update(data);
  }
  return hash.digest('hex');
}

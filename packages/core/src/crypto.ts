import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
  KeyObject,
} from 'node:crypto';

// Standard Bitcoin/Solana Base58 Alphabet
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  MAP[ALPHABET[i]] = i;
}

// SPKI header for 32-byte Ed25519 public keys: 302a300506032b6570032100
const ED25519_SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex');
// PKCS#8 header for 32-byte Ed25519 private seeds: 302e020100300506032b657004220420
const ED25519_PKCS8_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Encodes a Uint8Array into a Base58 string.
 */
export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str += '1';
  for (let i = digits.length - 1; i >= 0; i--) str += ALPHABET[digits[i]];
  return str;
}

/**
 * Decodes a Base58 string into a Uint8Array.
 */
export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  const bytes: number[] = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (!(c in MAP)) {
      throw new Error(`Invalid Base58 character: ${c}`);
    }
    for (let j = 0; j < bytes.length; j++) bytes[j] *= 58;
    bytes[0] += MAP[c];
    let carry = 0;
    for (let j = 0; j < bytes.length; ++j) {
      bytes[j] += carry;
      carry = bytes[j] >> 8;
      bytes[j] &= 0xff;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

/**
 * Creates a Node.js KeyObject from a raw 32-byte Ed25519 public key.
 */
export function createPublicKeyFromRaw(rawPubkey: Uint8Array): KeyObject {
  if (rawPubkey.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: expected 32 bytes, got ${rawPubkey.length}`);
  }
  const spki = Buffer.concat([ED25519_SPKI_HEADER, Buffer.from(rawPubkey)]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

/**
 * Creates a Node.js KeyObject from a raw 32-byte Ed25519 private seed.
 */
export function createPrivateKeyFromRaw(rawPrivkey: Uint8Array): KeyObject {
  if (rawPrivkey.length !== 32 && rawPrivkey.length !== 64) {
    throw new Error(`Invalid Ed25519 private key length: expected 32 or 64 bytes, got ${rawPrivkey.length}`);
  }
  const seed = rawPrivkey.slice(0, 32);
  const pkcs8 = Buffer.concat([ED25519_PKCS8_HEADER, Buffer.from(seed)]);
  return createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
}

export interface Ed25519Keypair {
  publicKey: string; // Base58 encoded (Solana address format)
  secretKey: string; // Base58 encoded 64-byte or 32-byte seed
  publicKeyBytes: Uint8Array;
  secretKeyBytes: Uint8Array;
}

/**
 * Generates an Ed25519 keypair for testing or throwaway devnet agents.
 */
export function generateEd25519Keypair(): Ed25519Keypair {
  const seed = randomBytes(32);
  const privKey = createPrivateKeyFromRaw(seed);
  const pubKey = createPublicKey(privKey);
  const spkiDer = pubKey.export({ format: 'der', type: 'spki' });
  const pubBytes = new Uint8Array(spkiDer.subarray(12)); // Raw 32 bytes after SPKI header

  // Standard Solana secretKey format is 64 bytes (seed + pubBytes)
  const fullSecretBytes = new Uint8Array(64);
  fullSecretBytes.set(seed, 0);
  fullSecretBytes.set(pubBytes, 32);

  return {
    publicKey: encodeBase58(pubBytes),
    secretKey: encodeBase58(fullSecretBytes),
    publicKeyBytes: pubBytes,
    secretKeyBytes: fullSecretBytes,
  };
}

/**
 * Signs a message using an Ed25519 private key.
 * Accepts string or Uint8Array message, and Base58 string or Uint8Array secret key.
 * Returns Base58 encoded 64-byte signature.
 */
export function signEd25519(
  message: Uint8Array | string,
  secretKey: Uint8Array | string
): string {
  const msgBytes = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);
  const privBytes = typeof secretKey === 'string' ? decodeBase58(secretKey) : secretKey;
  const privKey = createPrivateKeyFromRaw(privBytes.slice(0, 32));
  const sig = sign(null, msgBytes, privKey);
  return encodeBase58(new Uint8Array(sig));
}

/**
 * Verifies an Ed25519 signature against a public key.
 */
export function verifyEd25519(
  message: Uint8Array | string,
  signature: string | Uint8Array,
  publicKey: string | Uint8Array
): boolean {
  try {
    const msgBytes = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message);
    const sigBytes = typeof signature === 'string' ? decodeBase58(signature) : signature;
    const pubBytes = typeof publicKey === 'string' ? decodeBase58(publicKey) : publicKey;

    if (pubBytes.length !== 32 || sigBytes.length !== 64) {
      return false;
    }

    const pubKey = createPublicKeyFromRaw(pubBytes);
    return verify(null, msgBytes, pubKey, Buffer.from(sigBytes));
  } catch {
    return false;
  }
}

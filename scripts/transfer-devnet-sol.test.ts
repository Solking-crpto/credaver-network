import { describe, it, expect } from 'vitest';
import {
  validateTransferArgs,
  MAX_TRANSFER_SOL,
  MIN_RESERVE_SOL,
  LAMPORTS_PER_SOL,
} from './transfer-devnet-sol';
import { generateEd25519Keypair } from '../packages/core/src/index.js';

describe('scripts/transfer-devnet-sol: Argument and Safety Rule Validation', () => {
  const sender = generateEd25519Keypair();
  const recipient = generateEd25519Keypair();

  it('1. Rejects missing destination address', () => {
    expect(() =>
      validateTransferArgs({
        destination: '',
        amountStr: '0.1',
      })
    ).toThrow(/Missing destination address/);
  });

  it('2. Rejects invalid base58 or incorrect length destination address', () => {
    // Too short (not 32 bytes)
    expect(() =>
      validateTransferArgs({
        destination: '123456789',
        amountStr: '0.1',
      })
    ).toThrow(/Invalid destination/);

    // Invalid base58 characters (0, O, I, l)
    expect(() =>
      validateTransferArgs({
        destination: '0OIlInvalidBase58Pubkey1111111111111111111111111',
        amountStr: '0.1',
      })
    ).toThrow(/Invalid destination base58/);
  });

  it('3. Rejects self-transfer to sender address', () => {
    expect(() =>
      validateTransferArgs({
        destination: sender.publicKey,
        amountStr: '0.1',
        senderPubkey: sender.publicKey,
      })
    ).toThrow(/Self-transfer is not permitted/);
  });

  it('4. Rejects missing, NaN, or non-positive transfer amounts', () => {
    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '',
      })
    ).toThrow(/Missing transfer amount/);

    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: 'abc',
      })
    ).toThrow(/must be a positive number/);

    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '-0.5',
      })
    ).toThrow(/must be a positive number/);

    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '0',
      })
    ).toThrow(/must be a positive number/);
  });

  it('5. Enforces safety cap of 0.5 SOL per run', () => {
    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '0.51',
      })
    ).toThrow(/exceeds maximum per-run safety limit of 0.5 SOL/);

    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '1.0',
      })
    ).toThrow(/exceeds maximum per-run safety limit of 0.5 SOL/);
  });

  it('6. Enforces leaving at least 0.05 SOL reserve in sender wallet', () => {
    // Sender has 0.1 SOL total (100_000_000 lamports)
    // Transferring 0.08 SOL leaves ~0.02 SOL, violating 0.05 SOL reserve
    const senderBalanceLamports = 100_000_000n; // 0.1 SOL

    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '0.08',
        senderPubkey: sender.publicKey,
        senderBalanceLamports,
      })
    ).toThrow(/Safety rule violation: transfer would leave.*At least 0.05 SOL must remain/);
  });

  it('7. Rejects transfer when sender has insufficient funds', () => {
    const senderBalanceLamports = 50_000_000n; // 0.05 SOL
    expect(() =>
      validateTransferArgs({
        destination: recipient.publicKey,
        amountStr: '0.1',
        senderPubkey: sender.publicKey,
        senderBalanceLamports,
      })
    ).toThrow(/Insufficient funds/);
  });

  it('8. Accepts valid transfer parameters and computes correct lamports', () => {
    const senderBalanceLamports = 1_000_000_000n; // 1.0 SOL
    const result = validateTransferArgs({
      destination: recipient.publicKey,
      amountStr: '0.25',
      senderPubkey: sender.publicKey,
      senderBalanceLamports,
    });

    expect(result.destination).toBe(recipient.publicKey);
    expect(result.amountSol).toBe(0.25);
    expect(result.lamports).toBe(250_000_000n);
  });

  it('9. Allows boundary transfer of exactly 0.5 SOL when sender has sufficient reserve', () => {
    const senderBalanceLamports = 600_000_000n; // 0.60 SOL
    const result = validateTransferArgs({
      destination: recipient.publicKey,
      amountStr: '0.5',
      senderPubkey: sender.publicKey,
      senderBalanceLamports,
    });

    expect(result.amountSol).toBe(0.5);
    expect(result.lamports).toBe(500_000_000n);
  });
});

import { describe, it, expect } from 'vitest';
import { generateEd25519Keypair, signEd25519, verifyEd25519 } from '@credaver/core';

describe('S3 Wallet: Phantom Connect & Server-Side Challenge Verification', () => {
  it('1. Generates cryptographic challenge bound to operator wallet', () => {
    const operator = generateEd25519Keypair();
    const nonce = 'rand-nonce-9921';
    const timestamp = Date.now();
    const challenge = `CredaVer Operator Authentication\nWallet: ${operator.publicKey}\nNonce: ${nonce}\nTimestamp: ${timestamp}\nTarget: colosseum-hackathon-devnet`;

    expect(challenge).toContain(operator.publicKey);
    expect(challenge).toContain(nonce);
  });

  it('2. Signs challenge with Ed25519 wallet key and verifies successfully server-side', () => {
    const operator = generateEd25519Keypair();
    const challenge = `CredaVer Operator Authentication\nWallet: ${operator.publicKey}\nNonce: test-nonce\nTimestamp: ${Date.now()}`;

    // Wallet signs challenge bytes
    const challengeBytes = Buffer.from(challenge, 'utf8');
    const signature = signEd25519(challengeBytes, operator.secretKey);

    // Server verifies signature against operator public key
    const isValid = verifyEd25519(challengeBytes, signature, operator.publicKey);
    expect(isValid).toBe(true);
  });

  it('3. Rejects challenge signed by an unauthorized keypair', () => {
    const legitimateOperator = generateEd25519Keypair();
    const attacker = generateEd25519Keypair();

    const challenge = `CredaVer Operator Authentication\nWallet: ${legitimateOperator.publicKey}\nNonce: test-nonce\nTimestamp: ${Date.now()}`;
    const challengeBytes = Buffer.from(challenge, 'utf8');

    // Attacker attempts to sign challenge claiming legitimateOperator's pubkey
    const imposterSig = signEd25519(challengeBytes, attacker.secretKey);

    // Server verification against legitimateOperator fails
    const isValid = verifyEd25519(challengeBytes, imposterSig, legitimateOperator.publicKey);
    expect(isValid).toBe(false);
  });

  it('4. Rejects tampered challenge message', () => {
    const operator = generateEd25519Keypair();
    const challenge = `CredaVer Operator Authentication\nWallet: ${operator.publicKey}\nNonce: nonce-1`;
    const sig = signEd25519(challenge, operator.secretKey);

    // Attacker attempts to replay signature against a modified challenge with different nonce
    const tampered = `CredaVer Operator Authentication\nWallet: ${operator.publicKey}\nNonce: nonce-2`;
    const isValid = verifyEd25519(tampered, sig, operator.publicKey);
    expect(isValid).toBe(false);
  });
});

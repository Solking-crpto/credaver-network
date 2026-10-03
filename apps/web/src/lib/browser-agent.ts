'use client';

import { generateKeyPairSigner, getBase58Decoder } from '@solana/kit';

export interface InMemoryAgent {
  agentPubkey: string;
  signBytes: (bytes: Uint8Array) => Promise<string>;
}

/**
 * Creates an ephemeral, in-browser Ed25519 agent keypair using Web Crypto subtle via @solana/kit.
 * The private key is held strictly in browser JavaScript memory and is never persisted or transmitted.
 */
export async function createInMemoryAgent(): Promise<InMemoryAgent> {
  const signer = await generateKeyPairSigner();
  const decoder = getBase58Decoder();

  return {
    agentPubkey: signer.address,
    signBytes: async (bytes: Uint8Array) => {
      const [signedMessage] = await signer.signMessages([
        { content: bytes, signatures: {} } as any,
      ]);
      const sigBytes = (signedMessage as any)[signer.address];
      return decoder.decode(sigBytes);
    },
  };
}

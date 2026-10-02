import {
  SignedMandate,
  SignedPaymentProof,
  createSignedPaymentProof,
  PaymentProofCore,
  decodeBase58,
  SignResult,
  ReasonCodeType,
  SignedReceipt,
} from '@credaver/core';

export class CredaverSignatureDeniedError extends Error {
  public readonly reasonCodes: ReasonCodeType[];
  public readonly receipt: SignedReceipt;

  constructor(reasonCodes: ReasonCodeType[], receipt: SignedReceipt) {
    super(`CredaVer Denied Transaction Signature: [${reasonCodes.join(', ')}]`);
    this.name = 'CredaverSignatureDeniedError';
    this.reasonCodes = reasonCodes;
    this.receipt = receipt;
  }
}

export class CredaverSignatureReviewRequiredError extends Error {
  public readonly reasonCodes: ReasonCodeType[];
  public readonly receipt: SignedReceipt;

  constructor(reasonCodes: ReasonCodeType[], receipt: SignedReceipt) {
    super(`CredaVer Signature Held for Human Review: [${reasonCodes.join(', ')}]`);
    this.name = 'CredaverSignatureReviewRequiredError';
    this.reasonCodes = reasonCodes;
    this.receipt = receipt;
  }
}

export interface PaymentIntentContext {
  merchantPubkey: string;
  asset: string;
  amount: string;
  audience: string;
  nonce?: string;
}

export interface CredaverConstrainedSignerConfig {
  fundingAddress: string;
  mandate: SignedMandate;
  agentSecretKey: string | Uint8Array;
  signEndpoint?: string;
  localSignerDelegate?: (params: {
    mandate: SignedMandate;
    proof: SignedPaymentProof;
    transactionMessageBytes: Uint8Array;
  }) => Promise<SignResult>;
}

/**
 * Custom Solana Transaction Signer for Autonomous Agents.
 *
 * Security Model:
 * - The agent holds ZERO private keys for the funding wallet.
 * - The agent only holds its own identity key (agentSecretKey).
 * - All transaction signing requests are sent to CredaVer (POST /api/sign).
 * - CredaVer checks policy deterministically and only signs if ALLOW.
 */
export class CredaverConstrainedSigner {
  public readonly address: string;
  private mandate: SignedMandate;
  private agentSecretKey: string | Uint8Array;
  private signEndpoint?: string;
  private localSignerDelegate?: CredaverConstrainedSignerConfig['localSignerDelegate'];
  private currentContext?: PaymentIntentContext;
  private lastReceipt?: SignedReceipt;

  constructor(config: CredaverConstrainedSignerConfig) {
    this.address = config.fundingAddress;
    this.mandate = config.mandate;
    this.agentSecretKey = config.agentSecretKey;
    this.signEndpoint = config.signEndpoint;
    this.localSignerDelegate = config.localSignerDelegate;
  }

  /**
   * Sets the contextual payment requirements (merchant, asset, amount, audience).
   */
  setContext(context: PaymentIntentContext): this {
    this.currentContext = context;
    return this;
  }

  /**
   * Returns the most recent audit receipt from CredaVer.
   */
  getLastReceipt(): SignedReceipt | undefined {
    return this.lastReceipt;
  }

  /**
   * Implements the @solana/kit signTransactions interface.
   * Invoked by partiallySignTransactionMessageWithSigners().
   */
  async signTransactions(
    transactions: readonly { messageBytes: Uint8Array; signatures?: Record<string, Uint8Array | null> }[]
  ): Promise<readonly Record<string, Uint8Array>[]> {
    if (!this.currentContext) {
      throw new Error(
        'CredaverConstrainedSigner requires payment context before signing. Call setContext() first.'
      );
    }

    const results: Record<string, Uint8Array>[] = [];

    for (const tx of transactions) {
      const now = Date.now();
      const nonce =
        this.currentContext.nonce ?? `nonce-${now}-${Math.random().toString(36).slice(2, 10)}`;

      // 1. Agent signs proof-of-intent with its own identity key
      const proofCore: PaymentProofCore = {
        mandateHash: this.mandate.mandateHash,
        agentPubkey: this.mandate.agentPubkey,
        merchantPubkey: this.currentContext.merchantPubkey,
        asset: this.currentContext.asset,
        amount: this.currentContext.amount,
        audience: this.currentContext.audience,
        network: this.mandate.network,
        nonce,
        timestamp: now,
        expiresAt: now + 300000,
      };

      const signedProof = createSignedPaymentProof(proofCore, this.agentSecretKey);

      // 2. Call CredaVer signing service (remote or local delegate)
      let signResult: SignResult;

      if (this.localSignerDelegate) {
        signResult = await this.localSignerDelegate({
          mandate: this.mandate,
          proof: signedProof,
          transactionMessageBytes: tx.messageBytes,
        });
      } else if (this.signEndpoint) {
        const res = await fetch(this.signEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mandateHash: this.mandate.mandateHash,
            proof: signedProof,
            transactionMessageBytes: Buffer.from(tx.messageBytes).toString('base64'),
            mandate: this.mandate,
          }),
        });

        const data = await res.json();
        signResult = data as SignResult;
      } else {
        throw new Error(
          'CredaverConstrainedSigner must be configured with either signEndpoint or localSignerDelegate'
        );
      }

      this.lastReceipt = signResult.receipt;

      // 3. Handle policy outcome
      if (signResult.decision === 'ALLOW') {
        const sigBytes =
          signResult.signatureBytes instanceof Uint8Array
            ? signResult.signatureBytes
            : decodeBase58(signResult.signature);

        results.push(Object.freeze({ [this.address]: sigBytes }));
      } else if (signResult.decision === 'REVIEW') {
        throw new CredaverSignatureReviewRequiredError(
          signResult.reasonCodes,
          signResult.receipt
        );
      } else {
        throw new CredaverSignatureDeniedError(
          signResult.reasonCodes,
          signResult.receipt
        );
      }
    }

    return results;
  }
}

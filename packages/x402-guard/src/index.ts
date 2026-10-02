import type { PaymentPolicy } from '@x402/core/client';
import type { PaymentRequirements } from '@x402/core/types';
import {
  SignedMandate,
  PaymentProofCore,
  createSignedPaymentProof,
  evaluatePaymentPolicy,
  issueSignedReceipt,
  SignedReceipt,
  ICredaverStore,
  MemoryStore,
  ReasonCode,
} from '@credaver/core';

export interface CredaverGuardConfig {
  mandate: SignedMandate;
  agentSecretKey: string | Uint8Array;
  store: ICredaverStore;
  authoritySecretKey?: string | Uint8Array;
  authorityPubkey?: string;
  audienceUrl?: string;
}

/**
 * Creates an x402-compliant PaymentPolicy for x402Client.registerPolicy().
 *
 * Enforces:
 * - Network match (e.g. solana:devnet)
 * - Asset allowlist
 * - Merchant (payTo) allowlist
 * - Max amount per payment
 *
 * If a requirement violates mandate constraints, it is filtered out.
 * If all requirements are filtered out, x402Client halts payment safely.
 */
export function createCredaverClientPolicy(mandate: SignedMandate): PaymentPolicy {
  return (_version: number, requirements: PaymentRequirements[]): PaymentRequirements[] => {
    return requirements.filter((req) => {
      // 1. Check network
      if (req.network && req.network !== mandate.network) {
        return false;
      }

      // 2. Check merchant (payTo)
      if (
        !mandate.allowedMerchants.includes('*') &&
        req.payTo &&
        !mandate.allowedMerchants.includes(req.payTo)
      ) {
        return false;
      }

      // 3. Check asset
      if (req.asset) {
        const isAssetAllowed =
          mandate.allowedAssets.includes('*') ||
          mandate.allowedAssets.includes(req.asset) ||
          mandate.allowedAssets.map((a) => a.toLowerCase()).includes(req.asset.toLowerCase());
        if (!isAssetAllowed) {
          return false;
        }
      }

      // 4. Check maxPerTx amount
      if (req.amount) {
        try {
          const reqAmount = BigInt(req.amount);
          const maxAmount = BigInt(mandate.maxPerTx);
          if (reqAmount > maxAmount) {
            return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    });
  };
}

/**
 * Comprehensive CredaVer Guard for autonomous agents.
 * Integrates policy evaluation, proof generation, and receipt anchoring.
 */
export class CredaverAgentGuard {
  private mandate: SignedMandate;
  private agentSecretKey: string | Uint8Array;
  private store: ICredaverStore;
  private authoritySecretKey?: string | Uint8Array;
  private authorityPubkey: string;

  constructor(config: CredaverGuardConfig) {
    this.mandate = config.mandate;
    this.agentSecretKey = config.agentSecretKey;
    this.store = config.store;
    this.authoritySecretKey = config.authoritySecretKey;
    this.authorityPubkey = config.authorityPubkey ?? config.mandate.operatorPubkey;
  }

  /**
   * Pre-authorizes an impending x402 payment attempt against the Mandate.
   * Returns the decision and a signed verifiable receipt.
   */
  async preAuthorizePayment(params: {
    merchantPubkey: string;
    asset: string;
    amount: string;
    audience: string;
    nonce?: string;
  }): Promise<{
    allowed: boolean;
    decision: 'ALLOW' | 'DENY' | 'REVIEW';
    reasonCodes: string[];
    receipt: SignedReceipt;
  }> {
    const now = Date.now();
    const nonce = params.nonce ?? `nonce-${now}-${Math.random().toString(36).slice(2, 10)}`;

    const proofCore: PaymentProofCore = {
      mandateHash: this.mandate.mandateHash,
      agentPubkey: this.mandate.agentPubkey,
      merchantPubkey: params.merchantPubkey,
      asset: params.asset,
      amount: params.amount,
      audience: params.audience,
      network: this.mandate.network,
      nonce,
      timestamp: now,
      expiresAt: now + 300000, // 5 min validity window
    };

    const signedProof = createSignedPaymentProof(proofCore, this.agentSecretKey);
    const evalResult = await evaluatePaymentPolicy(this.mandate, signedProof, this.store);

    // Issue receipt
    const receiptBody = {
      receiptId: `rcpt-${now}-${Math.random().toString(36).slice(2, 8)}`,
      mandateHash: this.mandate.mandateHash,
      agentPubkey: this.mandate.agentPubkey,
      merchantPubkey: params.merchantPubkey,
      asset: params.asset,
      amount: params.amount,
      network: this.mandate.network,
      nonce,
      decision: evalResult.decision,
      reasonCodes: evalResult.reasonCodes,
      policyVersion: 'credav-v1.0',
      issuedAt: now,
      authorityPubkey: this.authorityPubkey,
    };

    const signingKey = this.authoritySecretKey ?? this.agentSecretKey;
    const signedReceipt = issueSignedReceipt(receiptBody, signingKey);

    await this.store.saveReceipt(signedReceipt);

    if (evalResult.decision === 'ALLOW') {
      await this.store.recordMandateSpend(this.mandate.mandateId, BigInt(params.amount));
    }

    return {
      allowed: evalResult.decision === 'ALLOW',
      decision: evalResult.decision,
      reasonCodes: evalResult.reasonCodes,
      receipt: signedReceipt,
    };
  }

  /**
   * Returns the x402 client policy to be registered in x402Client
   */
  getPolicy(): PaymentPolicy {
    return createCredaverClientPolicy(this.mandate);
  }
}

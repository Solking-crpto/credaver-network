import { NextRequest, NextResponse } from 'next/server';
import { getServerStore, getServerPayerKeypair } from '../../../lib/server-state';
import {
  ReasonCode,
  issueSignedReceipt,
  createPrivateKeyFromRaw,
  decodeBase58,
  encodeBase58,
} from '@credaver/core';
import { sign } from 'node:crypto';

export async function GET() {
  try {
    const store = getServerStore();
    const allReceipts = await store.listReceipts();
    const reviews = allReceipts.filter((r) => r.decision === 'REVIEW');

    return NextResponse.json({
      count: reviews.length,
      reviews,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'FAILED_TO_LIST_REVIEWS', message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { receiptId, action, reviewerPubkey, reason } = body;

    if (!receiptId || !action || (action !== 'APPROVE' && action !== 'REJECT')) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Specify receiptId and action ("APPROVE" or "REJECT")' },
        { status: 400 }
      );
    }

    const store = getServerStore();
    const receipt = await store.getReceipt(receiptId);

    if (!receipt) {
      return NextResponse.json(
        { error: 'RECEIPT_NOT_FOUND', message: `Receipt ${receiptId} not found` },
        { status: 404 }
      );
    }

    const payerKeypair = getServerPayerKeypair();

    if (action === 'APPROVE') {
      // 1. Record cumulative spend for approved amount
      const mandate = await store.getMandate(receipt.mandateHash);
      if (mandate) {
        await store.recordMandateSpend(mandate.mandateId, BigInt(receipt.amount));
      }

      // 2. Sign transaction message with custody payment key
      const mockMsgBytes = Buffer.from('mock-approved-tx-message');
      const privBytes = decodeBase58(payerKeypair.secretKey);
      const privKey = createPrivateKeyFromRaw(privBytes.slice(0, 32));
      const sigBuffer = sign(null, mockMsgBytes, privKey);
      const signature = encodeBase58(new Uint8Array(sigBuffer));

      // 3. Issue updated receipt with ALLOW decision
      const updatedBody = {
        receiptId: `rcpt-apprv-${Date.now()}`,
        mandateHash: receipt.mandateHash,
        agentPubkey: receipt.agentPubkey,
        merchantPubkey: receipt.merchantPubkey,
        asset: receipt.asset,
        amount: receipt.amount,
        network: receipt.network,
        nonce: `nonce-apprv-${Date.now()}`,
        decision: 'ALLOW' as const,
        reasonCodes: [ReasonCode.POLICY_PASSED_ALL_GATES],
        policyVersion: receipt.policyVersion,
        issuedAt: Date.now(),
        reviewedBy: reviewerPubkey || 'operator-admin',
        authorityPubkey: payerKeypair.publicKey,
      };

      const approvedReceipt = issueSignedReceipt(updatedBody, payerKeypair.secretKey);
      await store.saveReceipt(approvedReceipt);

      // 4. Save audit event
      await store.saveAuditEvent({
        eventId: `audit-rev-app-${Date.now()}`,
        type: 'REVIEW_APPROVED',
        entityId: receiptId,
        timestamp: Date.now(),
        data: {
          originalReceiptId: receiptId,
          approvedReceiptId: approvedReceipt.receiptId,
          reviewer: reviewerPubkey || 'operator-admin',
          reason: reason || 'Approved by operator console',
        },
      });

      return NextResponse.json({
        action: 'APPROVE',
        originalReceiptId: receiptId,
        decision: 'ALLOW',
        signature,
        receipt: approvedReceipt,
      });
    }

    if (action === 'REJECT') {
      // Issue updated receipt with DENY decision
      const updatedBody = {
        receiptId: `rcpt-rej-${Date.now()}`,
        mandateHash: receipt.mandateHash,
        agentPubkey: receipt.agentPubkey,
        merchantPubkey: receipt.merchantPubkey,
        asset: receipt.asset,
        amount: receipt.amount,
        network: receipt.network,
        nonce: `nonce-rej-${Date.now()}`,
        decision: 'DENY' as const,
        reasonCodes: [ReasonCode.OPERATOR_REJECTED],
        policyVersion: receipt.policyVersion,
        issuedAt: Date.now(),
        reviewedBy: reviewerPubkey || 'operator-admin',
        authorityPubkey: payerKeypair.publicKey,
      };

      const rejectedReceipt = issueSignedReceipt(updatedBody, payerKeypair.secretKey);
      await store.saveReceipt(rejectedReceipt);

      // Save audit event
      await store.saveAuditEvent({
        eventId: `audit-rev-rej-${Date.now()}`,
        type: 'REVIEW_REJECTED',
        entityId: receiptId,
        timestamp: Date.now(),
        data: {
          originalReceiptId: receiptId,
          rejectedReceiptId: rejectedReceipt.receiptId,
          reviewer: reviewerPubkey || 'operator-admin',
          reason: reason || 'Rejected by operator console',
        },
      });

      return NextResponse.json({
        action: 'REJECT',
        originalReceiptId: receiptId,
        decision: 'DENY',
        reasonCodes: [ReasonCode.OPERATOR_REJECTED],
        receipt: rejectedReceipt,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'REVIEW_ACTION_FAILED', message: err.message },
      { status: 500 }
    );
  }
}

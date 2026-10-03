import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCompleteReceipt,
  verifyOnChainMemo,
  SignedReceiptSchema,
  DEFAULT_DEVNET_RPC,
} from '@credaver/core';
import { getServerStore, getServerReceiptAuthorityKeypair } from '../../../lib/server-state';
import { z } from 'zod';

const VerifyQuerySchema = z.object({
  tx: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
});

const VerifyBodySchema = z
  .object({
    receipt: z.any().optional(),
    txSignature: z.string().optional(),
    expectedReceiptHash: z.string().optional(),
    receiptId: z.string().optional(),
  })
  .refine((data) => !!(data.receipt || data.txSignature || data.receiptId), {
    message: 'Provide receipt object, txSignature, or receiptId',
  });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parseResult = VerifyQuerySchema.safeParse({
      tx: searchParams.get('tx') || undefined,
      receiptId: searchParams.get('receiptId') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'INVALID_QUERY', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { tx, receiptId } = parseResult.data;
    const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_DEVNET_RPC;
    const store = getServerStore();

    if (tx) {
      const onChainResult = await verifyOnChainMemo(tx, undefined, rpcUrl);
      let linkedReceipt = null;

      if (onChainResult.isValid && onChainResult.parsedMemo?.receiptHash) {
        // Try finding receipt by hash
        const allReceipts = await store.listReceipts();
        linkedReceipt = allReceipts.find(
          (r) => r.receiptHash === onChainResult.parsedMemo?.receiptHash
        ) || null;
      }

      return NextResponse.json({
        type: 'TRANSACTION',
        onChain: onChainResult,
        linkedReceipt,
      });
    }

    if (receiptId) {
      const receipt = await store.getReceipt(receiptId);
      if (!receipt) {
        return NextResponse.json(
          { error: 'RECEIPT_NOT_FOUND', message: `Receipt ${receiptId} not found in store` },
          { status: 404 }
        );
      }

      const authorityKeypair = getServerReceiptAuthorityKeypair();
      const verification = await verifyCompleteReceipt(receipt, {
        rpcUrl,
        configuredAuthorityPubkey: authorityKeypair.publicKey,
      });
      return NextResponse.json({
        type: 'RECEIPT',
        receipt,
        verification,
      });
    }

    return NextResponse.json(
      { error: 'MISSING_PARAM', message: 'Specify ?tx=<signature> or ?receiptId=<id>' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'VERIFICATION_ERROR', message: err.message || 'Verification failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = VerifyBodySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Provide receipt object, txSignature, or receiptId',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.SOLANA_RPC_URL || DEFAULT_DEVNET_RPC;
    const store = getServerStore();

    // 1. Direct SignedReceipt verification
    if (body.receipt) {
      const parsedReceipt = SignedReceiptSchema.safeParse(body.receipt);
      if (!parsedReceipt.success) {
        return NextResponse.json(
          {
            error: 'INVALID_RECEIPT_SCHEMA',
            details: parsedReceipt.error.format(),
          },
          { status: 400 }
        );
      }

      const authorityKeypair = getServerReceiptAuthorityKeypair();
      const verification = await verifyCompleteReceipt(parsedReceipt.data, {
        rpcUrl,
        configuredAuthorityPubkey: authorityKeypair.publicKey,
      });
      return NextResponse.json({
        type: 'RECEIPT',
        receipt: parsedReceipt.data,
        verification,
      });
    }

    // 2. Transaction signature lookup & verification
    if (body.txSignature) {
      const onChainResult = await verifyOnChainMemo(
        body.txSignature,
        body.expectedReceiptHash,
        rpcUrl
      );

      let linkedReceipt = null;
      if (onChainResult.isValid && onChainResult.parsedMemo?.receiptHash) {
        const allReceipts = await store.listReceipts();
        linkedReceipt = allReceipts.find(
          (r) => r.receiptHash === onChainResult.parsedMemo?.receiptHash
        ) || null;
      }

      return NextResponse.json({
        type: 'TRANSACTION',
        onChain: onChainResult,
        linkedReceipt,
      });
    }

    // 3. ReceiptId lookup
    if (body.receiptId) {
      const receipt = await store.getReceipt(body.receiptId);
      if (!receipt) {
        return NextResponse.json(
          { error: 'RECEIPT_NOT_FOUND', message: `Receipt ${body.receiptId} not found in store` },
          { status: 404 }
        );
      }

      const authorityKeypair = getServerReceiptAuthorityKeypair();
      const verification = await verifyCompleteReceipt(receipt, {
        rpcUrl,
        configuredAuthorityPubkey: authorityKeypair.publicKey,
      });
      return NextResponse.json({
        type: 'RECEIPT',
        receipt,
        verification,
      });
    }

    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Provide receipt object, txSignature, or receiptId' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'VERIFICATION_ERROR', message: err.message || 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * ============================================================================
 * CredaVer Network — Fresh Throwaway Devnet Key Generator
 *
 * WARNING: DEVNET-ONLY KEYS. DO NOT USE ON MAINNET OR WITH REAL FUNDS.
 * Generates fresh throwaway Ed25519 keypairs for production deployment configuration.
 *
 * SAFETY INVARIANT:
 * This script prints to the terminal ONLY. It NEVER writes keys to disk, files,
 * git, or logs.
 * ============================================================================
 */

import { generateEd25519Keypair } from '../packages/core/src/crypto.js';

interface GeneratedKey {
  name: string;
  pubName: string;
  purpose: string;
  publicKey: string;
  secretKeyBase58: string;
  secretKeyJsonArray: string;
  fundingRequirement: string;
}

function main() {
  const timestamp = new Date().toISOString();

  // 1. Generate keypairs
  const paymentKeypair = generateEd25519Keypair();
  const receiptAuthorityKeypair = generateEd25519Keypair();
  const anchorPayerKeypair = generateEd25519Keypair();
  const merchantKeypair = generateEd25519Keypair();

  const keys: GeneratedKey[] = [
    {
      name: 'DEVNET_PAYMENT_SECRET_KEY',
      pubName: 'DEVNET_PAYMENT_PUBLIC_KEY',
      purpose: 'Demo Payment Signer (Custodied funding wallet for agent payments via /api/sign)',
      publicKey: paymentKeypair.publicKey,
      secretKeyBase58: paymentKeypair.secretKey,
      secretKeyJsonArray: JSON.stringify(Array.from(paymentKeypair.secretKeyBytes)),
      fundingRequirement: 'Needs Devnet USDC (for x402 payment settlements) and a small balance of Devnet SOL (~0.1 SOL for token account rent)',
    },
    {
      name: 'CREDAVER_AUTHORITY_SECRET_KEY',
      pubName: 'CREDAVER_AUTHORITY_PUBLIC_KEY',
      purpose: 'CredaVer Receipt Signing Authority (Signs RFC 8785 canonical JSON decision receipts)',
      publicKey: receiptAuthorityKeypair.publicKey,
      secretKeyBase58: receiptAuthorityKeypair.secretKey,
      secretKeyJsonArray: JSON.stringify(Array.from(receiptAuthorityKeypair.secretKeyBytes)),
      fundingRequirement: 'Off-chain digital signature authority ONLY (No SOL or USDC required)',
    },
    {
      name: 'ANCHOR_SECRET_KEY',
      pubName: 'ANCHOR_PUBLIC_KEY',
      purpose: 'On-Chain SPL Memo Anchor Payer (Pays network gas fees when ANCHOR_ON_CHAIN=true)',
      publicKey: anchorPayerKeypair.publicKey,
      secretKeyBase58: anchorPayerKeypair.secretKey,
      secretKeyJsonArray: JSON.stringify(Array.from(anchorPayerKeypair.secretKeyBytes)),
      fundingRequirement: 'Needs Devnet SOL (~0.1 - 0.2 SOL to pay SPL Memo transaction fees of ~0.000005 SOL per anchor)',
    },
    {
      name: 'DEVNET_MERCHANT_SECRET_KEY',
      pubName: 'DEVNET_MERCHANT_PUBLIC_KEY',
      purpose: 'Demo Merchant Service (x402 resource server receiving USDC payments)',
      publicKey: merchantKeypair.publicKey,
      secretKeyBase58: merchantKeypair.secretKey,
      secretKeyJsonArray: JSON.stringify(Array.from(merchantKeypair.secretKeyBytes)),
      fundingRequirement: 'Needs Devnet SOL (small balance for ATA creation) to receive incoming USDC settlements',
    },
  ];

  console.log('# ============================================================================');
  console.log('# CredaVer Network — Fresh Throwaway Devnet Deployment Keys');
  console.log('# WARNING: DEVNET-ONLY KEYS. DO NOT USE ON MAINNET OR WITH REAL FUNDS.');
  console.log(`# Generated At: ${timestamp}`);
  console.log('# ============================================================================\n');

  console.log('# ----------------------------------------------------------------------------');
  console.log('# Section 1: Environment Variables (NAME=value format for .env / host config)');
  console.log('# Encoding: Base58 string (Solana standard 64-byte Ed25519 secret / 32-byte public)');
  console.log('# ----------------------------------------------------------------------------\n');

  for (const k of keys) {
    console.log(`# ${k.purpose}`);
    console.log(`# Encoding: Base58 string`);
    console.log(`${k.name}=${k.secretKeyBase58}`);
    console.log(`${k.pubName}=${k.publicKey}\n`);
  }

  console.log('# ----------------------------------------------------------------------------');
  console.log('# Section 2: Alternative JSON Array Secret Key Encodings');
  console.log('# (Supported if your runtime or Solana CLI expects byte array format)');
  console.log('# ----------------------------------------------------------------------------\n');

  for (const k of keys) {
    console.log(`# ${k.name} (JSON Array encoding: uint8[64])`);
    console.log(`${k.name}_JSON='${k.secretKeyJsonArray}'\n`);
  }

  console.log('# ============================================================================');
  console.log('# Section 3: Public Addresses & Funding Instructions');
  console.log('# ============================================================================\n');

  for (const k of keys) {
    console.log(`[${k.pubName}]`);
    console.log(`  Public Address:     ${k.publicKey}`);
    console.log(`  Purpose:            ${k.purpose}`);
    console.log(`  Funding Needed:     ${k.fundingRequirement}\n`);
  }

  console.log('# ============================================================================');
  console.log('# End of Deployment Keys');
  console.log('# NOTE: No files were written to disk or git. Store these securely in your');
  console.log('# private deployment environment variables.');
  console.log('# ============================================================================');
}

main();

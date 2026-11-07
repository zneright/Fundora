/**
 * Fundora — Transaction-Linked Digital Receipt Generator (`receiptPdfGenerator.ts`)
 *
 * Generates verifiable PDF digital receipts using `jsPDF` with QR code target URLs,
 * SHA-256 payload integrity digests, and strict validation.
 *
 * Honesty & Legal Compliance Invariants (ADR-09):
 * 1. Receipts are labeled "Fundora Transaction-Linked Digital Receipt" (never claiming
 *    unverified statutory BIR tax invoice or COA voucher accreditation).
 * 2. Simulated / Demo sandbox transactions are explicitly stamped as
 *    `SIMULATED / DEMO SANDBOX` and never misrepresented as live blockchain confirmations.
 * 3. Validates all required receipt fields before PDF generation.
 */

import { jsPDF } from 'jspdf';
import { APP_CONFIG } from '../configuration/config';
import { formatNear, formatPhp } from './currency';
import { computeSha256Hex } from './normalization';

export type ReceiptVerificationStatus =
  | 'CONFIRMED'
  | 'SIMULATED'
  | 'PENDING'
  | 'FAILED'
  | 'RECONCILIATION_REQUIRED';

export interface FundoraDigitalReceiptPayload {
  receiptSerialNumber: string;
  projectId: string;
  projectTitle: string;
  barangayId: string;
  barangayName: string;
  psgcCode: string;
  nearTxHash: string;
  actionType: string;
  purpose: string;
  milestoneIndex?: number;
  milestoneTitle?: string;
  signerNearAccountId: string;
  recipientNearAccountId: string;
  amountYocto: string;
  amountNear: string;
  amountPhpEquivalent: number;
  currency: 'NEAR';
  transactionDateIso: string;
  verificationStatus: ReceiptVerificationStatus;
  isSimulatedOrDemo: boolean;
}

export interface ValidatedReceiptMetadata {
  isValid: boolean;
  isSimulatedReceipt: boolean;
  statusBannerText: string;
  nearBlocksTxUrl: string | null;
  nearBlocksSignerUrl: string;
  qrCodeTargetUrl: string;
  complianceDisclaimer: string;
}

export function isSimulatedTxHash(txHash: string, barangayId?: string): boolean {
  const clean = (txHash || '').trim();
  if (!clean) return true;
  if (clean.startsWith('SimTx') || clean.startsWith('sim_') || clean.startsWith('demo_')) {
    return true;
  }
  if (barangayId === APP_CONFIG.governance.demoBarangayId) {
    return true;
  }
  return false;
}

export function validateReceiptPayload(payload: Partial<FundoraDigitalReceiptPayload>): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('ERR_INVALID_RECEIPT_DATA: Receipt payload is missing.');
  }

  const requiredStrings: Array<keyof FundoraDigitalReceiptPayload> = [
    'receiptSerialNumber',
    'projectId',
    'projectTitle',
    'barangayId',
    'barangayName',
    'nearTxHash',
    'actionType',
    'purpose',
    'signerNearAccountId',
    'recipientNearAccountId',
    'amountNear',
    'transactionDateIso',
  ];

  for (const field of requiredStrings) {
    const val = payload[field];
    if (typeof val !== 'string' || !val.trim()) {
      throw new Error(
        `ERR_INVALID_RECEIPT_DATA: Required receipt field "${String(field)}" is missing or empty.`
      );
    }
  }

  const nearNum = Number(payload.amountNear);
  if (Number.isNaN(nearNum) || nearNum < 0) {
    throw new Error(
      `ERR_INVALID_RECEIPT_DATA: Invalid amountNear "${String(payload.amountNear)}".`
    );
  }

  const parsedDate = Date.parse(payload.transactionDateIso!);
  if (Number.isNaN(parsedDate)) {
    throw new Error(
      `ERR_INVALID_RECEIPT_DATA: Invalid transactionDateIso "${String(payload.transactionDateIso)}".`
    );
  }

  if (payload.currency && payload.currency !== 'NEAR') {
    throw new Error(
      `ERR_INVALID_RECEIPT_DATA: Unsupported receipt currency "${String(payload.currency)}".`
    );
  }
}

export function resolveReceiptVerificationMetadata(
  payload: FundoraDigitalReceiptPayload
): ValidatedReceiptMetadata {
  validateReceiptPayload(payload);

  const explorerBase = APP_CONFIG.near.explorerBaseUrl.replace(/\/+$/, '');
  const isSimulated =
    payload.isSimulatedOrDemo ||
    payload.verificationStatus === 'SIMULATED' ||
    isSimulatedTxHash(payload.nearTxHash, payload.barangayId);

  const nearBlocksSignerUrl = `${explorerBase}/address/${encodeURIComponent(
    payload.signerNearAccountId.trim()
  )}`;

  const nearBlocksTxUrl = isSimulated
    ? null
    : `${explorerBase}/txns/${encodeURIComponent(payload.nearTxHash.trim())}`;

  const qrCodeTargetUrl = nearBlocksTxUrl
    ? nearBlocksTxUrl
    : `${explorerBase}/address/${encodeURIComponent(APP_CONFIG.near.contractId)}?simRef=${encodeURIComponent(payload.nearTxHash.trim())}`;

  const statusBannerText = isSimulated
    ? 'SIMULATED / DEMO SANDBOX RECEIPT — NOT BROADCAST TO LIVE NEAR BLOCKCHAIN'
    : payload.verificationStatus === 'CONFIRMED'
      ? 'BLOCKCHAIN-CONFIRMED ON NEAR TESTNET'
      : `TRANSACTION STATUS: ${payload.verificationStatus}`;

  const complianceDisclaimer =
    'Fundora Transaction-Linked Digital Receipt: Cryptographic ledger reference for community transparency. This document is an informational accountability record and is not a statutory BIR official tax invoice or COA government accounting voucher.';

  return {
    isValid: true,
    isSimulatedReceipt: isSimulated,
    statusBannerText,
    nearBlocksTxUrl,
    nearBlocksSignerUrl,
    qrCodeTargetUrl,
    complianceDisclaimer,
  };
}

export async function computeReceiptIntegrityHash(
  payload: FundoraDigitalReceiptPayload
): Promise<string> {
  validateReceiptPayload(payload);
  const canonical = JSON.stringify({
    serial: payload.receiptSerialNumber.trim(),
    projectId: payload.projectId.trim(),
    barangayId: payload.barangayId.trim(),
    txHash: payload.nearTxHash.trim(),
    actionType: payload.actionType.trim(),
    signer: payload.signerNearAccountId.trim().toLowerCase(),
    recipient: payload.recipientNearAccountId.trim().toLowerCase(),
    amountYocto: payload.amountYocto || '0',
    amountNear: payload.amountNear,
    date: payload.transactionDateIso,
    status: payload.verificationStatus,
  });
  return computeSha256Hex(canonical);
}

export async function generateReceiptPdfDocument(
  payload: FundoraDigitalReceiptPayload
): Promise<{
  pdfDoc: jsPDF;
  fileName: string;
  integritySha256: string;
  metadata: ValidatedReceiptMetadata;
  summaryText: string;
}> {
  const metadata = resolveReceiptVerificationMetadata(payload);
  const integritySha256 = await computeReceiptIntegrityHash(payload);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFontSize(16);
  doc.text('FUNDORA — TRANSACTION-LINKED DIGITAL RECEIPT', 15, 20);

  doc.setFontSize(10);
  doc.text(`Status: ${metadata.statusBannerText}`, 15, 28);
  doc.text(`Receipt Reference ID: ${payload.receiptSerialNumber}`, 15, 35);
  doc.text(`Transaction Date (UTC): ${payload.transactionDateIso}`, 15, 41);

  // Jurisdiction & Project Section
  doc.setFontSize(12);
  doc.text('1. Jurisdiction & Project Details', 15, 52);
  doc.setFontSize(10);
  doc.text(
    `Barangay Jurisdiction: Brgy. ${payload.barangayName} (${payload.barangayId} / PSGC ${payload.psgcCode || 'N/A'})`,
    15,
    59
  );
  doc.text(`Project ID: ${payload.projectId}`, 15, 65);
  doc.text(`Project Title: ${payload.projectTitle}`, 15, 71);
  doc.text(`Purpose / Action: ${payload.purpose} (${payload.actionType})`, 15, 77);
  if (payload.milestoneIndex) {
    doc.text(
      `Milestone Tranche: Phase #${payload.milestoneIndex}${payload.milestoneTitle ? ` — ${payload.milestoneTitle}` : ''}`,
      15,
      83
    );
  }

  // Financial & Cryptographic Section
  doc.setFontSize(12);
  doc.text('2. Financial & NEAR Protocol Reference', 15, 95);
  doc.setFontSize(10);
  doc.text(
    `Amount: ${formatNear(payload.amountNear)} (${payload.currency || 'NEAR'}) / Snapshot Equiv: ${formatPhp(payload.amountPhpEquivalent)}`,
    15,
    102
  );
  doc.text(`Raw Amount (yoctoNEAR): ${payload.amountYocto}`, 15, 108);
  doc.text(`Signer NEAR Account: ${payload.signerNearAccountId}`, 15, 114);
  doc.text(`Recipient NEAR Account: ${payload.recipientNearAccountId}`, 15, 120);
  doc.text(`NEAR Transaction Hash: ${payload.nearTxHash}`, 15, 126);
  doc.text(
    `Explorer Reference URL: ${metadata.nearBlocksTxUrl || `${metadata.qrCodeTargetUrl} (Simulated Reference)`}`,
    15,
    132
  );
  doc.text(`Document SHA-256 Integrity Digest: ${integritySha256}`, 15, 138);

  // Honest Disclaimer Footer
  doc.setFontSize(8.5);
  const splitDisclaimer = doc.splitTextToSize(metadata.complianceDisclaimer, 180);
  doc.text(splitDisclaimer, 15, 152);

  const summaryText = [
    'FUNDORA — TRANSACTION-LINKED DIGITAL RECEIPT',
    metadata.statusBannerText,
    `Receipt: ${payload.receiptSerialNumber}`,
    `Project: ${payload.projectId} (${payload.projectTitle})`,
    `Barangay: ${payload.barangayName} (${payload.barangayId})`,
    `TxHash: ${payload.nearTxHash}`,
    `Amount: ${formatNear(payload.amountNear)} (${formatPhp(payload.amountPhpEquivalent)})`,
    `Purpose: ${payload.purpose}`,
    `QR URL: ${metadata.qrCodeTargetUrl}`,
    `Integrity SHA-256: ${integritySha256}`,
    metadata.complianceDisclaimer,
  ].join('\n');

  const safeSerial = payload.receiptSerialNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    pdfDoc: doc,
    fileName: `${safeSerial}.pdf`,
    integritySha256,
    metadata,
    summaryText,
  };
}

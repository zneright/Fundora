/**
 * Fundora — Interactive Transaction-Linked Digital Receipt Modal (`ReceiptModal.tsx`)
 *
 * Displays transaction details, SHA-256 document integrity digest, NearBlocks QR code,
 * and one-click PDF download via `generateReceiptPdfDocument`.
 */

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Download,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import {
  computeReceiptIntegrityHash,
  generateReceiptPdfDocument,
  resolveReceiptVerificationMetadata,
  type FundoraDigitalReceiptPayload,
  type ValidatedReceiptMetadata,
} from '../utils/receiptPdfGenerator';
import { formatNear, formatPhp } from '../utils/currency';

export interface ReceiptModalProps {
  receipt: FundoraDigitalReceiptPayload | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  const [integrityHash, setIntegrityHash] = useState<string>('');
  const [metadata, setMetadata] = useState<ValidatedReceiptMetadata | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function initReceipt() {
      if (!receipt) {
        setMetadata(null);
        setIntegrityHash('');
        setValidationError(null);
        return;
      }
      try {
        const meta = resolveReceiptVerificationMetadata(receipt);
        const hash = await computeReceiptIntegrityHash(receipt);
        if (active) {
          setMetadata(meta);
          setIntegrityHash(hash);
          setValidationError(null);
        }
      } catch (err) {
        if (active) {
          setValidationError(err instanceof Error ? err.message : String(err));
          setMetadata(null);
        }
      }
    }
    void initReceipt();
    return () => {
      active = false;
    };
  }, [receipt]);

  if (!receipt) return null;

  const handleDownloadPdf = async () => {
    try {
      const { pdfDoc, fileName } = await generateReceiptPdfDocument(receipt);
      pdfDoc.save(fileName);
      setDownloadStatus(`Downloaded ${fileName}`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Fundora Transaction-Linked Digital Receipt"
      data-testid="receipt-modal-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999,
      }}
    >
      <div
        className="bank-card"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h3 className="bank-card-title" style={{ fontSize: '1.15rem' }}>
              <Receipt size={18} /> Fundora Transaction-Linked Digital Receipt
            </h3>
            <p className="bank-card-subtitle">
              Serial: <code data-testid="receipt-modal-serial">{receipt.receiptSerialNumber}</code> • Protocol Settlement Voucher (Non-Statutory)
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            data-testid="receipt-modal-close-btn"
            onClick={onClose}
          >
            <X size={15} /> Close
          </button>
        </div>

        {validationError ? (
          <div
            role="alert"
            data-testid="receipt-validation-error"
            style={{
              padding: '0.85rem',
              borderRadius: '0.65rem',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}
          >
            <AlertTriangle size={16} style={{ verticalAlign: 'middle' }} />{' '}
            {validationError}
          </div>
        ) : (
          metadata && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Simulation vs Live Confirmation Banner */}
              <div
                data-testid="receipt-verification-banner"
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.65rem',
                  border: metadata.isSimulatedReceipt
                    ? '1px solid #f59e0b'
                    : '1px solid #10b981',
                  background: metadata.isSimulatedReceipt
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {metadata.isSimulatedReceipt ? (
                  <AlertTriangle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{metadata.statusBannerText}</span>
              </div>

              {/* Core Fields + QR Code */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.84rem' }}>
                  <div>
                    <strong>Barangay Jurisdiction:</strong> Brgy. {receipt.barangayName} (
                    <code>{receipt.barangayId}</code> • PSGC{' '}
                    <code>{receipt.psgcCode || 'N/A'}</code>)
                  </div>
                  <div>
                    <strong>Project ID &amp; Title:</strong>{' '}
                    <code data-testid="receipt-project-id">{receipt.projectId}</code> —{' '}
                    {receipt.projectTitle}
                  </div>
                  <div>
                    <strong>Purpose / Action:</strong> {receipt.purpose} (
                    <code>{receipt.actionType}</code>)
                  </div>
                  {receipt.milestoneIndex && (
                    <div>
                      <strong>Milestone Tranche:</strong> Phase #{receipt.milestoneIndex}
                      {receipt.milestoneTitle ? ` — ${receipt.milestoneTitle}` : ''}
                    </div>
                  )}
                  <div>
                    <strong>Amount:</strong>{' '}
                    <span data-testid="receipt-amount-near">
                      {formatNear(receipt.amountNear)}
                    </span>{' '}
                    ({receipt.currency}) • Snapshot:{' '}
                    <strong>{formatPhp(receipt.amountPhpEquivalent)}</strong>
                  </div>
                  <div>
                    <strong>Signer NEAR Account:</strong>{' '}
                    <a
                      href={metadata.nearBlocksSignerUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="receipt-signer-link"
                    >
                      <code>{receipt.signerNearAccountId}</code>{' '}
                      <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                    </a>
                  </div>
                  <div>
                    <strong>Recipient NEAR Account:</strong>{' '}
                    <code>{receipt.recipientNearAccountId}</code>
                  </div>
                  <div>
                    <strong>Transaction Date (UTC):</strong>{' '}
                    <code>{receipt.transactionDateIso}</code>
                  </div>
                  <div>
                    <strong>NEAR Transaction Reference:</strong>{' '}
                    <code data-testid="receipt-tx-hash">{receipt.nearTxHash}</code>
                    {metadata.nearBlocksTxUrl && (
                      <>
                        {' '}
                        <a
                          href={metadata.nearBlocksTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-testid="receipt-nearblocks-tx-link"
                        >
                          View on NearBlocks <ExternalLink size={12} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* QR Code Panel */}
                <div
                  data-testid="receipt-qr-container"
                  style={{
                    padding: '0.75rem',
                    background: '#ffffff',
                    borderRadius: '0.75rem',
                    textAlign: 'center',
                    color: '#0f172a',
                  }}
                >
                  <QRCodeSVG value={metadata.qrCodeTargetUrl} size={124} level="M" />
                  <div
                    style={{
                      fontSize: '0.68rem',
                      marginTop: '0.35rem',
                      fontWeight: 600,
                      maxWidth: '124px',
                    }}
                  >
                    {metadata.isSimulatedReceipt
                      ? 'Sandbox Reference QR'
                      : 'Scan for NearBlocks Tx'}
                  </div>
                </div>
              </div>

              {/* SHA-256 Document Integrity Digest */}
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                }}
              >
                <div>
                  <ShieldCheck size={13} style={{ verticalAlign: 'middle' }} />{' '}
                  <strong>Document SHA-256 Integrity Digest:</strong>{' '}
                  <code data-testid="receipt-integrity-sha256">{integrityHash}</code>
                </div>
                <div style={{ marginTop: '0.3rem', opacity: 0.8 }}>
                  {metadata.complianceDisclaimer}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                {downloadStatus ? (
                  <span
                    style={{ fontSize: '0.8rem', color: '#10b981' }}
                    data-testid="receipt-download-status"
                  >
                    {downloadStatus}
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="receipt-download-pdf-btn"
                  onClick={() => void handleDownloadPdf()}
                >
                  <Download size={15} /> Download PDF Digital Receipt
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};


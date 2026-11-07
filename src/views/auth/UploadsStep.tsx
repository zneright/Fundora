/**
 * Fundora — Pill 5 (`5. Docs`): Tagged Document Uploader, SHA-256 Digest Calculation,
 * and 13-Stage AI Verification Submission.
 */

import React, { useState } from 'react';
import { ArrowLeft, Upload, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import { computeSha256Hex } from '../../utils/normalization';
import type { DocumentTag, RegistrationWizardState, UploadedDocumentItem } from '../../types';

interface UploadsStepProps {
  wizard: RegistrationWizardState;
  canEditUploads?: boolean;
  isSubmitting?: boolean;
  onUpdateWizard: (partial: Partial<RegistrationWizardState>) => void;
  onBack: () => void;
  onSubmitOnboarding: () => Promise<void>;
}

const REQUIRED_SLOTS_BY_ROLE: Record<
  RegistrationWizardState['selectedRole'],
  DocumentTag[]
> = {
  resident: ['Primary ID Front', 'Proof of Residency', 'Live Selfie'],
  sk_official: [
    'Primary ID Front',
    'Proof of Residency',
    'Appointment / Oath Paper',
    'Live Selfie',
  ],
  barangay_admin: [
    'Primary ID Front',
    'Official LGU Credential',
    'Appointment / Oath Paper',
    'Live Selfie',
  ],
};

export const UploadsStep: React.FC<UploadsStepProps> = ({
  wizard,
  canEditUploads = true,
  isSubmitting = false,
  onUpdateWizard,
  onBack,
  onSubmitOnboarding,
}) => {
  const [selectedTag, setSelectedTag] = useState<DocumentTag>('Primary ID Front');
  const [stepError, setStepError] = useState('');

  const requiredSlots = REQUIRED_SLOTS_BY_ROLE[wizard.selectedRole];

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slotTag: DocumentTag
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStepError('');

    try {
      const compressed = await compressImageFileToDataUrl(file);
      const sha256Hash = await computeSha256Hex(`${slotTag}:${compressed.dataUrl}`);
      const newItem: UploadedDocumentItem = {
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        tag: slotTag,
        label: file.name,
        dataUrl: compressed.dataUrl,
        mimeType: compressed.mimeType,
        sizeBytes: compressed.sizeBytes,
        sha256Hash,
        uploadedAt: new Date().toISOString(),
      };

      const filtered = wizard.uploadedDocuments.filter((d) => d.tag !== slotTag);
      onUpdateWizard({
        uploadedDocuments: [...filtered, newItem],
      });
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Failed to process image file.');
    }
  };

  const handleRemoveDocument = (docId: string) => {
    onUpdateWizard({
      uploadedDocuments: wizard.uploadedDocuments.filter((d) => d.id !== docId),
    });
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');

    const missingSlots = requiredSlots.filter(
      (slot) => !wizard.uploadedDocuments.some((d) => d.tag === slot)
    );
    if (missingSlots.length > 0) {
      setStepError(
        `Please upload all required verification documents: ${missingSlots.join(', ')}`
      );
      return;
    }

    try {
      await onSubmitOnboarding();
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Onboarding submission failed.');
    }
  };

  return (
    <form onSubmit={handleFinalSubmit} className="bank-card-body">
      {stepError && (
        <div
          role="alert"
          style={{
            padding: '0.7rem 0.95rem',
            borderRadius: 12,
            background: 'var(--accent-danger-soft)',
            color: '#f87171',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          {stepError}
        </div>
      )}

      {/* Required Document Slots Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {requiredSlots.map((slot) => {
          const uploaded = wizard.uploadedDocuments.find((d) => d.tag === slot);
          return (
            <div key={slot} className="doc-inspect-card" style={{ padding: '0.85rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{slot}</span>
                {uploaded ? (
                  <span className="badge badge-success">
                    <CheckCircle2 size={12} /> Ready
                  </span>
                ) : (
                  <span className="badge badge-warning">Required</span>
                )}
              </div>

              {uploaded ? (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <div>{uploaded.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                    SHA-256: {uploaded.sha256Hash.slice(0, 14)}...
                  </div>
                </div>
              ) : (
                <div className="text-muted-sm">Upload clear JPEG/PNG image</div>
              )}

              {canEditUploads && (
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                  <label
                    className="btn btn-sm btn-outline"
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <Upload size={13} /> {uploaded ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      aria-label={`Upload ${slot}`}
                      style={{ display: 'none' }}
                      onChange={(e) => void handleFileChange(e, slot)}
                    />
                  </label>
                  {uploaded && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleRemoveDocument(uploaded.id)}
                      aria-label={`Remove ${slot}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Optional Additional Slot */}
      {canEditUploads && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <select
            className="select-control"
            style={{ maxWidth: 240 }}
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value as DocumentTag)}
            aria-label="Additional document tag"
          >
            <option value="Primary ID Back">Primary ID Back</option>
            <option value="Secondary ID Front">Secondary ID Front</option>
            <option value="Resubmission Attachment">Resubmission Attachment</option>
          </select>

          <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Add Supporting Document
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => void handleFileChange(e, selectedTag)}
            />
          </label>
        </div>
      )}

      <div className="action-row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={isSubmitting}
          onClick={onBack}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          <ShieldCheck size={16} />
          <span>
            {isSubmitting
              ? 'Running 13-Stage Civic KYC Audit...'
              : 'Submit Identity Package for Verification'}
          </span>
        </button>
      </div>
    </form>
  );
};

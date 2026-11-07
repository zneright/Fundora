/**
 * Fundora — Pill 4 (`4. Details`): Government ID Metadata, Contact Phone,
 * Official Position/Term Dates, and R.A. 10173 Data Privacy Attestation.
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Phone, CreditCard } from 'lucide-react';
import { isValidPhMobile, normalizePhonePh } from '../../utils/normalization';
import type { RegistrationWizardState } from '../../types';

interface AddInfoStepProps {
  wizard: RegistrationWizardState;
  canEditField?: (fieldName: string) => boolean;
  onUpdateWizard: (partial: Partial<RegistrationWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export const GOVERNMENT_ID_TYPES = [
  'Philippine National ID (PhilSys)',
  'Philippine Passport',
  'Driver’s License (LTO)',
  'UMID / SSS Card',
  'Voter’s ID / COMELEC Voter’s Certification',
  'Postal ID',
  'PRC Professional ID',
  'Barangay Residency ID',
  'University / School ID (Youth 15-21)',
];

export const AddInfoStep: React.FC<AddInfoStepProps> = ({
  wizard,
  canEditField = () => true,
  onUpdateWizard,
  onBack,
  onNext,
}) => {
  const [stepError, setStepError] = useState('');

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');

    if (!isValidPhMobile(wizard.mobileNumber)) {
      setStepError('Please enter a valid 11-digit Philippine mobile number (e.g., 09171234567).');
      return;
    }
    if (!wizard.primaryIdType || !wizard.primaryIdNumber.trim()) {
      setStepError('Please select a Primary Government ID type and enter the ID Number.');
      return;
    }
    if (
      (wizard.selectedRole === 'sk_official' || wizard.selectedRole === 'barangay_admin') &&
      !wizard.positionTitle.trim()
    ) {
      setStepError('Please enter your official LGU / SK Position Title.');
      return;
    }
    if (!wizard.dataPrivacyConsent || !wizard.truthfulnessAttestation) {
      setStepError(
        'You must accept the R.A. 10173 Data Privacy Consent and Truthfulness Attestation to proceed.'
      );
      return;
    }

    onUpdateWizard({
      mobileNumber: normalizePhonePh(wizard.mobileNumber),
    });
    onNext();
  };

  return (
    <form onSubmit={handleContinue} className="bank-card-body">
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

      <div className="grid-2-equal">
        <div className="form-group">
          <label htmlFor="info-mobile">Philippine Mobile Number</label>
          <div style={{ position: 'relative' }}>
            <input
              id="info-mobile"
              type="tel"
              className="form-control"
              disabled={!canEditField('mobileNumber')}
              placeholder="09171234567"
              value={wizard.mobileNumber}
              onChange={(e) => onUpdateWizard({ mobileNumber: e.target.value })}
              required
            />
            <Phone
              size={15}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="info-civil-status">Civil Status</label>
          <select
            id="info-civil-status"
            className="select-control"
            disabled={!canEditField('civilStatus')}
            value={wizard.civilStatus}
            onChange={(e) =>
              onUpdateWizard({
                civilStatus: e.target.value as RegistrationWizardState['civilStatus'],
              })
            }
          >
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
          </select>
        </div>
      </div>

      <div className="grid-2-equal">
        <div className="form-group">
          <label htmlFor="info-primary-id-type">Primary Government ID Type</label>
          <select
            id="info-primary-id-type"
            className="select-control"
            disabled={!canEditField('primaryIdType')}
            value={wizard.primaryIdType}
            onChange={(e) => onUpdateWizard({ primaryIdType: e.target.value })}
          >
            {GOVERNMENT_ID_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="info-primary-id-num">Primary ID Reference Number</label>
          <div style={{ position: 'relative' }}>
            <input
              id="info-primary-id-num"
              type="text"
              className="form-control"
              disabled={!canEditField('primaryIdNumber')}
              placeholder="PSN-1234-5678-9012"
              value={wizard.primaryIdNumber}
              onChange={(e) => onUpdateWizard({ primaryIdNumber: e.target.value })}
              required
            />
            <CreditCard
              size={15}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
          </div>
        </div>
      </div>

      {(wizard.selectedRole === 'sk_official' || wizard.selectedRole === 'barangay_admin') && (
        <div className="grid-2-equal">
          <div className="form-group">
            <label htmlFor="info-position-title">Official LGU / SK Position Title</label>
            <input
              id="info-position-title"
              type="text"
              className="form-control"
              disabled={!canEditField('positionTitle')}
              placeholder={
                wizard.selectedRole === 'barangay_admin'
                  ? 'Punong Barangay / Barangay Secretary'
                  : 'SK Chairperson / SK Kagawad'
              }
              value={wizard.positionTitle}
              onChange={(e) => onUpdateWizard({ positionTitle: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="info-term-end">Term Expiration Date</label>
            <input
              id="info-term-end"
              type="date"
              className="form-control"
              value={wizard.termEndDate}
              onChange={(e) => onUpdateWizard({ termEndDate: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* R.A. 10173 Data Privacy & Truthfulness Checkboxes */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderRadius: 14,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={wizard.dataPrivacyConsent}
            onChange={(e) => onUpdateWizard({ dataPrivacyConsent: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong>R.A. 10173 Data Privacy Consent:</strong> I consent to the processing of my
            identity credentials in an isolated KYC vault strictly for Barangay jurisdiction
            verification.
          </span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={wizard.truthfulnessAttestation}
            onChange={(e) => onUpdateWizard({ truthfulnessAttestation: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong>Sworn Civic Attestation:</strong> I certify under penalty of perjury that all
            submitted identity details and attached documents are authentic.
          </span>
        </label>
      </div>

      <div className="action-row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" className="btn btn-primary">
          <span>Continue to Step 5: Docs</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
};

/**
 * Fundora — Pill 3 (`3. Identity`): Legal Name, Birth Date (R.A. 10742 Live Routing),
 * and Street/Sitio Address within Attached Jurisdiction.
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';
import { evaluateRa10742AgeEligibility, normalizePersonName } from '../../utils/normalization';
import type { RegistrationWizardState } from '../../types';

interface DetailsStepProps {
  wizard: RegistrationWizardState;
  canEditField?: (fieldName: string) => boolean;
  onUpdateWizard: (partial: Partial<RegistrationWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export const DetailsStep: React.FC<DetailsStepProps> = ({
  wizard,
  canEditField = () => true,
  onUpdateWizard,
  onBack,
  onNext,
}) => {
  const [stepError, setStepError] = useState('');

  const ageCheck = wizard.birthDate
    ? evaluateRa10742AgeEligibility(wizard.birthDate, wizard.selectedRole)
    : null;

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');

    if (!wizard.firstName.trim() || !wizard.lastName.trim()) {
      setStepError('Please enter your legal First Name and Last Name as shown on your government ID.');
      return;
    }
    if (!wizard.birthDate) {
      setStepError('Please provide your Date of Birth for R.A. 10742 age verification.');
      return;
    }
    if (ageCheck && !ageCheck.allowed) {
      setStepError(ageCheck.noticeMessage || 'Age eligibility check failed under R.A. 10742.');
      return;
    }
    if (!wizard.houseStreetSitio || wizard.houseStreetSitio.trim().length < 4) {
      setStepError('Please enter your complete House No., Street, Purok, or Sitio.');
      return;
    }

    onUpdateWizard({
      firstName: normalizePersonName(wizard.firstName),
      middleName: wizard.middleName ? normalizePersonName(wizard.middleName) : '',
      lastName: normalizePersonName(wizard.lastName),
    });

    onNext();
  };

  return (
    <form onSubmit={handleContinue} className="bank-card-body">
      {/* Live Attached Jurisdiction Badge */}
      <div
        style={{
          padding: '0.65rem 0.95rem',
          borderRadius: 12,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--role-accent-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          fontWeight: 700,
        }}
      >
        <MapPin size={15} style={{ color: 'var(--role-accent)' }} />
        <span>
          📍 Attached Jurisdiction: Brgy. {wizard.barangayName}, {wizard.cityMunicipalityName},{' '}
          {wizard.provinceName} ({wizard.zipCode})
        </span>
      </div>

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
          <label htmlFor="id-first-name">Legal First Name</label>
          <input
            id="id-first-name"
            type="text"
            className="form-control"
            disabled={!canEditField('firstName')}
            placeholder="Juan"
            value={wizard.firstName}
            onChange={(e) => onUpdateWizard({ firstName: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="id-middle-name">Middle Name (Optional)</label>
          <input
            id="id-middle-name"
            type="text"
            className="form-control"
            disabled={!canEditField('middleName')}
            placeholder="Santos"
            value={wizard.middleName}
            onChange={(e) => onUpdateWizard({ middleName: e.target.value })}
          />
        </div>
      </div>

      <div className="grid-2-equal">
        <div className="form-group">
          <label htmlFor="id-last-name">Legal Last Name</label>
          <input
            id="id-last-name"
            type="text"
            className="form-control"
            disabled={!canEditField('lastName')}
            placeholder="Dela Cruz"
            value={wizard.lastName}
            onChange={(e) => onUpdateWizard({ lastName: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="id-suffix">Suffix (Jr., III, etc.)</label>
          <input
            id="id-suffix"
            type="text"
            className="form-control"
            disabled={!canEditField('suffix')}
            placeholder="Optional"
            value={wizard.suffix}
            onChange={(e) => onUpdateWizard({ suffix: e.target.value })}
          />
        </div>
      </div>

      <div className="grid-2-equal">
        <div className="form-group">
          <label htmlFor="id-birthdate">Date of Birth (R.A. 10742 Check)</label>
          <input
            id="id-birthdate"
            type="date"
            className="form-control"
            disabled={!canEditField('birthDate')}
            value={wizard.birthDate}
            onChange={(e) => onUpdateWizard({ birthDate: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="id-sex">Sex</label>
          <select
            id="id-sex"
            className="select-control"
            disabled={!canEditField('sex')}
            value={wizard.sex}
            onChange={(e) =>
              onUpdateWizard({
                sex: e.target.value as RegistrationWizardState['sex'],
              })
            }
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
      </div>

      {/* Live R.A. 10742 Age Eligibility Notice */}
      {ageCheck && (
        <div
          style={{
            padding: '0.7rem 0.95rem',
            borderRadius: 12,
            background: ageCheck.allowed
              ? 'var(--accent-green-soft)'
              : 'var(--accent-danger-soft)',
            border: `1px solid ${
              ageCheck.allowed ? 'rgba(0, 214, 101, 0.3)' : 'rgba(239, 68, 68, 0.35)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
        >
          {ageCheck.allowed ? (
            <ShieldCheck size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={16} style={{ color: 'var(--accent-danger)', flexShrink: 0 }} />
          )}
          <span>
            Age: {ageCheck.ageYears} yrs •{' '}
            {ageCheck.noticeMessage ||
              `R.A. 10742 Katipunan ng Kabataan Eligible (${ageCheck.effectiveRole})`}
          </span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="id-street-sitio">House No., Street, Purok / Sitio / Subdivision</label>
        <input
          id="id-street-sitio"
          type="text"
          className="form-control"
          disabled={!canEditField('houseStreetSitio')}
          placeholder="Blk 4 Lot 12 Phase 2, Sampaguita St."
          value={wizard.houseStreetSitio}
          onChange={(e) => onUpdateWizard({ houseStreetSitio: e.target.value })}
          required
        />
      </div>

      <div className="action-row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" className="btn btn-primary">
          <span>Continue to Step 4: Details</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
};

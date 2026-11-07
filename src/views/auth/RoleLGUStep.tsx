/**
 * Fundora — Pill 2 (`2. Role / LGU`): Civic Role & PSGC Geographic Cascading Step
 * Preserves:
 * - Approved barangay cascading for Residents and SK Officials
 * - Full PSGC cascading (`Region -> Province -> Municipality/City -> Barangay`)
 *   with NCR virtual `Metro Manila` fallback and 3s offline fallback for Barangay Admins
 */

import React, { useEffect, useState } from 'react';
import { MapPin, Shield, Users, Landmark, ArrowLeft, ArrowRight, WifiOff } from 'lucide-react';
import { usePsgcGeographicSelector } from '../../hooks/usePsgcGeographicSelector';
import { barangayRepository } from '../../repositories/barangay.repository';
import type { BarangayDocument, RegistrationWizardState } from '../../types';

interface RoleLGUStepProps {
  wizard: RegistrationWizardState;
  isLocked?: boolean;
  onUpdateWizard: (partial: Partial<RegistrationWizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

export const RoleLGUStep: React.FC<RoleLGUStepProps> = ({
  wizard,
  isLocked = false,
  onUpdateWizard,
  onBack,
  onNext,
}) => {
  const [approvedBarangays, setApprovedBarangays] = useState<BarangayDocument[]>([]);
  const [stepError, setStepError] = useState('');

  const psgc = usePsgcGeographicSelector({
    regionCode: wizard.regionCode,
    provinceCode: wizard.provinceCode,
    cityMunicipalityCode: wizard.cityMunicipalityCode,
    barangayCode: wizard.barangayCode,
  });

  useEffect(() => {
    let active = true;
    barangayRepository.listApprovedBarangays().then((list) => {
      if (active) setApprovedBarangays(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync PSGC selections into wizard state for Barangay Admin mode
  useEffect(() => {
    if (wizard.selectedRole !== 'barangay_admin') return;
    onUpdateWizard({
      regionCode: psgc.selectedRegionCode,
      regionName: psgc.selectedRegion?.name || '',
      provinceCode: psgc.selectedProvinceCode,
      provinceName: psgc.selectedProvince?.name || '',
      cityMunicipalityCode: psgc.selectedCityMunicipalityCode,
      cityMunicipalityName: psgc.selectedCityMunicipality?.name || '',
      barangayCode: psgc.selectedBarangayCode,
      barangayName: psgc.selectedBarangay?.name || '',
      barangayId: psgc.selectedBarangayCode ? `brgy_${psgc.selectedBarangayCode}` : '',
      zipCode: psgc.resolvedZipCode || wizard.zipCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wizard.selectedRole,
    psgc.selectedRegionCode,
    psgc.selectedProvinceCode,
    psgc.selectedCityMunicipalityCode,
    psgc.selectedBarangayCode,
    psgc.resolvedZipCode,
  ]);

  const handleSelectApprovedBarangay = (barangayId: string) => {
    const found = approvedBarangays.find((b) => b.id === barangayId);
    if (!found) return;
    onUpdateWizard({
      barangayId: found.id,
      barangayCode: found.psgcCode,
      barangayName: found.name,
      cityMunicipalityCode: found.cityMunicipalityCode,
      cityMunicipalityName: found.cityMunicipalityName,
      provinceCode: found.provinceCode,
      provinceName: found.provinceName,
      regionCode: found.regionCode,
      regionName: found.regionName,
      zipCode: found.zipCode,
      hallAddress: found.hallAddress,
    });
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError('');

    if (!wizard.barangayName || !wizard.barangayCode) {
      setStepError('Please select a valid Barangay jurisdiction before continuing.');
      return;
    }
    if (!wizard.zipCode || wizard.zipCode.trim().length < 4) {
      setStepError('Please provide the 4-digit Philippine Postal ZIP Code.');
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleContinue} className="bank-card-body">
      {/* Role Selector */}
      <div className="form-group">
        <label>Select Your Civic Treasury Role</label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
            gap: '0.65rem',
          }}
        >
          <button
            type="button"
            disabled={isLocked}
            className={`bank-nav-item ${wizard.selectedRole === 'resident' ? 'active' : ''}`}
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.35rem',
              padding: '0.85rem',
            }}
            onClick={() => onUpdateWizard({ selectedRole: 'resident' })}
          >
            <Users size={18} />
            <div style={{ fontWeight: 800 }}>Resident / Youth Voter</div>
            <span className="text-muted-sm">Vote on milestones & audit receipts</span>
          </button>

          <button
            type="button"
            disabled={isLocked}
            className={`bank-nav-item ${wizard.selectedRole === 'sk_official' ? 'active' : ''}`}
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.35rem',
              padding: '0.85rem',
            }}
            onClick={() => onUpdateWizard({ selectedRole: 'sk_official' })}
          >
            <Shield size={18} />
            <div style={{ fontWeight: 800 }}>SK Official</div>
            <span className="text-muted-sm">Submit proposals & milestone proofs</span>
          </button>

          <button
            type="button"
            disabled={isLocked}
            className={`bank-nav-item ${wizard.selectedRole === 'barangay_admin' ? 'active' : ''}`}
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.35rem',
              padding: '0.85rem',
            }}
            onClick={() => onUpdateWizard({ selectedRole: 'barangay_admin' })}
          >
            <Landmark size={18} />
            <div style={{ fontWeight: 800 }}>Barangay Admin</div>
            <span className="text-muted-sm">Register LGU & oversee jurisdiction</span>
          </button>
        </div>
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

      {/* Resident / SK Official: Select from Approved Barangays OR use full PSGC Cascader */}
      {wizard.selectedRole !== 'barangay_admin' && (
        <div className="form-group">
          <label htmlFor="approved-barangay-select">
            Select Active Registered Barangay Jurisdiction
          </label>
          <select
            id="approved-barangay-select"
            className="select-control"
            disabled={isLocked}
            value={wizard.barangayId}
            onChange={(e) => handleSelectApprovedBarangay(e.target.value)}
          >
            <option value="">-- Choose Approved Barangay Jurisdiction --</option>
            {approvedBarangays.map((b) => (
              <option key={b.id} value={b.id}>
                Brgy. {b.name} — {b.cityMunicipalityName}, {b.provinceName} (PSGC {b.psgcCode})
                {b.isDemoJurisdiction ? ' [DEMO SANDBOX]' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Barangay Admin (or fallback PSGC Cascader): Full 4-Tier PSGC Geographic Selector */}
      {wizard.selectedRole === 'barangay_admin' && (
        <>
          {psgc.isOfflineFallback && (
            <div
              className="badge badge-info"
              style={{ alignSelf: 'flex-start', gap: '0.4rem' }}
            >
              <WifiOff size={13} />
              <span>PSGC Bundled Offline Registry Active</span>
            </div>
          )}

          <div className="grid-2-equal">
            <div className="form-group">
              <label htmlFor="psgc-region">1. Region (PSGC)</label>
              <select
                id="psgc-region"
                className="select-control"
                disabled={isLocked}
                value={psgc.selectedRegionCode}
                onChange={(e) => psgc.selectRegion(e.target.value)}
              >
                <option value="">-- Select Region --</option>
                {psgc.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="psgc-province">2. Province / District</label>
              <select
                id="psgc-province"
                className="select-control"
                disabled={isLocked || !psgc.selectedRegionCode}
                value={psgc.selectedProvinceCode}
                onChange={(e) => psgc.selectProvince(e.target.value)}
              >
                <option value="">-- Select Province --</option>
                {psgc.provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2-equal">
            <div className="form-group">
              <label htmlFor="psgc-city">3. City / Municipality</label>
              <select
                id="psgc-city"
                className="select-control"
                disabled={isLocked || !psgc.selectedProvinceCode}
                value={psgc.selectedCityMunicipalityCode}
                onChange={(e) => psgc.selectCityMunicipality(e.target.value)}
              >
                <option value="">-- Select City / Municipality --</option>
                {psgc.citiesMunicipalities.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="psgc-barangay">4. Official Barangay</label>
              <select
                id="psgc-barangay"
                className="select-control"
                disabled={isLocked || !psgc.selectedCityMunicipalityCode}
                value={psgc.selectedBarangayCode}
                onChange={(e) => psgc.selectBarangay(e.target.value)}
              >
                <option value="">-- Select Barangay --</option>
                {psgc.barangays.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {/* ZIP Code & Hall Address */}
      <div className="grid-2-equal">
        <div className="form-group">
          <label htmlFor="lgu-zipcode">Postal ZIP Code</label>
          <input
            id="lgu-zipcode"
            type="text"
            className="form-control"
            disabled={isLocked}
            placeholder="4103"
            value={wizard.zipCode}
            onChange={(e) => onUpdateWizard({ zipCode: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="lgu-psgc-readonly">Canonical 10-Digit PSGC Code</label>
          <input
            id="lgu-psgc-readonly"
            type="text"
            className="form-control"
            value={wizard.barangayCode || 'Not selected'}
            readOnly
          />
        </div>
      </div>

      {wizard.barangayName && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 14,
            background: 'var(--role-accent-soft)',
            border: '1px solid var(--role-accent-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.84rem',
            fontWeight: 700,
          }}
        >
          <MapPin size={16} style={{ color: 'var(--role-accent)', flexShrink: 0 }} />
          <span>
            📍 Attached Jurisdiction: Brgy. {wizard.barangayName}, {wizard.cityMunicipalityName},{' '}
            {wizard.provinceName} ({wizard.zipCode}) • PSGC {wizard.barangayCode}
          </span>
        </div>
      )}

      <div className="action-row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" className="btn btn-primary">
          <span>Continue to Step 3: Identity</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
};

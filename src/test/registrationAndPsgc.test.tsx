/**
 * Fundora — Phase 1 Automated Verification Suite:
 * 5-Pill Step-by-Step Registration, PSGC Cascading, R.A. 10742 Age Routing,
 * Duplicate SHA-256 Detection, and Selective Resubmission.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import {
  evaluateRa10742AgeEligibility,
  normalizeBarangayName,
  normalizePersonName,
  normalizePhonePh,
} from '../utils/normalization';
import {
  usePsgcGeographicSelector,
  normalizeTo10DigitPsgc,
} from '../hooks/usePsgcGeographicSelector';
import { resolveResubmissionPermissions } from '../utils/lifecycle';
import { resetLocalCollectionsForTest } from '../repositories/db.helper';
import { authService } from '../services/auth.service';
import { verificationService } from '../services/verification.service';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthPage } from '../views/auth/AuthPage';
import type { RegistrationWizardState, UserProfile } from '../types';

describe('Phase 1 — Normalization & R.A. 10742 Youth Age-Bracket Routing', () => {
  it('normalizes person names, barangay prefixes, Philippine phone numbers, and 10-digit PSGC codes', () => {
    expect(normalizePersonName('  jUAN   dELA   cRUZ  ')).toBe('Juan Dela Cruz');
    expect(normalizeBarangayName('Brgy. Bucandala III')).toBe('Bucandala III');
    expect(normalizeBarangayName('Barangay Bel-Air')).toBe('Bel-Air');
    expect(normalizePhonePh('+63 917 123 4567')).toBe('09171234567');
    expect(normalizeTo10DigitPsgc('042109018')).toBe('0421090180');
  });

  it('enforces R.A. 10742 age routing: <15 blocked, 15-30 eligible youth, >30 auto-provisioned viewer', () => {
    const refDate = new Date('2026-11-07T00:00:00Z');

    // Age 14 (<15) -> blocked
    const under15 = evaluateRa10742AgeEligibility('2013-05-10', 'resident', refDate);
    expect(under15.allowed).toBe(false);
    expect(under15.ageBracketStatus).toBe('under_15_blocked');

    // Age 21 (15-30) -> eligible youth resident
    const youth = evaluateRa10742AgeEligibility('2005-03-15', 'resident', refDate);
    expect(youth.allowed).toBe(true);
    expect(youth.ageBracketStatus).toBe('eligible_youth');
    expect(youth.effectiveRole).toBe('resident');

    // Age 34 (>30) resident -> auto-provisioned as viewer
    const seniorResident = evaluateRa10742AgeEligibility('1992-01-10', 'resident', refDate);
    expect(seniorResident.allowed).toBe(true);
    expect(seniorResident.ageBracketStatus).toBe('over_30_viewer');
    expect(seniorResident.effectiveRole).toBe('viewer');

    // Age 34 (>30) SK official -> blocked per R.A. 10742 Sec. 10
    const seniorSk = evaluateRa10742AgeEligibility('1992-01-10', 'sk_official', refDate);
    expect(seniorSk.allowed).toBe(false);

    // Age 45 (>30) Barangay Admin -> allowed as barangay_admin
    const seniorBrgyAdmin = evaluateRa10742AgeEligibility('1981-01-10', 'barangay_admin', refDate);
    expect(seniorBrgyAdmin.allowed).toBe(true);
    expect(seniorBrgyAdmin.effectiveRole).toBe('barangay_admin');

    // SK Official minor (16) -> blocked (SK officials must be >= 18)
    const minorSk = evaluateRa10742AgeEligibility('2010-06-01', 'sk_official', refDate);
    expect(minorSk.allowed).toBe(false);
    expect(minorSk.ageBracketStatus).toBe('ineligible_sk_age');

    // Elected SK Chairperson (age 21) -> allowed
    const electedChair = evaluateRa10742AgeEligibility('2005-03-15', 'sk_official', refDate, 'elected_chairperson');
    expect(electedChair.allowed).toBe(true);
    expect(electedChair.effectiveRole).toBe('sk_official');

    // Elected SK Kagawad (age 26) -> blocked (> 24 on election day)
    const electedOverAge = evaluateRa10742AgeEligibility('2000-05-10', 'sk_official', refDate, 'elected_kagawad');
    expect(electedOverAge.allowed).toBe(false);
    expect(electedOverAge.ageBracketStatus).toBe('ineligible_sk_age');

    // Appointed SK Treasurer (age 26) -> allowed (18–30)
    const appointedTreas = evaluateRa10742AgeEligibility('2000-05-10', 'sk_official', refDate, 'appointed_treasurer');
    expect(appointedTreas.allowed).toBe(true);
    expect(appointedTreas.effectiveRole).toBe('sk_official');

    // Appointed SK Secretary (age 32) -> blocked (> 30)
    const appointedOverAge = evaluateRa10742AgeEligibility('1994-05-10', 'sk_official', refDate, 'appointed_secretary');
    expect(appointedOverAge.allowed).toBe(false);
  });
});

describe('Phase 1 — PSGC Cascading Hook (`usePsgcGeographicSelector`) & NCR / Offline Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to psgcFallback.json when PSGC API fails and cascades Region IV-A -> Cavite -> Imus -> Bucandala III', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    const { result } = renderHook(() => usePsgcGeographicSelector());

    await waitFor(() => {
      expect(result.current.regions.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.selectRegion('040000000'); // Region IV-A CALABARZON
    });

    await waitFor(() => {
      expect(result.current.provinces.some((p) => p.name === 'Cavite')).toBe(true);
    });

    act(() => {
      result.current.selectProvince('042100000'); // Cavite
    });

    await waitFor(() => {
      expect(result.current.citiesMunicipalities.some((c) => c.name === 'City of Imus')).toBe(true);
    });

    act(() => {
      result.current.selectCityMunicipality('042109000'); // Imus
    });

    await waitFor(() => {
      expect(result.current.barangays.some((b) => b.name === 'Bucandala III')).toBe(true);
    });

    act(() => {
      result.current.selectBarangay('0421090180');
    });

    expect(result.current.selectedBarangay?.name).toBe('Bucandala III');
    expect(result.current.resolvedZipCode).toBe('4103');
    expect(result.current.isOfflineFallback).toBe(true);
  });

  it('handles NCR empty-province response by injecting virtual Metro Manila province', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/regions/130000000/provinces/')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      throw new Error('Offline fallback for other endpoints');
    });

    const { result } = renderHook(() => usePsgcGeographicSelector());

    act(() => {
      result.current.selectRegion('130000000'); // NCR
    });

    await waitFor(() => {
      expect(result.current.provinces).toHaveLength(1);
      expect(result.current.provinces[0].name).toBe('Metro Manila');
      expect(result.current.selectedProvinceCode).toBe('130000000-MM');
    });
  });
});

describe('Phase 1 — 5-Pill Wizard UI, Back Navigation, Duplicate Detection & Selective Resubmission', () => {
  beforeEach(() => {
    resetLocalCollectionsForTest();
    window.localStorage.clear();
  });

  it('renders all 5 step pills and preserves entered state across Next and Back navigation', async () => {
    render(
      <AuthProvider>
        <AuthPage initialStep={2} />
      </AuthProvider>
    );

    expect(screen.getByText('1. Account')).toBeInTheDocument();
    expect(screen.getByText('2. Role / LGU')).toBeInTheDocument();
    expect(screen.getByText('3. Identity')).toBeInTheDocument();
    expect(screen.getByText('4. Details')).toBeInTheDocument();
    expect(screen.getByText('5. Docs')).toBeInTheDocument();

    // Select Bucandala III from Approved Barangays dropdown on Step 2
    const brgySelect = await screen.findByLabelText(/Select Active Registered Barangay Jurisdiction/i);
    fireEvent.change(brgySelect, { target: { value: 'brgy_0421090180' } });

    expect(screen.getByText(/Attached Jurisdiction: Brgy. Bucandala III/i)).toBeInTheDocument();

    // Advance to Step 3: Identity
    fireEvent.click(screen.getByRole('button', { name: /Continue to Step 3: Identity/i }));

    const firstNameInput = screen.getByLabelText(/Legal First Name/i) as HTMLInputElement;
    fireEvent.change(firstNameInput, { target: { value: 'Maria' } });

    // Navigate Back to Step 2 and then Forward to Step 3 — verify state is preserved
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByText(/Attached Jurisdiction: Brgy. Bucandala III/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue to Step 3: Identity/i }));
    expect((screen.getByLabelText(/Legal First Name/i) as HTMLInputElement).value).toBe('Maria');
  });

  it('detects SHA-256 duplicate ID uploads across accounts and generates OCR typo suggestions', async () => {
    const baseWizard: RegistrationWizardState = {
      email: 'user1@test.ph',
      selectedRole: 'resident',
      regionCode: '040000000',
      regionName: 'Region IV-A (CALABARZON)',
      provinceCode: '042100000',
      provinceName: 'Cavite',
      cityMunicipalityCode: '042109000',
      cityMunicipalityName: 'City of Imus',
      barangayCode: '0421090180',
      barangayName: 'Bucandala III',
      barangayId: 'brgy_0421090180',
      zipCode: '4103',
      hallAddress: 'Bucandala III Hall',
      firstName: 'Jhon',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      suffix: '',
      birthDate: '2004-06-15',
      sex: 'Male',
      civilStatus: 'Single',
      mobileNumber: '09171234567',
      houseStreetSitio: 'Blk 2 Lot 8 Phase 1',
      primaryIdType: 'Philippine National ID (PhilSys)',
      primaryIdNumber: 'PSN-9999-8888',
      secondaryIdType: '',
      secondaryIdNumber: '',
      positionTitle: '',
      termStartDate: '2025-11-30',
      termEndDate: '2028-11-30',
      dataPrivacyConsent: true,
      truthfulnessAttestation: true,
      uploadedDocuments: [
        {
          id: 'doc_1',
          tag: 'Primary ID Front',
          label: 'philsys_front.jpg',
          dataUrl: 'data:image/jpeg;base64,SHARED_ID_PAYLOAD',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          sha256Hash: '',
          uploadedAt: '2026-11-07T00:00:00Z',
        },
        {
          id: 'doc_2',
          tag: 'Proof of Residency',
          label: 'residency.jpg',
          dataUrl: 'data:image/jpeg;base64,RESIDENCY_1',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          sha256Hash: '',
          uploadedAt: '2026-11-07T00:00:00Z',
        },
        {
          id: 'doc_3',
          tag: 'Live Selfie',
          label: 'selfie.jpg',
          dataUrl: 'data:image/jpeg;base64,SELFIE_1',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          sha256Hash: '',
          uploadedAt: '2026-11-07T00:00:00Z',
        },
      ],
    };

    // First user submits onboarding
    const firstSubmission = await authService.completeOnboardingSubmission('uid_first', baseWizard);
    expect(firstSubmission.verificationRecord.duplicateDetected).toBe(false);

    // Second user attempts to reuse the exact same ID photo + OCR detects "John" vs "Jhon"
    const secondAudit = await verificationService.runIdentityVerificationAudit(
      'uid_second',
      {
        ...baseWizard,
        email: 'user2@test.ph',
        uploadedDocuments: baseWizard.uploadedDocuments.map((d) => ({ ...d, sha256Hash: '' })),
      },
      undefined,
      { extractedFirstName: 'John' }
    );

    expect(secondAudit.duplicateDetected).toBe(true);
    expect(secondAudit.duplicateMatchedUid).toBe('uid_first');
    expect(secondAudit.scoreCard.verdict).toBe('REJECT_RECOMMENDED');
    expect(secondAudit.scoreCard.typoSuggestions?.[0]?.extractedValue).toBe('John');
  });

  it('enforces selective resubmission presets: photo_only, details_only, full_package, custom', () => {
    const baseRejectedUser: Partial<UserProfile> = {
      uid: 'usr_rejected',
      verificationStatus: 'rejected',
    };

    const photoOnly = resolveResubmissionPermissions({
      ...baseRejectedUser,
      resubmissionTarget: 'photo_only',
    });
    expect(photoOnly.isResubmissionMode).toBe(true);
    expect(photoOnly.canEditIdentityStep).toBe(false);
    expect(photoOnly.canEditUploadsStep).toBe(true);
    expect(photoOnly.canEditField('firstName')).toBe(false);
    expect(photoOnly.canEditField('uploadedDocuments')).toBe(true);

    const detailsOnly = resolveResubmissionPermissions({
      ...baseRejectedUser,
      resubmissionTarget: 'details_only',
    });
    expect(detailsOnly.canEditIdentityStep).toBe(true);
    expect(detailsOnly.canEditUploadsStep).toBe(false);
    expect(detailsOnly.canEditField('firstName')).toBe(true);
    expect(detailsOnly.canEditField('uploadedDocuments')).toBe(false);

    const customMode = resolveResubmissionPermissions({
      ...baseRejectedUser,
      resubmissionTarget: 'custom',
      resubmissionAllowedFields: ['houseStreetSitio'],
    });
    expect(customMode.canEditField('houseStreetSitio')).toBe(true);
    expect(customMode.canEditField('firstName')).toBe(false);
  });
});

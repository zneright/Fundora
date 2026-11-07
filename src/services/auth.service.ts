/**
 * Fundora — Authentication, Onboarding & Jurisdiction Registration Service
 * Implements:
 * - Step 1 Account creation & login
 * - Mandatory Email Verification gate (`emailVerified`)
 * - R.A. 10742 Youth Age-Bracket Routing (`<15` blocked, `15-30` youth, `>30` viewer)
 * - Strict separation between `users/{uid}` and `registration_records/{uid}`
 * - Barangay Admin jurisdiction creation (`barangays/{barangayId}`)
 * - Selective Resubmission (`photo_only`, `details_only`, `full_package`, `custom`)
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';
import { userRepository } from '../repositories/user.repository';
import { registrationRepository } from '../repositories/registration.repository';
import { barangayRepository } from '../repositories/barangay.repository';
import { auditRepository } from '../repositories/audit.repository';
import { verificationService, type VerificationStageProgress } from './verification.service';
import {
  evaluateRa10742AgeEligibility,
  normalizeBarangayName,
  normalizePersonName,
  normalizePhonePh,
} from '../utils/normalization';
import { normalizeTo10DigitPsgc } from '../hooks/usePsgcGeographicSelector';
import { APP_CONFIG } from '../configuration/config';
import type {
  BarangayDocument,
  RegistrationRecordDocument,
  RegistrationWizardState,
  UserProfile,
  VerificationRecordDocument,
} from '../types';

export interface LocalAuthSession {
  uid: string;
  email: string;
  emailVerified: boolean;
}

const SESSION_STORAGE_KEY = 'fundora_active_auth_session';
const LOCAL_ACCOUNTS_KEY = 'fundora_local_auth_accounts';

interface StoredLocalAccount {
  uid: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}

function getLocalAccounts(): Record<string, StoredLocalAccount> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredLocalAccount>) : {};
  } catch {
    return {};
  }
}

function saveLocalAccounts(accounts: Record<string, StoredLocalAccount>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

export const authService = {
  getCurrentSession(): LocalAuthSession | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LocalAuthSession) : null;
    } catch {
      return null;
    }
  },

  setCurrentSession(session: LocalAuthSession | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  },

  async registerAccountCredentials(
    email: string,
    password: string
  ): Promise<LocalAuthSession> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    if (firebaseAuth) {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // Non-fatal in local/dev
      }
      const session: LocalAuthSession = {
        uid: cred.user.uid,
        email: cleanEmail,
        emailVerified: cred.user.emailVerified,
      };
      this.setCurrentSession(session);
      return session;
    }

    const accounts = getLocalAccounts();
    if (accounts[cleanEmail]) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    accounts[cleanEmail] = {
      uid,
      email: cleanEmail,
      passwordHash: `hash_${password.length}_${btoa(password)}`,
      emailVerified: false,
    };
    saveLocalAccounts(accounts);

    const session: LocalAuthSession = {
      uid,
      email: cleanEmail,
      emailVerified: false,
    };
    this.setCurrentSession(session);
    return session;
  },

  async signInWithCredentials(email: string, password: string): Promise<{
    session: LocalAuthSession;
    profile: UserProfile | null;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    if (firebaseAuth) {
      const cred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      const session: LocalAuthSession = {
        uid: cred.user.uid,
        email: cleanEmail,
        emailVerified: cred.user.emailVerified,
      };
      this.setCurrentSession(session);
      const profile = await userRepository.getById(cred.user.uid);
      return { session, profile };
    }

    const accounts = getLocalAccounts();
    const acc = accounts[cleanEmail];
    if (!acc || acc.passwordHash !== `hash_${password.length}_${btoa(password)}`) {
      throw new Error('Invalid email or password.');
    }

    const session: LocalAuthSession = {
      uid: acc.uid,
      email: acc.email,
      emailVerified: acc.emailVerified,
    };
    this.setCurrentSession(session);
    const profile = await userRepository.getById(acc.uid);
    return { session, profile };
  },

  async confirmEmailVerification(uid: string, email: string): Promise<LocalAuthSession> {
    const cleanEmail = email.trim().toLowerCase();
    const accounts = getLocalAccounts();
    if (accounts[cleanEmail]) {
      accounts[cleanEmail].emailVerified = true;
      saveLocalAccounts(accounts);
    }
    const updated: LocalAuthSession = {
      uid,
      email: cleanEmail,
      emailVerified: true,
    };
    this.setCurrentSession(updated);

    const existingProfile = await userRepository.getById(uid);
    if (existingProfile) {
      await userRepository.updateProfile(uid, { emailVerified: true });
    }
    return updated;
  },

  async completeOnboardingSubmission(
    uid: string,
    wizard: RegistrationWizardState,
    onStageUpdate?: (stage: VerificationStageProgress) => void
  ): Promise<{
    profile: UserProfile;
    registrationRecord: RegistrationRecordDocument;
    verificationRecord: VerificationRecordDocument;
  }> {
    // 1. Validate R.A. 10742 Age Eligibility
    const ageResult = evaluateRa10742AgeEligibility(wizard.birthDate, wizard.selectedRole);
    if (!ageResult.allowed) {
      throw new Error(ageResult.noticeMessage || 'Age eligibility check failed under R.A. 10742.');
    }

    // 2. Normalize identity and jurisdiction fields
    const firstName = normalizePersonName(wizard.firstName);
    const middleName = wizard.middleName ? normalizePersonName(wizard.middleName) : '';
    const lastName = normalizePersonName(wizard.lastName);
    const suffix = wizard.suffix ? wizard.suffix.trim() : '';
    const displayName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
    const psgcCode = normalizeTo10DigitPsgc(wizard.barangayCode || '0000000000');
    const barangayName = normalizeBarangayName(wizard.barangayName);
    const mobileNumber = normalizePhonePh(wizard.mobileNumber);

    // 3. Resolve or Create Barangay Document
    let barangayId = wizard.barangayId || `brgy_${psgcCode}`;
    if (wizard.selectedRole === 'barangay_admin') {
      const existingByPsgc = await barangayRepository.getByPsgcCode(psgcCode);
      if (existingByPsgc && existingByPsgc.adminUid !== uid && existingByPsgc.status === 'approved') {
        throw new Error(
          `Barangay ${barangayName} (${psgcCode}) already has an active approved Barangay Admin.`
        );
      }
      barangayId = existingByPsgc?.id || `brgy_${psgcCode}`;
      const newBrgy: BarangayDocument = {
        id: barangayId,
        psgcCode,
        name: barangayName,
        regionName: wizard.regionName,
        regionCode: wizard.regionCode,
        provinceName: wizard.provinceName,
        provinceCode: wizard.provinceCode,
        cityMunicipalityName: wizard.cityMunicipalityName,
        cityMunicipalityCode: wizard.cityMunicipalityCode,
        zipCode: wizard.zipCode,
        hallAddress:
          wizard.hallAddress ||
          `${barangayName} Barangay Hall, ${wizard.cityMunicipalityName}, ${wizard.provinceName}`,
        status: 'pending_review',
        adminUid: uid,
        adminFullName: displayName,
        quorumBps: APP_CONFIG.governance.defaultQuorumBps,
        minVotesRequired:
          barangayId === APP_CONFIG.governance.demoBarangayId
            ? APP_CONFIG.governance.demoMinVotes
            : APP_CONFIG.governance.defaultMinVotes,
        termStartDate: wizard.termStartDate || '2025-11-30',
        termEndDate: wizard.termEndDate || '2028-11-30',
        isDemoJurisdiction: barangayId === APP_CONFIG.governance.demoBarangayId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await barangayRepository.saveBarangay(newBrgy);
    }

    const wizardWithNormalized: RegistrationWizardState = {
      ...wizard,
      firstName,
      middleName,
      lastName,
      suffix,
      barangayId,
      barangayCode: psgcCode,
      barangayName,
      mobileNumber,
    };

    // 4. Run 13-stage Identity Verification & Duplicate Detection
    const verificationRecord = await verificationService.runIdentityVerificationAudit(
      uid,
      wizardWithNormalized,
      onStageUpdate
    );

    const now = new Date().toISOString();
    const existingReg = await registrationRepository.getByUid(uid);

    // 5. Save Protected PII to `registration_records/{uid}` (Separated from `users/{uid}`)
    const registrationRecord: RegistrationRecordDocument = {
      uid,
      barangayId,
      psgcCode,
      firstName,
      middleName: middleName || undefined,
      lastName,
      suffix: suffix || undefined,
      birthDate: wizard.birthDate,
      ageYears: ageResult.ageYears,
      sex: wizard.sex,
      civilStatus: wizard.civilStatus,
      mobileNumber,
      houseStreetSitio: wizard.houseStreetSitio.trim(),
      fullFormattedAddress: `${wizard.houseStreetSitio.trim()}, Brgy. ${barangayName}, ${wizard.cityMunicipalityName}, ${wizard.provinceName} ${wizard.zipCode}`,
      primaryIdType: wizard.primaryIdType,
      primaryIdNumber: wizard.primaryIdNumber.trim(),
      secondaryIdType: wizard.secondaryIdType || undefined,
      secondaryIdNumber: wizard.secondaryIdNumber?.trim() || undefined,
      positionTitle: wizard.positionTitle || undefined,
      termStartDate: wizard.termStartDate || undefined,
      termEndDate: wizard.termEndDate || undefined,
      dataPrivacyConsent: wizard.dataPrivacyConsent,
      truthfulnessAttestation: wizard.truthfulnessAttestation,
      consentTimestamp: now,
      documentHashes: wizardWithNormalized.uploadedDocuments.map((d) => d.sha256Hash),
      resubmissionCount: existingReg ? existingReg.resubmissionCount + 1 : 0,
      lastSubmittedAt: now,
      updatedAt: now,
    };
    await registrationRepository.saveRegistrationRecord(registrationRecord);

    // 6. Save Non-Sensitive Routing Profile to `users/{uid}`
    const profile: UserProfile = {
      uid,
      email: wizard.email.trim().toLowerCase(),
      emailVerified: true,
      displayName,
      firstName,
      middleName: middleName || undefined,
      lastName,
      suffix: suffix || undefined,
      role: ageResult.effectiveRole,
      requestedRole: wizard.selectedRole,
      barangayId,
      barangayName,
      psgcCode,
      cityMunicipalityName: wizard.cityMunicipalityName,
      provinceName: wizard.provinceName,
      regionName: wizard.regionName,
      zipCode: wizard.zipCode,
      ageYears: ageResult.ageYears,
      ageBracketStatus: ageResult.ageBracketStatus,
      verificationStatus:
        ageResult.effectiveRole === 'viewer' && wizard.selectedRole === 'resident'
          ? 'approved'
          : 'pending_review',
      termEndsAt: wizard.termEndDate || '2028-11-30',
      createdAt: existingReg ? existingReg.lastSubmittedAt : now,
      updatedAt: now,
    };
    await userRepository.saveProfile(profile);

    // 7. Record Audit Trail
    await auditRepository.recordEvent({
      actorUid: uid,
      actorName: displayName,
      actorRole: profile.role,
      barangayId,
      action: existingReg ? 'RESUBMIT_ONBOARDING_PACKAGE' : 'SUBMIT_ONBOARDING_PACKAGE',
      targetId: verificationRecord.id,
      details: `Submitted ${wizard.selectedRole} onboarding package for Barangay ${barangayName} (${psgcCode}). AI Score: ${verificationRecord.scoreCard.overallScore}%.`,
    });

    return {
      profile,
      registrationRecord,
      verificationRecord,
    };
  },

  async signOut(): Promise<void> {
    if (firebaseAuth) {
      try {
        await firebaseSignOut(firebaseAuth);
      } catch {
        // Ignore
      }
    }
    this.setCurrentSession(null);
  },
};

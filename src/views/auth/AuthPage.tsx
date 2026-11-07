/**
 * Fundora — Master 5-Pill Step-by-Step Registration & Authentication Controller (`AuthPage`)
 * Preserves the exact 5-pill horizontal progress bar:
 * `1. Account` -> `2. Role / LGU` -> `3. Identity` -> `4. Details` -> `5. Docs`
 * Supports:
 * - Full state preservation across Back / Next navigation
 * - Mandatory Email Verification gate (`VerifyEmailView`) between Pill 1 and Pill 2
 * - Selective Resubmission (`photo_only`, `details_only`, `full_package`, `custom`)
 * - 13-stage AI KYC timeline & interactive OCR typo suggestions
 */

import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { LoginStep } from './LoginStep';
import { VerifyEmailView } from './VerifyEmailView';
import { RoleLGUStep } from './RoleLGUStep';
import { DetailsStep } from './DetailsStep';
import { AddInfoStep, GOVERNMENT_ID_TYPES } from './AddInfoStep';
import { UploadsStep } from './UploadsStep';
import { SuccessStep } from './SuccessStep';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../contexts/AuthContext';
import { resolveResubmissionPermissions } from '../../utils/lifecycle';
import { userRepository } from '../../repositories/user.repository';
import { registrationRepository } from '../../repositories/registration.repository';
import type {
  RegistrationWizardState,
  TypoCorrectionSuggestion,
  UserProfile,
  VerificationRecordDocument,
} from '../../types';

export type WizardPillStep = 1 | 2 | 3 | 4 | 5 | 'verify_email' | 'success';

const PILL_LABELS: Array<{ step: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { step: 1, label: '1. Account' },
  { step: 2, label: '2. Role / LGU' },
  { step: 3, label: '3. Identity' },
  { step: 4, label: '4. Details' },
  { step: 5, label: '5. Docs' },
];

interface AuthPageProps {
  initialStep?: WizardPillStep;
  initialWizardOverrides?: Partial<RegistrationWizardState>;
  resubmissionProfile?: UserProfile | null;
  onCompleteSuccess?: (profile: UserProfile) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialStep = 1,
  initialWizardOverrides,
  resubmissionProfile = null,
  onCompleteSuccess,
}) => {
  const { session, userProfile, registrationRecord, setSessionAndProfile } = useAuth();
  const activeProfile = resubmissionProfile || userProfile;
  const resubPermissions = resolveResubmissionPermissions(activeProfile);

  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [currentStep, setCurrentStep] = useState<WizardPillStep>(() => {
    if (resubPermissions.isResubmissionMode) {
      if (resubPermissions.target === 'photo_only') return 5;
      return 3;
    }
    return initialStep;
  });

  const [wizard, setWizard] = useState<RegistrationWizardState>(() => ({
    email: activeProfile?.email || session?.email || '',
    selectedRole:
      (activeProfile?.requestedRole as RegistrationWizardState['selectedRole']) || 'resident',
    regionCode: '',
    regionName: activeProfile?.regionName || '',
    provinceCode: '',
    provinceName: activeProfile?.provinceName || '',
    cityMunicipalityCode: '',
    cityMunicipalityName: activeProfile?.cityMunicipalityName || '',
    barangayCode: activeProfile?.psgcCode || '',
    barangayName: activeProfile?.barangayName || '',
    barangayId: activeProfile?.barangayId || '',
    zipCode: activeProfile?.zipCode || '',
    hallAddress: '',
    firstName: registrationRecord?.firstName || activeProfile?.firstName || '',
    middleName: registrationRecord?.middleName || activeProfile?.middleName || '',
    lastName: registrationRecord?.lastName || activeProfile?.lastName || '',
    suffix: registrationRecord?.suffix || activeProfile?.suffix || '',
    birthDate: registrationRecord?.birthDate || '',
    sex: registrationRecord?.sex || 'Male',
    civilStatus: registrationRecord?.civilStatus || 'Single',
    mobileNumber: registrationRecord?.mobileNumber || '',
    houseStreetSitio: registrationRecord?.houseStreetSitio || '',
    primaryIdType: registrationRecord?.primaryIdType || GOVERNMENT_ID_TYPES[0],
    primaryIdNumber: registrationRecord?.primaryIdNumber || '',
    secondaryIdType: registrationRecord?.secondaryIdType || '',
    secondaryIdNumber: registrationRecord?.secondaryIdNumber || '',
    positionTitle: registrationRecord?.positionTitle || '',
    termStartDate: registrationRecord?.termStartDate || '2025-11-30',
    termEndDate: registrationRecord?.termEndDate || '2028-11-30',
    dataPrivacyConsent: registrationRecord?.dataPrivacyConsent || false,
    truthfulnessAttestation: registrationRecord?.truthfulnessAttestation || false,
    uploadedDocuments: [],
    ...initialWizardOverrides,
  }));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedProfile, setCompletedProfile] = useState<UserProfile | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<VerificationRecordDocument | null>(null);

  const updateWizard = (partial: Partial<RegistrationWizardState>) => {
    setWizard((prev) => ({ ...prev, ...partial }));
  };

  const activeNumericStep: number =
    currentStep === 'verify_email' ? 1 : currentStep === 'success' ? 5 : currentStep;

  const handleCredentialsSubmit = async (email: string, password: string) => {
    updateWizard({ email });
    if (mode === 'register') {
      const newSession = await authService.registerAccountCredentials(email, password);
      setSessionAndProfile(newSession, null, null);
      setCurrentStep('verify_email');
    } else {
      const { session: signedInSession, profile } = await authService.signInWithCredentials(
        email,
        password
      );
      setSessionAndProfile(signedInSession, profile, null);
      if (!signedInSession.emailVerified) {
        setCurrentStep('verify_email');
      } else if (!profile) {
        setCurrentStep(2);
      } else if (onCompleteSuccess) {
        onCompleteSuccess(profile);
      }
    }
  };

  const handleConfirmEmailVerified = async () => {
    const uid = session?.uid || `usr_${Date.now()}`;
    const verifiedSession = await authService.confirmEmailVerification(uid, wizard.email);
    setSessionAndProfile(verifiedSession, userProfile, registrationRecord);
    setCurrentStep(2);
  };

  const handleFinalSubmitOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const uid = activeProfile?.uid || session?.uid || `usr_${Date.now()}`;
      const result = await authService.completeOnboardingSubmission(uid, wizard);
      setCompletedProfile(result.profile);
      setVerificationResult(result.verificationRecord);
      setSessionAndProfile(
        { uid, email: result.profile.email, emailVerified: true },
        result.profile,
        result.registrationRecord
      );
      setCurrentStep('success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTypoSuggestion = async (suggestion: TypoCorrectionSuggestion) => {
    if (!completedProfile) return;
    if (suggestion.field === 'firstName' || suggestion.field === 'lastName') {
      const updatedFirst =
        suggestion.field === 'firstName' ? suggestion.extractedValue : completedProfile.firstName;
      const updatedLast =
        suggestion.field === 'lastName' ? suggestion.extractedValue : completedProfile.lastName;
      const updatedDisplay = [updatedFirst, completedProfile.middleName, updatedLast]
        .filter(Boolean)
        .join(' ');
      await userRepository.updateProfile(completedProfile.uid, {
        firstName: updatedFirst,
        lastName: updatedLast,
        displayName: updatedDisplay,
      });
      await registrationRepository.updateRegistrationRecord(completedProfile.uid, {
        firstName: updatedFirst,
        lastName: updatedLast,
      });
      setCompletedProfile({
        ...completedProfile,
        firstName: updatedFirst,
        lastName: updatedLast,
        displayName: updatedDisplay,
      });
    }
  };

  return (
    <div
      className="banking-app-container page-enter"
      style={{ maxWidth: 680, paddingTop: '2rem' }}
    >
      <div className="bank-card">
        {/* Brand Header */}
        <div className="bank-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="bank-brand-crest">
              <ShieldCheck size={22} style={{ color: 'var(--role-accent)' }} />
            </div>
            <div>
              <h1 className="bank-card-title">Fundora Civic Treasury</h1>
              <p className="bank-card-subtitle">
                NEAR-Native Programmable Escrow & R.A. 10742 Verified LGU Onboarding
              </p>
            </div>
          </div>
        </div>

        {/* Selective Resubmission Banner */}
        {resubPermissions.isResubmissionMode && activeProfile && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 14,
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              marginBottom: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 800,
                fontSize: '0.84rem',
                color: '#fbbf24',
              }}
            >
              <AlertTriangle size={16} />
              <span>
                Selective Resubmission Mode: {resubPermissions.target.toUpperCase()}
              </span>
            </div>
            <p className="text-secondary-sm">
              {activeProfile.rejectionReason ||
                'Please update the unlocked fields or documents requested by your Barangay reviewer.'}
            </p>
          </div>
        )}

        {/* 5-Pill Progress Stepper */}
        <div className="wizard-progress-bar" role="navigation" aria-label="Onboarding Steps">
          {PILL_LABELS.map((pill) => {
            const isActive = activeNumericStep === pill.step;
            const isCompleted = activeNumericStep > pill.step || currentStep === 'success';
            return (
              <div
                key={pill.label}
                className={`step-dot ${isActive ? 'active' : ''} ${
                  isCompleted ? 'completed' : ''
                }`}
              >
                {pill.label}
              </div>
            );
          })}
        </div>

        {/* Active Step Content */}
        {currentStep === 1 && (
          <LoginStep
            mode={mode}
            initialEmail={wizard.email}
            onModeChange={setMode}
            onSubmitCredentials={handleCredentialsSubmit}
          />
        )}

        {currentStep === 'verify_email' && (
          <VerifyEmailView
            email={wizard.email}
            onConfirmVerified={handleConfirmEmailVerified}
            onSwitchAccount={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 2 && (
          <RoleLGUStep
            wizard={wizard}
            isLocked={resubPermissions.isResubmissionMode}
            onUpdateWizard={updateWizard}
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <DetailsStep
            wizard={wizard}
            canEditField={resubPermissions.canEditField}
            onUpdateWizard={updateWizard}
            onBack={() => setCurrentStep(2)}
            onNext={() => setCurrentStep(4)}
          />
        )}

        {currentStep === 4 && (
          <AddInfoStep
            wizard={wizard}
            canEditField={resubPermissions.canEditField}
            onUpdateWizard={updateWizard}
            onBack={() => setCurrentStep(3)}
            onNext={() => setCurrentStep(5)}
          />
        )}

        {currentStep === 5 && (
          <UploadsStep
            wizard={wizard}
            canEditUploads={resubPermissions.canEditUploadsStep}
            isSubmitting={isSubmitting}
            onUpdateWizard={updateWizard}
            onBack={() =>
              setCurrentStep(
                resubPermissions.isResubmissionMode && resubPermissions.target === 'photo_only'
                  ? 3
                  : 4
              )
            }
            onSubmitOnboarding={handleFinalSubmitOnboarding}
          />
        )}

        {currentStep === 'success' && completedProfile && verificationResult && (
          <SuccessStep
            profile={completedProfile}
            verificationRecord={verificationResult}
            onAcceptTypoSuggestion={handleAcceptTypoSuggestion}
            onEnterWorkspace={() => {
              if (onCompleteSuccess) {
                onCompleteSuccess(completedProfile);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

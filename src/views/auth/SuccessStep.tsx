/**
 * Fundora — Role-Aware Onboarding Completion & Verification Scorecard Summary (`SuccessStep`)
 */

import React from 'react';
import { ShieldCheck, ArrowRight, Eye } from 'lucide-react';
import { VerificationTimeline } from '../../components/VerificationTimeline';
import type {
  TypoCorrectionSuggestion,
  UserProfile,
  VerificationRecordDocument,
} from '../../types';

interface SuccessStepProps {
  profile: UserProfile;
  verificationRecord: VerificationRecordDocument;
  onAcceptTypoSuggestion?: (suggestion: TypoCorrectionSuggestion) => void;
  onEnterWorkspace: () => void;
}

export const SuccessStep: React.FC<SuccessStepProps> = ({
  profile,
  verificationRecord,
  onAcceptTypoSuggestion,
  onEnterWorkspace,
}) => {
  const isViewerAutoProvisioned = profile.role === 'viewer';

  return (
    <div className="bank-card-body" style={{ gap: '1.25rem' }}>
      <div
        style={{
          padding: '1.25rem',
          borderRadius: 18,
          background: 'var(--role-card-gradient)',
          border: '1px solid var(--role-accent-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isViewerAutoProvisioned ? (
            <Eye size={22} style={{ color: 'var(--role-accent)' }} />
          ) : (
            <ShieldCheck size={22} style={{ color: 'var(--accent-green)' }} />
          )}
          <h3 className="bank-card-title">
            {isViewerAutoProvisioned
              ? 'Provisioned as Verified Public Transparency Viewer'
              : 'Civic KYC Package Submitted & Audited'}
          </h3>
        </div>

        <p className="text-secondary-sm">
          {isViewerAutoProvisioned
            ? `Under R.A. 10742 (SK Reform Act), Katipunan ng Kabataan voting is reserved for ages 15–30. Your account in Barangay ${profile.barangayName} is active with full Public Transparency Board and NEAR ledger inspection access.`
            : `Your ${profile.role.replace('_', ' ')} application for Barangay ${profile.barangayName} (${profile.cityMunicipalityName}, PSGC ${profile.psgcCode}) has been recorded with a ${verificationRecord.scoreCard.overallScore}% AI Verification Score.`}
        </p>
      </div>

      <VerificationTimeline
        currentStageIndex={12}
        scoreCard={verificationRecord.scoreCard}
        onAcceptTypoSuggestion={onAcceptTypoSuggestion}
      />

      <button type="button" className="btn btn-primary w-100" onClick={onEnterWorkspace}>
        <span>Proceed to Fundora Civic Workspace</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

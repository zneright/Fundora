/**
 * Fundora — Mandatory Email Verification Gate (`VerifyEmailView`)
 * Positioned between Pill 1 (`1. Account`) and Pill 2 (`2. Role / LGU`).
 */

import React from 'react';
import { MailCheck, CheckCircle2, RefreshCw } from 'lucide-react';

interface VerifyEmailViewProps {
  email: string;
  onConfirmVerified: () => Promise<void>;
  onSwitchAccount: () => void;
}

export const VerifyEmailView: React.FC<VerifyEmailViewProps> = ({
  email,
  onConfirmVerified,
  onSwitchAccount,
}) => {
  return (
    <div className="bank-card-body" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: 'var(--role-accent-soft)',
          border: '1px solid var(--role-accent-border)',
          color: 'var(--role-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 0.75rem auto',
        }}
      >
        <MailCheck size={30} />
      </div>

      <h3 className="bank-card-title">Verify Your Email Address</h3>
      <p className="text-secondary-sm" style={{ maxWidth: 440, margin: '0 auto' }}>
        We sent a verification link to <strong>{email}</strong>. Confirming your email ensures
        tamper-evident civic receipt delivery and account recovery before selecting your LGU
        jurisdiction.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          marginTop: '1rem',
        }}
      >
        <button
          type="button"
          className="btn btn-primary w-100"
          onClick={() => void onConfirmVerified()}
        >
          <CheckCircle2 size={16} /> I Have Verified My Email — Continue to Step 2
        </button>

        <button type="button" className="btn btn-outline w-100" onClick={onSwitchAccount}>
          <RefreshCw size={15} /> Use a Different Email Account
        </button>
      </div>
    </div>
  );
};

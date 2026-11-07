import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Award, Sparkles, ArrowRight, X } from 'lucide-react';

interface SKCelebrationModalProps {
  onAcknowledge?: () => void;
}

export const SKCelebrationModal: React.FC<SKCelebrationModalProps> = ({ onAcknowledge }) => {
  const { userProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!userProfile || dismissed) return null;

  const isSk = userProfile.role === 'sk_official' && userProfile.verificationStatus === 'approved';
  if (!isSk) return null;

  const localKey = `sk_celebration_ack_${userProfile.uid}`;
  if (localStorage.getItem(localKey) === 'true') {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(localKey, 'true');
    setDismissed(true);
    if (onAcknowledge) onAcknowledge();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SK Official Appointment Celebration"
      style={{
        zIndex: 9999,
        background: 'rgba(7, 10, 18, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        position: 'fixed',
        inset: 0,
      }}
      onClick={handleDismiss}
    >
      <div
        className="bank-card page-enter"
        style={{
          maxWidth: 480,
          width: '100%',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(0, 214, 101, 0.35)',
          borderRadius: 24,
          padding: '2rem',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 214, 101, 0.2)',
          textAlign: 'center',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          aria-label="Close celebration"
        >
          <X size={15} />
        </button>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(0, 214, 101, 0.15)',
            color: 'var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            border: '2px solid rgba(0, 214, 101, 0.3)',
          }}
        >
          <Award size={32} />
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '0.4rem' }}>
          Official Sangguniang Kabataan Authority
        </h3>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          Congratulations, <strong>{userProfile.displayName}</strong>! You have been verified as an official{' '}
          <strong>SK Official</strong> for <strong>Brgy. {userProfile.barangayName}</strong> under Philippine R.A. 10742.
        </p>

        <div
          style={{
            padding: '0.85rem',
            borderRadius: 14,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            textAlign: 'left',
            display: 'grid',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)', fontWeight: 700 }}>
            <Sparkles size={14} /> Unlocked Capabilities:
          </div>
          <div>• Author deterministic proposals with 40/40/20 escrow milestones</div>
          <div>• Trigger Gemini AI procurement audits against DTI SRP caps</div>
          <div>• Submit photographic proof of milestone completion on NEAR Testnet</div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          style={{ width: '100%', fontWeight: 700, borderRadius: 14 }}
          onClick={handleDismiss}
        >
          <span>Enter SK Workspace</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

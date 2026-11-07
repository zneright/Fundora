import React from 'react';
import { ShieldOff, LogOut } from 'lucide-react';

interface SuspendedViewProps {
  reason?: string;
  onSignOut: () => void;
}

export const SuspendedView: React.FC<SuspendedViewProps> = ({ reason, onSignOut }) => {
  return (
    <div className="bank-card" style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'center' }}>
      <ShieldOff size={36} style={{ color: 'var(--accent-danger)', marginBottom: '0.75rem' }} />
      <h2 className="bank-card-title">Account Access Suspended</h2>
      <p className="text-secondary-sm" style={{ margin: '0.6rem 0 1.25rem 0' }}>
        {reason ||
          'Your civic account has been placed under administrative review by your Barangay jurisdiction.'}
      </p>
      <button type="button" className="btn btn-outline w-100" onClick={onSignOut}>
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
};

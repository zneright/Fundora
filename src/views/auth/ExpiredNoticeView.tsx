import React from 'react';
import { CalendarOff, RefreshCw } from 'lucide-react';

interface ExpiredNoticeViewProps {
  termEndsAt?: string;
  onRenewCredentials: () => void;
}

export const ExpiredNoticeView: React.FC<ExpiredNoticeViewProps> = ({
  termEndsAt,
  onRenewCredentials,
}) => {
  return (
    <div className="bank-card" style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
      <CalendarOff size={36} style={{ color: 'var(--accent-yellow)', marginBottom: '0.75rem' }} />
      <h2 className="bank-card-title">Official Term or Verification Expired</h2>
      <p className="text-secondary-sm" style={{ margin: '0.6rem 0 1.25rem 0' }}>
        Your official term ({termEndsAt || 'previous term'}) has concluded. Please submit updated
        appointment credentials to reactivate signing privileges.
      </p>
      <button type="button" className="btn btn-primary w-100" onClick={onRenewCredentials}>
        <RefreshCw size={16} /> Submit Updated Term Credentials
      </button>
    </div>
  );
};

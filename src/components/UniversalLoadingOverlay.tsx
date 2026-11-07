import React from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { ShieldCheck } from 'lucide-react';

export const UniversalLoadingOverlay: React.FC = () => {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 20000 }}>
      <div
        className="bank-card"
        style={{
          maxWidth: 380,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.85rem',
        }}
      >
        <div className="bank-brand-crest">
          <ShieldCheck size={24} style={{ color: 'var(--role-accent)' }} />
        </div>
        <div style={{ fontWeight: 800, fontSize: '1rem' }}>Fundora Civic Protocol</div>
        <div className="text-secondary-sm">{loadingMessage}</div>
      </div>
    </div>
  );
};

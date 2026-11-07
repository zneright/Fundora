import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorValidationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export const ErrorValidationModal: React.FC<ErrorValidationModalProps> = ({
  isOpen,
  title = 'Validation Notice',
  message,
  onClose,
}) => {
  if (!isOpen || !message) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="bank-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={20} style={{ color: 'var(--accent-danger)' }} />
            <h3 className="bank-card-title" style={{ fontSize: '1rem' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {message}
        </p>
        <button type="button" className="btn btn-primary w-100" onClick={onClose}>
          Understood
        </button>
      </div>
    </div>
  );
};

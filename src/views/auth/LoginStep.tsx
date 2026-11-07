/**
 * Fundora — Pill 1 (`1. Account`): Account Creation & Sign-In Step
 */

import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, UserPlus, LogIn } from 'lucide-react';

interface LoginStepProps {
  mode: 'register' | 'login';
  initialEmail?: string;
  onModeChange: (mode: 'register' | 'login') => void;
  onSubmitCredentials: (email: string, password: string) => Promise<void>;
}

export const LoginStep: React.FC<LoginStepProps> = ({
  mode,
  initialEmail = '',
  onModeChange,
  onSubmitCredentials,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitCredentials(email.trim(), password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bank-card-body">
      <div className="fintech-tabs-rail" style={{ marginBottom: '0.5rem' }}>
        <button
          type="button"
          className={`fintech-tab-btn ${mode === 'register' ? 'active' : ''}`}
          onClick={() => {
            setLocalError('');
            onModeChange('register');
          }}
        >
          <UserPlus size={15} /> Create Civic Account
        </button>
        <button
          type="button"
          className={`fintech-tab-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setLocalError('');
            onModeChange('login');
          }}
        >
          <LogIn size={15} /> Sign In
        </button>
      </div>

      {localError && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: 'var(--accent-danger-soft)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '0.84rem',
            fontWeight: 700,
          }}
        >
          {localError}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="auth-email">Official or Personal Email Address</label>
        <div style={{ position: 'relative' }}>
          <input
            id="auth-email"
            type="email"
            className="form-control"
            placeholder="juan.delacruz@barangay.gov.ph"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Mail
            size={16}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="auth-password">Password (minimum 8 characters)</label>
        <div style={{ position: 'relative' }}>
          <input
            id="auth-password"
            type="password"
            className="form-control"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Lock
            size={16}
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>

      {mode === 'register' && (
        <div className="form-group">
          <label htmlFor="auth-confirm-password">Confirm Password</label>
          <input
            id="auth-confirm-password"
            type="password"
            className="form-control"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
      )}

      <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
        <span>
          {submitting
            ? 'Authenticating...'
            : mode === 'register'
              ? 'Continue to Email Verification'
              : 'Access Fundora Vault'}
        </span>
        <ArrowRight size={16} />
      </button>
    </form>
  );
};

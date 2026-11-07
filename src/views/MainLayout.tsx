import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  LogOut,
  Sun,
  Moon,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NetworkBadge } from '../components/NetworkBadge';
import { AuthPage } from './auth/AuthPage';

export const MainLayout: React.FC = () => {
  const { userProfile, registrationRecord, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [editingResubmission, setEditingResubmission] = useState(false);

  if (!userProfile) return null;

  if (editingResubmission) {
    return (
      <AuthPage
        resubmissionProfile={userProfile}
        onCompleteSuccess={() => {
          setEditingResubmission(false);
          void refreshProfile();
        }}
      />
    );
  }

  const roleThemeClass = `role-${userProfile.role}`;

  return (
    <div className={`desktop-bank-shell ${roleThemeClass}`}>
      <div className="bank-main-viewport">
        <header className="desktop-top-bar">
          <div className="top-bar-user-info">
            <div className="top-bar-avatar">
              {userProfile.firstName.charAt(0)}
              {userProfile.lastName.charAt(0)}
            </div>
            <div>
              <div className="top-bar-title">
                Fundora • Brgy. {userProfile.barangayName}
              </div>
              <div className="top-bar-badge">
                <MapPin size={13} />
                <span>
                  {userProfile.cityMunicipalityName}, {userProfile.provinceName} (PSGC{' '}
                  {userProfile.psgcCode})
                </span>
              </div>
            </div>
          </div>

          <div className="top-bar-controls">
            <NetworkBadge />
            <span className="badge badge-role">{userProfile.role.replace('_', ' ')}</span>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void signOut()}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </header>

        <main className="banking-app-container page-enter">
          <div className="civic-master-card">
            <div className="civic-card-top">
              <span className="civic-card-chip-tag">
                <ShieldCheck size={14} /> Fundora Verified Jurisdiction Profile
              </span>
              <span
                className={`badge ${
                  userProfile.verificationStatus === 'approved'
                    ? 'badge-success'
                    : userProfile.verificationStatus === 'rejected'
                      ? 'badge-danger'
                      : 'badge-warning'
                }`}
              >
                {userProfile.verificationStatus === 'approved' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <Clock size={12} />
                )}
                <span>{userProfile.verificationStatus.replace('_', ' ')}</span>
              </span>
            </div>

            <div>
              <div className="civic-balance-label">Authenticated Civic Member</div>
              <div className="civic-balance-amount" style={{ fontSize: '2rem' }}>
                {userProfile.displayName}
              </div>
              <div className="civic-balance-sub">
                Role: {userProfile.role.toUpperCase()} • Age Bracket: {userProfile.ageYears} yrs (
                {userProfile.ageBracketStatus})
              </div>
            </div>

            {userProfile.verificationStatus === 'rejected' && (
              <div className="civic-card-action-bar">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setEditingResubmission(true)}
                >
                  <RefreshCw size={16} /> Open Selective Resubmission Wizard (
                  {userProfile.resubmissionTarget || 'full_package'})
                </button>
              </div>
            )}
          </div>

          <div className="grid-2-equal">
            <div className="bank-card">
              <h3 className="bank-card-title">Public Routing Record (`users/{'{uid}'}`)</h3>
              <p className="bank-card-subtitle">
                Contains strictly non-sensitive jurisdiction and role routing metadata
              </p>
              <div className="bank-card-body" style={{ marginTop: '0.85rem', fontSize: '0.84rem' }}>
                <div>
                  <strong>UID:</strong> <code>{userProfile.uid}</code>
                </div>
                <div>
                  <strong>Barangay ID:</strong> <code>{userProfile.barangayId}</code>
                </div>
                <div>
                  <strong>Canonical PSGC:</strong> <code>{userProfile.psgcCode}</code>
                </div>
                <div>
                  <strong>ZIP Code:</strong> {userProfile.zipCode}
                </div>
              </div>
            </div>

            <div className="bank-card">
              <h3 className="bank-card-title">
                Isolated KYC Vault (`registration_records/{'{uid}'}`)
              </h3>
              <p className="bank-card-subtitle">
                Protected by hardened Firestore rules against horizontal peer access
              </p>
              <div className="bank-card-body" style={{ marginTop: '0.85rem', fontSize: '0.84rem' }}>
                <div>
                  <strong>Formatted Address:</strong>{' '}
                  {registrationRecord?.fullFormattedAddress || 'Protected'}
                </div>
                <div>
                  <strong>Primary ID Type:</strong> {registrationRecord?.primaryIdType || 'N/A'}
                </div>
                <div>
                  <strong>SHA-256 Document Hashes:</strong>{' '}
                  {registrationRecord?.documentHashes.length || 0} recorded
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

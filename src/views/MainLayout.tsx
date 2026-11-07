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
  Wallet,
  Activity,
  LayoutDashboard,
  UserCheck,
  KeyRound,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import { NetworkBadge } from '../components/NetworkBadge';
import { AdminPanel } from '../components/AdminPanel';
import { SKWorkspace } from '../components/SKWorkspace';
import { YouthDashboard } from '../components/YouthDashboard';
import { ActivityView } from '../components/ActivityView';
import { TransparencyHub } from '../components/TransparencyHub';
import { JudgeDemoToolbar } from '../components/JudgeDemoToolbar';
import type { SupportedWalletProviderId } from '../services/nearContract.service';
import { AuthPage } from './auth/AuthPage';

export const MainLayout: React.FC = () => {
  const { userProfile, registrationRecord, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    isConnected,
    activeAccountId,
    connectedAccounts,
    selectedWalletId,
    supportedWallets,
    accessKeyMode,
    networkMismatchError,
    activeTransaction,
    pendingReconciliations,
    connectWallet,
    disconnectWallet,
    switchAccount,
    setAccessKeyMode,
    reconcileProject,
  } = useNearWallet();

  const [editingResubmission, setEditingResubmission] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'workspace' | 'transparency' | 'activity' | 'profile'
  >('workspace');
  const [walletProviderInput, setWalletProviderInput] =
    useState<SupportedWalletProviderId>('my-near-wallet');
  const [walletAccountInput, setWalletAccountInput] = useState('');
  const [enableFnCallKey, setEnableFnCallKey] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

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

  const defaultSuggestedAccount =
    userProfile.nearAccountId ||
    `${userProfile.firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}.${userProfile.role.replace('_', '')}.testnet`;

  const handleConnectWallet = async () => {
    setWalletError(null);
    const targetAccount = (walletAccountInput || defaultSuggestedAccount).trim();
    try {
      await connectWallet({
        walletProviderId: walletProviderInput,
        accountId: targetAccount,
        enableFunctionCallSession: enableFnCallKey,
      });
      setWalletAccountInput('');
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSwitchAccount = async (nextAccount: string) => {
    setWalletError(null);
    try {
      await switchAccount(nextAccount);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderPrimaryRoleWorkspace = () => {
    if (userProfile.role === 'barangay_admin' || userProfile.role === 'system_admin') {
      return <AdminPanel />;
    }
    if (userProfile.role === 'sk_official') {
      return <SKWorkspace />;
    }
    return <YouthDashboard />;
  };

  return (
    <div className={`desktop-bank-shell ${roleThemeClass}`}>
      <div className="bank-main-viewport">
        <JudgeDemoToolbar />
        <header className="desktop-top-bar" style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-surface)' }}>
          <div className="top-bar-user-info">
            <div className="bank-brand-crest" style={{ width: 42, height: 42, borderRadius: 12, overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
              <img src="/fundora-logo.png" alt="Fundora Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div className="top-bar-title" style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Fundora <span style={{ opacity: 0.5 }}>•</span> <span style={{ color: 'var(--accent-green)' }}>Brgy. {userProfile.barangayName}</span>
              </div>
              <div className="top-bar-badge" style={{ fontSize: '0.78rem' }}>
                <MapPin size={12} style={{ color: 'var(--accent-blue)' }} />
                <span>
                  {userProfile.cityMunicipalityName}, {userProfile.provinceName} (PSGC{' '}
                  {userProfile.psgcCode})
                </span>
              </div>
            </div>
          </div>

          <div className="top-bar-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <NetworkBadge />
            <span className="badge badge-role" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
              {userProfile.role.replace('_', ' ')}
            </span>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void signOut()}
              title="Sign Out of Session"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        <main className="banking-app-container page-enter">
          {/* 1. MASTER CIVIC & WALLET BAR */}
          <div className="civic-master-card" style={{ marginBottom: '1.15rem' }}>
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

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div className="civic-balance-label">Authenticated Civic Member</div>
                <div className="civic-balance-amount" style={{ fontSize: '1.85rem' }}>
                  {userProfile.displayName}
                </div>
                <div className="civic-balance-sub">
                  Role: {userProfile.role.toUpperCase()} • Age Bracket:{' '}
                  {userProfile.ageYears} yrs ({userProfile.ageBracketStatus})
                </div>
              </div>

              {/* NEAR Wallet Selector Control Strip */}
              <div
                data-testid="near-wallet-selector-bar"
                style={{
                  background: 'var(--bg-hover)',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-primary)',
                  minWidth: '320px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Wallet size={14} style={{ color: 'var(--accent-green)' }} /> NEAR Wallet Selector (Non-Custodial)
                </div>

                {isConnected && activeAccountId ? (
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>
                        Connected:{' '}
                        <code data-testid="connected-near-account" style={{ fontWeight: 600 }}>{activeAccountId}</code> (
                        {selectedWalletId})
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        data-testid="disconnect-wallet-btn"
                        onClick={() => void disconnectWallet()}
                      >
                        Disconnect
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        <KeyRound size={12} style={{ verticalAlign: 'middle' }} /> Session
                        Key Mode:{' '}
                        <code data-testid="wallet-access-key-mode">{accessKeyMode}</code>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        data-testid="toggle-key-mode-btn"
                        onClick={() =>
                          setAccessKeyMode(
                            accessKeyMode === 'full_access_wallet'
                              ? 'function_call_session'
                              : 'full_access_wallet'
                          )
                        }
                      >
                        Switch Key Mode
                      </button>
                    </div>

                    {connectedAccounts.length > 1 && (
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <span>Switch Account:</span>
                        {connectedAccounts.map((acc) => (
                          <button
                            key={acc}
                            type="button"
                            className="btn btn-sm btn-outline"
                            disabled={acc === activeAccountId}
                            onClick={() => void handleSwitchAccount(acc)}
                          >
                            {acc}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <select
                        className="form-control"
                        style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.6rem', height: 'auto' }}
                        data-testid="wallet-provider-select"
                        value={walletProviderInput}
                        onChange={(e) =>
                          setWalletProviderInput(
                            e.target.value as SupportedWalletProviderId
                          )
                        }
                      >
                        {supportedWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-control"
                        style={{ flex: 1, minWidth: '165px', fontSize: '0.8rem', padding: '0.35rem 0.6rem', height: 'auto' }}
                        data-testid="wallet-account-input"
                        placeholder={defaultSuggestedAccount}
                        value={walletAccountInput}
                        onChange={(e) => setWalletAccountInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        data-testid="connect-wallet-btn"
                        onClick={() => void handleConnectWallet()}
                      >
                        Connect Wallet
                      </button>
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enableFnCallKey}
                        onChange={(e) => setEnableFnCallKey(e.target.checked)}
                      />
                      <span>
                        Enable 0 NEAR Function-Call session key for voting &amp; proof uploads
                      </span>
                    </label>
                  </div>
                )}

                {(walletError || networkMismatchError) && (
                  <div
                    role="alert"
                    data-testid="wallet-error-banner"
                    style={{
                      marginTop: '0.4rem',
                      fontSize: '0.76rem',
                      color: 'var(--accent-danger)',
                      fontWeight: 600,
                    }}
                  >
                    {walletError || networkMismatchError}
                  </div>
                )}
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

          {/* 2. LIVE TRANSACTION LIFECYCLE & RECONCILIATION STATUS BANNER */}
          {activeTransaction && (
            <div
              className="bank-card"
              data-testid="active-tx-lifecycle-banner"
              style={{
                marginBottom: '1rem',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  NEAR Transaction Status:{' '}
                  <code data-testid="active-tx-status">{activeTransaction.status}</code> •
                  Method: <code>{activeTransaction.methodName}</code>
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                  Signer: <code>{activeTransaction.signerAccountId}</code>
                  {activeTransaction.txHash && (
                    <>
                      {' '}
                      • TxHash: <code>{activeTransaction.txHash}</code>
                    </>
                  )}
                  {activeTransaction.reconciliationReason && (
                    <> • {activeTransaction.reconciliationReason}</>
                  )}
                </div>
              </div>

              {activeTransaction.status === 'RECONCILIATION_REQUIRED' &&
                activeTransaction.projectId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    data-testid="banner-reconcile-btn"
                    onClick={() => void reconcileProject(activeTransaction.projectId!)}
                  >
                    <RefreshCw size={14} /> Sync State from NEAR
                  </button>
                )}
            </div>
          )}

          {/* 3. WORKSPACE NAVIGATION TABS */}
          <nav
            aria-label="Civic Workspace Navigation"
            style={{
              display: 'flex',
              gap: '0.4rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              padding: '0.35rem',
              background: 'var(--bg-hover)',
              borderRadius: '8px',
              border: '1px solid var(--border-primary)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${
                activeTab === 'workspace' ? 'btn-primary' : 'btn-outline'
              }`}
              style={{
                borderRadius: '6px',
                fontWeight: 600,
                padding: '0.5rem 0.95rem',
                border: activeTab === 'workspace' ? '1px solid var(--primary)' : '1px solid transparent',
                background: activeTab === 'workspace' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'workspace' ? '#ffffff' : 'var(--text-secondary)',
              }}
              data-testid="nav-tab-workspace"
              onClick={() => setActiveTab('workspace')}
            >
              <LayoutDashboard size={15} /> Primary Workspace ({userProfile.role.replace('_', ' ')})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                activeTab === 'transparency' ? 'btn-primary' : 'btn-outline'
              }`}
              style={{
                borderRadius: '6px',
                fontWeight: 600,
                padding: '0.5rem 0.95rem',
                border: activeTab === 'transparency' ? '1px solid var(--primary)' : '1px solid transparent',
                background: activeTab === 'transparency' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'transparency' ? '#ffffff' : 'var(--text-secondary)',
              }}
              data-testid="nav-tab-transparency"
              onClick={() => setActiveTab('transparency')}
            >
              <Globe size={15} /> Public Transparency Hub
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                activeTab === 'activity' ? 'btn-primary' : 'btn-outline'
              }`}
              style={{
                borderRadius: '6px',
                fontWeight: 600,
                padding: '0.5rem 0.95rem',
                border: activeTab === 'activity' ? '1px solid var(--primary)' : '1px solid transparent',
                background: activeTab === 'activity' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'activity' ? '#ffffff' : 'var(--text-secondary)',
              }}
              data-testid="nav-tab-activity"
              onClick={() => setActiveTab('activity')}
            >
              <Activity size={15} /> Ledger Activity &amp; References
              {pendingReconciliations.length > 0 && (
                <span className="badge badge-warning" style={{ marginLeft: '0.4rem', padding: '0.15rem 0.45rem' }}>
                  <AlertTriangle size={11} /> {pendingReconciliations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                activeTab === 'profile' ? 'btn-primary' : 'btn-outline'
              }`}
              style={{
                borderRadius: '6px',
                fontWeight: 600,
                padding: '0.5rem 0.95rem',
                border: activeTab === 'profile' ? '1px solid var(--primary)' : '1px solid transparent',
                background: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'profile' ? '#ffffff' : 'var(--text-secondary)',
              }}
              data-testid="nav-tab-profile"
              onClick={() => setActiveTab('profile')}
            >
              <UserCheck size={15} /> Profile &amp; KYC Vault
            </button>
          </nav>

          {/* 4. ACTIVE TAB VIEWPORT */}
          {activeTab === 'workspace' && renderPrimaryRoleWorkspace()}
          {activeTab === 'transparency' && (
            <TransparencyHub defaultBarangayId={userProfile.barangayId} />
          )}
          {activeTab === 'activity' && <ActivityView />}
          {activeTab === 'profile' && (
            <div className="grid-2-equal" data-testid="profile-kyc-vault-view">
              <div className="bank-card">
                <h3 className="bank-card-title">Public Routing Record (`users/{'{uid}'}`)</h3>
                <p className="bank-card-subtitle">
                  Contains strictly non-sensitive jurisdiction and role routing metadata
                </p>
                <div
                  className="bank-card-body"
                  style={{ marginTop: '0.85rem', fontSize: '0.84rem' }}
                >
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
                    <strong>Linked NEAR Account:</strong>{' '}
                    <code>{userProfile.nearAccountId || 'None'}</code>
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
                <div
                  className="bank-card-body"
                  style={{ marginTop: '0.85rem', fontSize: '0.84rem' }}
                >
                  <div>
                    <strong>Formatted Address:</strong>{' '}
                    {registrationRecord?.fullFormattedAddress || 'Protected'}
                  </div>
                  <div>
                    <strong>Primary ID Type:</strong>{' '}
                    {registrationRecord?.primaryIdType || 'N/A'}
                  </div>
                  <div>
                    <strong>SHA-256 Document Hashes:</strong>{' '}
                    {registrationRecord?.documentHashes.length || 0} recorded
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

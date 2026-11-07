import React from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Landmark,
  ArrowRight,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { NetworkBadge } from '../components/NetworkBadge';
import { JudgeDemoToolbar } from '../components/JudgeDemoToolbar';
import { useTheme } from '../contexts/ThemeContext';

interface LandingViewProps {
  onLaunchOnboarding: () => void;
  onOpenTransparencyHub?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onLaunchOnboarding,
  onOpenTransparencyHub,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
      <JudgeDemoToolbar />
      <div className="aurora-glow-container">
        <div className="aurora-glow-orb aurora-orb-1" />
        <div className="aurora-glow-orb aurora-orb-2" />
      </div>

      {/* Top Navigation */}
      <header className="desktop-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="bank-brand-crest" style={{ overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/fundora-logo.png" alt="Fundora Shield Crest" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div className="bank-brand-title">Fundora</div>
            <div className="bank-brand-network">
              <span className="pulse-beacon" />
              <span>NEAR Civic Treasury & Milestone Escrow</span>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <NetworkBadge />
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onLaunchOnboarding}>
            Launch Civic Vault
          </button>
        </div>
      </header>

      <main className="banking-app-container page-enter" style={{ paddingTop: '2.5rem' }}>
        <div className="civic-master-card" style={{ padding: '2.25rem' }}>
          <div className="civic-card-top">
            <span className="civic-card-chip-tag">
              <Sparkles size={14} /> NEAR Protocol × Gemini AI Auditor
            </span>
            <span className="badge badge-info">R.A. 10742 Compliant</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.1rem)',
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
            }}
          >
            Programmable Civic Escrow & AI Procurement Auditing on{' '}
            <span className="landing-shimmer-text">NEAR Protocol</span>
          </h1>

          <p
            style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              maxWidth: 720,
              lineHeight: 1.6,
            }}
          >
            Fundora secures Philippine Sangguniang Kabataan (SK) and Barangay development funds in
            3-tranche milestone escrows (40% / 40% / 20%), audited against DTI Suggested Retail
            Prices and governed by verified youth voters.
          </p>

          <div className="civic-card-action-bar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-lg" onClick={onLaunchOnboarding}>
              <span>Register or Sign In to Barangay Vault</span>
              <ArrowRight size={18} />
            </button>
            {onOpenTransparencyHub && (
              <button
                type="button"
                className="btn btn-outline btn-lg"
                data-testid="landing-open-transparency-btn"
                onClick={onOpenTransparencyHub}
              >
                <Globe size={18} />
                <span>Explore Public Transparency Hub</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Pillar Cards */}
        <div className="stats-grid-3">
          <div className="tech-stack-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Landmark size={24} style={{ color: 'var(--role-accent)' }} />
              <h3 className="bank-card-title">40 / 40 / 20 NEAR Escrow</h3>
              <p className="text-secondary-sm">
                Rust smart contract locks project allocations in yoctoNEAR and enforces 60%
                community quorum before releasing milestone tranches.
              </p>
            </div>
          </div>

          <div className="tech-stack-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Sparkles size={24} style={{ color: 'var(--accent-blue)' }} />
              <h3 className="bank-card-title">Server-Gated AI Procurement Audit</h3>
              <p className="text-secondary-sm">
                Audits line items against DTI SRP benchmarks, recommends inter-agency equipment
                borrowing, and records SHA-256 audit digests on NEAR.
              </p>
            </div>
          </div>

          <div className="tech-stack-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Lock size={24} style={{ color: 'var(--accent-yellow)' }} />
              <h3 className="bank-card-title">Zero-Custody & PSGC Scoped</h3>
              <p className="text-secondary-sm">
                Non-custodial NEAR wallet linking with zero private keys in storage, isolated PII
                vaults, and 10-digit PSGC barangay boundaries.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

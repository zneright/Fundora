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
  FileCheck2,
  Users,
  Coins,
  Cpu,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { NetworkBadge } from '../components/NetworkBadge';
import { JudgeDemoToolbar } from '../components/JudgeDemoToolbar';
import { InteractiveCanvasBackground } from '../components/InteractiveCanvasBackground';
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
    <div style={{ minHeight: '100dvh', position: 'relative', overflowX: 'hidden' }}>
      <InteractiveCanvasBackground />
      <JudgeDemoToolbar />

      <div className="aurora-glow-container" style={{ pointerEvents: 'none' }}>
        <div className="aurora-glow-orb aurora-orb-1" />
        <div className="aurora-glow-orb aurora-orb-2" />
      </div>

      {/* Modern Top Header */}
      <header
        className="desktop-top-bar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            className="bank-brand-crest"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              overflow: 'hidden',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
            }}
          >
            <img
              src="/fundora-logo.png"
              alt="Fundora Shield Crest"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              className="bank-brand-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              Fundora
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 6,
                  background: 'var(--accent-green-soft)',
                  color: 'var(--accent-green)',
                  border: '1px solid var(--role-accent-border)',
                }}
              >
                NEAR TESTNET
              </span>
            </div>
            <div className="bank-brand-network" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              <span className="pulse-beacon" />
              <span>Civic Treasury &amp; Milestone Escrow</span>
            </div>
          </div>
        </div>

        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NetworkBadge />
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ fontWeight: 700, padding: '0.5rem 1rem' }}
            onClick={onLaunchOnboarding}
          >
            Launch Vault <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main
        className="banking-app-container page-enter"
        style={{ position: 'relative', zIndex: 10, paddingTop: '2.5rem', paddingBottom: '3.5rem' }}
      >
        <div
          className="civic-master-card"
          style={{
            padding: '2.75rem 2.25rem',
            background:
              'linear-gradient(135deg, rgba(7, 10, 18, 0.95) 0%, rgba(15, 20, 34, 0.92) 55%, rgba(13, 148, 136, 0.12) 100%)',
            border: '1px solid rgba(0, 214, 101, 0.25)',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 214, 101, 0.12)',
            borderRadius: 24,
          }}
        >
          <div className="civic-card-top" style={{ marginBottom: '1.25rem' }}>
            <span
              className="civic-card-chip-tag"
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.8rem',
                borderRadius: 9999,
                background: 'rgba(0, 214, 101, 0.12)',
                border: '1px solid rgba(0, 214, 101, 0.3)',
                color: 'var(--accent-green)',
                fontWeight: 700,
              }}
            >
              <Sparkles size={14} /> NEAR Protocol × Gemini 2.5 Flash AI Auditor
            </span>
            <span className="badge badge-info" style={{ fontWeight: 700 }}>
              Philippine R.A. 10742 Compliant
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
            }}
          >
            Autonomous Civic Treasury &amp; Milestone Escrow on{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #00d665 0%, #007dfe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              NEAR Protocol
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.1rem',
              color: 'var(--text-secondary)',
              maxWidth: 780,
              lineHeight: 1.65,
              marginBottom: '1.8rem',
            }}
          >
            Fundora eliminates barangay corruption and ghost projects by locking youth development funds in
            programmable <strong>40% / 40% / 20% milestone escrows</strong>. Procurement is audited against
            DTI Suggested Retail Prices by Gemini AI, and funds release only when <strong>60% of verified youth</strong> vote yes.
          </p>

          <div
            className="civic-card-action-bar"
            style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}
          >
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.85rem 1.6rem',
                borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0, 214, 101, 0.35)',
              }}
              onClick={onLaunchOnboarding}
            >
              <span>Access Barangay Civic Vault</span>
              <ArrowRight size={18} />
            </button>
            {onOpenTransparencyHub && (
              <button
                type="button"
                className="btn btn-outline btn-lg"
                data-testid="landing-open-transparency-btn"
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  padding: '0.85rem 1.5rem',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.04)',
                }}
                onClick={onOpenTransparencyHub}
              >
                <Globe size={18} />
                <span>Explore Public Transparency Ledger</span>
              </button>
            )}
          </div>
        </div>

        {/* Protocol Trust & Metrics Ticker */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            margin: '2rem 0',
          }}
        >
          <div
            className="bank-card"
            style={{
              padding: '1.25rem',
              borderRadius: 18,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)' }}>
              <Coins size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Escrow Enforced
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.4rem' }}>40% / 40% / 20%</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Mobilization, delivery &amp; retention tranches
            </div>
          </div>

          <div
            className="bank-card"
            style={{
              padding: '1.25rem',
              borderRadius: 18,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)' }}>
              <Users size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Quorum Governance
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.4rem' }}>60% Supermajority</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              3-vote production floor • 1-vote sandbox
            </div>
          </div>

          <div
            className="bank-card"
            style={{
              padding: '1.25rem',
              borderRadius: 18,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-teal)' }}>
              <Cpu size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Gemini AI Auditing
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.4rem' }}>DTI SRP Benchmark</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Automated procurement price check &amp; OCR
            </div>
          </div>

          <div
            className="bank-card"
            style={{
              padding: '1.25rem',
              borderRadius: 18,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-yellow)' }}>
              <Lock size={18} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Non-Custodial Security
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.4rem' }}>Zero Private Keys</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Function-Call keys scoped to 0.25 NEAR
            </div>
          </div>
        </div>

        {/* 4-Step Interactive Protocol Visualizer */}
        <div style={{ margin: '2.5rem 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>How Trustless Barangay Governance Works</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              From SK youth proposal to verified on-chain settlement
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div
              className="bank-card"
              style={{
                padding: '1.5rem',
                borderRadius: 20,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-green-soft)',
                  color: 'var(--accent-green)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                SK Submits Proposal
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                SK Chairperson creates a project with itemized Bill of Quantities (BOQ) and 40/40/20 milestone milestones.
              </p>
            </div>

            <div
              className="bank-card"
              style={{
                padding: '1.5rem',
                borderRadius: 20,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-blue-soft)',
                  color: 'var(--accent-blue)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                AI Audits Pricing
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Gemini 2.5 Flash scans item costs against DTI SRP caps, detects duplicate receipts, and issues an SHA-256 attestation.
              </p>
            </div>

            <div
              className="bank-card"
              style={{
                padding: '1.5rem',
                borderRadius: 20,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-yellow-soft)',
                  color: 'var(--accent-yellow)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Admin Escrows NEAR
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Barangay Captain locks treasury NEAR tokens directly into the audited smart contract at <code>fundora-contract-bestdish.testnet</code>.
              </p>
            </div>

            <div
              className="bank-card"
              style={{
                padding: '1.5rem',
                borderRadius: 20,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-elevated)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-green-soft)',
                  color: 'var(--accent-green)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}
              >
                4
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Youth Vote &amp; Payout
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Youth inspect photo evidence and vote. Reaching the 60% quorum threshold triggers trustless payout to contractor wallets.
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Table: Traditional vs Fundora */}
        <div
          className="bank-card"
          style={{
            padding: '2rem',
            borderRadius: 22,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-surface)',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', textAlign: 'center' }}>
            Why Autonomous Civic Escrow Matters
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Governance Layer</th>
                  <th style={{ padding: '0.75rem', color: 'var(--accent-danger)' }}>Traditional Bureaucracy</th>
                  <th style={{ padding: '0.75rem', color: 'var(--accent-green)' }}>Fundora Protocol</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.85rem', fontWeight: 600 }}>Fund Disbursement</td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>100% upfront checks; high risk of ghost projects</td>
                  <td style={{ padding: '0.85rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    40% / 40% / 20% milestone releases locked in NEAR escrow
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.85rem', fontWeight: 600 }}>Procurement Pricing</td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>Manual paper canvass; susceptible to padded quotes</td>
                  <td style={{ padding: '0.85rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    Gemini AI price check against official DTI SRP catalog
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.85rem', fontWeight: 600 }}>Resident Consensus</td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>Limited public attendance; closed-door decisions</td>
                  <td style={{ padding: '0.85rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    60% on-chain youth voter quorum with NearBlocks proof
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.85rem', fontWeight: 600 }}>Audit Trail</td>
                  <td style={{ padding: '0.85rem', color: 'var(--text-secondary)' }}>Physical logbooks; delayed COA reports</td>
                  <td style={{ padding: '0.85rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    Public real-time ledger with verifiable SHA-256 PDF receipts
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

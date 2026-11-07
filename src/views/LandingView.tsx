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
  Users,
  Coins,
  Cpu,
  CheckCircle2,
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
    <div style={{ minHeight: '100dvh', background: '#ffffff', color: '#111827' }}>
      <JudgeDemoToolbar />

      {/* Top Header */}
      <header
        className="desktop-top-bar"
        style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
            }}
          >
            <img
              src="/fundora-logo.png"
              alt="Fundora Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#111827' }}>
              Fundora
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
              Republic of the Philippines • Civic Treasury Protocol
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <NetworkBadge />
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onLaunchOnboarding}
          >
            Access Vault <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="banking-app-container page-enter" style={{ paddingTop: '2.5rem', paddingBottom: '3.5rem', maxWidth: 1040 }}>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '2.25rem 2rem',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '0.2rem 0.6rem',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Philippine R.A. 10742 Compliant
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#2563eb',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '0.2rem 0.6rem',
                borderRadius: 6,
              }}
            >
              NEAR Testnet
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.9rem, 4vw, 2.75rem)',
              fontWeight: 800,
              lineHeight: 1.18,
              letterSpacing: '-0.025em',
              color: '#111827',
              marginBottom: '0.85rem',
            }}
          >
            Autonomous Civic Treasury &amp; Milestone Escrow on NEAR Protocol
          </h1>

          <p
            style={{
              fontSize: '1rem',
              color: '#4b5563',
              maxWidth: 720,
              lineHeight: 1.6,
              marginBottom: '1.75rem',
            }}
          >
            Fundora eliminates ghost projects and procurement anomalies by locking Philippine Sangguniang
            Kabataan (SK) and Barangay funds in <strong>40% / 40% / 20% milestone escrows</strong>. Procurement is
            audited against DTI Suggested Retail Prices, and funds release only when <strong>60% of verified youth</strong> vote yes.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.35rem', fontSize: '0.92rem' }}
              onClick={onLaunchOnboarding}
            >
              <span>Access Barangay Civic Vault</span>
              <ArrowRight size={15} />
            </button>
            {onOpenTransparencyHub && (
              <button
                type="button"
                className="btn btn-outline"
                data-testid="landing-open-transparency-btn"
                style={{ padding: '0.65rem 1.35rem', fontSize: '0.92rem' }}
                onClick={onOpenTransparencyHub}
              >
                <Globe size={15} />
                <span>Explore Public Transparency Ledger</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Protocol Invariant Metrics (Clean White Boxes) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              padding: '1.15rem',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#059669', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Coins size={15} />
              <span>Milestone Escrow</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem', color: '#111827' }}>
              40% / 40% / 20%
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
              Mobilization, delivery &amp; retention tranches
            </div>
          </div>

          <div
            style={{
              padding: '1.15rem',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Users size={15} />
              <span>Quorum Threshold</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem', color: '#111827' }}>
              60% Supermajority
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
              Min 3 votes (production) • 1 vote (sandbox)
            </div>
          </div>

          <div
            style={{
              padding: '1.15rem',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0d9488', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Cpu size={15} />
              <span>AI Procurement Audit</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem', color: '#111827' }}>
              DTI SRP Benchmark
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
              Price variance check &amp; SHA-256 digest
            </div>
          </div>

          <div
            style={{
              padding: '1.15rem',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#d97706', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Lock size={15} />
              <span>Non-Custodial</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem', color: '#111827' }}>
              Zero Private Keys
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.15rem' }}>
              0.25 NEAR Function-Call session keys
            </div>
          </div>
        </div>

        {/* 4-Step Governance Flow */}
        <div style={{ marginBottom: '2.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.4rem' }}>
            How the Civic Escrow Protocol Works
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.1rem' }}>
            Sequential milestone releases governed by Philippine youth voters
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            <div
              style={{
                padding: '1.1rem',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem' }}>
                1
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
                Proposal Authoring
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
                SK Official authors an initiative with itemized Bill of Quantities (BOQ) and 40/40/20 milestone schedule.
              </p>
            </div>

            <div
              style={{
                padding: '1.1rem',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem' }}>
                2
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
                AI Price Verification
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
                Gemini AI audits procurement line items against official DTI price caps and checks for duplicate claims.
              </p>
            </div>

            <div
              style={{
                padding: '1.1rem',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fffbeb', color: '#d97706', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem' }}>
                3
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
                On-Chain Escrow Deposit
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
                Barangay Captain locks NEAR tokens directly into <code>fundora-contract-bestdish.testnet</code>.
              </p>
            </div>

            <div
              style={{
                padding: '1.1rem',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.65rem' }}>
                4
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem' }}>
                60% Quorum Release
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
                Verified youth inspect photo proof and vote. Reaching the 60% threshold triggers trustless payout.
              </p>
            </div>
          </div>
        </div>

        {/* Clean Comparison Table */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '1.5rem',
            background: '#ffffff',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginBottom: '0.85rem' }}>
            System Comparison
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem', color: '#6b7280' }}>Governance Dimension</th>
                  <th style={{ padding: '0.65rem', color: '#dc2626' }}>Traditional Barangay Bureaucracy</th>
                  <th style={{ padding: '0.65rem', color: '#059669' }}>Fundora Protocol</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Disbursement Schedule</td>
                  <td style={{ padding: '0.75rem', color: '#4b5563' }}>100% upfront release; prone to ghost projects</td>
                  <td style={{ padding: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    40% / 40% / 20% milestone escrow on NEAR
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Procurement Audit</td>
                  <td style={{ padding: '0.75rem', color: '#4b5563' }}>Manual paperwork; susceptible to price padding</td>
                  <td style={{ padding: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    Gemini AI price check against DTI SRP caps
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Community Consensus</td>
                  <td style={{ padding: '0.75rem', color: '#4b5563' }}>Closed-door meetings; low public participation</td>
                  <td style={{ padding: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    60% on-chain youth quorum with explorer proof
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Audit Ledger</td>
                  <td style={{ padding: '0.75rem', color: '#4b5563' }}>Physical logbooks; delayed annual COA reports</td>
                  <td style={{ padding: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    Real-time public ledger with SHA-256 e-Disbursement receipts
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal Requirements vs Fundora Application Rules */}
        <div
          style={{
            marginTop: '2rem',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '1.5rem',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <ShieldCheck size={20} color="#059669" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              Statutory Framework &amp; Fundora System Rules
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.82rem' }}>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '0.35rem' }}>
                Philippine Statutory Requirements
              </div>
              <ul style={{ paddingLeft: '1.1rem', margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
                <li><strong>R.A. 10742 (amended by R.A. 11768):</strong> Katipunan ng Kabataan (KK) voters must be ages 15–30 residing in the barangay for at least 6 months.</li>
                <li><strong>SK Officials:</strong> Must be at least 18 years old. Elected officials (Chairperson/Kagawad) must be ages 18–24 on election day; appointed officials (Secretary/Treasurer) may be up to 30.</li>
                <li><strong>R.A. 7160 (Local Government Code):</strong> Local government units hold primary executive custody over public funds.</li>
                <li><strong>R.A. 8792 (E-Commerce Act):</strong> Electronic signatures and cryptographic hashes hold legal standing for digital audit records.</li>
              </ul>
            </div>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '0.35rem' }}>
                Fundora Application &amp; Contract Rules
              </div>
              <ul style={{ paddingLeft: '1.1rem', margin: 0, color: '#4b5563', lineHeight: 1.6 }}>
                <li><strong>40% / 40% / 20% Schedule:</strong> Fundora's smart contract disbursement rule for stage-gate release, not a statutory mandate.</li>
                <li><strong>Barangay Admin Invite Code:</strong> Fundora protocol access control preventing unauthorized administrator account claims.</li>
                <li><strong>Automatic Viewer Role:</strong> Fundora routing rule granting residents over 30 verified inspection access to all civic ledgers.</li>
                <li><strong>Advisory AI Audit:</strong> Gemini AI provides algorithmic DTI benchmark comparisons; final approval rests strictly with community vote.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Searchable / Interactive FAQ Accordion */}
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: '1.5rem',
            background: '#ffffff',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginBottom: '0.85rem' }}>
            Frequently Asked Questions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <details style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', background: '#f9fafb' }}>
              <summary style={{ fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none' }}>
                Do youth residents pay gas fees when casting votes?
              </summary>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                No. Fundora provisions a limited Function-Call session key with a 0.25 NEAR allowance and 0 yoctoNEAR deposit limit. Transactions are sponsored for the youth voter so they can participate without acquiring cryptocurrency.
              </div>
            </details>
            <details style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', background: '#f9fafb' }}>
              <summary style={{ fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none' }}>
                How does the 60% voting quorum operate?
              </summary>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                A milestone release requires at least 60% affirmative votes among cast votes, subject to an on-chain floor of at least 3 verified votes in production (1 vote in sandbox mode). Escrow cannot be drained by low turnout or collusion.
              </div>
            </details>
            <details style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', background: '#f9fafb' }}>
              <summary style={{ fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none' }}>
                Can AI independently release or confiscate escrow funds?
              </summary>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                No. Gemini AI is strictly advisory. It cross-checks unit prices against the DTI Suggested Retail Price database and flags potential anomalies. Only verified community members and smart contract voting logic can trigger fund disbursements.
              </div>
            </details>
            <details style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem', background: '#f9fafb' }}>
              <summary style={{ fontWeight: 600, color: '#111827', cursor: 'pointer', outline: 'none' }}>
                Where are project files and receipts stored?
              </summary>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.5 }}>
                Evidence documents and vouchers are stored in secured Google Cloud Storage buckets, with cryptographic SHA-256 digests permanently anchored on the NEAR blockchain to ensure tamper resistance.
              </div>
            </details>
          </div>
        </div>

        {/* Institutional Footer */}
        <footer
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: '#6b7280',
            gap: '1rem',
          }}
        >
          <div>
            <strong>Fundora Civic Treasury Protocol</strong> &bull; Open-source civic infrastructure deployed on NEAR Protocol Testnet. Not an official agency portal.
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ fontFamily: 'monospace' }}>Contract: fundora-contract-bestdish.testnet</span>
            <span>Storage Reserve: 0.05 NEAR</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

/**
 * Fundora — Isolated Hackathon Judge Demo Toolbar (`JudgeDemoToolbar.tsx`)
 *
 * Scoped strictly to:
 *   - Barangay: `Brgy. San Antonio (Demo)`
 *   - Barangay ID: `brgy_demo_001` (PSGC `1374030250`)
 *
 * Features:
 * - Visible DEMO MODE indicator & SIMULATED SANDBOX warning
 * - 1-click persona switching (`barangay_admin`, `sk_official`, `resident`, `viewer`, `system_admin`)
 * - Strict isolation from real users and production barangays
 * - Clean session restoration when exiting Demo Mode
 */

import React, { useState } from 'react';
import { Sparkles, LogOut, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import {
  DEMO_BARANGAY_NAME,
  JUDGE_DEMO_PERSONAS,
  demoSandboxService,
  isDemoPersonaProfile,
  type DemoPersonaDefinition,
} from '../services/demoSeed.service';
import { DEMO_BARANGAY_ID } from '../services/nearContract.service';
import type { UserRole } from '../types';

export interface JudgeDemoToolbarProps {
  onExitUnauthenticatedDemo?: () => void;
}

export const JudgeDemoToolbar: React.FC<JudgeDemoToolbarProps> = ({
  onExitUnauthenticatedDemo,
}) => {
  const {
    session,
    userProfile,
    registrationRecord,
    setSessionAndProfile,
    signOut,
  } = useAuth();
  const { connectWallet, disconnectWallet } = useNearWallet();
  const [isSwitching, setIsSwitching] = useState(false);

  const isInDemo =
    demoSandboxService.isDemoModeActive() || isDemoPersonaProfile(userProfile);

  const handleActivatePersona = async (persona: DemoPersonaDefinition) => {
    setIsSwitching(true);
    try {
      demoSandboxService.captureRealUserBeforeDemo(
        session,
        userProfile,
        registrationRecord
      );
      await demoSandboxService.ensureDemoSandboxSeeded();

      setSessionAndProfile(
        {
          uid: persona.uid,
          email: persona.profile.email,
          emailVerified: true,
        },
        persona.profile,
        null
      );

      await connectWallet({
        walletProviderId: 'my-near-wallet',
        accountId: persona.nearAccountId,
        enableFunctionCallSession:
          persona.personaId === 'resident' || persona.personaId === 'sk_official',
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleEnterDemoDefault = async (role: UserRole = 'barangay_admin') => {
    const found =
      JUDGE_DEMO_PERSONAS.find((p) => p.personaId === role) || JUDGE_DEMO_PERSONAS[0];
    await handleActivatePersona(found);
  };

  const handleExitDemoMode = async () => {
    setIsSwitching(true);
    try {
      const restored = demoSandboxService.consumeRestoredRealUserOnExit();
      if (restored && restored.session && restored.profile) {
        setSessionAndProfile(
          restored.session,
          restored.profile,
          restored.registrationRecord
        );
        if (restored.profile.nearAccountId) {
          await connectWallet({
            walletProviderId: 'my-near-wallet',
            accountId: restored.profile.nearAccountId,
          });
        } else {
          await disconnectWallet();
        }
      } else {
        await disconnectWallet();
        await signOut();
        onExitUnauthenticatedDemo?.();
      }
    } finally {
      setIsSwitching(false);
    }
  };

  if (!isInDemo) {
    return (
      <div
        data-testid="judge-demo-launcher-bar"
        style={{
          padding: '0.6rem 1.25rem',
          background: '#eff6ff',
          borderBottom: '1px solid #dbeafe',
          color: '#1e40af',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.82rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={15} />
          <span>
            <strong>NEAR Hackathon 2026 Judge Sandbox:</strong> Explore isolated{' '}
            <code>Brgy. {DEMO_BARANGAY_NAME}</code> (<code>{DEMO_BARANGAY_ID}</code>) with
            pre-seeded escrows, AI audits &amp; quorum voting.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={isSwitching}
          data-testid="enter-judge-demo-btn"
          onClick={() => void handleEnterDemoDefault('barangay_admin')}
        >
          <Sparkles size={14} /> Launch Isolated Judge Demo Mode
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Judge Demo Mode Toolbar"
      data-testid="judge-demo-active-toolbar"
      style={{
        padding: '0.75rem 1.25rem',
        background: '#fffbeb',
        borderBottom: '1px solid #fde68a',
        color: '#92400e',
        display: 'grid',
        gap: '0.55rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span
            className="badge badge-warning"
            data-testid="demo-mode-indicator-badge"
            style={{ fontWeight: 800 }}
          >
            <ShieldAlert size={13} /> DEMO MODE ACTIVE — SIMULATED SANDBOX
          </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
            Isolated Jurisdiction: <code>Brgy. {DEMO_BARANGAY_NAME}</code> (
            <code data-testid="demo-toolbar-barangay-id">{DEMO_BARANGAY_ID}</code>) • Zero Real
            Funds or Production Records Touched
          </span>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={isSwitching}
          data-testid="exit-judge-demo-btn"
          onClick={() => void handleExitDemoMode()}
        >
          <LogOut size={14} /> Exit Demo Mode &amp; Restore Real Session
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          fontSize: '0.79rem',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          <Users size={13} style={{ verticalAlign: 'middle' }} /> Switch Demo Persona:
        </span>
        {JUDGE_DEMO_PERSONAS.map((p) => {
          const isCurrent = userProfile?.uid === p.uid;
          return (
            <button
              key={p.personaId}
              type="button"
              disabled={isSwitching}
              data-testid={`demo-persona-btn-${p.personaId}`}
              className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => void handleActivatePersona(p)}
              title={p.description}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};


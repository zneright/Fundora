/**
 * Fundora — Isolated Judge Demo Sandbox Seeder & Persona Manager (`demoSeed.service.ts`)
 *
 * Scoped strictly to:
 *   - Barangay Name: `Brgy. San Antonio (Demo)`
 *   - Barangay ID: `brgy_demo_001` (PSGC `1374030250`)
 *
 * Security & Isolation Invariants:
 * 1. Demo personas (`uid_demo_*`) are strictly locked to `brgy_demo_001`.
 * 2. Demo actions never broadcast real transactions or modify non-demo barangay balances.
 * 3. Entering Demo Mode snapshots the real user's session/profile so exiting restores it 100%.
 */

import { DEMO_BARANGAY_ID, nearContractService } from './nearContract.service';
import { userRepository } from '../repositories/user.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import type { LocalAuthSession } from './auth.service';
import type {
  ProposalDocument,
  RegistrationRecordDocument,
  UserProfile,
  UserRole,
} from '../types';

export const DEMO_BARANGAY_NAME = 'San Antonio (Demo)';
export const DEMO_PSGC_CODE = '1374030250';

export interface DemoPersonaDefinition {
  personaId: UserRole;
  label: string;
  description: string;
  uid: string;
  nearAccountId: string;
  profile: UserProfile;
}

export const JUDGE_DEMO_PERSONAS: ReadonlyArray<DemoPersonaDefinition> = [
  {
    personaId: 'barangay_admin',
    label: 'Barangay Admin (Demo)',
    description: 'Fund escrow (create_project), approve KYC, or refund disputed escrow to treasury',
    uid: 'uid_demo_barangay_admin',
    nearAccountId: 'admin-demo.fundora.testnet',
    profile: {
      uid: 'uid_demo_barangay_admin',
      email: 'admin.demo@fundora.ph',
      emailVerified: true,
      displayName: 'Punong Brgy. Raymond Lising (Demo)',
      firstName: 'Raymond',
      lastName: 'Lising',
      role: 'barangay_admin',
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      cityMunicipalityName: 'City of Pasig',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1605',
      ageYears: 42,
      ageBracketStatus: 'over_30_viewer',
      verificationStatus: 'approved',
      nearAccountId: 'admin-demo.fundora.testnet',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  },
  {
    personaId: 'sk_official',
    label: 'SK Official (Demo)',
    description: 'Author proposals, run AI procurement audits, and submit milestone proofs',
    uid: 'uid_demo_sk_official',
    nearAccountId: 'sk-demo.fundora.testnet',
    profile: {
      uid: 'uid_demo_sk_official',
      email: 'sk.demo@fundora.ph',
      emailVerified: true,
      displayName: 'SK Chair Andrea Santos (Demo)',
      firstName: 'Andrea',
      lastName: 'Santos',
      role: 'sk_official',
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      cityMunicipalityName: 'City of Pasig',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1605',
      ageYears: 23,
      ageBracketStatus: 'eligible_youth',
      verificationStatus: 'approved',
      nearAccountId: 'sk-demo.fundora.testnet',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  },
  {
    personaId: 'resident',
    label: 'Youth Resident Voter (Demo)',
    description: 'Inspect milestone evidence and cast binding 1-resident-1-vote quorum votes',
    uid: 'uid_demo_resident',
    nearAccountId: 'resident-demo.fundora.testnet',
    profile: {
      uid: 'uid_demo_resident',
      email: 'resident.demo@fundora.ph',
      emailVerified: true,
      displayName: 'Youth Voter Marco Reyes (Demo)',
      firstName: 'Marco',
      lastName: 'Reyes',
      role: 'resident',
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      cityMunicipalityName: 'City of Pasig',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1605',
      ageYears: 20,
      ageBracketStatus: 'eligible_youth',
      verificationStatus: 'approved',
      nearAccountId: 'resident-demo.fundora.testnet',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  },
  {
    personaId: 'viewer',
    label: 'Over-30 Public Viewer (Demo)',
    description: 'Read-only public transparency & receipt verification (cannot vote)',
    uid: 'uid_demo_viewer',
    nearAccountId: 'viewer-demo.fundora.testnet',
    profile: {
      uid: 'uid_demo_viewer',
      email: 'viewer.demo@fundora.ph',
      emailVerified: true,
      displayName: 'Senior Citizen Elena Gomez (Demo)',
      firstName: 'Elena',
      lastName: 'Gomez',
      role: 'viewer',
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      cityMunicipalityName: 'City of Pasig',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1605',
      ageYears: 54,
      ageBracketStatus: 'over_30_viewer',
      verificationStatus: 'approved',
      nearAccountId: 'viewer-demo.fundora.testnet',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  },
  {
    personaId: 'system_admin',
    label: 'System Admin (Demo)',
    description: 'Jurisdiction oversight & quorum configuration within Demo Sandbox',
    uid: 'uid_demo_system_admin',
    nearAccountId: 'admin.fundora.testnet',
    profile: {
      uid: 'uid_demo_system_admin',
      email: 'sysadmin.demo@fundora.ph',
      emailVerified: true,
      displayName: 'System Auditor (Demo Sandbox)',
      firstName: 'System',
      lastName: 'Auditor',
      role: 'system_admin',
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      cityMunicipalityName: 'City of Pasig',
      provinceName: 'Metro Manila',
      regionName: 'National Capital Region (NCR)',
      zipCode: '1605',
      ageYears: 35,
      ageBracketStatus: 'over_30_viewer',
      verificationStatus: 'approved',
      nearAccountId: 'admin.fundora.testnet',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    },
  },
] as const;

export interface SavedRealUserSnapshot {
  session: LocalAuthSession | null;
  profile: UserProfile | null;
  registrationRecord: RegistrationRecordDocument | null;
  savedAt: string;
}

let savedRealSnapshot: SavedRealUserSnapshot | null = null;
let demoModeActive = false;

export function isDemoPersonaProfile(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.barangayId === DEMO_BARANGAY_ID || profile.uid.startsWith('uid_demo_')
  );
}

export function assertDemoBarangayIsolation(
  actorProfile: UserProfile | null,
  targetBarangayId: string
): void {
  if (!actorProfile) return;
  const actorIsDemo = isDemoPersonaProfile(actorProfile);
  const targetIsDemo = targetBarangayId === DEMO_BARANGAY_ID;
  if (actorIsDemo && !targetIsDemo) {
    throw new Error(
      `ERR_DEMO_ISOLATION_VIOLATION: Judge Demo Persona (${actorProfile.uid}) is strictly isolated to "${DEMO_BARANGAY_ID}" and cannot access or mutate real barangay "${targetBarangayId}".`
    );
  }
}

export const demoSandboxService = {
  isDemoModeActive(): boolean {
    return demoModeActive;
  },

  getPersonaByRole(role: UserRole): DemoPersonaDefinition {
    const found = JUDGE_DEMO_PERSONAS.find((p) => p.personaId === role);
    if (!found) {
      throw new Error(`Unknown demo persona role: ${role}`);
    }
    return found;
  },

  assertDemoBarangayIsolation(
    actorOrTargetBarangayId: UserProfile | string | null,
    maybeTargetBarangayId?: string
  ): void {
    if (typeof actorOrTargetBarangayId === 'string') {
      const demoAdmin = JUDGE_DEMO_PERSONAS[0].profile;
      assertDemoBarangayIsolation(demoAdmin, actorOrTargetBarangayId);
      return;
    }
    assertDemoBarangayIsolation(
      actorOrTargetBarangayId,
      maybeTargetBarangayId || ''
    );
  },

  getSavedRealUserSnapshot(): SavedRealUserSnapshot | null {
    return savedRealSnapshot ? structuredClone(savedRealSnapshot) : null;
  },

  captureRealUserBeforeDemo(
    session: LocalAuthSession | null,
    profile: UserProfile | null,
    registrationRecord: RegistrationRecordDocument | null
  ): void {
    // Only capture if we are not already inside demo mode
    if (!demoModeActive && (!profile || !isDemoPersonaProfile(profile))) {
      savedRealSnapshot = {
        session: session ? structuredClone(session) : null,
        profile: profile ? structuredClone(profile) : null,
        registrationRecord: registrationRecord
          ? structuredClone(registrationRecord)
          : null,
        savedAt: new Date().toISOString(),
      };
    }
    demoModeActive = true;
  },

  consumeRestoredRealUserOnExit(): SavedRealUserSnapshot | null {
    const snap = savedRealSnapshot ? structuredClone(savedRealSnapshot) : null;
    savedRealSnapshot = null;
    demoModeActive = false;
    return snap;
  },

  resetDemoManagerForTests(): void {
    savedRealSnapshot = null;
    demoModeActive = false;
  },

  /**
   * Deterministically seeds `brgy_demo_001` (`Brgy. San Antonio (Demo)`) with coherent
   * proposals, AI attestations, on-chain escrows, milestone proofs, and disputed/completed states
   * without touching any non-demo barangay.
   */
  async ensureDemoSandboxSeeded(): Promise<void> {
    // 1. Seed the 5 demo persona user profiles into `brgy_demo_001`
    for (const p of JUDGE_DEMO_PERSONAS) {
      await userRepository.saveProfile(p.profile);
    }

    // 2. Provision on-chain role accounts in `brgy_demo_001`
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: DEMO_BARANGAY_ID,
      psgc_code: DEMO_PSGC_CODE,
      name: DEMO_BARANGAY_NAME,
      admin_account: 'admin-demo.fundora.testnet',
      sk_accounts: ['sk-demo.fundora.testnet'],
      resident_accounts: [
        'resident-demo.fundora.testnet',
        'demo-resident1.fundora.testnet',
        'demo-resident2.fundora.testnet',
      ],
    });

    // Check if demo projects are already seeded
    const existingDemoProposals = await proposalRepository.listByBarangay(DEMO_BARANGAY_ID);
    const hasSolar = existingDemoProposals.some(
      (p) => p.id === 'proj_1374030250_demo_solar'
    );
    if (hasSolar) {
      return;
    }

    const nowIso = '2026-11-07T08:00:00.000Z';

    // Scenario A: Active Escrow with Phase 2 Proof Submitted (`SubmittedForVote`), ready for Youth Resident Vote
    const solarId = 'proj_1374030250_demo_solar';
    const solarProposal: ProposalDocument = {
      id: solarId,
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      title: '[DEMO] San Antonio Youth Digital & Solar Study Hub',
      category: 'Youth Education & Renewable Energy',
      summary:
        'Installation of solar-powered study tables, LED lighting, and 10 study stations at San Antonio Youth Center.',
      beneficiarySummary: '450 youth students in Brgy. San Antonio (Demo)',
      proposerUid: 'uid_demo_sk_official',
      proposerName: 'SK Chair Andrea Santos (Demo)',
      proposerNearAccountId: 'sk-demo.fundora.testnet',
      beneficiaryNearAccountId: 'sk-demo.fundora.testnet',
      totalBudgetPhp: 28000,
      totalBudgetNear: '100.00',
      totalBudgetYocto: '100000000000000000000000000',
      lineItems: [
        {
          id: 'item_demo_1',
          itemName: '100W Solar Panel & LiFePO4 Battery Kit',
          category: 'Electrical & Solar',
          quantity: 4,
          unit: 'sets',
          unitPricePhp: 7000,
          totalPricePhp: 28000,
          dtiBenchmarkPricePhp: 7200,
          variancePct: -2.78,
        },
      ],
      milestones: [
        {
          index: 1,
          label: 'Phase 1 — Upfront Equipment Mobilization (40%)',
          allocationBps: 4000,
          amountYocto: '40000000000000000000000000',
          amountPhpEquivalent: 11200,
          status: 'RELEASED',
        },
        {
          index: 2,
          label: 'Phase 2 — Solar Installation & Delivery Inspection (40%)',
          allocationBps: 4000,
          amountYocto: '40000000000000000000000000',
          amountPhpEquivalent: 11200,
          status: 'EVIDENCE_SUBMITTED',
        },
        {
          index: 3,
          label: 'Phase 3 — Community Turnover & Final Audit (20%)',
          allocationBps: 2000,
          amountYocto: '20000000000000000000000000',
          amountPhpEquivalent: 5600,
          status: 'LOCKED',
        },
      ],
      status: 'ACTIVE_ESCROW',
      aiOverallRiskScore: 94,
      aiVerdict: 'PASS',
      approveVotes: 0,
      rejectVotes: 0,
      quorumBps: 6000,
      minVotesRequired: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await proposalRepository.saveProposal(solarProposal);

    const existingOnChainSolar = await nearContractService.getProject(solarId);
    if (!existingOnChainSolar) {
      await nearContractService.createProject(
        {
          project_id: solarId,
          barangay_id: DEMO_BARANGAY_ID,
          name: solarProposal.title,
          metadata_hash: 'a1'.repeat(32),
          sk_official: 'sk-demo.fundora.testnet',
          total_budget_yocto: '100000000000000000000000000',
          milestones_input: [
            { title: solarProposal.milestones[0].label, percentage_bps: 4000, is_upfront: true },
            { title: solarProposal.milestones[1].label, percentage_bps: 4000, is_upfront: false },
            { title: solarProposal.milestones[2].label, percentage_bps: 2000, is_upfront: false },
          ],
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-demo.fundora.testnet',
          explicitWalletConfirmation: true,
        }
      );

      await nearContractService.submitMilestoneProof(
        {
          project_id: solarId,
          milestone_idx: 2,
          proof_hash: 'b2'.repeat(32),
        },
        {
          signerAccountId: 'sk-demo.fundora.testnet',
          accessKeyMode: 'function_call_session',
        }
      );

      nearContractService.recordAiAttestationInMirror({
        project_id: solarId,
        target_type: 'proposal_procurement',
        milestone_idx: null,
        report_sha256_hash: 'c3'.repeat(32),
        score: 94,
        recommendation: 'approve',
      });
      nearContractService.recordAiAttestationInMirror({
        project_id: solarId,
        target_type: 'milestone_evidence',
        milestone_idx: 2,
        report_sha256_hash: 'd4'.repeat(32),
        score: 92,
        recommendation: 'approve',
      });

      await proposalRepository.recordTransactionReference({
        id: 'tx_demo_solar_escrow_001',
        barangayId: DEMO_BARANGAY_ID,
        proposalId: solarId,
        nearTxHash: 'SimTx_DemoSanAntonio_Solar_Escrow_001',
        actionType: 'FUND_ESCROW',
        milestoneIndex: 1,
        signerNearAccountId: 'admin-demo.fundora.testnet',
        recipientNearAccountId: 'sk-demo.fundora.testnet',
        amountYocto: '40000000000000000000000000',
        amountNear: '40.00',
        amountPhpEquivalent: 11200,
        explorerUrl: 'https://testnet.nearblocks.io/address/fundora-escrow.testnet?simRef=SimTx_DemoSanAntonio_Solar_Escrow_001',
        receiptSerialNumber: 'FD-RCPT-DEMO-SOLAR-001',
        createdAt: nowIso,
      });
    }

    // Scenario B: Pending Admin Escrow Funding (`COMMUNITY_VOTE`)
    const pendingId = 'proj_1374030250_demo_pending';
    const pendingProposal: ProposalDocument = {
      id: pendingId,
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      title: '[DEMO] Barangay Youth Disaster First-Aid & Radio Kits',
      category: 'Disaster Preparedness & DRRM',
      summary:
        'Procurement of 20 trauma first-aid kits and handheld emergency radios for youth volunteers.',
      beneficiarySummary: 'San Antonio Youth DRRM Volunteers (Demo)',
      proposerUid: 'uid_demo_sk_official',
      proposerName: 'SK Chair Andrea Santos (Demo)',
      proposerNearAccountId: 'sk-demo.fundora.testnet',
      beneficiaryNearAccountId: 'sk-demo.fundora.testnet',
      totalBudgetPhp: 14000,
      totalBudgetNear: '50.00',
      totalBudgetYocto: '50000000000000000000000000',
      lineItems: [
        {
          id: 'item_demo_2',
          itemName: 'Standard LGU Trauma First-Aid Kit',
          category: 'Medical Supplies',
          quantity: 20,
          unit: 'kits',
          unitPricePhp: 700,
          totalPricePhp: 14000,
          dtiBenchmarkPricePhp: 750,
          variancePct: -6.67,
        },
      ],
      milestones: [
        {
          index: 1,
          label: 'Phase 1 — Upfront Supplier Order (40%)',
          allocationBps: 4000,
          amountYocto: '20000000000000000000000000',
          amountPhpEquivalent: 5600,
          status: 'LOCKED',
        },
        {
          index: 2,
          label: 'Phase 2 — Physical Kit Delivery & Inspection (40%)',
          allocationBps: 4000,
          amountYocto: '20000000000000000000000000',
          amountPhpEquivalent: 5600,
          status: 'LOCKED',
        },
        {
          index: 3,
          label: 'Phase 3 — CDRRMO Drill & Turnover (20%)',
          allocationBps: 2000,
          amountYocto: '10000000000000000000000000',
          amountPhpEquivalent: 2800,
          status: 'LOCKED',
        },
      ],
      status: 'COMMUNITY_VOTE',
      aiOverallRiskScore: 91,
      aiVerdict: 'PASS',
      approveVotes: 0,
      rejectVotes: 0,
      quorumBps: 6000,
      minVotesRequired: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await proposalRepository.saveProposal(pendingProposal);
    nearContractService.recordAiAttestationInMirror({
      project_id: pendingId,
      target_type: 'proposal_procurement',
      milestone_idx: null,
      report_sha256_hash: 'e5'.repeat(32),
      score: 91,
      recommendation: 'approve',
    });

    // Scenario C: Disputed Project Ready for Treasury Refund (`Disputed`)
    const disputedId = 'proj_1374030250_demo_disputed';
    const disputedProposal: ProposalDocument = {
      id: disputedId,
      barangayId: DEMO_BARANGAY_ID,
      barangayName: DEMO_BARANGAY_NAME,
      psgcCode: DEMO_PSGC_CODE,
      title: '[DEMO] SK Basketball Court Sound System Procurement (Disputed)',
      category: 'Community Events & Equipment',
      summary:
        'Procurement of portable PA amplifiers where Phase 2 delivery failed community receipt verification.',
      beneficiarySummary: 'San Antonio Sports Complex (Demo)',
      proposerUid: 'uid_demo_sk_official',
      proposerName: 'SK Chair Andrea Santos (Demo)',
      proposerNearAccountId: 'sk-demo.fundora.testnet',
      beneficiaryNearAccountId: 'sk-demo.fundora.testnet',
      totalBudgetPhp: 22400,
      totalBudgetNear: '80.00',
      totalBudgetYocto: '80000000000000000000000000',
      lineItems: [],
      milestones: [
        {
          index: 1,
          label: 'Phase 1 — Upfront Mobilization (40%)',
          allocationBps: 4000,
          amountYocto: '32000000000000000000000000',
          amountPhpEquivalent: 8960,
          status: 'RELEASED',
        },
        {
          index: 2,
          label: 'Phase 2 — Equipment Delivery (60%)',
          allocationBps: 6000,
          amountYocto: '48000000000000000000000000',
          amountPhpEquivalent: 13440,
          status: 'DISPUTED',
        },
      ],
      status: 'REVISION_REQUESTED',
      aiOverallRiskScore: 54,
      aiVerdict: 'WARN',
      approveVotes: 0,
      rejectVotes: 1,
      quorumBps: 6000,
      minVotesRequired: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await proposalRepository.saveProposal(disputedProposal);

    const existingDisputed = await nearContractService.getProject(disputedId);
    if (!existingDisputed) {
      await nearContractService.createProject(
        {
          project_id: disputedId,
          barangay_id: DEMO_BARANGAY_ID,
          name: disputedProposal.title,
          metadata_hash: 'f6'.repeat(32),
          sk_official: 'sk-demo.fundora.testnet',
          total_budget_yocto: '80000000000000000000000000',
          milestones_input: [
            { title: 'Phase 1 Upfront', percentage_bps: 4000, is_upfront: true },
            { title: 'Phase 2 Delivery', percentage_bps: 6000, is_upfront: false },
          ],
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-demo.fundora.testnet',
          explicitWalletConfirmation: true,
        }
      );

      await nearContractService.submitMilestoneProof(
        {
          project_id: disputedId,
          milestone_idx: 2,
          proof_hash: '99'.repeat(32),
        },
        {
          signerAccountId: 'sk-demo.fundora.testnet',
          accessKeyMode: 'function_call_session',
        }
      );

      await nearContractService.voteMilestone(
        {
          project_id: disputedId,
          milestone_idx: 2,
          approve: false,
        },
        {
          signerAccountId: 'demo-resident1.fundora.testnet',
          accessKeyMode: 'function_call_session',
        }
      );
    }
  },
};

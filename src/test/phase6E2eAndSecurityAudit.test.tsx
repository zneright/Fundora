/**
 * Fundora — Phase 6 Final End-to-End (E2E) QA & Security Audit Regression Suite
 *
 * Verifies the complete multi-layer Fundora architecture in a unified suite:
 * 1. Registration, PSGC Geographic Resolution, Age Routing & Selective Resubmission
 * 2. Protected Server-Side AI Auditor (`verify-identity`, `audit-proposal`, `audit-evidence`) & HMAC-SHA256
 * 3. Authoritative NEAR Smart Contract Lifecycle (Escrow, Phase 1 Upfront, Phase 2 Proof, 3-Resident Quorum, Refund & Reconciliation)
 * 4. Public Transparency Hub Privacy, Digital Receipt Integrity & Isolated Judge Demo Mode (`brgy_demo_001`)
 * 5. Hardened Firestore Security Rules (`SEC-AUDIT-01`), `.env.example` (`SEC-AUDIT-02`), Compiled `dist/` Bundle Secret Scan & WASM Integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resetLocalCollectionsForTest } from '../repositories/db.helper';
import { authService } from '../services/auth.service';
import { proposalRepository } from '../repositories/proposal.repository';
import {
  DEMO_BARANGAY_ID,
  nearContractService,
} from '../services/nearContract.service';
import {
  demoSandboxService,
  assertDemoBarangayIsolation,
} from '../services/demoSeed.service';
import { buildSanitizedPublicProjectView } from '../components/TransparencyHub';
import {
  generateReceiptPdfDocument,
  resolveReceiptVerificationMetadata,
  type FundoraDigitalReceiptPayload,
} from '../utils/receiptPdfGenerator';
import { evaluateRa10742AgeEligibility } from '../utils/normalization';
import { resolveResubmissionPermissions } from '../utils/lifecycle';
import {
  hashNormalizedIdNumber,
  resetRateLimitsForTesting,
} from '../../api/_lib/security';
import { backendAdminStore } from '../../api/_lib/adminStore';
import { handleVerifyIdentityRequest } from '../../api/ai/verify-identity';
import { handleAuditProposalRequest } from '../../api/ai/audit-proposal';
import { handleAuditEvidenceRequest } from '../../api/ai/audit-evidence';
import type {
  AuditProposalResponse,
  AuthenticatedCallerContext,
  VerifyIdentityResponse,
} from '../../api/_lib/types';
import type { RegistrationWizardState } from '../types';

const ROOT_DIR = path.resolve(__dirname, '../..');

function makeBearerToken(ctx: AuthenticatedCallerContext): string {
  const b64 = Buffer.from(JSON.stringify(ctx), 'utf8').toString('base64');
  return `Bearer fundora_token:${b64}`;
}

const VALID_SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Phase 6 — Final End-to-End (E2E) QA & Security Audit Verification', () => {
  beforeEach(() => {
    resetLocalCollectionsForTest();
    nearContractService.resetSandboxStateForTests();
    demoSandboxService.resetDemoManagerForTests();
    resetRateLimitsForTesting();
    backendAdminStore.resetStoreForTesting();
    localStorage.clear();
  });

  it('1. executes full E2E civic lifecycle: Registration -> AI Identity Check -> Proposal AI Audit -> NEAR Escrow & 3-Vote Quorum Payout -> Receipt & Transparency', async () => {
    // A. Age-bracket routing & selective resubmission invariants
    const refDate = new Date('2026-11-07T00:00:00Z');
    expect(evaluateRa10742AgeEligibility('2015-05-01', 'resident', refDate).allowed).toBe(false);
    expect(evaluateRa10742AgeEligibility('2004-05-01', 'resident', refDate).effectiveRole).toBe('resident');
    expect(evaluateRa10742AgeEligibility('1988-05-01', 'resident', refDate).effectiveRole).toBe('viewer');
    const photoPerms = resolveResubmissionPermissions({
      verificationStatus: 'rejected',
      resubmissionTarget: 'photo_only',
    });
    expect(photoPerms.canEditUploadsStep).toBe(true);
    expect(photoPerms.canEditDetailsStep).toBe(false);

    // B. Complete 5-step Registration in Brgy. Bucandala III (PSGC 0421090180)
    const wizardState: RegistrationWizardState = {
      email: 'resident.e2e@fundora.ph',
      selectedRole: 'resident',
      regionCode: '040000000',
      regionName: 'Region IV-A (CALABARZON)',
      provinceCode: '042100000',
      provinceName: 'Cavite',
      cityMunicipalityCode: '042109000',
      cityMunicipalityName: 'City of Imus',
      barangayCode: '0421090180',
      barangayName: 'Bucandala III',
      barangayId: 'brgy_0421090180',
      zipCode: '4103',
      hallAddress: 'Bucandala III Barangay Hall',
      firstName: 'Marco',
      middleName: 'Santos',
      lastName: 'Reyes',
      suffix: '',
      birthDate: '2003-04-15',
      sex: 'Male',
      civilStatus: 'Single',
      mobileNumber: '09179998877',
      houseStreetSitio: 'Blk 4 Lot 12 Sampaguita St.',
      primaryIdType: 'Philippine National ID (PhilSys)',
      primaryIdNumber: 'PSN-9988-7766-5544',
      secondaryIdType: '',
      secondaryIdNumber: '',
      positionTitle: '',
      termStartDate: '',
      termEndDate: '',
      dataPrivacyConsent: true,
      truthfulnessAttestation: true,
      uploadedDocuments: [
        {
          id: 'doc_e2e_1',
          tag: 'Primary ID Front',
          label: 'philsys_front.png',
          dataUrl: VALID_SAMPLE_PNG_DATA_URL,
          mimeType: 'image/png',
          sizeBytes: 512,
          sha256Hash: 'aa'.repeat(32),
          uploadedAt: '2026-11-07T10:00:00.000Z',
        },
      ],
    };

    const { profile: residentProfile, registrationRecord } =
      await authService.completeOnboardingSubmission('uid_res_e2e_1', wizardState);
    expect(residentProfile.barangayId).toBe('brgy_0421090180');
    expect(registrationRecord.primaryIdNumber).toBe('PSN-9988-7766-5544');

    // C. Protected Server-Side Identity Verification & HMAC-SHA256 Duplicate Check
    const residentToken = makeBearerToken({
      uid: 'uid_res_e2e_1',
      role: 'resident',
      barangayId: 'brgy_0421090180',
      status: 'onboarding',
    });

    const idRes = await handleVerifyIdentityRequest({
      method: 'POST',
      headers: { Authorization: residentToken },
      body: {
        uid: 'uid_res_e2e_1',
        barangayId: 'brgy_0421090180',
        psgcCode: '0421090180',
        selectedRole: 'resident',
        firstName: 'Marco',
        lastName: 'Reyes',
        birthDate: '2003-04-15',
        mobileNumber: '09179998877',
        houseStreetSitio: 'Blk 4 Lot 12 Sampaguita St.',
        primaryIdType: 'Philippine National ID (PhilSys)',
        primaryIdNumber: 'PSN-9988-7766-5544',
        barangayName: 'Bucandala III',
        cityMunicipalityName: 'City of Imus',
        documents: [
          {
            tag: 'Primary ID Front',
            mimeType: 'image/png',
            dataUrl: VALID_SAMPLE_PNG_DATA_URL,
            sizeBytes: 512,
          },
        ],
      },
    });
    expect(idRes.status).toBe(200);
    const idBody = idRes.body as VerifyIdentityResponse;
    expect(idBody.duplicateCheck.duplicateDetected).toBe(false);

    // Confirm HMAC-SHA256 is keyed and never equals plain unsalted SHA-256
    const hmacDigest = hashNormalizedIdNumber('PSN-9988-7766-5544');
    const plainSha256 = createHash('sha256').update('PSN998877665544').digest('hex');
    expect(hmacDigest).not.toBe(plainSha256);

    // D. Server-Side AI Proposal Procurement Audit (DTI SRP + LGU Borrowing + NEAR Attestation)
    const projectId = 'proj_0421090180_e2e_001';
    const skToken = makeBearerToken({
      uid: 'uid_sk_imus',
      role: 'sk_official',
      barangayId: 'brgy_0421090180',
      status: 'active',
    });

    const propAuditRes = await handleAuditProposalRequest({
      method: 'POST',
      headers: { Authorization: skToken },
      body: {
        projectId,
        barangayId: 'brgy_0421090180',
        projectName: 'Bucandala III Youth Tech & Disaster Resilience Hub',
        category: 'Youth Education & DRRM',
        description: 'Procurement of laptops, solar backup kits, and an event sound system.',
        totalBudgetPhp: 120000,
        totalBudgetNear: 100,
        lineItems: [
          {
            itemName: 'Core i5 Laptop 16GB RAM',
            quantity: 2,
            unit: 'units',
            unitPricePhp: 36000,
          },
          {
            itemName: 'Sound System Rental & Heavy Generator',
            quantity: 1,
            unit: 'lot',
            unitPricePhp: 48000,
          },
        ],
        milestones: [
          { title: 'Phase 1 Upfront (40%)', percentageBps: 4000 },
          { title: 'Phase 2 Delivery (40%)', percentageBps: 4000 },
          { title: 'Phase 3 Turnover (20%)', percentageBps: 2000 },
        ],
      },
    });
    expect(propAuditRes.status).toBe(200);
    const propAuditBody = propAuditRes.body as AuditProposalResponse;
    expect(Array.isArray(propAuditBody.report.borrowingRecommendations)).toBe(true);
    expect(propAuditBody.report.borrowingRecommendations.length).toBeGreaterThan(0);

    // E. Authoritative NEAR Smart Contract Lifecycle (Provision -> Create Escrow -> Proof -> 3-Resident Quorum Vote)
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: 'brgy_0421090180',
      psgc_code: '0421090180',
      name: 'Bucandala III',
      admin_account: 'admin.imus.testnet',
      sk_accounts: ['sk.imus.testnet'],
      resident_accounts: ['res1.imus.testnet', 'res2.imus.testnet', 'res3.imus.testnet'],
    });

    const createTx = await nearContractService.createProject(
      {
        project_id: projectId,
        barangay_id: 'brgy_0421090180',
        name: 'Bucandala III Youth Tech & Disaster Resilience Hub',
        metadata_hash: propAuditBody.reportSha256Hash || 'a1'.repeat(32),
        sk_official: 'sk.imus.testnet',
        total_budget_yocto: '100000000000000000000000000', // 100 NEAR
        milestones_input: [
          { title: 'Phase 1 Upfront (40%)', percentage_bps: 4000, is_upfront: true },
          { title: 'Phase 2 Delivery (40%)', percentage_bps: 4000, is_upfront: false },
          { title: 'Phase 3 Turnover (20%)', percentage_bps: 2000, is_upfront: false },
        ],
        immediate_phase_1: true,
      },
      {
        signerAccountId: 'admin.imus.testnet',
        explicitWalletConfirmation: true,
      }
    );
    expect(createTx.txRecord.status).toBe('SUCCESSFUL');

    // Submit Phase 2 Proof & Run Server-Side AI Evidence Audit
    await nearContractService.submitMilestoneProof(
      {
        project_id: projectId,
        milestone_idx: 2,
        proof_hash: 'b2'.repeat(32),
      },
      {
        signerAccountId: 'sk.imus.testnet',
        accessKeyMode: 'function_call_session',
      }
    );

    const evAuditRes = await handleAuditEvidenceRequest({
      method: 'POST',
      headers: { Authorization: skToken },
      body: {
        projectId,
        barangayId: 'brgy_0421090180',
        milestoneIndex: 2,
        milestoneTitle: 'Phase 2 Delivery (40%)',
        milestoneBudgetPhp: 48000,
        requiredProofs: ['Official Receipt', 'Delivery Photo'],
        accomplishmentNotes: 'Delivered 2 Core i5 laptops with serial numbers and official receipt.',
        evidenceImages: [
          {
            tag: 'Delivery Photo',
            mimeType: 'image/png',
            dataUrl: VALID_SAMPLE_PNG_DATA_URL,
            sizeBytes: 512,
          },
        ],
      },
    });
    expect(evAuditRes.status).toBe(200);

    // 3 Verified Residents Vote on Milestone #2 (2 approve, 1 reject = 66.67% >= 60% quorum)
    await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: true },
      { signerAccountId: 'res1.imus.testnet', accessKeyMode: 'function_call_session' }
    );
    await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: false },
      { signerAccountId: 'res2.imus.testnet', accessKeyMode: 'function_call_session' }
    );
    await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: true },
      { signerAccountId: 'res3.imus.testnet', accessKeyMode: 'function_call_session' }
    );

    const updatedProject = await nearContractService.getProject(projectId);
    expect(updatedProject?.milestones[1].status).toBe('Completed');
    // 40 NEAR (Phase 1) + 40 NEAR (Phase 2) = 80 NEAR disbursed, 20 NEAR remaining
    expect(updatedProject?.total_disbursed_yocto).toBe('80000000000000000000000000');
    expect(updatedProject?.remaining_balance_yocto).toBe('20000000000000000000000000');

    // F. Public Transparency Sanitization & Digital Receipt Generation
    await proposalRepository.saveProposal({
      id: projectId,
      barangayId: 'brgy_0421090180',
      barangayName: 'Bucandala III',
      psgcCode: '0421090180',
      title: 'Bucandala III Youth Tech & Disaster Resilience Hub',
      category: 'Youth Education & DRRM',
      summary: 'Procurement of laptops, solar backup kits, and an event sound system.',
      beneficiarySummary: '600 youth residents in Bucandala III',
      proposerUid: 'uid_sk_imus',
      proposerName: 'SK Chair Marco',
      proposerNearAccountId: 'sk.imus.testnet',
      beneficiaryNearAccountId: 'sk.imus.testnet',
      totalBudgetPhp: 120000,
      totalBudgetNear: '100.00',
      totalBudgetYocto: '100000000000000000000000000',
      lineItems: [],
      milestones: [
        {
          index: 1,
          label: 'Phase 1 Upfront (40%)',
          allocationBps: 4000,
          amountYocto: '40000000000000000000000000',
          amountPhpEquivalent: 48000,
          status: 'RELEASED',
        },
        {
          index: 2,
          label: 'Phase 2 Delivery (40%)',
          allocationBps: 4000,
          amountYocto: '40000000000000000000000000',
          amountPhpEquivalent: 48000,
          status: 'RELEASED',
        },
        {
          index: 3,
          label: 'Phase 3 Turnover (20%)',
          allocationBps: 2000,
          amountYocto: '20000000000000000000000000',
          amountPhpEquivalent: 24000,
          status: 'LOCKED',
        },
      ],
      status: 'ACTIVE_ESCROW',
      approveVotes: 2,
      rejectVotes: 1,
      quorumBps: 6000,
      minVotesRequired: 3,
      createdAt: '2026-11-07T10:00:00.000Z',
      updatedAt: '2026-11-07T11:00:00.000Z',
    });

    const savedProposal = await proposalRepository.getById(projectId);
    const sanitizedView = buildSanitizedPublicProjectView(
      savedProposal!,
      updatedProject,
      [],
      []
    );
    expect(JSON.stringify(sanitizedView)).not.toContain('PSN-9988-7766-5544');
    expect(JSON.stringify(sanitizedView)).not.toContain('09179998877');

    const receiptPayload: FundoraDigitalReceiptPayload = {
      receiptSerialNumber: 'FD-RCPT-E2E-001',
      projectId,
      projectTitle: savedProposal!.title,
      barangayId: 'brgy_0421090180',
      barangayName: 'Bucandala III',
      psgcCode: '0421090180',
      nearTxHash: '9xLiveVerifiedTestnetHashBucandalaPhase2Release',
      actionType: 'RELEASE_MILESTONE',
      purpose: 'Phase 2 Delivery (40%) Quorum Payout',
      milestoneIndex: 2,
      signerNearAccountId: 'res3.imus.testnet',
      recipientNearAccountId: 'sk.imus.testnet',
      amountYocto: '40000000000000000000000000',
      amountNear: '40.00',
      amountPhpEquivalent: 48000,
      currency: 'NEAR',
      transactionDateIso: '2026-11-07T11:05:00.000Z',
      verificationStatus: 'CONFIRMED',
      isSimulatedOrDemo: false,
    };

    const receiptMeta = resolveReceiptVerificationMetadata(receiptPayload);
    expect(receiptMeta.isSimulatedReceipt).toBe(false);
    expect(receiptMeta.nearBlocksTxUrl).toBe(
      'https://testnet.nearblocks.io/txns/9xLiveVerifiedTestnetHashBucandalaPhase2Release'
    );
    const { pdfDoc, integritySha256 } = await generateReceiptPdfDocument(receiptPayload);
    expect(pdfDoc.getNumberOfPages()).toBe(1);
    expect(integritySha256).toMatch(/^[a-f0-9]{64}$/);

    // G. Isolated Judge Demo Mode cannot touch `brgy_0421090180`
    const demoAdmin = demoSandboxService.getPersonaByRole('barangay_admin').profile;
    expect(() =>
      assertDemoBarangayIsolation(demoAdmin, 'brgy_0421090180')
    ).toThrow(/ERR_DEMO_ISOLATION_VIOLATION/);
    expect(() =>
      assertDemoBarangayIsolation(demoAdmin, DEMO_BARANGAY_ID)
    ).not.toThrow();
  });

  it('2. verifies Firestore security rules cross-barangay isolation, .env.example hygiene, compiled dist/ bundle zero-secret safety, and WASM artifact integrity', () => {
    // A. Firestore rules (`SEC-AUDIT-01`)
    const rulesContent = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf-8');
    expect(rulesContent).toContain(
      'allow list: if isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId);'
    );
    expect(rulesContent).toContain('function isDocumentOwner(docData)');
    expect(rulesContent).toContain('docData.ownerUid == request.auth.uid');
    expect(rulesContent).toContain('function hasNoForbiddenSecretKeys(data)');

    // B. `.env.example` (`SEC-AUDIT-02`) — placeholders only, no VITE_ prefix on secrets
    const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf-8');
    expect(envExample).toContain('GEMINI_API_KEY=');
    expect(envExample).toContain('IDENTITY_HMAC_SECRET=');
    expect(envExample).toContain('NEAR_AUDITOR_PRIVATE_KEY=');
    expect(envExample).toContain('FIREBASE_SERVICE_ACCOUNT_JSON=');
    expect(envExample).not.toContain('VITE_GEMINI_API_KEY');
    expect(envExample).not.toContain('VITE_NEAR_AUDITOR_PRIVATE_KEY');
    expect(envExample).not.toContain('VITE_IDENTITY_HMAC_SECRET');

    // C. Compiled `dist/` client bundle scan (if `dist/assets` is present)
    const distAssetsDir = path.join(ROOT_DIR, 'dist', 'assets');
    if (fs.existsSync(distAssetsDir)) {
      const assetFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
      expect(assetFiles.length).toBeGreaterThan(0);
      for (const file of assetFiles) {
        const jsContent = fs.readFileSync(path.join(distAssetsDir, file), 'utf-8');
        expect(jsContent).not.toContain('VITE_GEMINI_API_KEY');
        expect(jsContent).not.toContain('NEAR_AUDITOR_PRIVATE_KEY');
        expect(jsContent).not.toContain('IDENTITY_HMAC_SECRET');
        expect(jsContent).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON');
      }
    }

    // D. Compiled NEAR Rust WASM binary integrity verification
    const wasmPath = path.join(
      ROOT_DIR,
      'contracts',
      'fundora-escrow',
      'target',
      'wasm32-unknown-unknown',
      'release',
      'fundora_escrow.wasm'
    );
    expect(fs.existsSync(wasmPath)).toBe(true);
    const wasmBytes = fs.readFileSync(wasmPath);
    expect(wasmBytes.subarray(0, 4).toString('binary')).toBe('\0asm');
    expect(wasmBytes.length).toBe(389772);
    const wasmSha256 = createHash('sha256').update(wasmBytes).digest('hex');
    expect(wasmSha256).toBe(
      'a25d34cd0eec0ea8494a9680bd453cbe748d7f8cfd3ac34e3099a754fce9976b'
    );
  });
});

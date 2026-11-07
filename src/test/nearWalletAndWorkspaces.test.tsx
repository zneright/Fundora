/**
 * Fundora — Phase 4 Automated Verification Suite
 * NEAR Wallet Selector Integration, Authoritative Smart Contract Lifecycle,
 * Reconciliation Engine, Core Role Workspaces & Server-Keyed Identity HMAC
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createHash } from 'node:crypto';
import {
  nearContractService,
  SUPPORTED_WALLET_PROVIDERS,
} from '../services/nearContract.service';
import { walletRepository } from '../repositories/wallet.repository';
import { userRepository } from '../repositories/user.repository';
import {
  proposalRepository,
  generateDeterministicProjectId,
} from '../repositories/proposal.repository';
import { resetLocalCollectionsForTest } from '../repositories/db.helper';
import { AuthProvider } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { ThemeProvider } from '../contexts/ThemeContext';
import { NearWalletProvider } from '../contexts/NearWalletContext';
import { MainLayout } from '../views/MainLayout';
import {
  hashNormalizedIdNumber,
  hashNormalizedMobile,
  hashNormalizedNameAndBirthdate,
  isIdentityHmacSecretConfigured,
} from '../../api/_lib/security';
import type { UserProfile } from '../types';

const TEST_BRGY_ID = 'brgy_1376020030';
const TEST_PSGC = '1376020030';

function createTestUserProfile(overrides: Partial<UserProfile>): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: 'uid_default',
    email: 'user@fundora.ph',
    emailVerified: true,
    displayName: 'Juan Dela Cruz',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    role: 'resident',
    barangayId: TEST_BRGY_ID,
    barangayName: 'Bel-Air',
    psgcCode: TEST_PSGC,
    cityMunicipalityName: 'City of Makati',
    provinceName: 'Metro Manila',
    regionName: 'National Capital Region (NCR)',
    zipCode: '1209',
    ageYears: 21,
    ageBracketStatus: 'eligible_youth',
    verificationStatus: 'approved',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Phase 4 — NEAR Wallet Selector, Authoritative Contract & Core Workspaces', () => {
  beforeEach(() => {
    resetLocalCollectionsForTest();
    nearContractService.resetSandboxStateForTests();
  });

  it('1. supports MyNearWallet, Meteor Wallet, and HERE Wallet; links, switches, disconnects, and blocks 1-wallet-many-users Sybil reuse', async () => {
    expect(SUPPORTED_WALLET_PROVIDERS.map((w) => w.id)).toEqual([
      'my-near-wallet',
      'meteor-wallet',
      'here-wallet',
    ]);

    const userA = createTestUserProfile({
      uid: 'uid_res_a',
      displayName: 'Resident A',
    });
    const userB = createTestUserProfile({
      uid: 'uid_res_b',
      displayName: 'Resident B',
    });
    await userRepository.saveProfile(userA);
    await userRepository.saveProfile(userB);

    // User A links `alice.testnet` via MyNearWallet
    await walletRepository.linkNearAccount({
      id: 'wlink_a1',
      uid: userA.uid,
      barangayId: TEST_BRGY_ID,
      nearAccountId: 'alice.testnet',
      networkId: 'testnet',
      walletProviderId: 'my-near-wallet',
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    });

    // User A links a second account `alice-alt.testnet` via Meteor Wallet and switches primary
    await walletRepository.linkNearAccount({
      id: 'wlink_a2',
      uid: userA.uid,
      barangayId: TEST_BRGY_ID,
      nearAccountId: 'alice-alt.testnet',
      networkId: 'testnet',
      walletProviderId: 'meteor-wallet',
      isPrimary: true,
      linkedAt: new Date().toISOString(),
    });

    const primaryForA = await walletRepository.getByUid(userA.uid);
    expect(primaryForA?.nearAccountId).toBe('alice-alt.testnet');

    // User B attempting to bind `alice.testnet` must be blocked (Sybil protection)
    await expect(
      walletRepository.linkNearAccount({
        id: 'wlink_b_sybil',
        uid: userB.uid,
        barangayId: TEST_BRGY_ID,
        nearAccountId: 'alice.testnet',
        networkId: 'testnet',
        walletProviderId: 'here-wallet',
        isPrimary: true,
        linkedAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/ERR_WALLET_ALREADY_BOUND/);

    // Unlink `alice.testnet` from User A, after which it is no longer bound
    await walletRepository.unlinkNearAccount(userA.uid, 'alice.testnet');
    const afterUnlink = await walletRepository.getByNearAccountId('alice.testnet');
    expect(afterUnlink).toBeNull();
  });

  it('2. rejects unsupported wallets, mainnet/testnet network mismatches, and enforces scoped Function-Call Access Key boundaries', async () => {
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      admin_account: 'admin-belair.testnet',
      sk_accounts: ['sk-belair.testnet'],
      resident_accounts: ['res1-belair.testnet'],
    });

    const baseProjectParams = {
      project_id: 'proj_1376020030_1001',
      barangay_id: TEST_BRGY_ID,
      name: 'Youth Center Solar Roof',
      metadata_hash: 'a'.repeat(64),
      sk_official: 'sk-belair.testnet',
      total_budget_yocto: '10000000000000000000000000', // 10 NEAR
      milestones_input: [
        { title: 'Phase 1', percentage_bps: 4000, is_upfront: true },
        { title: 'Phase 2', percentage_bps: 4000, is_upfront: false },
        { title: 'Phase 3', percentage_bps: 2000, is_upfront: false },
      ],
      immediate_phase_1: true,
    };

    // 1) Unsupported wallet provider
    await expect(
      nearContractService.createProject(baseProjectParams, {
        signerAccountId: 'admin-belair.testnet',
        walletProviderId: 'phantom-solana-wallet' as never,
        explicitWalletConfirmation: true,
      })
    ).rejects.toThrow(/ERR_UNSUPPORTED_WALLET_PROVIDER/);

    // 2) Network mismatch (mainnet vs testnet)
    await expect(
      nearContractService.createProject(baseProjectParams, {
        signerAccountId: 'admin-belair.testnet',
        networkId: 'mainnet',
        explicitWalletConfirmation: true,
      })
    ).rejects.toThrow(/ERR_NETWORK_MISMATCH/);

    // 3) Mainnet `.near` account on Testnet
    await expect(
      nearContractService.createProject(baseProjectParams, {
        signerAccountId: 'admin-belair.near',
        networkId: 'testnet',
        explicitWalletConfirmation: true,
      })
    ).rejects.toThrow(/ERR_NETWORK_MISMATCH/);

    // 4) Attempting payable `create_project` with a scoped Function-Call Access Key
    await expect(
      nearContractService.createProject(baseProjectParams, {
        signerAccountId: 'admin-belair.testnet',
        accessKeyMode: 'function_call_session',
        explicitWalletConfirmation: true,
      })
    ).rejects.toThrow(/ERR_FUNCTION_CALL_KEY_FORBIDDEN_METHOD/);

    // 5) Attempting payable `create_project` without explicit wallet confirmation
    await expect(
      nearContractService.createProject(baseProjectParams, {
        signerAccountId: 'admin-belair.testnet',
        accessKeyMode: 'full_access_wallet',
        explicitWalletConfirmation: false,
      })
    ).rejects.toThrow(/ERR_WALLET_CONFIRMATION_REQUIRED/);
  });

  it('3. enforces contract method arguments, RBAC, separation of duties, and storage deposit requirements', async () => {
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      admin_account: 'admin-belair.testnet',
      sk_accounts: ['sk-belair.testnet'],
      resident_accounts: ['res1.testnet', 'res2.testnet', 'res3.testnet'],
    });

    const validMilestones = [
      { title: 'Phase 1', percentage_bps: 4000, is_upfront: true },
      { title: 'Phase 2', percentage_bps: 4000, is_upfront: false },
      { title: 'Phase 3', percentage_bps: 2000, is_upfront: false },
    ];

    // Non-admin cannot create project
    await expect(
      nearContractService.createProject(
        {
          project_id: 'proj_1376020030_rbac1',
          barangay_id: TEST_BRGY_ID,
          name: 'Test Project',
          metadata_hash: 'b'.repeat(64),
          sk_official: 'sk-belair.testnet',
          total_budget_yocto: '10000000000000000000000000',
          milestones_input: validMilestones,
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'res1.testnet',
          explicitWalletConfirmation: true,
        }
      )
    ).rejects.toThrow(/ERR_UNAUTHORIZED_BARANGAY_ADMIN/);

    // Separation of duties: Admin cannot fund themselves as SK official
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      sk_accounts: ['admin-belair.testnet'],
    });
    await expect(
      nearContractService.createProject(
        {
          project_id: 'proj_1376020030_sep',
          barangay_id: TEST_BRGY_ID,
          name: 'Self-Dealing Attempt',
          metadata_hash: 'b'.repeat(64),
          sk_official: 'admin-belair.testnet',
          total_budget_yocto: '10000000000000000000000000',
          milestones_input: validMilestones,
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-belair.testnet',
          explicitWalletConfirmation: true,
        }
      )
    ).rejects.toThrow(/ERR_SEPARATION_OF_DUTIES/);

    // Invalid milestone basis points sum (9000 != 10000)
    await expect(
      nearContractService.createProject(
        {
          project_id: 'proj_1376020030_bps',
          barangay_id: TEST_BRGY_ID,
          name: 'Bad BPS Sum',
          metadata_hash: 'b'.repeat(64),
          sk_official: 'sk-belair.testnet',
          total_budget_yocto: '10000000000000000000000000',
          milestones_input: [
            { title: 'Phase 1', percentage_bps: 4000, is_upfront: true },
            { title: 'Phase 2', percentage_bps: 5000, is_upfront: false },
          ],
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-belair.testnet',
          explicitWalletConfirmation: true,
        }
      )
    ).rejects.toThrow(/ERR_INVALID_MILESTONE_BPS_SUM/);

    // Insufficient attached deposit (missing 0.05 NEAR storage reserve)
    await expect(
      nearContractService.createProject(
        {
          project_id: 'proj_1376020030_dep',
          barangay_id: TEST_BRGY_ID,
          name: 'Missing Storage Deposit',
          metadata_hash: 'b'.repeat(64),
          sk_official: 'sk-belair.testnet',
          total_budget_yocto: '10000000000000000000000000',
          milestones_input: validMilestones,
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-belair.testnet',
          explicitWalletConfirmation: true,
          attachedDepositYocto: '10000000000000000000000000', // missing 0.05 NEAR storage reserve
        }
      )
    ).rejects.toThrow(/ERR_INSUFFICIENT_ATTACHED_DEPOSIT/);
  });

  it('4. executes full escrow lifecycle: create_project (40% Phase 1 upfront), submit_milestone_proof, 3-resident quorum voting, and automatic tranche payout', async () => {
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      admin_account: 'admin-belair.testnet',
      sk_accounts: ['sk-belair.testnet'],
      resident_accounts: ['res1.testnet', 'res2.testnet', 'res3.testnet'],
    });

    const projectId = generateDeterministicProjectId(TEST_PSGC, 1762500100);
    const totalBudgetYocto = '10000000000000000000000000'; // 10 NEAR

    // 1) Admin funds escrow (10 NEAR + 0.05 NEAR storage reserve); Phase 1 (4 NEAR) mobilizes immediately
    const { txRecord: createTx, project: createdProj } =
      await nearContractService.createProject(
        {
          project_id: projectId,
          barangay_id: TEST_BRGY_ID,
          name: 'Bel-Air Youth Digital Hub',
          metadata_hash: 'c'.repeat(64),
          sk_official: 'sk-belair.testnet',
          total_budget_yocto: totalBudgetYocto,
          milestones_input: [
            { title: 'Phase 1 Upfront', percentage_bps: 4000, is_upfront: true },
            { title: 'Phase 2 Delivery', percentage_bps: 4000, is_upfront: false },
            { title: 'Phase 3 Turnover', percentage_bps: 2000, is_upfront: false },
          ],
          immediate_phase_1: true,
        },
        {
          signerAccountId: 'admin-belair.testnet',
          explicitWalletConfirmation: true,
        }
      );

    expect(createTx.status).toBe('SUCCESSFUL');
    expect(createTx.payoutFinalized).toBe(true);
    expect(createdProj?.milestones[0].status).toBe('Completed');
    expect(createdProj?.total_disbursed_yocto).toBe('4000000000000000000000000'); // 4 NEAR
    expect(createdProj?.remaining_balance_yocto).toBe('6000000000000000000000000'); // 6 NEAR

    // 2) Record advisory AI attestation on Phase 2 — verify it does NOT release funds by itself
    nearContractService.recordAiAttestationInMirror({
      project_id: projectId,
      target_type: 'milestone_evidence',
      milestone_idx: 2,
      report_sha256_hash: 'd'.repeat(64),
      score: 96,
      recommendation: 'approve',
    });
    const afterAiOnly = await nearContractService.getProject(projectId);
    expect(afterAiOnly?.remaining_balance_yocto).toBe('6000000000000000000000000');

    // 3) SK Official submits Milestone #2 proof using scoped 0 NEAR Function-Call Access Key
    const { project: afterProof } = await nearContractService.submitMilestoneProof(
      {
        project_id: projectId,
        milestone_idx: 2,
        proof_hash: 'e'.repeat(64),
      },
      {
        signerAccountId: 'sk-belair.testnet',
        accessKeyMode: 'function_call_session',
      }
    );
    expect(afterProof.milestones[1].status).toBe('SubmittedForVote');

    // 4) Unregistered wallet or cross-barangay resident is blocked from voting
    await expect(
      nearContractService.voteMilestone(
        { project_id: projectId, milestone_idx: 2, approve: true },
        { signerAccountId: 'stranger.testnet', accessKeyMode: 'function_call_session' }
      )
    ).rejects.toThrow(/ERR_NOT_VERIFIED_RESIDENT/);

    // 5) Resident 1 votes Approve (1/3 min_votes -> no payout yet)
    const vote1 = await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: true },
      { signerAccountId: 'res1.testnet', accessKeyMode: 'function_call_session' }
    );
    expect(vote1.txRecord.payoutFinalized).toBe(false);
    expect(vote1.project.milestones[1].status).toBe('SubmittedForVote');

    // Double-voting by Resident 1 is blocked
    await expect(
      nearContractService.voteMilestone(
        { project_id: projectId, milestone_idx: 2, approve: true },
        { signerAccountId: 'res1.testnet', accessKeyMode: 'function_call_session' }
      )
    ).rejects.toThrow(/ERR_ALREADY_VOTED/);

    // 6) Resident 2 votes Reject (1 Approve, 1 Reject = 2/3 min_votes -> no resolution yet)
    const vote2 = await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: false },
      { signerAccountId: 'res2.testnet', accessKeyMode: 'function_call_session' }
    );
    expect(vote2.project.milestones[1].status).toBe('SubmittedForVote');

    // 7) Resident 3 votes Approve (2 Approve, 1 Reject = 3 votes >= min_votes 3, 66.66% >= 60% quorum) -> Phase 2 (4 NEAR) released!
    const vote3 = await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: true },
      { signerAccountId: 'res3.testnet', accessKeyMode: 'function_call_session' }
    );
    expect(vote3.txRecord.payoutFinalized).toBe(true);
    expect(vote3.project.milestones[1].status).toBe('Completed');
    expect(vote3.project.total_disbursed_yocto).toBe('8000000000000000000000000'); // 8 NEAR total disbursed
    expect(vote3.project.remaining_balance_yocto).toBe('2000000000000000000000000'); // 2 NEAR remaining for Phase 3
  });

  it('5. routes rejected milestone escrow refunds strictly back to funder_treasury (Barangay Admin) and never to sk_official', async () => {
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      admin_account: 'treasury-belair.testnet',
      sk_accounts: ['sk-proposer.testnet'],
      resident_accounts: ['res1.testnet', 'res2.testnet', 'res3.testnet'],
    });

    const projectId = 'proj_1376020030_refund_test';
    await nearContractService.createProject(
      {
        project_id: projectId,
        barangay_id: TEST_BRGY_ID,
        name: 'Disputed Sound System Procurement',
        metadata_hash: 'f'.repeat(64),
        sk_official: 'sk-proposer.testnet',
        total_budget_yocto: '10000000000000000000000000', // 10 NEAR
        milestones_input: [
          { title: 'Phase 1', percentage_bps: 4000, is_upfront: true },
          { title: 'Phase 2', percentage_bps: 6000, is_upfront: false },
        ],
        immediate_phase_1: true,
      },
      {
        signerAccountId: 'treasury-belair.testnet',
        explicitWalletConfirmation: true,
      }
    );

    await nearContractService.submitMilestoneProof(
      { project_id: projectId, milestone_idx: 2, proof_hash: '1'.repeat(64) },
      { signerAccountId: 'sk-proposer.testnet', accessKeyMode: 'function_call_session' }
    );

    // 3 residents vote Reject on Phase 2 -> Project transitions to Disputed
    await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: false },
      { signerAccountId: 'res1.testnet', accessKeyMode: 'function_call_session' }
    );
    await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: false },
      { signerAccountId: 'res2.testnet', accessKeyMode: 'function_call_session' }
    );
    const afterReject = await nearContractService.voteMilestone(
      { project_id: projectId, milestone_idx: 2, approve: false },
      { signerAccountId: 'res3.testnet', accessKeyMode: 'function_call_session' }
    );

    expect(afterReject.project.status).toBe('Disputed');
    expect(afterReject.project.milestones[1].status).toBe('Rejected');

    // SK Official attempting to trigger refund is blocked
    await expect(
      nearContractService.refundProject(
        { project_id: projectId },
        { signerAccountId: 'sk-proposer.testnet', explicitWalletConfirmation: true }
      )
    ).rejects.toThrow(/ERR_UNAUTHORIZED_BARANGAY_ADMIN/);

    // Barangay Admin refunds project -> 6 NEAR returned strictly to `treasury-belair.testnet`
    const refundOutcome = await nearContractService.refundProject(
      { project_id: projectId },
      { signerAccountId: 'treasury-belair.testnet', explicitWalletConfirmation: true }
    );

    expect(refundOutcome.txRecord.status).toBe('SUCCESSFUL');
    expect(refundOutcome.refundedRecipient).toBe('treasury-belair.testnet');
    expect(refundOutcome.refundedRecipient).not.toBe('sk-proposer.testnet');
    expect(refundOutcome.refundedAmountYocto).toBe('6000000000000000000000000');
    expect(refundOutcome.project.status).toBe('Refunded');
    expect(refundOutcome.project.remaining_balance_yocto).toBe('0');
    expect(refundOutcome.project.total_refunded_yocto).toBe('6000000000000000000000000');
  });

  it('6. handles PENDING (in-flight), FAILED, callback-rollback, and interrupted Firestore writes (RECONCILIATION_REQUIRED) accurately', async () => {
    await nearContractService.ensureBarangayProvisioned({
      barangay_id: TEST_BRGY_ID,
      psgc_code: TEST_PSGC,
      name: 'Bel-Air',
      admin_account: 'admin-belair.testnet',
      sk_accounts: ['sk-belair.testnet'],
      resident_accounts: ['res1.testnet', 'res2.testnet', 'res3.testnet'],
    });

    // A) Pending-only simulation: PayoutInFlight must NEVER report payoutFinalized = true
    nearContractService.setFaultInjectionForTests({ simulatePendingOnly: true });
    const pendingCreate = await nearContractService.createProject(
      {
        project_id: 'proj_pending_test',
        barangay_id: TEST_BRGY_ID,
        name: 'Pending Payout Test',
        metadata_hash: '2'.repeat(64),
        sk_official: 'sk-belair.testnet',
        total_budget_yocto: '5000000000000000000000000',
        milestones_input: [
          { title: 'Phase 1', percentage_bps: 5000, is_upfront: true },
          { title: 'Phase 2', percentage_bps: 5000, is_upfront: false },
        ],
        immediate_phase_1: true,
      },
      { signerAccountId: 'admin-belair.testnet', explicitWalletConfirmation: true }
    );
    expect(pendingCreate.txRecord.status).toBe('PENDING');
    expect(pendingCreate.txRecord.payoutFinalized).toBe(false);
    expect(pendingCreate.project?.milestones[0].status).toBe('PayoutInFlight');

    // B) Transfer callback failure rollback -> ReconciliationRequired + retry recovery
    nearContractService.setFaultInjectionForTests({
      simulateTransferCallbackFailure: true,
    });
    const callbackFailCreate = await nearContractService.createProject(
      {
        project_id: 'proj_cb_fail_test',
        barangay_id: TEST_BRGY_ID,
        name: 'Callback Rollback Test',
        metadata_hash: '3'.repeat(64),
        sk_official: 'sk-belair.testnet',
        total_budget_yocto: '5000000000000000000000000',
        milestones_input: [
          { title: 'Phase 1', percentage_bps: 5000, is_upfront: true },
          { title: 'Phase 2', percentage_bps: 5000, is_upfront: false },
        ],
        immediate_phase_1: true,
      },
      { signerAccountId: 'admin-belair.testnet', explicitWalletConfirmation: true }
    );
    expect(callbackFailCreate.txRecord.status).toBe('RECONCILIATION_REQUIRED');
    expect(callbackFailCreate.txRecord.payoutFinalized).toBe(false);
    expect(callbackFailCreate.project?.status).toBe('ReconciliationRequired');
    // Balance was safely rolled back into remaining_balance_yocto
    expect(callbackFailCreate.project?.remaining_balance_yocto).toBe(
      '5000000000000000000000000'
    );

    // Clear fault injection and retry failed payout
    nearContractService.setFaultInjectionForTests({});
    const retried = await nearContractService.retryFailedMilestonePayout(
      { project_id: 'proj_cb_fail_test', milestone_idx: 1 },
      { signerAccountId: 'admin-belair.testnet', explicitWalletConfirmation: true }
    );
    expect(retried.txRecord.status).toBe('SUCCESSFUL');
    expect(retried.txRecord.payoutFinalized).toBe(true);
    expect(retried.project.status).toBe('Active');
    expect(retried.project.milestones[0].status).toBe('Completed');

    // C) Interrupted Firestore write after on-chain success -> reconcileProjectState syncs Firestore
    const propId = 'proj_1376020030_fs_interrupted';
    await proposalRepository.saveProposal({
      id: propId,
      barangayId: TEST_BRGY_ID,
      barangayName: 'Bel-Air',
      psgcCode: TEST_PSGC,
      title: 'Firestore Sync Recovery Project',
      category: 'Infrastructure',
      summary: 'Testing reconciliation after interrupted Firestore write',
      beneficiarySummary: 'Youth of Bel-Air',
      proposerUid: 'uid_sk',
      proposerName: 'SK Chairperson',
      proposerNearAccountId: 'sk-belair.testnet',
      beneficiaryNearAccountId: 'sk-belair.testnet',
      totalBudgetPhp: 28000,
      totalBudgetNear: '100',
      totalBudgetYocto: '10000000000000000000000000',
      lineItems: [],
      milestones: [
        {
          index: 1,
          label: 'Phase 1',
          allocationBps: 4000,
          amountYocto: '4000000000000000000000000',
          amountPhpEquivalent: 11200,
          status: 'LOCKED',
        },
        {
          index: 2,
          label: 'Phase 2',
          allocationBps: 6000,
          amountYocto: '6000000000000000000000000',
          amountPhpEquivalent: 16800,
          status: 'LOCKED',
        },
      ],
      status: 'COMMUNITY_VOTE',
      approveVotes: 0,
      rejectVotes: 0,
      quorumBps: 6000,
      minVotesRequired: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    nearContractService.setFaultInjectionForTests({
      simulateFirestoreWriteInterruption: true,
    });
    const interruptedRes = await nearContractService.createProject(
      {
        project_id: propId,
        barangay_id: TEST_BRGY_ID,
        name: 'Firestore Sync Recovery Project',
        metadata_hash: '4'.repeat(64),
        sk_official: 'sk-belair.testnet',
        total_budget_yocto: '10000000000000000000000000',
        milestones_input: [
          { title: 'Phase 1', percentage_bps: 4000, is_upfront: true },
          { title: 'Phase 2', percentage_bps: 6000, is_upfront: false },
        ],
        immediate_phase_1: true,
      },
      { signerAccountId: 'admin-belair.testnet', explicitWalletConfirmation: true }
    );

    expect(interruptedRes.txRecord.status).toBe('RECONCILIATION_REQUIRED');
    // Firestore is still stale ('COMMUNITY_VOTE') before reconciliation
    const staleProposal = await proposalRepository.getById(propId);
    expect(staleProposal?.status).toBe('COMMUNITY_VOTE');

    // Now run reconciliation
    nearContractService.setFaultInjectionForTests({});
    const reconOutcome = await nearContractService.reconcileProjectState(propId);
    expect(reconOutcome.reconciled).toBe(true);

    const syncedProposal = await proposalRepository.getById(propId);
    expect(syncedProposal?.status).toBe('ACTIVE_ESCROW');
    expect(syncedProposal?.milestones[0].status).toBe('RELEASED');
    expect(
      nearContractService.getPendingReconciliationIntents(TEST_BRGY_ID)
    ).toHaveLength(0);
  });

  it('7. renders role-isolated workspaces (AdminPanel, SKWorkspace, YouthDashboard, Viewer Read-Only, and ActivityView)', async () => {
    // 1) Render SK Official Workspace
    const skProfile = createTestUserProfile({
      uid: 'uid_sk_1',
      displayName: 'SK Chair Maria',
      role: 'sk_official',
      nearAccountId: 'sk-maria.testnet',
    });
    await userRepository.saveProfile(skProfile);
    authService.setCurrentSession({
      uid: skProfile.uid,
      email: skProfile.email,
      emailVerified: true,
    });

    const { unmount: unmountSk } = render(
      <ThemeProvider>
        <AuthProvider>
          <NearWalletProvider>
            <MainLayout />
          </NearWalletProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sk-workspace')).toBeInTheDocument();
    });

    // Author a proposal from SKWorkspace
    fireEvent.change(screen.getByTestId('sk-proposal-title-input'), {
      target: { value: 'Barangay Youth Robotics Lab' },
    });
    fireEvent.change(screen.getByTestId('sk-proposal-summary-input'), {
      target: { value: '15 Arduino kits and laptops for youth coding bootcamp' },
    });
    fireEvent.click(screen.getByTestId('sk-submit-proposal-btn'));

    await waitFor(() => {
      expect(screen.getByText('Barangay Youth Robotics Lab')).toBeInTheDocument();
    });
    unmountSk();

    // 2) Render Barangay Admin Workspace and verify proposal appears for escrow funding
    const adminProfile = createTestUserProfile({
      uid: 'uid_admin_1',
      displayName: 'Punong Barangay Roberto',
      role: 'barangay_admin',
      nearAccountId: 'admin-roberto.testnet',
    });
    await userRepository.saveProfile(adminProfile);
    authService.setCurrentSession({
      uid: adminProfile.uid,
      email: adminProfile.email,
      emailVerified: true,
    });

    const { unmount: unmountAdmin } = render(
      <ThemeProvider>
        <AuthProvider>
          <NearWalletProvider>
            <MainLayout />
          </NearWalletProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-panel-workspace')).toBeInTheDocument();
      expect(screen.getByText('Barangay Youth Robotics Lab')).toBeInTheDocument();
    });

    // Switch to ActivityView tab
    fireEvent.click(screen.getByTestId('nav-tab-activity'));
    await waitFor(() => {
      expect(screen.getByTestId('activity-view-workspace')).toBeInTheDocument();
      expect(screen.getByTestId('activity-execution-mode')).toHaveTextContent(
        'simulated_sandbox'
      );
    });
    unmountAdmin();

    // 3) Render Over-30 Viewer in YouthDashboard and verify Read-Only restriction badge
    const viewerProfile = createTestUserProfile({
      uid: 'uid_viewer_1',
      displayName: 'Senior Citizen Lolo Jose',
      role: 'viewer',
      ageYears: 62,
      ageBracketStatus: 'over_30_viewer',
    });
    await userRepository.saveProfile(viewerProfile);
    authService.setCurrentSession({
      uid: viewerProfile.uid,
      email: viewerProfile.email,
      emailVerified: true,
    });

    const { unmount: unmountViewer } = render(
      <ThemeProvider>
        <AuthProvider>
          <NearWalletProvider>
            <MainLayout />
          </NearWalletProvider>
        </AuthProvider>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('youth-dashboard-workspace')).toBeInTheDocument();
      expect(screen.getByTestId('viewer-readonly-badge')).toBeInTheDocument();
    });
    unmountViewer();
  });

  it('8. [Security Follow-Up RISK-12] keys personal identifier duplicate hashes with server HMAC-SHA256 instead of plain unsalted SHA-256', () => {
    const prevSecret = process.env.IDENTITY_HMAC_SECRET;
    try {
      delete process.env.IDENTITY_HMAC_SECRET;
      expect(isIdentityHmacSecretConfigured()).toBe(false);

      // Compute plain unsalted SHA-256 to prove our duplicate hashes NEVER equal raw SHA-256
      const rawPlainSha256 = createHash('sha256')
        .update('fundora:mobile:09171234567', 'utf8')
        .digest('hex')
        .toLowerCase();

      process.env.IDENTITY_HMAC_SECRET =
        'prod-hmac-secret-key-alpha-99887766554433221100';
      expect(isIdentityHmacSecretConfigured()).toBe(true);

      const hmacMobileAlpha = hashNormalizedMobile('+639171234567');
      const hmacIdAlpha = hashNormalizedIdNumber('PhilSys National ID', '1234-5678-9012');
      const hmacPersonAlpha = hashNormalizedNameAndBirthdate(
        'Juan',
        'Dela Cruz',
        '2004-05-15'
      );

      expect(hmacMobileAlpha).toHaveLength(64);
      expect(hmacMobileAlpha).not.toBe(rawPlainSha256);

      // Rotating the server HMAC secret produces completely different digests (defeating rainbow tables)
      process.env.IDENTITY_HMAC_SECRET =
        'prod-hmac-secret-key-bravo-00112233445566778899';
      const hmacMobileBravo = hashNormalizedMobile('0917-123-4567');
      const hmacIdBravo = hashNormalizedIdNumber('PhilSys National ID', '1234-5678-9012');
      const hmacPersonBravo = hashNormalizedNameAndBirthdate(
        'Juan',
        'Dela Cruz',
        '2004-05-15'
      );

      expect(hmacMobileBravo).not.toBe(hmacMobileAlpha);
      expect(hmacIdBravo).not.toBe(hmacIdAlpha);
      expect(hmacPersonBravo).not.toBe(hmacPersonAlpha);
    } finally {
      if (prevSecret === undefined) {
        delete process.env.IDENTITY_HMAC_SECRET;
      } else {
        process.env.IDENTITY_HMAC_SECRET = prevSecret;
      }
    }
  });
});

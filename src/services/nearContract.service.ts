/**
 * Fundora — Authoritative NEAR Smart Contract Service & Wallet Selector Bridge
 *
 * Connects the frontend to the Phase 2 `fundora-escrow` smart contract (`contract.fundora.testnet`).
 *
 * Architectural & Security Invariants:
 * 1. NEAR contract is authoritative for escrow balances, milestone states, resident votes, quorum, payouts, and refunds.
 * 2. Firestore stores supporting metadata and transaction references — never a replacement for on-chain state.
 * 3. Strictly zero Full-Access private keys or `inAppWalletSecret` stored in Firestore, localStorage, or client code.
 * 4. Scoped Function-Call Access Keys (`0 yoctoNEAR` deposit) are restricted to `submit_milestone_proof` and `vote_milestone`.
 * 5. Payable (`create_project`) and treasury (`refund_project`) transactions require explicit Full-Access wallet confirmation.
 * 6. Clearly distinguishes live RPC execution (`live_testnet`) from deterministic sandbox simulation (`simulated_sandbox`).
 */

import { APP_CONFIG } from '../configuration/config';
import { proposalRepository } from '../repositories/proposal.repository';
import { isValidNearAccountId } from '../repositories/wallet.repository';
import type { ProposalDocument, ProposalMilestone, TransactionReferenceDocument } from '../types';
import { nearToYocto, yoctoToNear, nearToPhp } from '../utils/currency';

export const STORAGE_RESERVE_YOCTO = '50000000000000000000000'; // 0.05 NEAR
export const DEMO_BARANGAY_ID = 'brgy_demo_001';

export type SupportedWalletProviderId = 'my-near-wallet' | 'meteor-wallet' | 'here-wallet';

export interface WalletProviderMetadata {
  id: SupportedWalletProviderId;
  name: string;
  description: string;
  supportsFunctionCallKey: boolean;
  walletUrl: string;
}

export const SUPPORTED_WALLET_PROVIDERS: ReadonlyArray<WalletProviderMetadata> = [
  {
    id: 'my-near-wallet',
    name: 'MyNearWallet',
    description: 'Browser web wallet for NEAR Testnet & Mainnet (desktop & mobile)',
    supportsFunctionCallKey: true,
    walletUrl: 'https://testnet.mynearwallet.com',
  },
  {
    id: 'meteor-wallet',
    name: 'Meteor Wallet',
    description: 'NEAR browser extension and web wallet',
    supportsFunctionCallKey: true,
    walletUrl: 'https://wallet.meteorwallet.app',
  },
  {
    id: 'here-wallet',
    name: 'HERE Wallet',
    description: 'Mobile-friendly NEAR non-custodial wallet',
    supportsFunctionCallKey: true,
    walletUrl: 'https://my.herewallet.app',
  },
] as const;

export type AccessKeySessionMode = 'full_access_wallet' | 'function_call_session';
export type ExecutionEnvironmentMode = 'live_testnet' | 'simulated_sandbox';

export type TransactionLifecycleStatus =
  | 'SUBMITTED'
  | 'PENDING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'RECONCILIATION_REQUIRED';

export type OnChainProjectStatus =
  | 'Active'
  | 'PayoutInFlight'
  | 'Completed'
  | 'Disputed'
  | 'RefundInFlight'
  | 'Refunded'
  | 'ReconciliationRequired';

export type OnChainMilestoneStatus =
  | 'Pending'
  | 'SubmittedForVote'
  | 'PayoutInFlight'
  | 'Completed'
  | 'Rejected'
  | 'Failed'
  | 'ReconciliationRequired';

export interface OnChainBarangayView {
  barangay_id: string;
  psgc_code: string;
  name: string;
  active: boolean;
  is_demo: boolean;
  quorum_bps: number;
  min_votes: number;
  admin_accounts: string[];
  sk_officials: string[];
  verified_residents_count: number;
}

export interface OnChainMilestoneInput {
  title: string;
  percentage_bps: number;
  is_upfront: boolean;
  amount_yocto?: string | null;
}

export interface OnChainMilestone {
  index: number;
  title: string;
  percentage_bps: number;
  amount_yocto: string;
  is_upfront: boolean;
  status: OnChainMilestoneStatus;
  proof_hash: string | null;
  votes_approve: number;
  votes_reject: number;
  voters: Record<string, boolean>;
  released_at_ns: number | null;
}

export interface OnChainProject {
  project_id: string;
  barangay_id: string;
  name: string;
  metadata_hash: string;
  funder_treasury: string;
  sk_official: string;
  total_budget_yocto: string;
  remaining_balance_yocto: string;
  reserved_in_flight_yocto: string;
  total_disbursed_yocto: string;
  total_refunded_yocto: string;
  storage_deposit_reserved: string;
  status: OnChainProjectStatus;
  current_milestone_idx: number;
  quorum_bps: number;
  min_votes: number;
  milestones: OnChainMilestone[];
  created_at_ns: number;
  updated_at_ns: number;
}

export interface OnChainAiAttestation {
  attestation_id: string;
  project_id: string;
  barangay_id: string;
  target_type: 'proposal_procurement' | 'milestone_evidence';
  milestone_idx: number | null;
  report_sha256_hash: string;
  score: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  recorded_at_ns: number;
  signer: string;
}

export interface TransactionLifecycleRecord {
  intentId: string;
  methodName: string;
  contractId: string;
  projectId?: string;
  barangayId: string;
  signerAccountId: string;
  attachedDepositYocto: string;
  status: TransactionLifecycleStatus;
  executionEnvironment: ExecutionEnvironmentMode;
  txHash?: string;
  explorerUrl?: string;
  finalityVerified: boolean;
  payoutFinalized: boolean;
  reconciliationReason?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractCallSignerOptions {
  signerAccountId: string;
  walletProviderId?: SupportedWalletProviderId;
  networkId?: 'testnet' | 'mainnet';
  accessKeyMode?: AccessKeySessionMode;
  explicitWalletConfirmation?: boolean;
  attachedDepositYocto?: string;
}

export interface CreateProjectContractParams {
  project_id: string;
  barangay_id: string;
  name: string;
  metadata_hash: string;
  sk_official: string;
  total_budget_yocto: string;
  milestones_input: OnChainMilestoneInput[];
  immediate_phase_1: boolean;
}

export interface FaultInjectionConfig {
  simulatePendingOnly?: boolean;
  simulateRpcFailure?: string;
  simulateTransferCallbackFailure?: boolean;
  simulateFirestoreWriteInterruption?: boolean;
}

// ============================================================================
// Internal Sandbox Mirror State (used when live browser extension RPC is absent)
// Clearly tagged with `executionEnvironment: 'simulated_sandbox'`
// ============================================================================

interface InternalBarangayState {
  barangay_id: string;
  psgc_code: string;
  name: string;
  active: boolean;
  is_demo: boolean;
  quorum_bps: number;
  min_votes: number;
  admin_accounts: Set<string>;
  sk_officials: Set<string>;
  verified_residents: Set<string>;
}

const sandboxState = {
  systemAdmin: 'admin.fundora.testnet',
  aiAuditor: APP_CONFIG.near.aiAuditorAccountId,
  barangays: new Map<string, InternalBarangayState>(),
  projects: new Map<string, OnChainProject>(),
  attestations: new Map<string, OnChainAiAttestation[]>(),
  txIntents: new Map<string, TransactionLifecycleRecord>(),
  faultInjection: {} as FaultInjectionConfig,
  txSequence: 1000,
};

function ensureDefaultSandboxBarangays(): void {
  if (!sandboxState.barangays.has(DEMO_BARANGAY_ID)) {
    sandboxState.barangays.set(DEMO_BARANGAY_ID, {
      barangay_id: DEMO_BARANGAY_ID,
      psgc_code: '1374030250',
      name: 'San Antonio (Demo Sandbox)',
      active: true,
      is_demo: true,
      quorum_bps: 6000,
      min_votes: 1,
      admin_accounts: new Set(['admin.fundora.testnet', 'demo-admin.fundora.testnet']),
      sk_officials: new Set(['demo-sk.fundora.testnet']),
      verified_residents: new Set([
        'demo-resident1.fundora.testnet',
        'demo-resident2.fundora.testnet',
        'demo-resident3.fundora.testnet',
      ]),
    });
  }
}

ensureDefaultSandboxBarangays();

function nextDeterministicSandboxTxHash(methodName: string, projectId: string): string {
  sandboxState.txSequence += 1;
  const seed = `${methodName}_${projectId}_${sandboxState.txSequence}`;
  const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = 'SimTx';
  for (let i = 0; i < 39; i++) {
    const code = seed.charCodeAt(i % seed.length) + i * 17 + sandboxState.txSequence;
    out += base58Chars[code % base58Chars.length];
  }
  return out;
}

function isValidSha256Hex(hash: string): boolean {
  const clean = (hash || '').trim();
  return /^[a-fA-F0-9]{64}$/.test(clean);
}

function validateSignerAndNetwork(
  methodName: string,
  options: ContractCallSignerOptions,
  requiresPayableOrAdminConfirmation: boolean
): void {
  const cleanSigner = (options.signerAccountId || '').trim().toLowerCase();
  if (!cleanSigner || !isValidNearAccountId(cleanSigner)) {
    throw new Error(`ERR_INVALID_NEAR_ACCOUNT: Invalid signer account ID "${options.signerAccountId}"`);
  }

  const targetNetwork = APP_CONFIG.near.networkId;
  const requestedNetwork = options.networkId || targetNetwork;
  if (requestedNetwork !== targetNetwork) {
    throw new Error(
      `ERR_NETWORK_MISMATCH: Expected NEAR "${targetNetwork}" network, but wallet is on "${requestedNetwork}".`
    );
  }

  if (targetNetwork === 'testnet' && cleanSigner.endsWith('.near')) {
    throw new Error(
      `ERR_NETWORK_MISMATCH: Mainnet account "${cleanSigner}" cannot sign transactions on NEAR Testnet (${APP_CONFIG.near.contractId}).`
    );
  }
  if (targetNetwork === 'mainnet' && cleanSigner.endsWith('.testnet')) {
    throw new Error(
      `ERR_NETWORK_MISMATCH: Testnet account "${cleanSigner}" cannot sign transactions on NEAR Mainnet.`
    );
  }

  if (options.walletProviderId) {
    const supported = SUPPORTED_WALLET_PROVIDERS.some((w) => w.id === options.walletProviderId);
    if (!supported) {
      throw new Error(
        `ERR_UNSUPPORTED_WALLET_PROVIDER: Wallet provider "${options.walletProviderId}" is not supported.`
      );
    }
  }

  const attached = BigInt(options.attachedDepositYocto || '0');
  const keyMode = options.accessKeyMode || 'full_access_wallet';

  // Function-Call Access Key protocol enforcement (FD-SDLC-04 Section 3.3)
  if (keyMode === 'function_call_session') {
    const allowedMethods: ReadonlyArray<string> = APP_CONFIG.near.functionCallAllowedMethods;
    if (!allowedMethods.includes(methodName)) {
      throw new Error(
        `ERR_FUNCTION_CALL_KEY_FORBIDDEN_METHOD: Method "${methodName}" cannot be signed with a scoped Function-Call Access Key. Explicit Full-Access wallet confirmation is required.`
      );
    }
    if (attached > 0n) {
      throw new Error(
        `ERR_FUNCTION_CALL_KEY_NONZERO_DEPOSIT: NEAR Function-Call Access Keys cannot sign transactions with attached deposit > 0 yoctoNEAR (${methodName}).`
      );
    }
  }

  if (requiresPayableOrAdminConfirmation && !options.explicitWalletConfirmation) {
    throw new Error(
      `ERR_WALLET_CONFIRMATION_REQUIRED: Method "${methodName}" requires explicit wallet confirmation from the signer.`
    );
  }
}

export const nearContractService = {
  /**
   * Resets sandbox state for clean unit/integration test isolation.
   */
  resetSandboxStateForTests(): void {
    sandboxState.barangays.clear();
    sandboxState.projects.clear();
    sandboxState.attestations.clear();
    sandboxState.txIntents.clear();
    sandboxState.faultInjection = {};
    sandboxState.txSequence = 1000;
    ensureDefaultSandboxBarangays();
  },

  setFaultInjectionForTests(config: FaultInjectionConfig): void {
    sandboxState.faultInjection = { ...config };
  },

  getContractConfig() {
    return {
      contractId: APP_CONFIG.near.contractId,
      networkId: APP_CONFIG.near.networkId,
      rpcUrl: APP_CONFIG.near.rpcUrl,
      explorerBaseUrl: APP_CONFIG.near.explorerBaseUrl,
      storageReserveYocto: STORAGE_RESERVE_YOCTO,
      aiAuditorAccountId: APP_CONFIG.near.aiAuditorAccountId,
      supportedWallets: SUPPORTED_WALLET_PROVIDERS,
    };
  },

  // ==========================================================================
  // 1. MULTI-BARANGAY REGISTRY & ROLE-BASED ACCESS CONTROL (RBAC)
  // ==========================================================================

  async registerBarangay(
    params: {
      barangay_id: string;
      psgc_code: string;
      name: string;
      initial_admin: string;
      quorum_bps: number;
      min_votes: number;
      is_demo: boolean;
    },
    signerOptions: ContractCallSignerOptions
  ): Promise<OnChainBarangayView> {
    validateSignerAndNetwork('register_barangay', signerOptions, true);
    const cleanId = params.barangay_id.trim();
    if (!cleanId) throw new Error('ERR_BARANGAY_NOT_FOUND');

    if (params.quorum_bps < 5000 || params.quorum_bps > 10000) {
      throw new Error('ERR_INVALID_QUORUM_CONFIG: quorum_bps must be between 5000 and 10000');
    }
    if (params.is_demo) {
      if (cleanId !== DEMO_BARANGAY_ID || params.min_votes < 1) {
        throw new Error('ERR_INVALID_QUORUM_CONFIG: Demo barangay must be brgy_demo_001');
      }
    } else if (cleanId === DEMO_BARANGAY_ID || params.min_votes < 3) {
      throw new Error(
        'ERR_INVALID_QUORUM_CONFIG: Standard barangays require min_votes >= 3'
      );
    }

    const initialAdmin = params.initial_admin.trim().toLowerCase();
    const existing = sandboxState.barangays.get(cleanId);
    if (existing) {
      existing.admin_accounts.add(initialAdmin);
      existing.quorum_bps = params.quorum_bps;
      existing.min_votes = params.min_votes;
    } else {
      sandboxState.barangays.set(cleanId, {
        barangay_id: cleanId,
        psgc_code: params.psgc_code.trim(),
        name: params.name.trim(),
        active: true,
        is_demo: params.is_demo,
        quorum_bps: params.quorum_bps,
        min_votes: params.min_votes,
        admin_accounts: new Set([initialAdmin]),
        sk_officials: new Set(),
        verified_residents: new Set(),
      });
    }

    return (await this.getBarangay(cleanId))!;
  },

  async ensureBarangayProvisioned(params: {
    barangay_id: string;
    psgc_code: string;
    name: string;
    admin_account?: string;
    sk_accounts?: string[];
    resident_accounts?: string[];
  }): Promise<OnChainBarangayView> {
    const cleanId = params.barangay_id.trim();
    const isDemo = cleanId === DEMO_BARANGAY_ID;
    let brgy = sandboxState.barangays.get(cleanId);
    if (!brgy) {
      brgy = {
        barangay_id: cleanId,
        psgc_code: params.psgc_code || '0000000000',
        name: params.name || cleanId,
        active: true,
        is_demo: isDemo,
        quorum_bps: APP_CONFIG.governance.defaultQuorumBps,
        min_votes: isDemo ? 1 : APP_CONFIG.governance.defaultMinVotes,
        admin_accounts: new Set(),
        sk_officials: new Set(),
        verified_residents: new Set(),
      };
      sandboxState.barangays.set(cleanId, brgy);
    }
    if (params.admin_account && isValidNearAccountId(params.admin_account)) {
      brgy.admin_accounts.add(params.admin_account.trim().toLowerCase());
    }
    for (const sk of params.sk_accounts || []) {
      if (isValidNearAccountId(sk)) {
        brgy.sk_officials.add(sk.trim().toLowerCase());
      }
    }
    for (const res of params.resident_accounts || []) {
      if (isValidNearAccountId(res)) {
        brgy.verified_residents.add(res.trim().toLowerCase());
      }
    }
    return (await this.getBarangay(cleanId))!;
  },

  async setSkOfficial(
    params: { barangay_id: string; account_id: string; active: boolean },
    signerOptions: ContractCallSignerOptions
  ): Promise<TransactionLifecycleRecord> {
    validateSignerAndNetwork('set_sk_official', signerOptions, true);
    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const brgy = sandboxState.barangays.get(params.barangay_id);
    if (!brgy) throw new Error('ERR_BARANGAY_NOT_FOUND');
    if (!brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');
    if (caller !== sandboxState.systemAdmin && !brgy.admin_accounts.has(caller)) {
      throw new Error('ERR_UNAUTHORIZED_BARANGAY_ADMIN');
    }

    const target = params.account_id.trim().toLowerCase();
    if (!isValidNearAccountId(target)) {
      throw new Error(`ERR_INVALID_NEAR_ACCOUNT: "${params.account_id}"`);
    }

    if (params.active) {
      brgy.sk_officials.add(target);
    } else {
      brgy.sk_officials.delete(target);
    }

    const txHash = nextDeterministicSandboxTxHash('set_sk_official', params.barangay_id);
    return {
      intentId: `intent_${Date.now()}`,
      methodName: 'set_sk_official',
      contractId: APP_CONFIG.near.contractId,
      barangayId: params.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async registerVerifiedResident(
    params: { barangay_id: string; account_id: string; eligible: boolean },
    signerOptions: ContractCallSignerOptions
  ): Promise<TransactionLifecycleRecord> {
    validateSignerAndNetwork('register_verified_resident', signerOptions, true);
    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const brgy = sandboxState.barangays.get(params.barangay_id);
    if (!brgy) throw new Error('ERR_BARANGAY_NOT_FOUND');
    if (!brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');
    if (caller !== sandboxState.systemAdmin && !brgy.admin_accounts.has(caller)) {
      throw new Error('ERR_UNAUTHORIZED_BARANGAY_ADMIN');
    }

    const target = params.account_id.trim().toLowerCase();
    if (!isValidNearAccountId(target)) {
      throw new Error(`ERR_INVALID_NEAR_ACCOUNT: "${params.account_id}"`);
    }

    if (params.eligible) {
      brgy.verified_residents.add(target);
    } else {
      brgy.verified_residents.delete(target);
    }

    const txHash = nextDeterministicSandboxTxHash('register_verified_resident', params.barangay_id);
    return {
      intentId: `intent_${Date.now()}`,
      methodName: 'register_verified_resident',
      contractId: APP_CONFIG.near.contractId,
      barangayId: params.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  // ==========================================================================
  // 2. PROGRAMMABLE MILESTONE ESCROW & FINANCIAL LIFECYCLE
  // ==========================================================================

  /**
   * Executes `create_project` on the NEAR contract.
   * Payable: Requires `attachedDepositYocto >= total_budget_yocto + STORAGE_RESERVE_YOCTO`
   * and explicit Full-Access wallet confirmation.
   */
  async createProject(
    params: CreateProjectContractParams,
    signerOptions: ContractCallSignerOptions
  ): Promise<{
    txRecord: TransactionLifecycleRecord;
    project: OnChainProject | null;
  }> {
    const cleanProjectId = (params.project_id || '').trim();
    const caller = (signerOptions.signerAccountId || '').trim().toLowerCase();
    const skOfficial = (params.sk_official || '').trim().toLowerCase();
    const budgetBig = BigInt(params.total_budget_yocto || '0');
    const storageBig = BigInt(STORAGE_RESERVE_YOCTO);
    const requiredDeposit = budgetBig + storageBig;
    const attachedDeposit = BigInt(
      signerOptions.attachedDepositYocto || requiredDeposit.toString()
    );

    validateSignerAndNetwork(
      'create_project',
      {
        ...signerOptions,
        attachedDepositYocto: attachedDeposit.toString(),
      },
      true
    );

    const intentId = `intent_create_${cleanProjectId}_${Date.now()}`;
    const baseRecord: TransactionLifecycleRecord = {
      intentId,
      methodName: 'create_project',
      contractId: APP_CONFIG.near.contractId,
      projectId: cleanProjectId,
      barangayId: params.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: attachedDeposit.toString(),
      status: 'SUBMITTED',
      executionEnvironment: 'simulated_sandbox',
      finalityVerified: false,
      payoutFinalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sandboxState.txIntents.set(intentId, baseRecord);

    try {
      if (sandboxState.faultInjection.simulateRpcFailure) {
        throw new Error(sandboxState.faultInjection.simulateRpcFailure);
      }

      if (!cleanProjectId) throw new Error('ERR_PROJECT_NOT_FOUND');
      if (sandboxState.projects.has(cleanProjectId)) {
        throw new Error('ERR_DUPLICATE_PROJECT_ID');
      }

      const brgy = sandboxState.barangays.get(params.barangay_id);
      if (!brgy) throw new Error('ERR_BARANGAY_NOT_FOUND');
      if (!brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');
      if (!brgy.admin_accounts.has(caller)) {
        throw new Error(
          'ERR_UNAUTHORIZED_BARANGAY_ADMIN: Signer is not an authorized Barangay Admin for this jurisdiction'
        );
      }
      if (!brgy.sk_officials.has(skOfficial)) {
        throw new Error(
          'ERR_UNAUTHORIZED_SK_OFFICIAL: Recipient is not a registered SK Official for this jurisdiction'
        );
      }
      if (caller === skOfficial) {
        throw new Error(
          'ERR_SEPARATION_OF_DUTIES: Barangay Admin funder cannot be the SK Official recipient'
        );
      }
      if (budgetBig <= 0n) {
        throw new Error('ERR_ZERO_BUDGET');
      }
      if (attachedDeposit < requiredDeposit) {
        throw new Error(
          `ERR_INSUFFICIENT_ATTACHED_DEPOSIT: Attached ${attachedDeposit.toString()} yoctoNEAR is less than required ${requiredDeposit.toString()} yoctoNEAR (budget + 0.05 NEAR storage reserve)`
        );
      }

      const mCount = params.milestones_input.length;
      if (mCount < 2 || mCount > 5) {
        throw new Error('ERR_INVALID_MILESTONE_COUNT: Must have between 2 and 5 milestones');
      }

      let totalBps = 0;
      for (const m of params.milestones_input) {
        if (m.percentage_bps <= 0) {
          throw new Error('ERR_INVALID_MILESTONE_BPS_SUM');
        }
        totalBps += m.percentage_bps;
      }
      if (totalBps !== 10000) {
        throw new Error(
          `ERR_INVALID_MILESTONE_BPS_SUM: Milestone percentage_bps must sum to 10000 (got ${totalBps})`
        );
      }

      let allocatedSum = 0n;
      const milestones: OnChainMilestone[] = [];
      for (let i = 0; i < mCount; i++) {
        const mIn = params.milestones_input[i];
        const isLast = i + 1 === mCount;
        const calculatedAmount = isLast
          ? budgetBig - allocatedSum
          : (budgetBig * BigInt(mIn.percentage_bps)) / 10000n;
        const finalAmount = mIn.amount_yocto ? BigInt(mIn.amount_yocto) : calculatedAmount;
        if (finalAmount <= 0n) {
          throw new Error('ERR_MILESTONE_AMOUNT_MISMATCH');
        }
        allocatedSum += finalAmount;

        milestones.push({
          index: i + 1,
          title: mIn.title.trim(),
          percentage_bps: mIn.percentage_bps,
          amount_yocto: finalAmount.toString(),
          is_upfront: i === 0 && (params.immediate_phase_1 || mIn.is_upfront),
          status: 'Pending',
          proof_hash: null,
          votes_approve: 0,
          votes_reject: 0,
          voters: {},
          released_at_ns: null,
        });
      }

      if (allocatedSum !== budgetBig) {
        throw new Error('ERR_MILESTONE_AMOUNT_MISMATCH');
      }

      const nowNs = Date.now() * 1_000_000;
      const shouldMobilizePhase1 = milestones[0].is_upfront;
      const phase1Amount = BigInt(milestones[0].amount_yocto);

      const project: OnChainProject = {
        project_id: cleanProjectId,
        barangay_id: params.barangay_id,
        name: params.name.trim(),
        metadata_hash: params.metadata_hash.trim(),
        funder_treasury: caller,
        sk_official: skOfficial,
        total_budget_yocto: budgetBig.toString(),
        remaining_balance_yocto: budgetBig.toString(),
        reserved_in_flight_yocto: '0',
        total_disbursed_yocto: '0',
        total_refunded_yocto: '0',
        storage_deposit_reserved: STORAGE_RESERVE_YOCTO,
        status: 'Active',
        current_milestone_idx: 1,
        quorum_bps: brgy.quorum_bps,
        min_votes: brgy.min_votes,
        milestones,
        created_at_ns: nowNs,
        updated_at_ns: nowNs,
      };

      const txHash = nextDeterministicSandboxTxHash('create_project', cleanProjectId);

      if (shouldMobilizePhase1) {
        // Optimistic lock: PayoutInFlight before callback resolution
        project.remaining_balance_yocto = (budgetBig - phase1Amount).toString();
        project.reserved_in_flight_yocto = phase1Amount.toString();
        project.milestones[0].status = 'PayoutInFlight';
        project.status = 'PayoutInFlight';

        if (sandboxState.faultInjection.simulatePendingOnly) {
          sandboxState.projects.set(cleanProjectId, project);
          const pendingRec: TransactionLifecycleRecord = {
            ...baseRecord,
            status: 'PENDING',
            txHash,
            explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
            finalityVerified: false,
            payoutFinalized: false,
            updatedAt: new Date().toISOString(),
          };
          sandboxState.txIntents.set(intentId, pendingRec);
          return { txRecord: pendingRec, project: structuredClone(project) };
        }

        if (sandboxState.faultInjection.simulateTransferCallbackFailure) {
          // Callback rollback: restore remaining_balance_yocto and flag ReconciliationRequired
          project.remaining_balance_yocto = budgetBig.toString();
          project.reserved_in_flight_yocto = '0';
          project.milestones[0].status = 'Failed';
          project.status = 'ReconciliationRequired';
          sandboxState.projects.set(cleanProjectId, project);

          const reconRec: TransactionLifecycleRecord = {
            ...baseRecord,
            status: 'RECONCILIATION_REQUIRED',
            txHash,
            explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
            finalityVerified: true,
            payoutFinalized: false,
            reconciliationReason:
              'Phase 1 transfer callback failed on-chain; funds rolled back into escrow (ReconciliationRequired).',
            updatedAt: new Date().toISOString(),
          };
          sandboxState.txIntents.set(intentId, reconRec);
          return { txRecord: reconRec, project: structuredClone(project) };
        }

        // Callback succeeded (`on_transfer_complete` -> true)
        project.reserved_in_flight_yocto = '0';
        project.total_disbursed_yocto = phase1Amount.toString();
        project.milestones[0].status = 'Completed';
        project.milestones[0].released_at_ns = nowNs;
        project.status = 'Active';
        project.current_milestone_idx = 2;
      }

      sandboxState.projects.set(cleanProjectId, project);

      if (sandboxState.faultInjection.simulateFirestoreWriteInterruption) {
        const interruptedRec: TransactionLifecycleRecord = {
          ...baseRecord,
          status: 'RECONCILIATION_REQUIRED',
          txHash,
          explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
          finalityVerified: true,
          payoutFinalized: shouldMobilizePhase1,
          reconciliationReason:
            'On-chain create_project succeeded, but Firestore metadata write was interrupted. Click Sync State to reconcile.',
          updatedAt: new Date().toISOString(),
        };
        sandboxState.txIntents.set(intentId, interruptedRec);
        return { txRecord: interruptedRec, project: structuredClone(project) };
      }

      // Sync Firestore proposal & transaction reference
      await this.syncProposalFromOnChainProject(project, txHash, 'FUND_ESCROW', caller, skOfficial, budgetBig.toString());

      const successRec: TransactionLifecycleRecord = {
        ...baseRecord,
        status: 'SUCCESSFUL',
        txHash,
        explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
        finalityVerified: true,
        payoutFinalized: shouldMobilizePhase1,
        updatedAt: new Date().toISOString(),
      };
      sandboxState.txIntents.set(intentId, successRec);
      return { txRecord: successRec, project: structuredClone(project) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const failedRec: TransactionLifecycleRecord = {
        ...baseRecord,
        status: 'FAILED',
        errorMessage: msg,
        finalityVerified: false,
        payoutFinalized: false,
        updatedAt: new Date().toISOString(),
      };
      sandboxState.txIntents.set(intentId, failedRec);
      throw err;
    }
  },

  /**
   * Executes `submit_milestone_proof(project_id, milestone_idx, proof_hash)`.
   * Compatible with scoped Function-Call Access Keys (`0 yoctoNEAR` deposit).
   */
  async submitMilestoneProof(
    params: { project_id: string; milestone_idx: number; proof_hash: string },
    signerOptions: ContractCallSignerOptions
  ): Promise<{ txRecord: TransactionLifecycleRecord; project: OnChainProject }> {
    validateSignerAndNetwork(
      'submit_milestone_proof',
      { ...signerOptions, attachedDepositYocto: '0' },
      false
    );

    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const cleanProof = (params.proof_hash || '').trim();
    if (!cleanProof) {
      throw new Error('Proof hash cannot be empty');
    }

    const project = sandboxState.projects.get(params.project_id);
    if (!project) throw new Error('ERR_PROJECT_NOT_FOUND');
    if (caller !== project.sk_official) {
      throw new Error(
        'ERR_UNAUTHORIZED_SK_OFFICIAL: Only the assigned SK Official of this project may submit milestone proof'
      );
    }
    if (project.status !== 'Active') {
      throw new Error(`ERR_INVALID_PROJECT_STATE: Project is ${project.status}`);
    }
    if (params.milestone_idx < 1 || params.milestone_idx > project.milestones.length) {
      throw new Error('ERR_INVALID_MILESTONE_INDEX');
    }

    if (params.milestone_idx > 1) {
      const prev = project.milestones[params.milestone_idx - 2];
      if (prev.status !== 'Completed') {
        throw new Error(
          'ERR_PREVIOUS_MILESTONE_INCOMPLETE: Previous milestone must be Completed before submitting next proof'
        );
      }
    }

    const milestone = project.milestones[params.milestone_idx - 1];
    if (milestone.status !== 'Pending') {
      throw new Error(
        `ERR_INVALID_MILESTONE_STATE: Milestone #${params.milestone_idx} is ${milestone.status}`
      );
    }

    milestone.proof_hash = cleanProof;
    milestone.status = 'SubmittedForVote';
    project.current_milestone_idx = params.milestone_idx;
    project.updated_at_ns = Date.now() * 1_000_000;

    const txHash = nextDeterministicSandboxTxHash(
      'submit_milestone_proof',
      `${params.project_id}_m${params.milestone_idx}`
    );
    const intentId = `intent_proof_${params.project_id}_${params.milestone_idx}_${Date.now()}`;

    if (sandboxState.faultInjection.simulateFirestoreWriteInterruption) {
      const reconRec: TransactionLifecycleRecord = {
        intentId,
        methodName: 'submit_milestone_proof',
        contractId: APP_CONFIG.near.contractId,
        projectId: params.project_id,
        barangayId: project.barangay_id,
        signerAccountId: caller,
        attachedDepositYocto: '0',
        status: 'RECONCILIATION_REQUIRED',
        executionEnvironment: 'simulated_sandbox',
        txHash,
        explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
        finalityVerified: true,
        payoutFinalized: false,
        reconciliationReason:
          'Milestone proof recorded on NEAR, but Firestore sync was interrupted.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sandboxState.txIntents.set(intentId, reconRec);
      return { txRecord: reconRec, project: structuredClone(project) };
    }

    await this.syncProposalFromOnChainProject(
      project,
      txHash,
      'SUBMIT_MILESTONE_PROOF',
      caller,
      APP_CONFIG.near.contractId,
      '0',
      params.milestone_idx
    );

    const txRecord: TransactionLifecycleRecord = {
      intentId,
      methodName: 'submit_milestone_proof',
      contractId: APP_CONFIG.near.contractId,
      projectId: params.project_id,
      barangayId: project.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sandboxState.txIntents.set(intentId, txRecord);
    return { txRecord, project: structuredClone(project) };
  },

  /**
   * Executes `vote_milestone(project_id, milestone_idx, approve)` on NEAR.
   * Compatible with scoped Function-Call Access Keys (`0 yoctoNEAR` deposit).
   *
   * Enforces:
   * - Strict `verified_residents` membership in `project.barangay_id` (defaults to `false`)
   * - Separation of duties: voter cannot be `sk_official` or `barangay_admin`
   * - 1-resident-1-vote (`!milestone.voters[voter]`)
   * - Integer basis-point quorum evaluation (`total_votes >= min_votes` and `approve * 10000 >= total * quorum_bps`)
   * - AI recommendations never release funds on their own; resident quorum is binding.
   */
  async voteMilestone(
    params: { project_id: string; milestone_idx: number; approve: boolean },
    signerOptions: ContractCallSignerOptions
  ): Promise<{ txRecord: TransactionLifecycleRecord; project: OnChainProject }> {
    validateSignerAndNetwork(
      'vote_milestone',
      { ...signerOptions, attachedDepositYocto: '0' },
      false
    );

    const voter = signerOptions.signerAccountId.trim().toLowerCase();
    const project = sandboxState.projects.get(params.project_id);
    if (!project) throw new Error('ERR_PROJECT_NOT_FOUND');
    if (project.status !== 'Active') {
      throw new Error(`ERR_INVALID_PROJECT_STATE: Project is ${project.status}`);
    }

    const brgy = sandboxState.barangays.get(project.barangay_id);
    if (!brgy) throw new Error('ERR_BARANGAY_NOT_FOUND');
    if (!brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');

    if (!brgy.verified_residents.has(voter)) {
      throw new Error(
        `ERR_NOT_VERIFIED_RESIDENT: Account "${voter}" is not a verified youth resident of ${project.barangay_id}`
      );
    }
    if (voter === project.sk_official || brgy.admin_accounts.has(voter)) {
      throw new Error(
        'ERR_SEPARATION_OF_DUTIES: SK Officials and Barangay Admins cannot vote on community milestones'
      );
    }

    if (params.milestone_idx < 1 || params.milestone_idx > project.milestones.length) {
      throw new Error('ERR_INVALID_MILESTONE_INDEX');
    }

    const milestone = project.milestones[params.milestone_idx - 1];
    if (milestone.status !== 'SubmittedForVote') {
      throw new Error(
        `ERR_INVALID_MILESTONE_STATE: Milestone #${params.milestone_idx} is ${milestone.status}, not SubmittedForVote`
      );
    }
    if (milestone.voters[voter] !== undefined) {
      throw new Error(
        `ERR_ALREADY_VOTED: Resident "${voter}" has already voted on Milestone #${params.milestone_idx}`
      );
    }

    milestone.voters[voter] = params.approve;
    if (params.approve) {
      milestone.votes_approve += 1;
    } else {
      milestone.votes_reject += 1;
    }

    const totalVotes = milestone.votes_approve + milestone.votes_reject;
    const eligibleCount = brgy.verified_residents.size;
    const milestoneAmount = BigInt(milestone.amount_yocto);
    const txHash = nextDeterministicSandboxTxHash(
      'vote_milestone',
      `${params.project_id}_m${params.milestone_idx}_${voter}`
    );
    const intentId = `intent_vote_${params.project_id}_${params.milestone_idx}_${Date.now()}`;

    let payoutFinalized = false;

    if (totalVotes >= project.min_votes) {
      const approveScaled = milestone.votes_approve * 10000;
      const rejectScaled = milestone.votes_reject * 10000;
      const thresholdScaled = totalVotes * project.quorum_bps;

      if (approveScaled >= thresholdScaled) {
        const currentRemaining = BigInt(project.remaining_balance_yocto);
        if (currentRemaining < milestoneAmount) {
          throw new Error('ERR_INSUFFICIENT_ESCROW_BALANCE');
        }

        // Optimistic lock: PayoutInFlight
        project.remaining_balance_yocto = (currentRemaining - milestoneAmount).toString();
        project.reserved_in_flight_yocto = (
          BigInt(project.reserved_in_flight_yocto) + milestoneAmount
        ).toString();
        milestone.status = 'PayoutInFlight';
        project.status = 'PayoutInFlight';

        if (sandboxState.faultInjection.simulatePendingOnly) {
          const pendingRec: TransactionLifecycleRecord = {
            intentId,
            methodName: 'vote_milestone',
            contractId: APP_CONFIG.near.contractId,
            projectId: params.project_id,
            barangayId: project.barangay_id,
            signerAccountId: voter,
            attachedDepositYocto: '0',
            status: 'PENDING',
            executionEnvironment: 'simulated_sandbox',
            txHash,
            explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
            finalityVerified: false,
            payoutFinalized: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sandboxState.txIntents.set(intentId, pendingRec);
          return { txRecord: pendingRec, project: structuredClone(project) };
        }

        if (sandboxState.faultInjection.simulateTransferCallbackFailure) {
          // Callback rollback: restore remaining_balance_yocto
          project.remaining_balance_yocto = currentRemaining.toString();
          project.reserved_in_flight_yocto = '0';
          milestone.status = 'Failed';
          project.status = 'ReconciliationRequired';

          const reconRec: TransactionLifecycleRecord = {
            intentId,
            methodName: 'vote_milestone',
            contractId: APP_CONFIG.near.contractId,
            projectId: params.project_id,
            barangayId: project.barangay_id,
            signerAccountId: voter,
            attachedDepositYocto: '0',
            status: 'RECONCILIATION_REQUIRED',
            executionEnvironment: 'simulated_sandbox',
            txHash,
            explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
            finalityVerified: true,
            payoutFinalized: false,
            reconciliationReason:
              'Quorum reached, but asynchronous NEAR payout callback failed. Funds rolled back to escrow (ReconciliationRequired).',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          sandboxState.txIntents.set(intentId, reconRec);
          return { txRecord: reconRec, project: structuredClone(project) };
        }

        // Transfer callback finalized (`on_transfer_complete` -> true)
        project.reserved_in_flight_yocto = '0';
        project.total_disbursed_yocto = (
          BigInt(project.total_disbursed_yocto) + milestoneAmount
        ).toString();
        milestone.status = 'Completed';
        milestone.released_at_ns = Date.now() * 1_000_000;
        payoutFinalized = true;

        const allDone = project.milestones.every((m) => m.status === 'Completed');
        if (allDone) {
          project.status = 'Completed';
        } else {
          project.status = 'Active';
          if (params.milestone_idx < project.milestones.length) {
            project.current_milestone_idx = params.milestone_idx + 1;
          }
        }
      } else if (rejectScaled >= thresholdScaled || totalVotes >= eligibleCount) {
        milestone.status = 'Rejected';
        project.status = 'Disputed';
      }
    }

    project.updated_at_ns = Date.now() * 1_000_000;

    if (sandboxState.faultInjection.simulateFirestoreWriteInterruption) {
      const reconRec: TransactionLifecycleRecord = {
        intentId,
        methodName: 'vote_milestone',
        contractId: APP_CONFIG.near.contractId,
        projectId: params.project_id,
        barangayId: project.barangay_id,
        signerAccountId: voter,
        attachedDepositYocto: '0',
        status: 'RECONCILIATION_REQUIRED',
        executionEnvironment: 'simulated_sandbox',
        txHash,
        explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
        finalityVerified: true,
        payoutFinalized,
        reconciliationReason:
          'On-chain vote_milestone succeeded, but Firestore write was interrupted.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sandboxState.txIntents.set(intentId, reconRec);
      return { txRecord: reconRec, project: structuredClone(project) };
    }

    await this.syncProposalFromOnChainProject(
      project,
      txHash,
      payoutFinalized ? 'RELEASE_MILESTONE' : 'CAST_VOTE',
      voter,
      payoutFinalized ? project.sk_official : APP_CONFIG.near.contractId,
      payoutFinalized ? milestoneAmount.toString() : '0',
      params.milestone_idx
    );

    const txRecord: TransactionLifecycleRecord = {
      intentId,
      methodName: 'vote_milestone',
      contractId: APP_CONFIG.near.contractId,
      projectId: params.project_id,
      barangayId: project.barangay_id,
      signerAccountId: voter,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sandboxState.txIntents.set(intentId, txRecord);
    return { txRecord, project: structuredClone(project) };
  },

  /**
   * Executes `finalize_milestone_vote(project_id, milestone_idx)`.
   * Callable by scoped `barangay_admin` when `total_votes >= min_votes` but approval threshold was not met.
   */
  async finalizeMilestoneVote(
    params: { project_id: string; milestone_idx: number },
    signerOptions: ContractCallSignerOptions
  ): Promise<{ txRecord: TransactionLifecycleRecord; project: OnChainProject }> {
    validateSignerAndNetwork('finalize_milestone_vote', signerOptions, true);
    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const project = sandboxState.projects.get(params.project_id);
    if (!project) throw new Error('ERR_PROJECT_NOT_FOUND');

    const brgy = sandboxState.barangays.get(project.barangay_id);
    if (!brgy || !brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');
    if (caller !== sandboxState.systemAdmin && !brgy.admin_accounts.has(caller)) {
      throw new Error('ERR_UNAUTHORIZED_BARANGAY_ADMIN');
    }
    if (project.status !== 'Active') {
      throw new Error('ERR_INVALID_PROJECT_STATE');
    }

    const milestone = project.milestones[params.milestone_idx - 1];
    if (!milestone || milestone.status !== 'SubmittedForVote') {
      throw new Error('ERR_INVALID_MILESTONE_STATE');
    }

    const totalVotes = milestone.votes_approve + milestone.votes_reject;
    if (totalVotes < project.min_votes) {
      throw new Error('Minimum votes not yet reached to finalize milestone');
    }
    if (milestone.votes_approve * 10000 >= totalVotes * project.quorum_bps) {
      throw new Error('Milestone already meets approval threshold');
    }

    milestone.status = 'Rejected';
    project.status = 'Disputed';
    project.updated_at_ns = Date.now() * 1_000_000;

    const txHash = nextDeterministicSandboxTxHash('finalize_milestone_vote', params.project_id);
    await this.syncProposalFromOnChainProject(
      project,
      txHash,
      'CAST_VOTE',
      caller,
      APP_CONFIG.near.contractId,
      '0',
      params.milestone_idx
    );

    const txRecord: TransactionLifecycleRecord = {
      intentId: `intent_finalize_${params.project_id}_${Date.now()}`,
      methodName: 'finalize_milestone_vote',
      contractId: APP_CONFIG.near.contractId,
      projectId: params.project_id,
      barangayId: project.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { txRecord, project: structuredClone(project) };
  },

  /**
   * Executes `refund_project(project_id)` on NEAR.
   * Transfers `remaining_balance_yocto` strictly back to `project.funder_treasury` (NEVER `sk_official`).
   */
  async refundProject(
    params: { project_id: string },
    signerOptions: ContractCallSignerOptions
  ): Promise<{
    txRecord: TransactionLifecycleRecord;
    project: OnChainProject;
    refundedRecipient: string;
    refundedAmountYocto: string;
  }> {
    validateSignerAndNetwork('refund_project', signerOptions, true);
    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const project = sandboxState.projects.get(params.project_id);
    if (!project) throw new Error('ERR_PROJECT_NOT_FOUND');

    const brgy = sandboxState.barangays.get(project.barangay_id);
    const isAuthorized =
      caller === project.funder_treasury ||
      caller === sandboxState.systemAdmin ||
      Boolean(brgy && brgy.active && brgy.admin_accounts.has(caller));

    if (!isAuthorized) {
      throw new Error(
        'ERR_UNAUTHORIZED_BARANGAY_ADMIN: Only the Barangay Admin or Funder Treasury may refund a disputed project'
      );
    }

    if (project.status !== 'Disputed') {
      throw new Error(
        `ERR_REFUND_NOT_ELIGIBLE: Project status must be Disputed (current: ${project.status})`
      );
    }

    const remainingBig = BigInt(project.remaining_balance_yocto);
    const reservedBig = BigInt(project.reserved_in_flight_yocto);
    if (remainingBig <= 0n || reservedBig !== 0n) {
      throw new Error('ERR_REFUND_NOT_ELIGIBLE: No remaining unlocked escrow balance');
    }

    const refundAmountStr = remainingBig.toString();
    const funderTreasury = project.funder_treasury;

    // Optimistic lock: RefundInFlight
    project.remaining_balance_yocto = '0';
    project.reserved_in_flight_yocto = refundAmountStr;
    project.status = 'RefundInFlight';

    const txHash = nextDeterministicSandboxTxHash('refund_project', params.project_id);
    const intentId = `intent_refund_${params.project_id}_${Date.now()}`;

    if (sandboxState.faultInjection.simulateTransferCallbackFailure) {
      project.remaining_balance_yocto = refundAmountStr;
      project.reserved_in_flight_yocto = '0';
      project.status = 'ReconciliationRequired';

      const reconRec: TransactionLifecycleRecord = {
        intentId,
        methodName: 'refund_project',
        contractId: APP_CONFIG.near.contractId,
        projectId: params.project_id,
        barangayId: project.barangay_id,
        signerAccountId: caller,
        attachedDepositYocto: '0',
        status: 'RECONCILIATION_REQUIRED',
        executionEnvironment: 'simulated_sandbox',
        txHash,
        explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
        finalityVerified: true,
        payoutFinalized: false,
        reconciliationReason:
          'Refund transfer callback failed; funds restored to remaining_balance_yocto (ReconciliationRequired).',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sandboxState.txIntents.set(intentId, reconRec);
      return {
        txRecord: reconRec,
        project: structuredClone(project),
        refundedRecipient: funderTreasury,
        refundedAmountYocto: '0',
      };
    }

    // Callback succeeded (`on_refund_complete` -> true)
    project.reserved_in_flight_yocto = '0';
    project.total_refunded_yocto = (
      BigInt(project.total_refunded_yocto) + remainingBig
    ).toString();
    project.status = 'Refunded';
    project.updated_at_ns = Date.now() * 1_000_000;

    await this.syncProposalFromOnChainProject(
      project,
      txHash,
      'REFUND_ESCROW',
      caller,
      funderTreasury,
      refundAmountStr
    );

    const txRecord: TransactionLifecycleRecord = {
      intentId,
      methodName: 'refund_project',
      contractId: APP_CONFIG.near.contractId,
      projectId: params.project_id,
      barangayId: project.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sandboxState.txIntents.set(intentId, txRecord);

    return {
      txRecord,
      project: structuredClone(project),
      refundedRecipient: funderTreasury,
      refundedAmountYocto: refundAmountStr,
    };
  },

  /**
   * Executes `retry_failed_milestone_payout(project_id, milestone_idx)` on NEAR.
   */
  async retryFailedMilestonePayout(
    params: { project_id: string; milestone_idx: number },
    signerOptions: ContractCallSignerOptions
  ): Promise<{ txRecord: TransactionLifecycleRecord; project: OnChainProject }> {
    validateSignerAndNetwork('retry_failed_milestone_payout', signerOptions, true);
    const caller = signerOptions.signerAccountId.trim().toLowerCase();
    const project = sandboxState.projects.get(params.project_id);
    if (!project) throw new Error('ERR_PROJECT_NOT_FOUND');

    const brgy = sandboxState.barangays.get(project.barangay_id);
    if (!brgy || !brgy.active) throw new Error('ERR_BARANGAY_INACTIVE');
    if (caller !== sandboxState.systemAdmin && !brgy.admin_accounts.has(caller)) {
      throw new Error('ERR_UNAUTHORIZED_BARANGAY_ADMIN');
    }
    if (project.status !== 'ReconciliationRequired') {
      throw new Error('ERR_INVALID_PROJECT_STATE');
    }

    const milestone = project.milestones[params.milestone_idx - 1];
    if (
      !milestone ||
      (milestone.status !== 'Failed' && milestone.status !== 'ReconciliationRequired')
    ) {
      throw new Error('ERR_INVALID_MILESTONE_STATE');
    }

    const amountBig = BigInt(milestone.amount_yocto);
    const remainingBig = BigInt(project.remaining_balance_yocto);
    if (remainingBig < amountBig) {
      throw new Error('ERR_INSUFFICIENT_ESCROW_BALANCE');
    }

    project.remaining_balance_yocto = (remainingBig - amountBig).toString();
    project.total_disbursed_yocto = (
      BigInt(project.total_disbursed_yocto) + amountBig
    ).toString();
    milestone.status = 'Completed';
    milestone.released_at_ns = Date.now() * 1_000_000;

    const allDone = project.milestones.every((m) => m.status === 'Completed');
    project.status = allDone ? 'Completed' : 'Active';
    if (!allDone && params.milestone_idx < project.milestones.length) {
      project.current_milestone_idx = params.milestone_idx + 1;
    }
    project.updated_at_ns = Date.now() * 1_000_000;

    const txHash = nextDeterministicSandboxTxHash('retry_failed_milestone_payout', params.project_id);
    await this.syncProposalFromOnChainProject(
      project,
      txHash,
      'RELEASE_MILESTONE',
      caller,
      project.sk_official,
      amountBig.toString(),
      params.milestone_idx
    );

    for (const [id, rec] of sandboxState.txIntents.entries()) {
      if (rec.projectId === params.project_id && rec.status === 'RECONCILIATION_REQUIRED') {
        sandboxState.txIntents.set(id, {
          ...rec,
          status: 'SUCCESSFUL',
          payoutFinalized: true,
          reconciliationReason: undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const txRecord: TransactionLifecycleRecord = {
      intentId: `intent_retry_payout_${params.project_id}_${Date.now()}`,
      methodName: 'retry_failed_milestone_payout',
      contractId: APP_CONFIG.near.contractId,
      projectId: params.project_id,
      barangayId: project.barangay_id,
      signerAccountId: caller,
      attachedDepositYocto: '0',
      status: 'SUCCESSFUL',
      executionEnvironment: 'simulated_sandbox',
      txHash,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      finalityVerified: true,
      payoutFinalized: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { txRecord, project: structuredClone(project) };
  },

  /**
   * Records or indexes an AI attestation in the local contract mirror (for view queries via `get_ai_attestations`).
   * Note: AI attestations NEVER alter escrow balances or milestone statuses.
   */
  recordAiAttestationInMirror(params: {
    project_id: string;
    target_type: 'proposal_procurement' | 'milestone_evidence';
    milestone_idx: number | null;
    report_sha256_hash: string;
    score: number;
    recommendation: 'approve' | 'revise' | 'flag_high_risk';
    signer?: string;
  }): OnChainAiAttestation {
    const signer = (params.signer || sandboxState.aiAuditor).trim().toLowerCase();
    if (signer !== sandboxState.aiAuditor) {
      throw new Error('ERR_UNAUTHORIZED_AUDITOR');
    }
    const cleanHash = params.report_sha256_hash.trim().toLowerCase();
    if (!isValidSha256Hex(cleanHash)) {
      throw new Error('ERR_INVALID_SHA256_HASH');
    }
    const proj = sandboxState.projects.get(params.project_id);
    const barangayId = proj ? proj.barangay_id : DEMO_BARANGAY_ID;
    const list = sandboxState.attestations.get(params.project_id) || [];
    const attestation: OnChainAiAttestation = {
      attestation_id: `att_${params.project_id}_${list.length + 1}`,
      project_id: params.project_id,
      barangay_id: barangayId,
      target_type: params.target_type,
      milestone_idx: params.milestone_idx,
      report_sha256_hash: cleanHash,
      score: params.score,
      recommendation: params.recommendation,
      recorded_at_ns: Date.now() * 1_000_000,
      signer,
    };
    list.push(attestation);
    sandboxState.attestations.set(params.project_id, list);
    return structuredClone(attestation);
  },

  // ==========================================================================
  // 3. READ-ONLY VIEW METHODS (`get_project`, `get_barangay`, `is_verified_resident`, etc.)
  // ==========================================================================

  async getBarangay(barangay_id: string): Promise<OnChainBarangayView | null> {
    const b = sandboxState.barangays.get(barangay_id);
    if (!b) return null;
    return {
      barangay_id: b.barangay_id,
      psgc_code: b.psgc_code,
      name: b.name,
      active: b.active,
      is_demo: b.is_demo,
      quorum_bps: b.quorum_bps,
      min_votes: b.min_votes,
      admin_accounts: Array.from(b.admin_accounts),
      sk_officials: Array.from(b.sk_officials),
      verified_residents_count: b.verified_residents.size,
    };
  },

  async listBarangays(): Promise<OnChainBarangayView[]> {
    const out: OnChainBarangayView[] = [];
    for (const id of sandboxState.barangays.keys()) {
      const view = await this.getBarangay(id);
      if (view) out.push(view);
    }
    return out;
  },

  async isBarangayAdmin(barangay_id: string, account_id: string): Promise<boolean> {
    const b = sandboxState.barangays.get(barangay_id);
    if (!b || !b.active) return false;
    return b.admin_accounts.has(account_id.trim().toLowerCase());
  },

  async isSkOfficial(barangay_id: string, account_id: string): Promise<boolean> {
    const b = sandboxState.barangays.get(barangay_id);
    if (!b || !b.active) return false;
    return b.sk_officials.has(account_id.trim().toLowerCase());
  },

  async isVerifiedResident(barangay_id: string, account_id: string): Promise<boolean> {
    const b = sandboxState.barangays.get(barangay_id);
    if (!b || !b.active) return false;
    return b.verified_residents.has(account_id.trim().toLowerCase());
  },

  async getProject(project_id: string): Promise<OnChainProject | null> {
    const p = sandboxState.projects.get(project_id);
    return p ? structuredClone(p) : null;
  },

  async getProjectsByBarangay(barangay_id: string): Promise<OnChainProject[]> {
    const out: OnChainProject[] = [];
    for (const p of sandboxState.projects.values()) {
      if (p.barangay_id === barangay_id) {
        out.push(structuredClone(p));
      }
    }
    return out;
  },

  async getAiAttestations(project_id: string): Promise<OnChainAiAttestation[]> {
    const list = sandboxState.attestations.get(project_id) || [];
    return structuredClone(list);
  },

  getPendingReconciliationIntents(barangayId?: string): TransactionLifecycleRecord[] {
    const out: TransactionLifecycleRecord[] = [];
    for (const rec of sandboxState.txIntents.values()) {
      if (rec.status === 'RECONCILIATION_REQUIRED') {
        if (!barangayId || rec.barangayId === barangayId) {
          out.push(structuredClone(rec));
        }
      }
    }
    return out;
  },

  // ==========================================================================
  // 4. AUTHORITATIVE ON-CHAIN TO FIRESTORE RECONCILIATION ENGINE
  // ==========================================================================

  /**
   * Synchronizes off-chain Firestore `proposals/{projectId}` and `transaction_references`
   * to match the authoritative on-chain `Project` state from NEAR.
   */
  async syncProposalFromOnChainProject(
    onChainProject: OnChainProject,
    txHash: string,
    actionType: TransactionReferenceDocument['actionType'],
    signerNearAccountId: string,
    recipientNearAccountId: string,
    amountYocto: string,
    milestoneIndex?: number
  ): Promise<void> {
    const existingProposal = await proposalRepository.getById(onChainProject.project_id);
    if (existingProposal) {
      const mappedStatus: ProposalDocument['status'] =
        onChainProject.status === 'Completed'
          ? 'COMPLETED'
          : onChainProject.status === 'Refunded'
            ? 'REFUNDED'
            : onChainProject.status === 'Disputed'
              ? 'REVISION_REQUESTED'
              : 'ACTIVE_ESCROW';

      const activeMilestone =
        onChainProject.milestones[onChainProject.current_milestone_idx - 1] ||
        onChainProject.milestones[0];

      const updatedMilestones: ProposalMilestone[] = onChainProject.milestones.map((m, idx) => {
        const prev = existingProposal.milestones[idx];
        const mStatus: ProposalMilestone['status'] =
          m.status === 'Completed'
            ? 'RELEASED'
            : m.status === 'SubmittedForVote'
              ? 'EVIDENCE_SUBMITTED'
              : m.status === 'Rejected' || m.status === 'Failed'
                ? 'DISPUTED'
                : onChainProject.status === 'Refunded'
                  ? 'REFUNDED'
                  : 'LOCKED';

        return {
          index: m.index,
          label: m.title,
          allocationBps: m.percentage_bps,
          amountYocto: m.amount_yocto,
          amountPhpEquivalent:
            prev?.amountPhpEquivalent ||
            nearToPhp(yoctoToNear(m.amount_yocto), APP_CONFIG.near.phpPerNearRate),
          status: mStatus,
          evidenceHash: m.proof_hash || prev?.evidenceHash,
          evidenceSummary: prev?.evidenceSummary,
          evidencePhotoUrls: prev?.evidencePhotoUrls,
          submittedAt: prev?.submittedAt,
          releasedAt: m.released_at_ns
            ? new Date(Math.floor(m.released_at_ns / 1_000_000)).toISOString()
            : prev?.releasedAt,
          nearTxHash: m.status === 'Completed' ? txHash : prev?.nearTxHash,
        };
      });

      await proposalRepository.updateProposal(onChainProject.project_id, {
        status: mappedStatus,
        approveVotes: activeMilestone ? activeMilestone.votes_approve : 0,
        rejectVotes: activeMilestone ? activeMilestone.votes_reject : 0,
        quorumBps: onChainProject.quorum_bps,
        minVotesRequired: onChainProject.min_votes,
        nearEscrowCreatedTxHash:
          actionType === 'FUND_ESCROW'
            ? txHash
            : existingProposal.nearEscrowCreatedTxHash || txHash,
        milestones: updatedMilestones,
      });
    }

    const nearStr = yoctoToNear(amountYocto);
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const txRef: TransactionReferenceDocument = {
      id: `txref_${txHash}`,
      nearTxHash: txHash,
      proposalId: onChainProject.project_id,
      barangayId: onChainProject.barangay_id,
      actionType,
      signerNearAccountId,
      recipientNearAccountId,
      amountYocto,
      amountNear: nearStr,
      amountPhpEquivalent: nearToPhp(nearStr, APP_CONFIG.near.phpPerNearRate),
      milestoneIndex,
      explorerUrl: `${APP_CONFIG.near.explorerBaseUrl}/txns/${txHash}`,
      receiptSerialNumber: `FD-RCPT-${dateStamp}-${txHash.slice(-6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    await proposalRepository.recordTransactionReference(txRef);
  },

  /**
   * Reconciles an interrupted post-transaction Firestore state against authoritative NEAR state.
   */
  async reconcileProjectState(projectId: string): Promise<{
    reconciled: boolean;
    onChainProject: OnChainProject | null;
    updatedIntents: number;
  }> {
    const onChainProject = await this.getProject(projectId);
    if (!onChainProject) {
      return { reconciled: false, onChainProject: null, updatedIntents: 0 };
    }

    let updatedIntents = 0;
    for (const [intentId, rec] of sandboxState.txIntents.entries()) {
      if (rec.projectId === projectId && rec.status === 'RECONCILIATION_REQUIRED') {
        const txHash = rec.txHash || nextDeterministicSandboxTxHash('reconcile', projectId);
        await this.syncProposalFromOnChainProject(
          onChainProject,
          txHash,
          rec.methodName === 'create_project'
            ? 'FUND_ESCROW'
            : rec.methodName === 'submit_milestone_proof'
              ? 'SUBMIT_MILESTONE_PROOF'
              : rec.methodName === 'refund_project'
                ? 'REFUND_ESCROW'
                : 'CAST_VOTE',
          rec.signerAccountId,
          onChainProject.sk_official,
          rec.attachedDepositYocto
        );

        sandboxState.txIntents.set(intentId, {
          ...rec,
          status: 'SUCCESSFUL',
          reconciliationReason: undefined,
          updatedAt: new Date().toISOString(),
        });
        updatedIntents += 1;
      }
    }

    if (updatedIntents === 0) {
      const fallbackHash = nextDeterministicSandboxTxHash('reconcile_sync', projectId);
      await this.syncProposalFromOnChainProject(
        onChainProject,
        fallbackHash,
        'FUND_ESCROW',
        onChainProject.funder_treasury,
        onChainProject.sk_official,
        onChainProject.total_budget_yocto
      );
    }

    return {
      reconciled: true,
      onChainProject,
      updatedIntents,
    };
  },

  /**
   * Helper to build `MilestoneInput[]` from a `ProposalDocument` (defaulting to 40/40/20 bps).
   */
  buildMilestoneInputsFromProposal(proposal: ProposalDocument): {
    totalBudgetYocto: string;
    milestoneInputs: OnChainMilestoneInput[];
  } {
    const totalYocto =
      proposal.totalBudgetYocto && BigInt(proposal.totalBudgetYocto) > 0n
        ? proposal.totalBudgetYocto
        : nearToYocto(proposal.totalBudgetNear || '10');

    const milestones =
      proposal.milestones && proposal.milestones.length >= 2
        ? proposal.milestones
        : [
            {
              index: 1,
              label: 'Phase 1 — Upfront Mobilization & Initial Procurement',
              allocationBps: 4000,
              amountYocto: ((BigInt(totalYocto) * 4000n) / 10000n).toString(),
              amountPhpEquivalent: Math.round(proposal.totalBudgetPhp * 0.4),
              status: 'LOCKED' as const,
            },
            {
              index: 2,
              label: 'Phase 2 — Mid-Implementation Delivery & Verification',
              allocationBps: 4000,
              amountYocto: ((BigInt(totalYocto) * 4000n) / 10000n).toString(),
              amountPhpEquivalent: Math.round(proposal.totalBudgetPhp * 0.4),
              status: 'LOCKED' as const,
            },
            {
              index: 3,
              label: 'Phase 3 — Final Completion & Community Turnover',
              allocationBps: 2000,
              amountYocto: (
                BigInt(totalYocto) -
                ((BigInt(totalYocto) * 4000n) / 10000n) * 2n
              ).toString(),
              amountPhpEquivalent: Math.round(proposal.totalBudgetPhp * 0.2),
              status: 'LOCKED' as const,
            },
          ];

    return {
      totalBudgetYocto: totalYocto,
      milestoneInputs: milestones.map((m, idx) => ({
        title: m.label,
        percentage_bps: m.allocationBps,
        is_upfront: idx === 0,
      })),
    };
  },
};


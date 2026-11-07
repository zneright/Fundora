/**
 * Fundora — NEAR On-Chain AI Attestation Signer (`auditor.fundora.testnet`)
 * Integrates with Phase 2 `FundoraContract::record_ai_attestation`:
 *   record_ai_attestation(
 *     project_id: String,
 *     target_type: String,
 *     milestone_idx: Option<u32>,
 *     report_sha256_hash: String,
 *     score: u8,
 *     recommendation: String
 *   )
 */

import { backendAdminStore } from './adminStore.ts';
import { ApiSecurityError } from './security.ts';
import type {
  AttestationTargetType,
  ContractRecommendation,
  NearAttestationOutcome,
} from './types.ts';

export const AUTHORIZED_AUDITOR_ACCOUNT_ID = 'auditor.fundora.testnet';
export const DEFAULT_NEAR_CONTRACT_ID = 'contract.fundora.testnet';
export const NEARBLOCKS_TESTNET_TX_BASE = 'https://testnet.nearblocks.io/txns';

export const ADVISORY_TRUST_BOUNDARY_NOTICE =
  'ADVISORY TRUST BOUNDARY: This NEAR attestation proves cryptographic provenance and non-repudiation—that authorized auditor account auditor.fundora.testnet committed report_sha256_hash at this timestamp. It does NOT prove AI assessment infallibility; human Barangay Admin review and Verified Youth Resident quorum remain binding.';

export interface RecordAiAttestationContractArgs {
  project_id: string;
  target_type: AttestationTargetType;
  milestone_idx: number | null;
  report_sha256_hash: string;
  score: number;
  recommendation: ContractRecommendation;
}

export interface NearBroadcastResult {
  outcomeStatus: 'SUCCESS' | 'PENDING_TIMEOUT' | 'FAILED';
  txHash?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export type NearAttestationExecutorFn = (
  signerAccountId: string,
  contractId: string,
  args: RecordAiAttestationContractArgs
) => Promise<NearBroadcastResult>;

let customNearExecutor: NearAttestationExecutorFn | null = null;

export function setCustomNearAttestationExecutorForTesting(
  executor: NearAttestationExecutorFn | null
): void {
  customNearExecutor = executor;
}

export function validateContractAttestationArgs(
  signerAccountId: string,
  args: RecordAiAttestationContractArgs
): void {
  const expectedAuditor =
    (process.env.NEAR_AUDITOR_ACCOUNT_ID || AUTHORIZED_AUDITOR_ACCOUNT_ID).trim();

  if (signerAccountId !== expectedAuditor) {
    throw new ApiSecurityError(
      403,
      'ERR_UNAUTHORIZED_AUDITOR',
      `ERR_UNAUTHORIZED_AUDITOR: Signer "${signerAccountId}" is not the authorized AI auditor account ("${expectedAuditor}").`
    );
  }

  if (!args.project_id || args.project_id.trim().length === 0) {
    throw new ApiSecurityError(
      400,
      'ERR_PROJECT_NOT_FOUND',
      'ERR_PROJECT_NOT_FOUND: project_id cannot be empty.'
    );
  }

  if (
    args.target_type !== 'proposal_procurement' &&
    args.target_type !== 'milestone_evidence'
  ) {
    throw new ApiSecurityError(
      400,
      'ERR_INVALID_ATTESTATION_TARGET',
      `ERR_INVALID_ATTESTATION_TARGET: target_type must be "proposal_procurement" or "milestone_evidence".`
    );
  }

  if (args.target_type === 'milestone_evidence') {
    if (
      typeof args.milestone_idx !== 'number' ||
      !Number.isInteger(args.milestone_idx) ||
      args.milestone_idx < 1 ||
      args.milestone_idx > 5
    ) {
      throw new ApiSecurityError(
        400,
        'ERR_INVALID_MILESTONE_INDEX',
        'ERR_INVALID_MILESTONE_INDEX: milestone_evidence requires a 1-based integer milestone_idx (1..5).'
      );
    }
  }

  if (!/^[a-f0-9]{64}$/.test(args.report_sha256_hash)) {
    throw new ApiSecurityError(
      400,
      'ERR_INVALID_SHA256_HASH',
      'ERR_INVALID_SHA256_HASH: report_sha256_hash must be a 64-character lowercase hex SHA-256 string.'
    );
  }

  if (
    typeof args.score !== 'number' ||
    !Number.isInteger(args.score) ||
    args.score < 0 ||
    args.score > 100
  ) {
    throw new ApiSecurityError(
      400,
      'ERR_INVALID_AI_SCORE',
      'ERR_INVALID_AI_SCORE: score must be an integer between 0 and 100.'
    );
  }

  if (
    args.recommendation !== 'approve' &&
    args.recommendation !== 'revise' &&
    args.recommendation !== 'flag_high_risk'
  ) {
    throw new ApiSecurityError(
      400,
      'ERR_INVALID_AI_RECOMMENDATION',
      'ERR_INVALID_AI_RECOMMENDATION: recommendation must be "approve", "revise", or "flag_high_risk".'
    );
  }
}

async function defaultNearAttestationExecutor(
  _signerAccountId: string,
  _contractId: string,
  _args: RecordAiAttestationContractArgs
): Promise<NearBroadcastResult> {
  const privateKey = (process.env.NEAR_AUDITOR_PRIVATE_KEY || '').trim();
  if (!privateKey) {
    return {
      outcomeStatus: 'PENDING_TIMEOUT',
      errorMessage:
        'NEAR_AUDITOR_PRIVATE_KEY is not configured in server environment; attestation queued for on-chain submission once signer credentials are provided.',
      retryable: true,
    };
  }

  // Note: Live external transaction broadcast is gated behind explicit deployment approval.
  return {
    outcomeStatus: 'PENDING_TIMEOUT',
    errorMessage:
      'Live NEAR Testnet broadcast is gated until explicit Testnet deployment authorization; attestation payload verified and queued.',
    retryable: true,
  };
}

export async function submitNearAiAttestation(params: {
  barangayId: string;
  projectId: string;
  targetType: AttestationTargetType;
  milestoneIdx: number | null;
  reportSha256Hash: string;
  score: number;
  recommendation: ContractRecommendation;
  signerAccountIdOverride?: string;
}): Promise<NearAttestationOutcome> {
  const signerAccountId = (
    params.signerAccountIdOverride ||
    process.env.NEAR_AUDITOR_ACCOUNT_ID ||
    AUTHORIZED_AUDITOR_ACCOUNT_ID
  ).trim();

  const contractId = (
    process.env.NEAR_CONTRACT_ID || DEFAULT_NEAR_CONTRACT_ID
  ).trim();

  const contractArgs: RecordAiAttestationContractArgs = {
    project_id: params.projectId.trim(),
    target_type: params.targetType,
    milestone_idx:
      params.targetType === 'milestone_evidence' ? params.milestoneIdx : null,
    report_sha256_hash: params.reportSha256Hash.trim().toLowerCase(),
    score: Math.round(params.score),
    recommendation: params.recommendation,
  };

  validateContractAttestationArgs(signerAccountId, contractArgs);

  const executor = customNearExecutor || defaultNearAttestationExecutor;
  const result = await executor(signerAccountId, contractId, contractArgs);
  const nowIso = new Date().toISOString();

  if (result.outcomeStatus === 'SUCCESS' && result.txHash) {
    const explorerUrl = `${NEARBLOCKS_TESTNET_TX_BASE}/${result.txHash}`;

    await backendAdminStore.writeTrustedTransactionReference({
      id: result.txHash,
      nearTxHash: result.txHash,
      proposalId: contractArgs.project_id,
      barangayId: params.barangayId,
      actionType: 'RECORD_AI_AUDIT',
      signerNearAccountId: signerAccountId,
      recipientNearAccountId: contractId,
      amountYocto: '0',
      amountNear: '0',
      amountPhpEquivalent: 0,
      milestoneIndex: contractArgs.milestone_idx ?? undefined,
      explorerUrl,
      receiptSerialNumber: `FD-RCPT-${nowIso.slice(0, 10).replace(/-/g, '')}-${result.txHash
        .slice(0, 6)
        .toUpperCase()}`,
      createdAt: nowIso,
    });

    return {
      status: 'RECORDED_ONCHAIN',
      txHash: result.txHash,
      signerAccountId,
      contractId,
      projectId: contractArgs.project_id,
      targetType: contractArgs.target_type,
      milestoneIdx: contractArgs.milestone_idx,
      reportSha256Hash: contractArgs.report_sha256_hash,
      score: contractArgs.score,
      recommendation: contractArgs.recommendation,
      explorerUrl,
      retryable: false,
      recordedAt: nowIso,
      advisoryTrustNotice: ADVISORY_TRUST_BOUNDARY_NOTICE,
    };
  }

  if (result.outcomeStatus === 'PENDING_TIMEOUT') {
    return {
      status: 'PENDING_RETRY',
      signerAccountId,
      contractId,
      projectId: contractArgs.project_id,
      targetType: contractArgs.target_type,
      milestoneIdx: contractArgs.milestone_idx,
      reportSha256Hash: contractArgs.report_sha256_hash,
      score: contractArgs.score,
      recommendation: contractArgs.recommendation,
      retryable: true,
      error: result.errorMessage || 'NEAR RPC transaction pending or timed out; retryable.',
      recordedAt: nowIso,
      advisoryTrustNotice: ADVISORY_TRUST_BOUNDARY_NOTICE,
    };
  }

  return {
    status: 'FAILED',
    signerAccountId,
    contractId,
    projectId: contractArgs.project_id,
    targetType: contractArgs.target_type,
    milestoneIdx: contractArgs.milestone_idx,
    reportSha256Hash: contractArgs.report_sha256_hash,
    score: contractArgs.score,
    recommendation: contractArgs.recommendation,
    retryable: Boolean(result.retryable),
    error: result.errorMessage || 'NEAR attestation transaction failed.',
    recordedAt: nowIso,
    advisoryTrustNotice: ADVISORY_TRUST_BOUNDARY_NOTICE,
  };
}


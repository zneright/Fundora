/**
 * Fundora — Barangay Admin & Treasury Escrow Workspace (`AdminPanel.tsx`)
 *
 * Scoped strictly to `barangay_admin` and `system_admin` of the active Barangay jurisdiction.
 * Connects to the authoritative Phase 2 NEAR contract (`nearContractService`):
 * - Resident KYC approval & on-chain voter registration (`register_verified_resident`)
 * - SK Official appointment (`set_sk_official`)
 * - Selective resubmission requests (`photo_only`, `details_only`, `full_package`, `custom`)
 * - Proposal review, AI audit inspection & payable escrow funding (`create_project`)
 * - Disputed project treasury refund (`refund_project` -> routes strictly to `funder_treasury`)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Coins,
  RotateCcw,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import { userRepository } from '../repositories/user.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { aiAuditRepository } from '../repositories/aiAudit.repository';
import {
  nearContractService,
  STORAGE_RESERVE_YOCTO,
  type OnChainAiAttestation,
  type OnChainProject,
} from '../services/nearContract.service';
import type {
  AiAuditRecordDocument,
  ProposalDocument,
  ResubmissionTarget,
  UserProfile,
} from '../types';
import { formatNear, formatPhp, yoctoToNear } from '../utils/currency';
import { buildSelectiveResubmissionDecision } from '../utils/reviewDecision';
import { computeSha256Hex } from '../utils/normalization';

export const AdminPanel: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    isConnected,
    activeAccountId,
    networkId,
    setActiveTransaction,
    refreshTransactionHistory,
  } = useNearWallet();

  const [barangayUsers, setBarangayUsers] = useState<UserProfile[]>([]);
  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [onChainProjects, setOnChainProjects] = useState<Record<string, OnChainProject>>({});
  const [attestationsByProject, setAttestationsByProject] = useState<
    Record<string, OnChainAiAttestation[]>
  >({});
  const [aiAuditsByProposal, setAiAuditsByProposal] = useState<
    Record<string, AiAuditRecordDocument[]>
  >({});
  const [explicitWalletConfirmByProject, setExplicitWalletConfirmByProject] = useState<
    Record<string, boolean>
  >({});
  const [adminOverrideNoteByProject, setAdminOverrideNoteByProject] = useState<
    Record<string, string>
  >({});
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isAuthorizedAdmin =
    userProfile?.role === 'barangay_admin' || userProfile?.role === 'system_admin';

  const loadWorkspaceData = useCallback(async () => {
    if (!userProfile?.barangayId) return;
    const [users, props, chainProjs] = await Promise.all([
      userRepository.listByBarangay(userProfile.barangayId),
      proposalRepository.listByBarangay(userProfile.barangayId),
      nearContractService.getProjectsByBarangay(userProfile.barangayId),
    ]);

    setBarangayUsers(users);
    setProposals(props);

    const projMap: Record<string, OnChainProject> = {};
    for (const p of chainProjs) {
      projMap[p.project_id] = p;
    }
    setOnChainProjects(projMap);

    const attMap: Record<string, OnChainAiAttestation[]> = {};
    const auditMap: Record<string, AiAuditRecordDocument[]> = {};
    for (const prop of props) {
      const [atts, audits] = await Promise.all([
        nearContractService.getAiAttestations(prop.id),
        aiAuditRepository.listByProposal(prop.id),
      ]);
      attMap[prop.id] = atts;
      auditMap[prop.id] = audits;
    }
    setAttestationsByProject(attMap);
    setAiAuditsByProposal(auditMap);
  }, [userProfile?.barangayId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  if (!userProfile) return null;

  if (!isAuthorizedAdmin) {
    return (
      <div className="bank-card" role="alert" data-testid="admin-unauthorized-guard">
        <h3 className="bank-card-title">
          <AlertTriangle size={18} /> Access Restricted — Barangay Admin Only
        </h3>
        <p className="bank-card-subtitle">
          Your current role (<code>{userProfile.role}</code>) is not authorized to access
          Barangay Treasury administration or execute escrow funding calls.
        </p>
      </div>
    );
  }

  const handleApproveUserKyc = async (targetUser: UserProfile) => {
    if (targetUser.barangayId !== userProfile.barangayId) {
      setStatusMessage({
        type: 'error',
        text: 'Cross-barangay KYC modification is strictly forbidden.',
      });
      return;
    }
    setIsBusy(true);
    setStatusMessage(null);
    try {
      await userRepository.updateProfile(targetUser.uid, {
        verificationStatus: 'approved',
        rejectionReason: undefined,
        resubmissionTarget: undefined,
        resubmissionAllowedFields: undefined,
      });

      if (isConnected && activeAccountId && targetUser.nearAccountId) {
        await nearContractService.ensureBarangayProvisioned({
          barangay_id: userProfile.barangayId,
          psgc_code: userProfile.psgcCode,
          name: userProfile.barangayName,
          admin_account: activeAccountId,
        });

        if (targetUser.role === 'sk_official') {
          const tx = await nearContractService.setSkOfficial(
            {
              barangay_id: userProfile.barangayId,
              account_id: targetUser.nearAccountId,
              active: true,
            },
            {
              signerAccountId: activeAccountId,
              networkId,
              explicitWalletConfirmation: true,
            }
          );
          setActiveTransaction(tx);
        } else if (targetUser.role === 'resident') {
          const tx = await nearContractService.registerVerifiedResident(
            {
              barangay_id: userProfile.barangayId,
              account_id: targetUser.nearAccountId,
              eligible: true,
            },
            {
              signerAccountId: activeAccountId,
              networkId,
              explicitWalletConfirmation: true,
            }
          );
          setActiveTransaction(tx);
        }
      }

      await loadWorkspaceData();
      setStatusMessage({
        type: 'success',
        text: `Approved KYC for ${targetUser.displayName} (${targetUser.role}).`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRequestSelectiveResubmission = async (
    targetUser: UserProfile,
    preset: ResubmissionTarget
  ) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const decision = buildSelectiveResubmissionDecision(
        preset,
        `Barangay Admin requested ${preset.replace('_', ' ')} resubmission.`
      );
      await userRepository.updateProfile(targetUser.uid, {
        verificationStatus: 'rejected',
        resubmissionTarget: decision.resubmissionTarget,
        resubmissionAllowedFields: decision.allowedFields,
        rejectionReason: decision.rejectionReason,
      });
      await loadWorkspaceData();
      setStatusMessage({
        type: 'warning',
        text: `Requested selective resubmission (${preset}) from ${targetUser.displayName}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleFundEscrowOnNear = async (proposal: ProposalDocument) => {
    setStatusMessage(null);
    if (!isConnected || !activeAccountId) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your Barangay Admin NEAR wallet before funding project escrow.',
      });
      return;
    }

    if (proposal.barangayId !== userProfile.barangayId) {
      setStatusMessage({
        type: 'error',
        text: 'ERR_CROSS_BARANGAY_FORBIDDEN: Cannot fund a proposal from another barangay.',
      });
      return;
    }

    const confirmed = Boolean(explicitWalletConfirmByProject[proposal.id]);
    if (!confirmed) {
      setStatusMessage({
        type: 'error',
        text: 'ERR_WALLET_CONFIRMATION_REQUIRED: Please check the explicit Full-Access Wallet Deposit Confirmation box before locking treasury funds.',
      });
      return;
    }

    setIsBusy(true);
    try {
      await nearContractService.ensureBarangayProvisioned({
        barangay_id: userProfile.barangayId,
        psgc_code: userProfile.psgcCode,
        name: userProfile.barangayName,
        admin_account: activeAccountId,
        sk_accounts: [proposal.beneficiaryNearAccountId || proposal.proposerNearAccountId],
      });

      const { totalBudgetYocto, milestoneInputs } =
        nearContractService.buildMilestoneInputsFromProposal(proposal);
      const requiredAttachedYocto = (
        BigInt(totalBudgetYocto) + BigInt(STORAGE_RESERVE_YOCTO)
      ).toString();

      const metadataHash = await computeSha256Hex(
        JSON.stringify({
          id: proposal.id,
          title: proposal.title,
          totalBudgetYocto,
          lineItems: proposal.lineItems,
        })
      );

      const { txRecord } = await nearContractService.createProject(
        {
          project_id: proposal.id,
          barangay_id: proposal.barangayId,
          name: proposal.title,
          metadata_hash: metadataHash,
          sk_official: proposal.beneficiaryNearAccountId || proposal.proposerNearAccountId,
          total_budget_yocto: totalBudgetYocto,
          milestones_input: milestoneInputs,
          immediate_phase_1: true,
        },
        {
          signerAccountId: activeAccountId,
          networkId,
          accessKeyMode: 'full_access_wallet',
          explicitWalletConfirmation: confirmed,
          attachedDepositYocto: requiredAttachedYocto,
        }
      );

      setActiveTransaction(txRecord);
      await loadWorkspaceData();
      await refreshTransactionHistory();

      if (txRecord.status === 'SUCCESSFUL') {
        setStatusMessage({
          type: 'success',
          text: `Escrow funded on NEAR (${proposal.id}). Phase 1 mobilization finalized (Tx: ${txRecord.txHash?.slice(0, 12)}...).`,
        });
      } else if (txRecord.status === 'PENDING') {
        setStatusMessage({
          type: 'warning',
          text: `Escrow transaction submitted (${txRecord.status}). Awaiting transfer finality before marking Phase 1 payout complete.`,
        });
      } else if (txRecord.status === 'RECONCILIATION_REQUIRED') {
        setStatusMessage({
          type: 'warning',
          text: txRecord.reconciliationReason || 'Reconciliation required.',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefundDisputedProject = async (projectId: string) => {
    if (!isConnected || !activeAccountId) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your Barangay Admin NEAR wallet to execute a treasury refund.',
      });
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);
    try {
      const { txRecord, refundedRecipient, refundedAmountYocto } =
        await nearContractService.refundProject(
          { project_id: projectId },
          {
            signerAccountId: activeAccountId,
            networkId,
            accessKeyMode: 'full_access_wallet',
            explicitWalletConfirmation: true,
          }
        );

      setActiveTransaction(txRecord);
      await loadWorkspaceData();
      await refreshTransactionHistory();

      if (txRecord.status === 'SUCCESSFUL') {
        setStatusMessage({
          type: 'success',
          text: `Refunded ${formatNear(yoctoToNear(refundedAmountYocto))} strictly back to funder treasury (${refundedRecipient}).`,
        });
      } else {
        setStatusMessage({
          type: 'warning',
          text: txRecord.reconciliationReason || `Refund status: ${txRecord.status}`,
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetryFailedPayout = async (projectId: string, milestoneIdx: number) => {
    if (!isConnected || !activeAccountId) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const { txRecord } = await nearContractService.retryFailedMilestonePayout(
        { project_id: projectId, milestone_idx: milestoneIdx },
        {
          signerAccountId: activeAccountId,
          networkId,
          accessKeyMode: 'full_access_wallet',
          explicitWalletConfirmation: true,
        }
      );
      setActiveTransaction(txRecord);
      await loadWorkspaceData();
      await refreshTransactionHistory();
      setStatusMessage({
        type: 'success',
        text: `Retried Milestone #${milestoneIdx} payout for ${projectId}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="workspace-section" data-testid="admin-panel-workspace">
      {statusMessage && (
        <div
          className={`alert-banner alert-${statusMessage.type}`}
          role="status"
          data-testid="admin-status-banner"
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <strong>{statusMessage.type.toUpperCase()}:</strong> {statusMessage.text}
        </div>
      )}

      <div className="grid-2-equal" style={{ marginBottom: '1.25rem' }}>
        {/* 1. RESIDENT KYC & ON-CHAIN VOTER REGISTRY DESK */}
        <div className="bank-card">
          <h3 className="bank-card-title">
            <Users size={18} /> Resident KYC & On-Chain Voter Registry (
            {userProfile.barangayName})
          </h3>
          <p className="bank-card-subtitle">
            Approve verified youth residents (15–30) and SK officials to register their NEAR
            accounts in <code>{userProfile.barangayId}</code>.
          </p>

          <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.65rem' }}>
            {barangayUsers.length === 0 ? (
              <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                No registered members found in this jurisdiction yet.
              </div>
            ) : (
              barangayUsers.map((member) => (
                <div
                  key={member.uid}
                  data-testid={`kyc-member-row-${member.uid}`}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.65rem',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {member.displayName}{' '}
                      <span className="badge badge-role">{member.role}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                      Status: <code>{member.verificationStatus}</code> • Age: {member.ageYears}{' '}
                      yrs • NEAR: <code>{member.nearAccountId || 'Unlinked'}</code>
                    </div>
                  </div>

                  {member.uid !== userProfile.uid && (
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={isBusy}
                        data-testid={`approve-kyc-btn-${member.uid}`}
                        onClick={() => void handleApproveUserKyc(member)}
                      >
                        <CheckCircle2 size={14} /> Approve & Sync NEAR
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={isBusy}
                        data-testid={`resubmit-photo-btn-${member.uid}`}
                        onClick={() =>
                          void handleRequestSelectiveResubmission(member, 'photo_only')
                        }
                      >
                        <RefreshCw size={13} /> Request Photo Resubmission
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. ESCROW GOVERNANCE & ADVISORY TRUST BOUNDARY SUMMARY */}
        <div className="bank-card">
          <h3 className="bank-card-title">
            <ShieldCheck size={18} /> Programmable Escrow & Advisory AI Rules
          </h3>
          <p className="bank-card-subtitle">
            Enforced by <code>{nearContractService.getContractConfig().contractId}</code> on
            NEAR Testnet
          </p>
          <ul
            style={{
              marginTop: '0.85rem',
              paddingLeft: '1.15rem',
              fontSize: '0.84rem',
              lineHeight: 1.6,
            }}
          >
            <li>
              <strong>Explicit Full-Access Wallet Confirmation:</strong> Locking Barangay
              Treasury funds via <code>create_project</code> attaches{' '}
              <code>total_budget_yocto + 0.05 NEAR</code> storage reserve and never executes
              via a background session key.
            </li>
            <li>
              <strong>Advisory AI Boundary:</strong> <code>auditor.fundora.testnet</code>{' '}
              attestations commit SHA-256 report hashes on-chain for non-repudiation, but never
              release funds on their own.
            </li>
            <li>
              <strong>Treasury-Only Refund Routing:</strong> If community voters reject a
              milestone (<code>Disputed</code>), <code>refund_project</code> returns all
              remaining locked NEAR strictly back to <code>funder_treasury</code> (never to{' '}
              <code>sk_official</code>).
            </li>
          </ul>
        </div>
      </div>

      {/* 3. PROPOSALS & AUTHORITATIVE ON-CHAIN ESCROW OVERSIGHT */}
      <div className="bank-card">
        <h3 className="bank-card-title">
          <Coins size={18} /> Barangay Proposals & Programmable NEAR Escrows
        </h3>
        <p className="bank-card-subtitle">
          Review SK proposals, inspect AI DTI SRP procurement audits, fund escrow tranches, or
          reclaim rejected treasury balances.
        </p>

        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          {proposals.length === 0 ? (
            <div style={{ fontSize: '0.88rem', opacity: 0.75 }}>
              No community proposals submitted in {userProfile.barangayName} yet.
            </div>
          ) : (
            proposals.map((prop) => {
              const chainProj = onChainProjects[prop.id];
              const attestations = attestationsByProject[prop.id] || [];
              const audits = aiAuditsByProposal[prop.id] || [];
              const latestAudit = audits[0];

              return (
                <div
                  key={prop.id}
                  data-testid={`admin-proposal-card-${prop.id}`}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.85rem',
                    border: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.02rem' }}>{prop.title}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        Deterministic ID: <code>{prop.id}</code> • SK Beneficiary:{' '}
                        <code>
                          {prop.beneficiaryNearAccountId || prop.proposerNearAccountId}
                        </code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge badge-role">
                        Firestore: {prop.status}
                      </span>
                      {chainProj && (
                        <span
                          className="badge badge-success"
                          data-testid={`onchain-status-${prop.id}`}
                        >
                          On-Chain: {chainProj.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '1.25rem',
                      flexWrap: 'wrap',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div>
                      <strong>Total Budget:</strong> {formatNear(prop.totalBudgetNear)} (
                      {formatPhp(prop.totalBudgetPhp)})
                    </div>
                    {chainProj && (
                      <>
                        <div>
                          <strong>Remaining Locked Escrow:</strong>{' '}
                          <span data-testid={`remaining-escrow-${prop.id}`}>
                            {formatNear(yoctoToNear(chainProj.remaining_balance_yocto))}
                          </span>
                        </div>
                        <div>
                          <strong>Total Disbursed:</strong>{' '}
                          {formatNear(yoctoToNear(chainProj.total_disbursed_yocto))}
                        </div>
                        <div>
                          <strong>Funder Treasury:</strong>{' '}
                          <code data-testid={`funder-treasury-${prop.id}`}>
                            {chainProj.funder_treasury}
                          </code>
                        </div>
                      </>
                    )}
                  </div>

                  {/* AI Audit & On-Chain Attestation Box */}
                  {(latestAudit || attestations.length > 0) && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '0.6rem',
                        background: 'rgba(16, 185, 129, 0.07)',
                        fontSize: '0.81rem',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        <FileCheck2 size={14} style={{ verticalAlign: 'middle' }} /> Advisory
                        AI Procurement Assessment (Human Approval & Resident Quorum Remain
                        Binding)
                      </div>
                      {latestAudit && (
                        <div>
                          Verdict: <strong>{latestAudit.verdict}</strong> (Risk Score:{' '}
                          {latestAudit.overallRiskScore}/100) — {latestAudit.summary}
                        </div>
                      )}
                      {attestations.map((att) => (
                        <div key={att.attestation_id} style={{ marginTop: '0.25rem' }}>
                          On-Chain Attestation (<code>{att.signer}</code>): Score{' '}
                          <strong>{att.score}/100</strong> ({att.recommendation}) • SHA-256:{' '}
                          <code>{att.report_sha256_hash.slice(0, 16)}...</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Controls: Fund Escrow if not yet created on-chain */}
                  {!chainProj && (
                    <div
                      style={{
                        display: 'grid',
                        gap: '0.55rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.83rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          data-testid={`confirm-wallet-deposit-${prop.id}`}
                          checked={Boolean(explicitWalletConfirmByProject[prop.id])}
                          onChange={(e) =>
                            setExplicitWalletConfirmByProject((prev) => ({
                              ...prev,
                              [prop.id]: e.target.checked,
                            }))
                          }
                        />
                        <span>
                          I explicitly confirm signing <code>create_project</code> with my
                          Full-Access NEAR Wallet attaching{' '}
                          <strong>{formatNear(prop.totalBudgetNear)} + 0.05 NEAR</strong>{' '}
                          storage reserve.
                        </span>
                      </label>

                      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ maxWidth: '340px', fontSize: '0.82rem' }}
                          placeholder="Optional Admin Review / AI Override Justification Note"
                          value={adminOverrideNoteByProject[prop.id] || ''}
                          onChange={(e) =>
                            setAdminOverrideNoteByProject((prev) => ({
                              ...prev,
                              [prop.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isBusy}
                          data-testid={`fund-escrow-btn-${prop.id}`}
                          onClick={() => void handleFundEscrowOnNear(prop)}
                        >
                          <Lock size={15} /> Approve & Fund Escrow on NEAR
                        </button>
                      </div>
                    </div>
                  )}

                  {/* On-Chain Milestone Breakdown & Treasury Refund / Retry Controls */}
                  {chainProj && (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        On-Chain Milestones (Quorum: {chainProj.quorum_bps / 100}% • Min Votes:{' '}
                        {chainProj.min_votes}):
                      </div>
                      {chainProj.milestones.map((m) => (
                        <div
                          key={m.index}
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                          }}
                        >
                          <div>
                            <strong>
                              Phase #{m.index}: {m.title}
                            </strong>{' '}
                            ({m.percentage_bps / 100}% •{' '}
                            {formatNear(yoctoToNear(m.amount_yocto))})
                          </div>
                          <div>
                            Status: <code>{m.status}</code> • Votes: {m.votes_approve} Approve
                            / {m.votes_reject} Reject
                          </div>
                          {(m.status === 'Failed' ||
                            m.status === 'ReconciliationRequired') && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              data-testid={`retry-payout-btn-${prop.id}-${m.index}`}
                              onClick={() =>
                                void handleRetryFailedPayout(prop.id, m.index)
                              }
                            >
                              <RefreshCw size={13} /> Retry Failed Payout
                            </button>
                          )}
                        </div>
                      ))}

                      {chainProj.status === 'Disputed' &&
                        BigInt(chainProj.remaining_balance_yocto) > 0n && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={isBusy}
                              data-testid={`refund-project-btn-${prop.id}`}
                              onClick={() => void handleRefundDisputedProject(prop.id)}
                            >
                              <RotateCcw size={14} /> Refund Remaining Escrow (
                              {formatNear(yoctoToNear(chainProj.remaining_balance_yocto))}) to
                              Funder Treasury ({chainProj.funder_treasury})
                            </button>
                          </div>
                        )}

                      {prop.nearEscrowCreatedTxHash && (
                        <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                          Escrow Creation Tx:{' '}
                          <code>{prop.nearEscrowCreatedTxHash}</code>{' '}
                          <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


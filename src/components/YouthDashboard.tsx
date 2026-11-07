/**
 * Fundora — Youth Resident Quorum Voting & Project Discovery Dashboard (`YouthDashboard.tsx`)
 *
 * Connects verified Youth Residents (`resident`, ages 15–30) to on-chain milestone voting
 * (`vote_milestone` on `contract.fundora.testnet`, compatible with `0 yoctoNEAR` Function-Call Access Keys).
 * Over-30 community members (`viewer`) have full read-only inspection access without voting privileges.
 *
 * Financial & Governance Invariants:
 * - 1-resident-1-vote enforced on-chain (`milestone.voters[voter]`).
 * - Payouts are never displayed as finalized until `MilestoneStatus::Completed` (`on_transfer_complete` finality).
 * - AI audit scores are displayed as advisory context; resident quorum is the binding release gate.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import { proposalRepository } from '../repositories/proposal.repository';
import {
  nearContractService,
  type OnChainAiAttestation,
  type OnChainProject,
} from '../services/nearContract.service';
import type { ProposalDocument } from '../types';
import { formatNear, formatPhp, yoctoToNear } from '../utils/currency';
import { SKCelebrationModal } from './SKCelebrationModal';
import { ImageCarousel } from './ImageCarousel';

export const YouthDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    isConnected,
    activeAccountId,
    networkId,
    accessKeyMode,
    setActiveTransaction,
    refreshTransactionHistory,
  } = useNearWallet();

  const [proposals, setProposals] = useState<ProposalDocument[]>([]);
  const [onChainProjects, setOnChainProjects] = useState<Record<string, OnChainProject>>({});
  const [attestationsByProject, setAttestationsByProject] = useState<
    Record<string, OnChainAiAttestation[]>
  >({});
  const [isOnChainVerifiedVoter, setIsOnChainVerifiedVoter] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!userProfile?.barangayId) return;
    const [props, chainProjs] = await Promise.all([
      proposalRepository.listByBarangay(userProfile.barangayId),
      nearContractService.getProjectsByBarangay(userProfile.barangayId),
    ]);
    setProposals(props);

    const projMap: Record<string, OnChainProject> = {};
    for (const p of chainProjs) {
      projMap[p.project_id] = p;
    }
    setOnChainProjects(projMap);

    const attMap: Record<string, OnChainAiAttestation[]> = {};
    for (const p of chainProjs) {
      attMap[p.project_id] = await nearContractService.getAiAttestations(p.project_id);
    }
    setAttestationsByProject(attMap);

    if (activeAccountId) {
      const verified = await nearContractService.isVerifiedResident(
        userProfile.barangayId,
        activeAccountId
      );
      setIsOnChainVerifiedVoter(verified);
    } else {
      setIsOnChainVerifiedVoter(false);
    }
  }, [userProfile?.barangayId, activeAccountId]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (!userProfile) return null;

  const isViewerOnly =
    userProfile.role === 'viewer' || userProfile.ageBracketStatus === 'over_30_viewer';
  const isEligibleResidentRole =
    userProfile.role === 'resident' &&
    userProfile.ageBracketStatus === 'eligible_youth' &&
    userProfile.verificationStatus === 'approved';

  const handleCastMilestoneVote = async (
    projectId: string,
    milestoneIdx: number,
    approve: boolean
  ) => {
    setStatusMessage(null);
    if (isViewerOnly) {
      setStatusMessage({
        type: 'error',
        text: 'ERR_VIEWER_READ_ONLY: Over-30 Viewer accounts have transparency inspection access only and cannot vote on SK youth milestones.',
      });
      return;
    }
    if (!isConnected || !activeAccountId) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your verified Youth Resident NEAR wallet before casting a milestone vote.',
      });
      return;
    }

    setIsBusy(true);
    try {
      const { txRecord, project } = await nearContractService.voteMilestone(
        {
          project_id: projectId,
          milestone_idx: milestoneIdx,
          approve,
        },
        {
          signerAccountId: activeAccountId,
          networkId,
          accessKeyMode,
          attachedDepositYocto: '0',
        }
      );

      setActiveTransaction(txRecord);
      await loadDashboardData();
      await refreshTransactionHistory();

      const updatedMilestone = project.milestones[milestoneIdx - 1];
      if (txRecord.status === 'PENDING' || updatedMilestone.status === 'PayoutInFlight') {
        setStatusMessage({
          type: 'warning',
          text: `Vote recorded on NEAR. Milestone #${milestoneIdx} payout is currently PENDING (PayoutInFlight) — awaiting transfer callback finality.`,
        });
      } else if (txRecord.status === 'RECONCILIATION_REQUIRED') {
        setStatusMessage({
          type: 'warning',
          text:
            txRecord.reconciliationReason ||
            'Reconciliation required — transfer or off-chain sync needs verification.',
        });
      } else if (updatedMilestone.status === 'Completed' && txRecord.payoutFinalized) {
        setStatusMessage({
          type: 'success',
          text: `Quorum reached & verified! Milestone #${milestoneIdx} tranche (${formatNear(yoctoToNear(updatedMilestone.amount_yocto))}) finalized and released to ${project.sk_official}.`,
        });
      } else if (updatedMilestone.status === 'Rejected') {
        setStatusMessage({
          type: 'warning',
          text: `Rejection quorum reached on Milestone #${milestoneIdx}. Project transitioned to Disputed for Barangay Treasury refund.`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Your ${approve ? 'APPROVE' : 'REJECT'} vote on Milestone #${milestoneIdx} was recorded on NEAR (${updatedMilestone.votes_approve} Approve / ${updatedMilestone.votes_reject} Reject).`,
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

  return (
    <div className="workspace-section" data-testid="youth-dashboard-workspace">
      {statusMessage && (
        <div
          className={`alert-banner alert-${statusMessage.type}`}
          role="status"
          data-testid="youth-status-banner"
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

      {/* Eligibility & Voter Status Banner */}
      <div className="bank-card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 className="bank-card-title">
              {isViewerOnly ? (
                <>
                  <Eye size={18} /> Public Transparency & Oversight Mode (Over-30 Viewer)
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> Sangguniang Kabataan Youth Voter Assembly (15–30)
                </>
              )}
            </h3>
            <p className="bank-card-subtitle">
              Jurisdiction: <strong>Brgy. {userProfile.barangayName}</strong> (
              <code>{userProfile.barangayId}</code>) • 1-Resident-1-Vote On-Chain Quorum
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isViewerOnly ? (
              <span className="badge badge-warning" data-testid="viewer-readonly-badge">
                Read-Only Viewer (R.A. 10742 Age &gt; 30)
              </span>
            ) : isEligibleResidentRole && isOnChainVerifiedVoter ? (
              <span className="badge badge-success" data-testid="verified-voter-badge">
                <CheckCircle2 size={13} /> Verified On-Chain Youth Voter (
                {activeAccountId})
              </span>
            ) : (
              <span className="badge badge-warning" data-testid="unverified-voter-badge">
                <Clock size={13} /> Connect Verified Resident Wallet to Vote
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barangay Projects & Milestone Quorum Voting Cards */}
      <div className="bank-card">
        <h3 className="bank-card-title">
          <FileSearch size={18} /> Barangay Projects, Deliverable Evidence & Quorum Voting
        </h3>
        <p className="bank-card-subtitle">
          Inspect submitted milestone proofs and advisory AI audits before casting your binding
          on-chain vote.
        </p>

        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          {Object.values(onChainProjects).length === 0 && proposals.length === 0 ? (
            <div style={{ fontSize: '0.86rem', opacity: 0.75 }}>
              No community projects found in Brgy. {userProfile.barangayName} yet.
            </div>
          ) : (
            proposals.map((prop) => {
              const chainProj = onChainProjects[prop.id];
              const attestations = attestationsByProject[prop.id] || [];

              return (
                <div
                  key={prop.id}
                  data-testid={`youth-project-card-${prop.id}`}
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
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{prop.title}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        ID: <code>{prop.id}</code> • Total Budget:{' '}
                        {formatNear(prop.totalBudgetNear)} ({formatPhp(prop.totalBudgetPhp)})
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span className="badge badge-role">{prop.status}</span>
                      {chainProj && (
                        <span
                          className="badge badge-success"
                          data-testid={`youth-onchain-project-status-${prop.id}`}
                        >
                          On-Chain: {chainProj.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {attestations.length > 0 && (
                    <div
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.55rem',
                        background: 'rgba(59, 130, 246, 0.08)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <strong>Advisory AI Auditor Attestation:</strong> Score{' '}
                      <strong>{attestations[0].score}/100</strong> (
                      {attestations[0].recommendation}) • SHA-256:{' '}
                      <code>{attestations[0].report_sha256_hash.slice(0, 16)}...</code> •{' '}
                      <em>Resident Quorum Vote is the binding payout release gate.</em>
                    </div>
                  )}

                  {chainProj ? (
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      {chainProj.milestones.map((m) => {
                        const voterKey = (activeAccountId || '').toLowerCase();
                        const hasAlreadyVoted =
                          Boolean(voterKey) && m.voters[voterKey] !== undefined;
                        const totalVotes = m.votes_approve + m.votes_reject;
                        const approvePct =
                          totalVotes > 0
                            ? Math.round((m.votes_approve * 100) / totalVotes)
                            : 0;

                        // Never show a payout as finalized unless status === 'Completed'
                        const payoutStatusLabel =
                          m.status === 'Completed'
                            ? 'FINALIZED & RELEASED'
                            : m.status === 'PayoutInFlight'
                              ? 'PENDING (IN-FLIGHT — NOT YET FINALIZED)'
                              : m.status === 'Failed' || m.status === 'ReconciliationRequired'
                                ? 'RECONCILIATION REQUIRED (TRANSFER ROLLED BACK)'
                                : m.status === 'Rejected'
                                  ? 'REJECTED BY QUORUM'
                                  : m.status === 'SubmittedForVote'
                                    ? 'OPEN FOR COMMUNITY QUORUM VOTE'
                                    : 'LOCKED IN ESCROW';

                        return (
                          <div
                            key={m.index}
                            data-testid={`youth-milestone-row-${prop.id}-${m.index}`}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '0.65rem',
                              border: '1px solid var(--border-subtle)',
                              display: 'grid',
                              gap: '0.45rem',
                              fontSize: '0.83rem',
                            }}
                          >
                            <div
                              style={{
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
                              <span
                                className="badge badge-role"
                                data-testid={`youth-payout-status-${prop.id}-${m.index}`}
                              >
                                {payoutStatusLabel}
                              </span>
                            </div>

                            {m.proof_hash && (
                              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                                Deliverable Proof SHA-256: <code>{m.proof_hash}</code>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                              }}
                            >
                              <div data-testid={`youth-vote-tally-${prop.id}-${m.index}`} style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <span>
                                    Tally: <strong>{m.votes_approve} Approve</strong> /{' '}
                                    <strong>{m.votes_reject} Reject</strong> ({totalVotes}/
                                    {chainProj.min_votes} min votes • {approvePct}% approval vs{' '}
                                    {chainProj.quorum_bps / 100}% required)
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: approvePct >= (chainProj.quorum_bps / 100) ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 700 }}>
                                    {approvePct >= (chainProj.quorum_bps / 100) ? '✓ Quorum Reached' : 'Quorum Pending'}
                                  </span>
                                </div>

                                {/* Visual Dual-Color Quorum Progress Bar */}
                                <div
                                  style={{
                                    height: '8px',
                                    borderRadius: '9999px',
                                    background: 'var(--bg-elevated)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    position: 'relative',
                                    marginBottom: '0.65rem',
                                    border: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${totalVotes > 0 ? (m.votes_approve / totalVotes) * 100 : 0}%`,
                                      background: 'var(--accent-green)',
                                      transition: 'width 0.3s ease',
                                    }}
                                    title={`Approve: ${m.votes_approve}`}
                                  />
                                  <div
                                    style={{
                                      width: `${totalVotes > 0 ? (m.votes_reject / totalVotes) * 100 : 0}%`,
                                      background: 'var(--accent-danger)',
                                      transition: 'width 0.3s ease',
                                    }}
                                    title={`Reject: ${m.votes_reject}`}
                                  />
                                </div>
                              </div>

                              {m.status === 'SubmittedForVote' && !isViewerOnly && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  {hasAlreadyVoted ? (
                                    <span
                                      className="badge badge-success"
                                      data-testid={`already-voted-badge-${prop.id}-${m.index}`}
                                    >
                                      <CheckCircle2 size={12} /> Vote Recorded (
                                      {m.voters[voterKey] ? 'Approve' : 'Reject'})
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        disabled={isBusy}
                                        data-testid={`vote-approve-btn-${prop.id}-${m.index}`}
                                        onClick={() =>
                                          void handleCastMilestoneVote(prop.id, m.index, true)
                                        }
                                      >
                                        <ThumbsUp size={13} /> Vote Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline"
                                        disabled={isBusy}
                                        data-testid={`vote-reject-btn-${prop.id}-${m.index}`}
                                        onClick={() =>
                                          void handleCastMilestoneVote(prop.id, m.index, false)
                                        }
                                      >
                                        <ThumbsDown size={13} /> Vote Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              {m.status === 'SubmittedForVote' && isViewerOnly && (
                                <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>
                                  <AlertTriangle
                                    size={12}
                                    style={{ verticalAlign: 'middle' }}
                                  />{' '}
                                  Voting restricted to verified Youth Residents (15–30)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                      Awaiting Barangay Admin on-chain escrow locking (`create_project`).
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <SKCelebrationModal />
    </div>
  );
};


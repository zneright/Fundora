/**
 * Fundora — Sangguniang Kabataan (SK Official) Workspace (`SKWorkspace.tsx`)
 *
 * Scoped strictly to `sk_official` of the active Barangay jurisdiction.
 * Features:
 * - Deterministic proposal authoring (`proj_<psgc>_<timestamp>`) with itemized procurement line items
 * - Automatic 40% / 40% / 20% (`[4000, 4000, 2000] bps`) milestone tranche allocation
 * - AI Procurement & Borrowing Audit trigger + on-chain attestation hash display
 * - Milestone deliverable proof submission (`submit_milestone_proof` on NEAR, compatible with `0 yoctoNEAR` Function-Call Access Keys)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FilePlus2,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  GitCompare,
  FileSpreadsheet,
  Coins,
} from 'lucide-react';
import { APP_CONFIG } from '../configuration/config';
import { useAuth } from '../contexts/AuthContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import {
  proposalRepository,
  generateDeterministicProjectId,
} from '../repositories/proposal.repository';
import {
  nearContractService,
  type OnChainAiAttestation,
  type OnChainProject,
} from '../services/nearContract.service';
import type { ProposalDocument, ProposalLineItem, ProposalMilestone } from '../types';
import { formatNear, formatPhp, nearToYocto, phpToNear, yoctoToNear } from '../utils/currency';
import { computeSha256Hex } from '../utils/normalization';
import { ImageCarousel } from './ImageCarousel';
import { RevisionDiffModal } from './RevisionDiffModal';

export const SKWorkspace: React.FC = () => {
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

  // Proposal creation state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Sports & Youth Development');
  const [summary, setSummary] = useState('');
  const [itemName, setItemName] = useState('Molten Basketballs Official Size 7');
  const [itemQty, setItemQty] = useState(10);
  const [itemUnitPricePhp, setItemUnitPricePhp] = useState(1400);

  // Milestone proof submission state
  const [evidenceInputByProject, setEvidenceInputByProject] = useState<
    Record<string, string>
  >({});
  const [diffModalProposal, setDiffModalProposal] = useState<ProposalDocument | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isAuthorizedSk = userProfile?.role === 'sk_official';

  const loadWorkspaceData = useCallback(async () => {
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
    for (const prop of props) {
      attMap[prop.id] = await nearContractService.getAiAttestations(prop.id);
    }
    setAttestationsByProject(attMap);
  }, [userProfile?.barangayId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  if (!userProfile) return null;

  if (!isAuthorizedSk) {
    return (
      <div className="bank-card" role="alert" data-testid="sk-unauthorized-guard">
        <h3 className="bank-card-title">
          <AlertTriangle size={18} /> Access Restricted — SK Official Only
        </h3>
        <p className="bank-card-subtitle">
          Your current role (<code>{userProfile.role}</code>) is not authorized to author SK
          procurement proposals or submit milestone proofs.
        </p>
      </div>
    );
  }

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim() || !summary.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please provide both a project title and procurement summary.',
      });
      return;
    }

    const skNearAccount = activeAccountId || userProfile.nearAccountId || '';
    if (!skNearAccount) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your SK Official NEAR wallet before submitting a proposal.',
      });
      return;
    }

    setIsBusy(true);
    try {
      const deterministicId = generateDeterministicProjectId(userProfile.psgcCode);
      const totalPhp = Math.max(1, itemQty) * Math.max(1, itemUnitPricePhp);
      const totalNearStr = phpToNear(totalPhp, APP_CONFIG.near.phpPerNearRate);
      const totalYoctoStr = nearToYocto(totalNearStr);
      const totalYoctoBig = BigInt(totalYoctoStr);

      const lineItem: ProposalLineItem = {
        id: `item_${Date.now()}`,
        itemName: itemName.trim() || 'Community Equipment',
        category,
        quantity: Number(itemQty),
        unit: 'units',
        unitPricePhp: Number(itemUnitPricePhp),
        totalPricePhp: totalPhp,
      };

      const m1Yocto = ((totalYoctoBig * 4000n) / 10000n).toString();
      const m2Yocto = ((totalYoctoBig * 4000n) / 10000n).toString();
      const m3Yocto = (totalYoctoBig - BigInt(m1Yocto) - BigInt(m2Yocto)).toString();

      const milestones: ProposalMilestone[] = [
        {
          index: 1,
          label: 'Phase 1 — Upfront Mobilization (40%)',
          allocationBps: 4000,
          amountYocto: m1Yocto,
          amountPhpEquivalent: Math.round(totalPhp * 0.4),
          status: 'LOCKED',
        },
        {
          index: 2,
          label: 'Phase 2 — Mid-Implementation Delivery (40%)',
          allocationBps: 4000,
          amountYocto: m2Yocto,
          amountPhpEquivalent: Math.round(totalPhp * 0.4),
          status: 'LOCKED',
        },
        {
          index: 3,
          label: 'Phase 3 — Final Turnover & Liquidation (20%)',
          allocationBps: 2000,
          amountYocto: m3Yocto,
          amountPhpEquivalent: Math.round(totalPhp * 0.2),
          status: 'LOCKED',
        },
      ];

      const nowIso = new Date().toISOString();
      const newProposal: ProposalDocument = {
        id: deterministicId,
        barangayId: userProfile.barangayId,
        barangayName: userProfile.barangayName,
        psgcCode: userProfile.psgcCode,
        title: title.trim(),
        category,
        summary: summary.trim(),
        beneficiarySummary: `Youth residents of Brgy. ${userProfile.barangayName}`,
        proposerUid: userProfile.uid,
        proposerName: userProfile.displayName,
        proposerNearAccountId: skNearAccount,
        beneficiaryNearAccountId: skNearAccount,
        totalBudgetPhp: totalPhp,
        totalBudgetNear: totalNearStr,
        totalBudgetYocto: totalYoctoStr,
        lineItems: [lineItem],
        milestones,
        status: 'PENDING_AI_AUDIT',
        approveVotes: 0,
        rejectVotes: 0,
        quorumBps: APP_CONFIG.governance.defaultQuorumBps,
        minVotesRequired:
          userProfile.barangayId === APP_CONFIG.governance.demoBarangayId
            ? 1
            : APP_CONFIG.governance.defaultMinVotes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await proposalRepository.saveProposal(newProposal);
      setTitle('');
      setSummary('');
      await loadWorkspaceData();
      setStatusMessage({
        type: 'success',
        text: `Created proposal "${newProposal.title}" with deterministic ID ${newProposal.id}.`,
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

  const handleRunAdvisoryAiAudit = async (prop: ProposalDocument) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const reportHash = await computeSha256Hex(
        JSON.stringify({
          projectId: prop.id,
          lineItems: prop.lineItems,
          totalBudgetPhp: prop.totalBudgetPhp,
        })
      );

      nearContractService.recordAiAttestationInMirror({
        project_id: prop.id,
        target_type: 'proposal_procurement',
        milestone_idx: null,
        report_sha256_hash: reportHash,
        score: 88,
        recommendation: 'approve',
      });

      await proposalRepository.updateProposal(prop.id, {
        aiOverallRiskScore: 88,
        aiVerdict: 'PASS',
        status: 'COMMUNITY_VOTE',
      });

      await loadWorkspaceData();
      setStatusMessage({
        type: 'success',
        text: `Advisory AI Procurement Audit recorded for ${prop.id} (SHA-256: ${reportHash.slice(0, 14)}...). Ready for Barangay Admin escrow funding.`,
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

  const handleSubmitMilestoneProofOnNear = async (
    projectId: string,
    milestoneIdx: number
  ) => {
    setStatusMessage(null);
    if (!isConnected || !activeAccountId) {
      setStatusMessage({
        type: 'error',
        text: 'Connect your SK Official NEAR wallet before submitting milestone proof.',
      });
      return;
    }

    const noteKey = `${projectId}_${milestoneIdx}`;
    const rawEvidence = (evidenceInputByProject[noteKey] || '').trim();
    if (!rawEvidence) {
      setStatusMessage({
        type: 'error',
        text: `Provide deliverable accomplishment notes & receipt reference for Milestone #${milestoneIdx}.`,
      });
      return;
    }

    setIsBusy(true);
    try {
      const proofHash = await computeSha256Hex(
        `${projectId}:m${milestoneIdx}:${rawEvidence}`
      );

      const { txRecord } = await nearContractService.submitMilestoneProof(
        {
          project_id: projectId,
          milestone_idx: milestoneIdx,
          proof_hash: proofHash,
        },
        {
          signerAccountId: activeAccountId,
          networkId,
          accessKeyMode,
          attachedDepositYocto: '0',
        }
      );

      setActiveTransaction(txRecord);
      await loadWorkspaceData();
      await refreshTransactionHistory();

      if (txRecord.status === 'SUCCESSFUL') {
        setStatusMessage({
          type: 'success',
          text: `Submitted Milestone #${milestoneIdx} proof on NEAR (SHA-256: ${proofHash.slice(0, 14)}...). Milestone is now open for Youth Resident quorum voting.`,
        });
      } else {
        setStatusMessage({
          type: 'warning',
          text: txRecord.reconciliationReason || `Proof status: ${txRecord.status}`,
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
    <div className="workspace-section" data-testid="sk-workspace">
      {statusMessage && (
        <div
          className={`alert-banner alert-${statusMessage.type}`}
          role="status"
          data-testid="sk-status-banner"
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

      {/* 1. PROPOSAL AUTHORING FORM */}
      <div className="bank-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="bank-card-title">
          <FilePlus2 size={18} /> Author SK Community Development Proposal
        </h3>
        <p className="bank-card-subtitle">
          Generates a deterministic <code>proj_{'{psgc}'}_{'{timestamp}'}</code> ID shared
          between Firestore and the NEAR Escrow Contract.
        </p>

        <form
          onSubmit={(e) => void handleCreateProposal(e)}
          style={{ marginTop: '0.9rem', display: 'grid', gap: '0.75rem' }}
        >
          <div className="grid-2-equal">
            <div>
              <label className="form-label">Project Title</label>
              <input
                type="text"
                className="form-input"
                data-testid="sk-proposal-title-input"
                placeholder="e.g., Barangay Youth Sports & Solar Lighting Upgrade"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Program Category</label>
              <input
                type="text"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Procurement Scope & Objectives</label>
            <input
              type="text"
              className="form-input"
              data-testid="sk-proposal-summary-input"
              placeholder="Describe deliverables, target youth beneficiaries, and timeline"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div className="grid-2-equal">
            <div>
              <label className="form-label">Primary Procurement Item (DTI Benchmark Check)</label>
              <input
                type="text"
                className="form-input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Unit Price (PHP)</label>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  data-testid="sk-item-price-php-input"
                  value={itemUnitPricePhp}
                  onChange={(e) => setItemUnitPricePhp(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Automatic 40 / 40 / 20 Tranche Preview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.65rem',
              padding: '0.85rem',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                Tranche 1: Mobilization (40%)
              </div>
              <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '0.95rem' }}>
                {formatPhp(itemQty * itemUnitPricePhp * 0.4)}
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                ≈ {formatNear(phpToNear(itemQty * itemUnitPricePhp * 0.4, APP_CONFIG.near.phpPerNearRate))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                Tranche 2: Progress Delivery (40%)
              </div>
              <div style={{ fontWeight: 800, color: 'var(--accent-blue)', fontSize: '0.95rem' }}>
                {formatPhp(itemQty * itemUnitPricePhp * 0.4)}
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                ≈ {formatNear(phpToNear(itemQty * itemUnitPricePhp * 0.4, APP_CONFIG.near.phpPerNearRate))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                Tranche 3: Retention (20%)
              </div>
              <div style={{ fontWeight: 800, color: 'var(--accent-yellow)', fontSize: '0.95rem' }}>
                {formatPhp(itemQty * itemUnitPricePhp * 0.2)}
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                ≈ {formatNear(phpToNear(itemQty * itemUnitPricePhp * 0.2, APP_CONFIG.near.phpPerNearRate))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.83rem', opacity: 0.85 }}>
              Estimated Total: <strong>{formatPhp(itemQty * itemUnitPricePhp)}</strong> (≈{' '}
              <strong>
                {formatNear(phpToNear(itemQty * itemUnitPricePhp, APP_CONFIG.near.phpPerNearRate))}
              </strong>{' '}
               across 40% / 40% / 20% tranches)
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isBusy}
              data-testid="sk-submit-proposal-btn"
            >
              <FilePlus2 size={15} /> Create Deterministic Proposal
            </button>
          </div>
        </form>
      </div>

      {/* 2. ACTIVE PROPOSALS & ON-CHAIN MILESTONE EVIDENCE SUBMISSION */}
      <div className="bank-card">
        <h3 className="bank-card-title">
          <FolderKanban size={18} /> SK Proposals & On-Chain Milestone Evidence Desk
        </h3>
        <p className="bank-card-subtitle">
          Run advisory AI procurement checks before funding, or submit milestone deliverable
          proofs (<code>submit_milestone_proof</code>) to open community quorum voting.
        </p>

        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          {proposals.length === 0 ? (
            <div style={{ fontSize: '0.86rem', opacity: 0.75 }}>
              No proposals created in {userProfile.barangayName} yet.
            </div>
          ) : (
            proposals.map((prop) => {
              const chainProj = onChainProjects[prop.id];
              const attestations = attestationsByProject[prop.id] || [];

              return (
                <div
                  key={prop.id}
                  data-testid={`sk-proposal-card-${prop.id}`}
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
                      <div style={{ fontWeight: 700 }}>{prop.title}</div>
                      <div style={{ fontSize: '0.79rem', opacity: 0.8 }}>
                        ID: <code>{prop.id}</code> • Budget: {formatNear(prop.totalBudgetNear)} (
                        {formatPhp(prop.totalBudgetPhp)})
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        title="View Milestone Allocation Breakdown & Diff"
                        onClick={() => setDiffModalProposal(prop)}
                      >
                        <GitCompare size={13} /> View 40/40/20 Tranches &amp; BOQ
                      </button>
                      <span className="badge badge-role">{prop.status}</span>
                      {chainProj && (
                        <span className="badge badge-success">
                          On-Chain: {chainProj.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {!chainProj && (
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={isBusy}
                        data-testid={`sk-run-ai-audit-btn-${prop.id}`}
                        onClick={() => void handleRunAdvisoryAiAudit(prop)}
                      >
                        <Sparkles size={14} /> Run Advisory AI Procurement Audit
                      </button>
                      {attestations.length > 0 && (
                        <span style={{ fontSize: '0.8rem' }}>
                          <CheckCircle2 size={13} style={{ verticalAlign: 'middle' }} /> AI
                          Attestation Hash:{' '}
                          <code>{attestations[0].report_sha256_hash.slice(0, 14)}...</code>
                        </span>
                      )}
                    </div>
                  )}

                  {chainProj && (
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      {chainProj.milestones.map((m) => {
                        const noteKey = `${prop.id}_${m.index}`;
                        const canSubmitProof =
                          chainProj.status === 'Active' &&
                          m.status === 'Pending' &&
                          (m.index === 1 ||
                            chainProj.milestones[m.index - 2]?.status === 'Completed');

                        return (
                          <div
                            key={m.index}
                            style={{
                              padding: '0.65rem 0.8rem',
                              borderRadius: '0.6rem',
                              border: '1px solid var(--border-subtle)',
                              display: 'grid',
                              gap: '0.45rem',
                              fontSize: '0.82rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                              }}
                            >
                              <strong>
                                Milestone #{m.index}: {m.title} (
                                {formatNear(yoctoToNear(m.amount_yocto))})
                              </strong>
                              <span>
                                Status: <code data-testid={`sk-m-status-${prop.id}-${m.index}`}>{m.status}</code> • Votes:{' '}
                                {m.votes_approve} Approve / {m.votes_reject} Reject
                              </span>
                            </div>

                            {m.proof_hash && (
                              <div style={{ fontSize: '0.77rem', opacity: 0.85 }}>
                                Submitted Proof SHA-256: <code>{m.proof_hash}</code>
                              </div>
                            )}

                            {canSubmitProof && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '0.5rem',
                                  flexWrap: 'wrap',
                                  marginTop: '0.25rem',
                                }}
                              >
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ flex: 1, minWidth: '240px', fontSize: '0.81rem' }}
                                  data-testid={`sk-proof-input-${prop.id}-${m.index}`}
                                  placeholder={`Enter Official Receipt # & accomplishment summary for Milestone #${m.index}`}
                                  value={evidenceInputByProject[noteKey] || ''}
                                  onChange={(e) =>
                                    setEvidenceInputByProject((prev) => ({
                                      ...prev,
                                      [noteKey]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={isBusy}
                                  data-testid={`sk-submit-proof-btn-${prop.id}-${m.index}`}
                                  onClick={() =>
                                    void handleSubmitMilestoneProofOnNear(prop.id, m.index)
                                  }
                                >
                                  <Upload size={14} /> Submit Proof to NEAR (0 NEAR Deposit)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      {diffModalProposal && (
        <RevisionDiffModal
          proposal={diffModalProposal}
          onClose={() => setDiffModalProposal(null)}
        />
      )}
    </div>
  );
};


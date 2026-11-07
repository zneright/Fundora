/**
 * Fundora — Public Civic Transparency Hub (`TransparencyHub.tsx`)
 *
 * Publicly accessible accountability portal for community residents, civic auditors,
 * and hackathon judges — usable with or without connecting a wallet or logging in.
 *
 * Core Invariants:
 * 1. Clearly distinguishes authoritative NEAR Smart Contract state (`OnChainProject`,
 *    `OnChainAiAttestation`) from supporting off-chain Firestore metadata (`ProposalDocument`).
 * 2. Never presents Firestore metadata as proof of blockchain finality.
 * 3. Strictly enforces privacy: never queries or exposes resident government ID numbers,
 *    birthdates, mobile numbers, street addresses, or KYC documents (`registration_records`,
 *    `uploaded_documents`, `verification_records`).
 * 4. Clearly labels simulated/demo records (`SIMULATED`) vs. confirmed on-chain records.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Globe,
  ShieldCheck,
  Database,
  FileCheck2,
  Receipt,
  ExternalLink,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { APP_CONFIG } from '../configuration/config';
import { barangayRepository } from '../repositories/barangay.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import {
  DEMO_BARANGAY_ID,
  nearContractService,
  type OnChainAiAttestation,
  type OnChainProject,
} from '../services/nearContract.service';
import { demoSandboxService } from '../services/demoSeed.service';
import type {
  BarangayDocument,
  ProposalDocument,
  TransactionReferenceDocument,
} from '../types';
import { formatNear, formatPhp, yoctoToNear } from '../utils/currency';
import {
  isSimulatedTxHash,
  type FundoraDigitalReceiptPayload,
} from '../utils/receiptPdfGenerator';
import { ReceiptModal } from './ReceiptModal';

export interface PublicProjectTransparencyView {
  projectId: string;
  barangayId: string;
  barangayName: string;
  psgcCode: string;
  isDemoProject: boolean;
  title: string;
  category: string;
  summary: string;
  beneficiarySummary: string;
  proposerRoleLabel: string;
  skOfficialNearAccount: string;
  offChainStatus: ProposalDocument['status'];
  totalBudgetPhp: number;
  totalBudgetNear: string;
  lineItems: ProposalDocument['lineItems'];
  onChainProject: OnChainProject | null;
  aiAttestations: OnChainAiAttestation[];
  transactions: TransactionReferenceDocument[];
}

/**
 * Privacy sanitizer: guarantees that no resident PII (ID numbers, mobile numbers,
 * birthdates, street addresses, or private keys) can ever leak into public views.
 */
export function buildSanitizedPublicProjectView(
  proposal: ProposalDocument,
  onChainProject: OnChainProject | null,
  aiAttestations: OnChainAiAttestation[],
  transactions: TransactionReferenceDocument[]
): PublicProjectTransparencyView {
  return {
    projectId: proposal.id,
    barangayId: proposal.barangayId,
    barangayName: proposal.barangayName,
    psgcCode: proposal.psgcCode,
    isDemoProject: proposal.barangayId === DEMO_BARANGAY_ID,
    title: proposal.title,
    category: proposal.category,
    summary: proposal.summary,
    beneficiarySummary: proposal.beneficiarySummary,
    proposerRoleLabel: `SK Council Official (${proposal.barangayName})`,
    skOfficialNearAccount:
      onChainProject?.sk_official ||
      proposal.beneficiaryNearAccountId ||
      proposal.proposerNearAccountId,
    offChainStatus: proposal.status,
    totalBudgetPhp: proposal.totalBudgetPhp,
    totalBudgetNear: proposal.totalBudgetNear,
    lineItems: proposal.lineItems || [],
    onChainProject,
    aiAttestations,
    transactions,
  };
}

export interface TransparencyHubProps {
  defaultBarangayId?: string;
  onBackToLanding?: () => void;
}

export const TransparencyHub: React.FC<TransparencyHubProps> = ({
  defaultBarangayId = 'ALL',
  onBackToLanding,
}) => {
  const [barangays, setBarangays] = useState<BarangayDocument[]>([]);
  const [selectedBarangayId, setSelectedBarangayId] =
    useState<string>(defaultBarangayId);
  const [publicProjects, setPublicProjects] = useState<
    PublicProjectTransparencyView[]
  >([]);
  const [selectedReceipt, setSelectedReceipt] =
    useState<FundoraDigitalReceiptPayload | null>(null);

  const loadTransparencyData = useCallback(async () => {
    await demoSandboxService.ensureDemoSandboxSeeded();
    const [allBrgys, allProposals] = await Promise.all([
      barangayRepository.listApprovedBarangays(),
      proposalRepository.listAll(),
    ]);
    setBarangays(allBrgys);

    const uniqueBrgyIds = Array.from(
      new Set([
        ...allBrgys.map((b) => b.id),
        ...allProposals.map((p) => p.barangayId),
      ])
    );

    const targetBrgyIds =
      selectedBarangayId === 'ALL' ? uniqueBrgyIds : [selectedBarangayId];

    const views: PublicProjectTransparencyView[] = [];
    for (const bid of targetBrgyIds) {
      const [props, chainProjs, txs] = await Promise.all([
        proposalRepository.listByBarangay(bid),
        nearContractService.getProjectsByBarangay(bid),
        proposalRepository.listTransactionsByBarangay(bid),
      ]);

      const chainMap = new Map<string, OnChainProject>();
      for (const cp of chainProjs) {
        chainMap.set(cp.project_id, cp);
      }

      for (const prop of props) {
        const cp = chainMap.get(prop.id) || null;
        const atts = await nearContractService.getAiAttestations(prop.id);
        const propTxs = txs.filter((t) => t.proposalId === prop.id);
        views.push(buildSanitizedPublicProjectView(prop, cp, atts, propTxs));
      }
    }

    setPublicProjects(views);
  }, [selectedBarangayId]);

  useEffect(() => {
    void loadTransparencyData();
  }, [loadTransparencyData]);

  const handleOpenReceipt = (
    proj: PublicProjectTransparencyView,
    tx: TransactionReferenceDocument
  ) => {
    const isSim = isSimulatedTxHash(tx.nearTxHash, proj.barangayId);
    setSelectedReceipt({
      receiptSerialNumber: tx.receiptSerialNumber,
      projectId: proj.projectId,
      projectTitle: proj.title,
      barangayId: proj.barangayId,
      barangayName: proj.barangayName,
      psgcCode: proj.psgcCode,
      nearTxHash: tx.nearTxHash,
      actionType: tx.actionType,
      purpose: `${tx.actionType.replace(/_/g, ' ')} for ${proj.title}`,
      milestoneIndex: tx.milestoneIndex,
      signerNearAccountId: tx.signerNearAccountId,
      recipientNearAccountId: tx.recipientNearAccountId || APP_CONFIG.near.contractId,
      amountYocto: tx.amountYocto,
      amountNear: tx.amountNear,
      amountPhpEquivalent: tx.amountPhpEquivalent,
      currency: 'NEAR',
      transactionDateIso: tx.createdAt,
      verificationStatus: isSim ? 'SIMULATED' : 'CONFIRMED',
      isSimulatedOrDemo: isSim || proj.isDemoProject,
    });
  };

  return (
    <div className="workspace-section" data-testid="transparency-hub-root">
      <ReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Header & Jurisdiction Filter */}
      <div className="bank-card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2 className="bank-card-title" style={{ fontSize: '1.25rem' }}>
              <Globe size={20} /> Fundora Public Civic Transparency Hub
            </h2>
            <p className="bank-card-subtitle">
              Open-access community treasury ledger, AI procurement audit digests, and
              milestone quorum tallies. Resident PII and KYC records are strictly isolated.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {onBackToLanding && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                data-testid="transparency-back-btn"
                onClick={onBackToLanding}
              >
                <ArrowLeft size={14} /> Back to Home
              </button>
            )}
            <select
              className="form-input"
              style={{ width: 'auto', fontSize: '0.84rem' }}
              data-testid="transparency-barangay-filter"
              value={selectedBarangayId}
              onChange={(e) => setSelectedBarangayId(e.target.value)}
            >
              <option value="ALL">All Barangays (Public Index)</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>
                  Brgy. {b.name}, {b.cityMunicipalityName} ({b.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Authority Boundary Legend */}
        <div
          data-testid="transparency-authority-legend"
          style={{
            marginTop: '0.9rem',
            padding: '0.65rem 0.9rem',
            borderRadius: '0.65rem',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            fontSize: '0.79rem',
          }}
        >
          <span>
            <ShieldCheck size={13} style={{ verticalAlign: 'middle' }} />{' '}
            <strong>NEAR Contract State (`{APP_CONFIG.near.contractId}`):</strong>{' '}
            Authoritative source for escrow balances, milestone release states, quorum vote
            counts, and AI SHA-256 attestations.
          </span>
          <span>
            <Database size={13} style={{ verticalAlign: 'middle' }} />{' '}
            <strong>Off-Chain Firestore Metadata:</strong> Supporting project prose and
            itemized line items (never treated as standalone proof of blockchain finality).
          </span>
          <span>
            <Lock size={13} style={{ verticalAlign: 'middle' }} />{' '}
            <strong>Privacy Guard:</strong> Zero resident IDs, phone numbers, or KYC files
            exposed.
          </span>
        </div>

        {/* Public Treasury Spending Analytics Summary */}
        <div
          style={{
            marginTop: '0.9rem',
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
              Initiatives Indexed
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}>{publicProjects.length} Projects</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>Filtered jurisdiction</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Total Budget Committed
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-blue)' }}>
              {formatNear(publicProjects.reduce((acc, p) => acc + (Number(p.totalBudgetNear) || 0), 0))}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>
              Approx. {formatPhp(publicProjects.reduce((acc, p) => acc + (p.totalBudgetPhp || 0), 0))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Settled Tranches
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-green)' }}>
              {formatNear(
                publicProjects.reduce((acc, p) => {
                  const cp = p.onChainProject;
                  return acc + (cp ? Number(yoctoToNear(cp.total_disbursed_yocto)) || 0 : 0);
                }, 0)
              )}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>Disbursed via 60% Quorum</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Active Escrow
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-yellow)' }}>
              {formatNear(
                publicProjects.reduce((acc, p) => {
                  const cp = p.onChainProject;
                  return acc + (cp ? Number(yoctoToNear(cp.remaining_balance_yocto)) || 0 : 0);
                }, 0)
              )}
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>Locked in Smart Contract</div>
          </div>
        </div>
      </div>

      {/* Project Transparency Cards */}
      <div style={{ display: 'grid', gap: '1.15rem' }}>
        {publicProjects.length === 0 ? (
          <div className="bank-card" style={{ fontSize: '0.88rem', opacity: 0.8 }}>
            No public projects found for the selected jurisdiction filter.
          </div>
        ) : (
          publicProjects.map((proj) => {
            const cp = proj.onChainProject;
            const totalDisbursedNear = cp
              ? yoctoToNear(cp.total_disbursed_yocto)
              : '0.00';
            const remainingNear = cp ? yoctoToNear(cp.remaining_balance_yocto) : '0.00';
            const totalRefundedNear = cp ? yoctoToNear(cp.total_refunded_yocto) : '0.00';

            return (
              <div
                key={proj.projectId}
                className="bank-card"
                data-testid={`transparency-project-card-${proj.projectId}`}
                style={{ display: 'grid', gap: '0.9rem' }}
              >
                {/* Title & Status Badges */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 className="bank-card-title" style={{ margin: 0 }}>
                        {proj.title}
                      </h3>
                      {proj.isDemoProject && (
                        <span
                          className="badge badge-warning"
                          data-testid={`demo-project-badge-${proj.projectId}`}
                        >
                          DEMO SANDBOX DATA (`brgy_demo_001`)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.2rem' }}>
                      Project ID: <code>{proj.projectId}</code> • Jurisdiction: Brgy.{' '}
                      <strong>{proj.barangayName}</strong> (PSGC <code>{proj.psgcCode}</code>)
                      • Category: {proj.category}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span
                      className="badge badge-role"
                      title="Off-chain workflow status in Firestore"
                    >
                      Off-Chain Metadata: {proj.offChainStatus}
                    </span>
                    {cp ? (
                      <span
                        className="badge badge-success"
                        data-testid={`transparency-onchain-badge-${proj.projectId}`}
                      >
                        NEAR Contract State: {cp.status} (SIMULATED SANDBOX)
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        Not Yet Locked in NEAR Escrow
                      </span>
                    )}
                  </div>
                </div>

                {/* Split View: (1) Authoritative NEAR Contract State vs (2) Off-Chain Metadata */}
                <div className="grid-2-equal">
                  {/* Left: Authoritative On-Chain Escrow & Quorum State */}
                  <div
                    data-testid={`onchain-panel-${proj.projectId}`}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-subtle)',
                      display: 'grid',
                      gap: '0.5rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      <ShieldCheck size={15} style={{ verticalAlign: 'middle' }} /> 1.
                      NEAR Contract Escrow &amp; Quorum State
                    </div>

                    {cp ? (
                      <>
                        <div>
                          <strong>Funder Treasury Account:</strong>{' '}
                          <code>{cp.funder_treasury}</code>
                        </div>
                        <div>
                          <strong>SK Recipient Account:</strong>{' '}
                          <code>{cp.sk_official}</code>
                        </div>
                        <div>
                          <strong>Total Escrow Budget:</strong>{' '}
                          {formatNear(yoctoToNear(cp.total_budget_yocto))} •{' '}
                          <strong>Disbursed:</strong> {formatNear(totalDisbursedNear)} •{' '}
                          <strong>Remaining Locked:</strong> {formatNear(remainingNear)}
                          {BigInt(cp.total_refunded_yocto) > 0n && (
                            <>
                              {' '}
                              • <strong>Refunded to Treasury:</strong>{' '}
                              {formatNear(totalRefundedNear)}
                            </>
                          )}
                        </div>
                        <div>
                          <strong>Quorum Rule:</strong> {cp.quorum_bps / 100}% approval
                          threshold • Minimum {cp.min_votes} verified resident vote(s)
                        </div>

                        <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.25rem' }}>
                          {cp.milestones.map((m) => (
                            <div
                              key={m.index}
                              style={{
                                padding: '0.45rem 0.65rem',
                                borderRadius: '0.5rem',
                                background: 'rgba(15, 23, 42, 0.25)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.4rem',
                              }}
                            >
                              <span>
                                <strong>Phase #{m.index}:</strong> {m.percentage_bps / 100}% (
                                {formatNear(yoctoToNear(m.amount_yocto))})
                              </span>
                              <span>
                                Status: <code>{m.status}</code> • Votes: {m.votes_approve}👍 /{' '}
                                {m.votes_reject}👎
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ opacity: 0.8 }}>
                        Proposal is currently in pre-escrow review (
                        <code>{proj.offChainStatus}</code>). No funds have been locked in the
                        NEAR contract yet.
                      </div>
                    )}
                  </div>

                  {/* Right: Supporting Off-Chain Metadata & AI Attestations */}
                  <div
                    data-testid={`offchain-panel-${proj.projectId}`}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-subtle)',
                      display: 'grid',
                      gap: '0.5rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      <Database size={15} style={{ verticalAlign: 'middle' }} /> 2.
                      Off-Chain Proposal Metadata &amp; AI Attestations
                    </div>
                    <div>
                      <strong>Scope:</strong> {proj.summary}
                    </div>
                    <div>
                      <strong>Beneficiaries:</strong> {proj.beneficiarySummary}
                    </div>
                    <div>
                      <strong>Proposed Budget:</strong> {formatNear(proj.totalBudgetNear)} (
                      {formatPhp(proj.totalBudgetPhp)})
                    </div>

                    {proj.aiAttestations.length > 0 && (
                      <div
                        style={{
                          padding: '0.5rem 0.65rem',
                          borderRadius: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.08)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          <FileCheck2 size={13} style={{ verticalAlign: 'middle' }} />{' '}
                          Advisory AI Attestations (<code>auditor.fundora.testnet</code>):
                        </div>
                        {proj.aiAttestations.map((att) => (
                          <div key={att.attestation_id} style={{ fontSize: '0.77rem' }}>
                            • {att.target_type}
                            {att.milestone_idx ? ` (Phase #${att.milestone_idx})` : ''}: Score{' '}
                            <strong>{att.score}/100</strong> ({att.recommendation}) • SHA-256:{' '}
                            <code>{att.report_sha256_hash.slice(0, 16)}...</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction References & Digital Receipts */}
                {proj.transactions.length > 0 && (
                  <div
                    style={{
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      fontSize: '0.8rem',
                    }}
                  >
                    <strong>Transaction Receipts:</strong>
                    {proj.transactions.map((tx) => {
                      const isSim = isSimulatedTxHash(tx.nearTxHash, proj.barangayId);
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          className="btn btn-sm btn-outline"
                          data-testid={`open-receipt-btn-${tx.nearTxHash}`}
                          onClick={() => handleOpenReceipt(proj, tx)}
                        >
                          <Receipt size={13} /> {tx.actionType} ({tx.receiptSerialNumber} •{' '}
                          {isSim ? 'SIMULATED' : 'CONFIRMED'}){' '}
                          <ExternalLink size={11} />
                        </button>
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
  );
};


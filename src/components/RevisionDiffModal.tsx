import React, { useState } from 'react';
import type { ProposalDocument, ProposalMilestone } from '../types';
import { formatNear, formatPhp } from '../utils/currency';
import {
  GitCompare,
  ArrowRight,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

interface RevisionDiffModalProps {
  proposal: ProposalDocument;
  onClose: () => void;
}

export const RevisionDiffModal: React.FC<RevisionDiffModalProps> = ({ proposal, onClose }) => {
  const [activeTab, setActiveTab] = useState<'side_by_side' | 'details'>('side_by_side');

  const milestones: ProposalMilestone[] = proposal.milestones || [];
  const totalNearNum = Number(proposal.totalBudgetNear) || 0;
  const totalPhp = proposal.totalBudgetPhp || totalNearNum * 280;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Proposal Revision Diff Modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(17, 24, 39, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="bank-card"
        style={{
          maxWidth: 780,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-floating)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--accent-blue-soft)',
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitCompare size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Proposal Milestone Allocation &amp; Audit Scope
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Initiative: <strong>{proposal.title}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onClose}
            aria-label="Close diff modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'grid', gap: '1.25rem' }}>
          {/* Summary Box */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 8,
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Allocated Escrow
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--accent-green)' }}>
                {formatNear(totalNearNum)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Approx. {formatPhp(totalPhp)}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Governance Status
              </div>
              <span className="badge badge-info" style={{ marginTop: '0.25rem' }}>
                {proposal.status.replace('_', ' ').toUpperCase()}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                Created: {new Date(proposal.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* 40 / 40 / 20 Milestone Tranche Breakdown */}
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.65rem' }}>
              40% / 40% / 20% Verified Milestone Schedule
            </h4>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {milestones.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Standard 3-tranche milestone array will be locked upon Captain approval.
                </div>
              ) : (
                milestones.map((ms) => (
                  <div
                    key={ms.index}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 12,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        Tranche {ms.index + 1}: {ms.label} ({ms.allocationBps / 100}%)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Status: <code>{ms.status}</code>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--accent-green)' }}>
                        {formatNear(totalNearNum * (ms.allocationBps / 10000))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatPhp(totalPhp * (ms.allocationBps / 10000))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Line Items Bill of Quantities */}
          {proposal.lineItems && proposal.lineItems.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Itemized Bill of Quantities (BOQ)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Item</th>
                      <th style={{ padding: '0.5rem' }}>Qty</th>
                      <th style={{ padding: '0.5rem' }}>Unit Price (PHP)</th>
                      <th style={{ padding: '0.5rem' }}>Total (PHP)</th>
                      <th style={{ padding: '0.5rem' }}>DTI SRP Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.lineItems.map((li) => (
                      <tr key={li.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>{li.itemName}</td>
                        <td style={{ padding: '0.5rem' }}>
                          {li.quantity} {li.unit}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{formatPhp(li.unitPricePhp)}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 700 }}>
                          {formatPhp(li.totalPricePhp)}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {li.dtiBenchmarkPricePhp ? (
                            <span
                              className={`badge ${
                                (li.variancePct || 0) > 10 ? 'badge-danger' : 'badge-success'
                              }`}
                              style={{ fontSize: '0.7rem' }}
                            >
                              {(li.variancePct || 0) > 0 ? `+${li.variancePct}%` : 'Fair Price'}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.6 }}>Standard</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-sm btn-outline" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Fundora — Ledger Activity & Reconciliation Inspector (`ActivityView.tsx`)
 *
 * Displays transaction-linked ledger references (`transaction_references/{txId}`),
 * pending reconciliation intents (`RECONCILIATION_REQUIRED`), and receipt serial numbers
 * (`FD-RCPT-...`) for the active Barangay jurisdiction.
 */

import React from 'react';
import {
  Activity,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNearWallet } from '../contexts/NearWalletContext';
import { formatNear, formatPhp } from '../utils/currency';

export const ActivityView: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    transactionHistory,
    pendingReconciliations,
    executionEnvironment,
    contractId,
    reconcileProject,
  } = useNearWallet();

  if (!userProfile) return null;

  return (
    <div className="workspace-section" data-testid="activity-view-workspace">
      {/* 1. PENDING RECONCILIATION BANNER */}
      {pendingReconciliations.length > 0 && (
        <div
          className="bank-card"
          data-testid="activity-reconciliation-card"
          style={{
            marginBottom: '1.25rem',
            border: '1px solid #f59e0b',
          }}
        >
          <h3 className="bank-card-title" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={18} /> Reconciliation Required — Post-Transaction Sync Pending
          </h3>
          <p className="bank-card-subtitle">
            One or more on-chain NEAR transactions succeeded on <code>{contractId}</code>,
            but the supporting Firestore metadata update was interrupted.
          </p>

          <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
            {pendingReconciliations.map((intent) => (
              <div
                key={intent.intentId}
                data-testid={`reconcile-intent-row-${intent.projectId}`}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    Method: <code>{intent.methodName}</code> • Project:{' '}
                    <code>{intent.projectId}</code>
                  </div>
                  <div style={{ fontSize: '0.79rem', opacity: 0.85 }}>
                    TxHash: <code>{intent.txHash}</code> •{' '}
                    {intent.reconciliationReason || 'Off-chain metadata out of sync'}
                  </div>
                </div>
                {intent.projectId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    data-testid={`reconcile-sync-btn-${intent.projectId}`}
                    onClick={() => void reconcileProject(intent.projectId!)}
                  >
                    <RefreshCw size={14} /> Sync State from NEAR Contract
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TRANSACTION REFERENCE LEDGER */}
      <div className="bank-card">
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
              <Activity size={18} /> Barangay Transaction Reference Ledger (
              {userProfile.barangayName})
            </h3>
            <p className="bank-card-subtitle">
              Contract: <code>{contractId}</code> • Execution Mode:{' '}
              <code data-testid="activity-execution-mode">{executionEnvironment}</code>
            </p>
          </div>
          <span className="badge badge-role">
            {transactionHistory.length} Verified References
          </span>
        </div>

        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          {transactionHistory.length === 0 ? (
            <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              No transaction references recorded for {userProfile.barangayName} yet.
            </div>
          ) : (
            transactionHistory.map((tx) => (
              <div
                key={tx.id}
                data-testid={`tx-ref-row-${tx.nearTxHash}`}
                style={{
                  padding: '0.85rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  fontSize: '0.83rem',
                }}
              >
                <div style={{ display: 'grid', gap: '0.2rem' }}>
                  <div style={{ fontWeight: 700 }}>
                    <CheckCircle2
                      size={14}
                      style={{ verticalAlign: 'middle', marginRight: '0.35rem' }}
                    />
                    {tx.actionType}{' '}
                    {tx.milestoneIndex ? `(Milestone #${tx.milestoneIndex})` : ''}
                  </div>
                  <div style={{ opacity: 0.85 }}>
                    Project: <code>{tx.proposalId}</code> • Signer:{' '}
                    <code>{tx.signerNearAccountId}</code> → Recipient:{' '}
                    <code>{tx.recipientNearAccountId}</code>
                  </div>
                  <div style={{ fontSize: '0.77rem', opacity: 0.75 }}>
                    <Receipt size={12} style={{ verticalAlign: 'middle' }} /> Receipt Ref:{' '}
                    <code>{tx.receiptSerialNumber}</code> • TxHash:{' '}
                    <code>{tx.nearTxHash}</code>{' '}
                    <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{formatNear(tx.amountNear)}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                    {formatPhp(tx.amountPhpEquivalent)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


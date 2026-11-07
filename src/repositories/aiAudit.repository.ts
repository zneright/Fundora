/**
 * Fundora — Read-Only AI Audit Records Repository (`ai_audit_records/{auditId}`)
 * Per FD-SDLC-06 & firestore.rules (`allow write: if false;`), clients may ONLY read
 * `ai_audit_records`. All writes occur exclusively on the backend via `/api/ai/audit-*`.
 */

import { dbGetById, dbListCollection } from './db.helper';
import type { AiAuditRecordDocument } from '../types';

export const aiAuditRepository = {
  async getById(auditId: string): Promise<AiAuditRecordDocument | null> {
    return dbGetById<AiAuditRecordDocument>('ai_audit_records', auditId);
  },

  async listByProposal(proposalId: string): Promise<AiAuditRecordDocument[]> {
    const records = await dbListCollection<AiAuditRecordDocument>('ai_audit_records', [
      { field: 'proposalId', op: '==', value: proposalId },
    ]);
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listByBarangay(barangayId: string): Promise<AiAuditRecordDocument[]> {
    const records = await dbListCollection<AiAuditRecordDocument>('ai_audit_records', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * Explicitly blocks any client-side write attempt to `ai_audit_records`.
   */
  async attemptDirectClientWrite(): Promise<never> {
    throw new Error(
      'SECURITY_VIOLATION: Client-side writes to ai_audit_records are forbidden. Use protected backend endpoints /api/ai/audit-proposal or /api/ai/audit-evidence.'
    );
  },
};


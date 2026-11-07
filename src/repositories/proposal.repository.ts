/**
 * Fundora — Proposal & Transaction Reference Repository
 * Uses canonical `prop_<uuid>` shared between Firestore and NEAR smart contract.
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { ProposalDocument, TransactionReferenceDocument } from '../types';

export function generateDeterministicProjectId(
  psgcCode: string,
  timestampMs: number = Date.now()
): string {
  const cleanPsgc = (psgcCode || '0000000000').replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
  return `proj_${cleanPsgc}_${timestampMs}`;
}

export function isValidDeterministicProjectId(projectId: string): boolean {
  const clean = (projectId || '').trim();
  return /^(proj|prop)_[a-zA-Z0-9_-]{4,64}$/.test(clean);
}

export const proposalRepository = {
  async getById(proposalId: string): Promise<ProposalDocument | null> {
    return dbGetById<ProposalDocument>('proposals', proposalId);
  },

  async listAll(): Promise<ProposalDocument[]> {
    const list = await dbListCollection<ProposalDocument>('proposals');
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listByBarangay(barangayId: string): Promise<ProposalDocument[]> {
    const list = await dbListCollection<ProposalDocument>('proposals', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async saveProposal(proposal: ProposalDocument): Promise<ProposalDocument> {
    if (!isValidDeterministicProjectId(proposal.id)) {
      throw new Error(
        `Proposal ID must use canonical "proj_<psgc>_<timestamp>" or "prop_<id>" format. Received: ${proposal.id}`
      );
    }
    return dbSetDocument<ProposalDocument>('proposals', proposal.id, proposal);
  },

  async updateProposal(proposalId: string, partial: Partial<ProposalDocument>): Promise<void> {
    await dbUpdateDocument<ProposalDocument>('proposals', proposalId, {
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  },

  async recordTransactionReference(
    txRef: TransactionReferenceDocument
  ): Promise<TransactionReferenceDocument> {
    return dbSetDocument<TransactionReferenceDocument>('transaction_references', txRef.id, txRef);
  },

  async listTransactionsByBarangay(barangayId: string): Promise<TransactionReferenceDocument[]> {
    const list = await dbListCollection<TransactionReferenceDocument>('transaction_references', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

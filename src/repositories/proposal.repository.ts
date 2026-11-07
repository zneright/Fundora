/**
 * Fundora — Proposal & Transaction Reference Repository
 * Uses canonical `prop_<uuid>` shared between Firestore and NEAR smart contract.
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { ProposalDocument, TransactionReferenceDocument } from '../types';

export const proposalRepository = {
  async getById(proposalId: string): Promise<ProposalDocument | null> {
    return dbGetById<ProposalDocument>('proposals', proposalId);
  },

  async listByBarangay(barangayId: string): Promise<ProposalDocument[]> {
    const list = await dbListCollection<ProposalDocument>('proposals', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async saveProposal(proposal: ProposalDocument): Promise<ProposalDocument> {
    if (!proposal.id.startsWith('prop_')) {
      throw new Error(`Proposal ID must use canonical "prop_<uuid>" format. Received: ${proposal.id}`);
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

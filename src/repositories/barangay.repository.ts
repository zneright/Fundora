/**
 * Fundora — Barangay Repository (`barangays/{barangayId}`)
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { BarangayDocument } from '../types';

export const barangayRepository = {
  async getById(barangayId: string): Promise<BarangayDocument | null> {
    return dbGetById<BarangayDocument>('barangays', barangayId);
  },

  async getByPsgcCode(psgcCode: string): Promise<BarangayDocument | null> {
    const matches = await dbListCollection<BarangayDocument>('barangays', [
      { field: 'psgcCode', op: '==', value: psgcCode },
    ]);
    return matches[0] || null;
  },

  async listApprovedBarangays(): Promise<BarangayDocument[]> {
    return dbListCollection<BarangayDocument>('barangays', [
      { field: 'status', op: '==', value: 'approved' },
    ]);
  },

  async listAllBarangays(): Promise<BarangayDocument[]> {
    return dbListCollection<BarangayDocument>('barangays');
  },

  async saveBarangay(barangay: BarangayDocument): Promise<BarangayDocument> {
    return dbSetDocument<BarangayDocument>('barangays', barangay.id, barangay);
  },

  async updateStatus(
    barangayId: string,
    status: BarangayDocument['status'],
    nearTreasuryAccountId?: string
  ): Promise<void> {
    await dbUpdateDocument<BarangayDocument>('barangays', barangayId, {
      status,
      ...(nearTreasuryAccountId ? { nearTreasuryAccountId } : {}),
      updatedAt: new Date().toISOString(),
    });
  },
};

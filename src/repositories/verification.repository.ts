/**
 * Fundora — Verification Records Repository (`verification_records/{verificationId}`)
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { VerificationRecordDocument } from '../types';

export const verificationRepository = {
  async getById(verificationId: string): Promise<VerificationRecordDocument | null> {
    return dbGetById<VerificationRecordDocument>('verification_records', verificationId);
  },

  async getLatestForUser(uid: string): Promise<VerificationRecordDocument | null> {
    const records = await dbListCollection<VerificationRecordDocument>('verification_records', [
      { field: 'uid', op: '==', value: uid },
    ]);
    if (records.length === 0) return null;
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  },

  async listByBarangay(barangayId: string): Promise<VerificationRecordDocument[]> {
    return dbListCollection<VerificationRecordDocument>('verification_records', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
  },

  async saveVerificationRecord(
    record: VerificationRecordDocument
  ): Promise<VerificationRecordDocument> {
    return dbSetDocument<VerificationRecordDocument>('verification_records', record.id, record);
  },

  async updateVerificationDecision(
    verificationId: string,
    partial: Partial<VerificationRecordDocument>
  ): Promise<void> {
    await dbUpdateDocument<VerificationRecordDocument>(
      'verification_records',
      verificationId,
      partial
    );
  },
};

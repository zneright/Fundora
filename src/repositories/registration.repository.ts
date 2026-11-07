/**
 * Fundora — Registration & Document Vault Repository
 * Manages `registration_records/{uid}` and `uploaded_documents/{docId}`
 * in strict separation from `users/{uid}` per FD-SDLC-06.
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { RegistrationRecordDocument, UploadedDocumentRecord } from '../types';

export const registrationRepository = {
  async getByUid(uid: string): Promise<RegistrationRecordDocument | null> {
    return dbGetById<RegistrationRecordDocument>('registration_records', uid);
  },

  async listByBarangay(barangayId: string): Promise<RegistrationRecordDocument[]> {
    return dbListCollection<RegistrationRecordDocument>('registration_records', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
  },

  async saveRegistrationRecord(
    record: RegistrationRecordDocument
  ): Promise<RegistrationRecordDocument> {
    return dbSetDocument<RegistrationRecordDocument>('registration_records', record.uid, record);
  },

  async updateRegistrationRecord(
    uid: string,
    partial: Partial<RegistrationRecordDocument>
  ): Promise<void> {
    await dbUpdateDocument<RegistrationRecordDocument>('registration_records', uid, {
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  },

  async saveUploadedDocument(docRecord: UploadedDocumentRecord): Promise<UploadedDocumentRecord> {
    return dbSetDocument<UploadedDocumentRecord>('uploaded_documents', docRecord.id, docRecord);
  },

  async listUploadedDocumentsByOwner(ownerUid: string): Promise<UploadedDocumentRecord[]> {
    return dbListCollection<UploadedDocumentRecord>('uploaded_documents', [
      { field: 'ownerUid', op: '==', value: ownerUid },
    ]);
  },

  async findDuplicateByDocumentHash(
    sha256Hash: string,
    excludeUid: string
  ): Promise<UploadedDocumentRecord | null> {
    const matches = await dbListCollection<UploadedDocumentRecord>('uploaded_documents', [
      { field: 'sha256Hash', op: '==', value: sha256Hash },
    ]);
    return matches.find((m) => m.ownerUid !== excludeUid) || null;
  },
};

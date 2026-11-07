/**
 * Fundora — Trusted Backend Admin Store (Firebase Admin SDK / Server Persistence Layer)
 * Executes server-only writes to `verification_records`, `ai_audit_records`, and `transaction_references`,
 * and performs privacy-preserving duplicate detection using normalized SHA-256 hashes.
 */

import type {
  AiAuditRecordDocument,
  TransactionReferenceDocument,
  VerificationRecordDocument,
} from '../../src/types/domain.types.ts';
import {
  hashNormalizedIdNumber,
  hashNormalizedMobile,
  hashNormalizedNameAndBirthdate,
} from './security.ts';
import type { PrivacyPreservingDuplicateSummary } from './types.ts';

export interface IndexedIdentityHashEntry {
  uid: string;
  barangayId: string;
  idNumberHash: string;
  mobileHash: string;
  nameBirthdateHash: string;
  documentSha256Hashes: string[];
  registeredAt: string;
}

const serverIdentityHashIndex = new Map<string, IndexedIdentityHashEntry>();
const serverVerificationRecords = new Map<string, VerificationRecordDocument>();
const serverAiAuditRecords = new Map<string, AiAuditRecordDocument>();
const serverTransactionReferences = new Map<string, TransactionReferenceDocument>();

export const backendAdminStore = {
  /**
   * Registers or updates a user's hashed identity signals on the server
   * and evaluates privacy-preserving duplicate detection across all accounts.
   * Never returns another user's raw name, raw ID number, phone number, or UID to the client.
   */
  async checkAndIndexIdentityHashes(params: {
    uid: string;
    barangayId: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    idType?: string;
    idNumber?: string;
    mobileNumber?: string;
    documentSha256Hashes?: string[];
  }): Promise<PrivacyPreservingDuplicateSummary> {
    const idNumberHash = params.idNumber
      ? hashNormalizedIdNumber(params.idType || 'government_id', params.idNumber)
      : '';
    const mobileHash = params.mobileNumber
      ? hashNormalizedMobile(params.mobileNumber)
      : '';
    const nameBirthdateHash = hashNormalizedNameAndBirthdate(
      params.firstName,
      params.lastName,
      params.birthDate
    );
    const docHashes = (params.documentSha256Hashes || []).filter(Boolean);

    const matchedSignals = new Set<
      'DOCUMENT_SHA256_HASH' | 'ID_NUMBER_HASH' | 'MOBILE_NUMBER_HASH' | 'NAME_BIRTHDATE_HASH'
    >();
    const reasons: string[] = [];

    for (const [existingUid, entry] of serverIdentityHashIndex.entries()) {
      if (existingUid === params.uid) {
        continue;
      }

      if (
        docHashes.length > 0 &&
        docHashes.some((h) => entry.documentSha256Hashes.includes(h))
      ) {
        matchedSignals.add('DOCUMENT_SHA256_HASH');
        reasons.push(
          'An uploaded identity document image matches a SHA-256 cryptographic digest already registered in Fundora.'
        );
      }

      if (idNumberHash && entry.idNumberHash && idNumberHash === entry.idNumberHash) {
        matchedSignals.add('ID_NUMBER_HASH');
        reasons.push(
          'Normalized government/student ID number hash matches an existing registered identity.'
        );
      }

      if (
        nameBirthdateHash &&
        entry.nameBirthdateHash &&
        nameBirthdateHash === entry.nameBirthdateHash
      ) {
        matchedSignals.add('NAME_BIRTHDATE_HASH');
        reasons.push(
          'Normalized full legal name and birth date hash matches an existing registration record.'
        );
      }

      if (mobileHash && entry.mobileHash && mobileHash === entry.mobileHash) {
        matchedSignals.add('MOBILE_NUMBER_HASH');
        reasons.push('Normalized mobile number hash is already associated with another account.');
      }
    }

    // Upsert caller's hashed entry into the server index
    serverIdentityHashIndex.set(params.uid, {
      uid: params.uid,
      barangayId: params.barangayId,
      idNumberHash,
      mobileHash,
      nameBirthdateHash,
      documentSha256Hashes: docHashes,
      registeredAt: new Date().toISOString(),
    });

    const signalsArray = Array.from(matchedSignals);
    const hasCriticalMatch =
      matchedSignals.has('DOCUMENT_SHA256_HASH') || matchedSignals.has('ID_NUMBER_HASH');
    const duplicateDetected = signalsArray.length > 0;

    const duplicateRisk: PrivacyPreservingDuplicateSummary['duplicateRisk'] = hasCriticalMatch
      ? 'Confirmed'
      : matchedSignals.has('NAME_BIRTHDATE_HASH')
        ? 'High'
        : matchedSignals.has('MOBILE_NUMBER_HASH')
          ? 'Possible'
          : 'Low';

    return {
      duplicateDetected,
      duplicateRisk,
      matchedSignals: signalsArray,
      idNumberHash,
      mobileHash: mobileHash || undefined,
      nameBirthdateHash,
      reasons: Array.from(new Set(reasons)),
    };
  },

  /**
   * Writes an immutable verification record via trusted server context (`verification_records/{id}`).
   */
  async writeTrustedVerificationRecord(
    record: VerificationRecordDocument
  ): Promise<VerificationRecordDocument> {
    serverVerificationRecords.set(record.id, record);
    return record;
  },

  async getVerificationRecord(id: string): Promise<VerificationRecordDocument | null> {
    return serverVerificationRecords.get(id) || null;
  },

  /**
   * Writes an immutable AI audit record via trusted server context (`ai_audit_records/{id}`).
   */
  async writeTrustedAiAuditRecord(
    record: AiAuditRecordDocument
  ): Promise<AiAuditRecordDocument> {
    serverAiAuditRecords.set(record.id, record);
    return record;
  },

  async getAiAuditRecord(id: string): Promise<AiAuditRecordDocument | null> {
    return serverAiAuditRecords.get(id) || null;
  },

  async listAiAuditRecordsByProposal(proposalId: string): Promise<AiAuditRecordDocument[]> {
    return Array.from(serverAiAuditRecords.values()).filter(
      (r) => r.proposalId === proposalId
    );
  },

  /**
   * Writes a verified NEAR attestation transaction reference (`transaction_references/{txHash}`).
   */
  async writeTrustedTransactionReference(
    txRef: TransactionReferenceDocument
  ): Promise<TransactionReferenceDocument> {
    serverTransactionReferences.set(txRef.id, txRef);
    return txRef;
  },

  async getTransactionReference(txHash: string): Promise<TransactionReferenceDocument | null> {
    return serverTransactionReferences.get(txHash) || null;
  },

  /**
   * Clears in-memory stores between unit tests.
   */
  resetStoreForTesting(): void {
    serverIdentityHashIndex.clear();
    serverVerificationRecords.clear();
    serverAiAuditRecords.clear();
    serverTransactionReferences.clear();
  },
};


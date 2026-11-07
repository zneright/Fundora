/**
 * Fundora — User Profile Repository (`users/{uid}`)
 * Strictly stores non-sensitive profile & jurisdiction routing attributes.
 * PII is stored separately in `registration_records/{uid}` via `registrationRepository`.
 */

import { dbGetById, dbListCollection, dbSetDocument, dbUpdateDocument } from './db.helper';
import type { UserProfile } from '../types';

const FORBIDDEN_USER_PROFILE_PII_FIELDS = new Set([
  'birthDate',
  'mobileNumber',
  'houseStreetSitio',
  'primaryIdNumber',
  'secondaryIdNumber',
  'uploadedDocuments',
]);

function stripSensitiveFieldsFromUserProfile(profile: UserProfile): UserProfile {
  const clean = { ...profile } as Record<string, unknown>;
  for (const field of FORBIDDEN_USER_PROFILE_PII_FIELDS) {
    delete clean[field];
  }
  return clean as unknown as UserProfile;
}

export const userRepository = {
  async getById(uid: string): Promise<UserProfile | null> {
    return dbGetById<UserProfile>('users', uid);
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const list = await dbListCollection<UserProfile>('users', [
      { field: 'email', op: '==', value: email.trim().toLowerCase() },
    ]);
    return list[0] || null;
  },

  async listByBarangay(barangayId: string): Promise<UserProfile[]> {
    return dbListCollection<UserProfile>('users', [
      { field: 'barangayId', op: '==', value: barangayId },
    ]);
  },

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    const sanitized = stripSensitiveFieldsFromUserProfile(profile);
    return dbSetDocument<UserProfile>('users', sanitized.uid, sanitized);
  },

  async updateProfile(uid: string, partial: Partial<UserProfile>): Promise<void> {
    const cleanPartial = { ...partial } as Record<string, unknown>;
    for (const field of FORBIDDEN_USER_PROFILE_PII_FIELDS) {
      delete cleanPartial[field];
    }
    await dbUpdateDocument<UserProfile>('users', uid, {
      ...(cleanPartial as Partial<UserProfile>),
      updatedAt: new Date().toISOString(),
    });
  },
};

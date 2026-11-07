/**
 * Fundora — Term Lifecycle & Resubmission Target Helpers
 */

import type { ResubmissionTarget, UserProfile } from '../types';

export interface ResubmissionPolicyConfig {
  target: ResubmissionTarget;
  label: string;
  description: string;
  unlockIdentityFields: boolean;
  unlockAddressFields: boolean;
  unlockUploads: boolean;
  allowedFields: string[];
}

export const RESUBMISSION_PRESETS: Record<ResubmissionTarget, ResubmissionPolicyConfig> = {
  photo_only: {
    target: 'photo_only',
    label: 'Photo & Document Re-upload Only',
    description:
      'Identity and jurisdiction fields remain locked; applicant only re-uploads clearer ID photos or live selfie.',
    unlockIdentityFields: false,
    unlockAddressFields: false,
    unlockUploads: true,
    allowedFields: ['uploadedDocuments'],
  },
  details_only: {
    target: 'details_only',
    label: 'Personal & Address Details Only',
    description:
      'Uploaded ID photos remain preserved; applicant corrects typos in legal name, birth date, ID number, or street address.',
    unlockIdentityFields: true,
    unlockAddressFields: true,
    unlockUploads: false,
    allowedFields: [
      'firstName',
      'middleName',
      'lastName',
      'suffix',
      'birthDate',
      'mobileNumber',
      'houseStreetSitio',
      'primaryIdType',
      'primaryIdNumber',
    ],
  },
  full_package: {
    target: 'full_package',
    label: 'Full Application Package',
    description:
      'Unlocks all personal identity fields, address details, and document uploads for a complete resubmission.',
    unlockIdentityFields: true,
    unlockAddressFields: true,
    unlockUploads: true,
    allowedFields: [
      'firstName',
      'middleName',
      'lastName',
      'suffix',
      'birthDate',
      'mobileNumber',
      'houseStreetSitio',
      'primaryIdType',
      'primaryIdNumber',
      'uploadedDocuments',
    ],
  },
  custom: {
    target: 'custom',
    label: 'Custom Field Unlock',
    description:
      'Reviewer selects exact fields or document slots that the applicant is permitted to revise.',
    unlockIdentityFields: true,
    unlockAddressFields: true,
    unlockUploads: true,
    allowedFields: [],
  },
};

export function resolveResubmissionPermissions(user?: Partial<UserProfile> | null): {
  isResubmissionMode: boolean;
  target: ResubmissionTarget;
  canEditField: (fieldName: string) => boolean;
  canEditIdentityStep: boolean;
  canEditDetailsStep: boolean;
  canEditUploadsStep: boolean;
} {
  if (!user || user.verificationStatus !== 'rejected') {
    return {
      isResubmissionMode: false,
      target: 'full_package',
      canEditField: () => true,
      canEditIdentityStep: true,
      canEditDetailsStep: true,
      canEditUploadsStep: true,
    };
  }

  const target: ResubmissionTarget = user.resubmissionTarget || 'full_package';
  const preset = RESUBMISSION_PRESETS[target];
  const customAllowed = new Set(user.resubmissionAllowedFields || preset.allowedFields);

  const canEditField = (fieldName: string): boolean => {
    if (target === 'full_package') return true;
    if (target === 'photo_only') return fieldName === 'uploadedDocuments';
    if (target === 'details_only') return fieldName !== 'uploadedDocuments';
    return customAllowed.has(fieldName);
  };

  return {
    isResubmissionMode: true,
    target,
    canEditField,
    canEditIdentityStep:
      target === 'full_package' ||
      target === 'details_only' ||
      (target === 'custom' &&
        ['firstName', 'middleName', 'lastName', 'birthDate', 'houseStreetSitio'].some((f) =>
          customAllowed.has(f)
        )),
    canEditDetailsStep:
      target === 'full_package' ||
      target === 'details_only' ||
      (target === 'custom' &&
        ['mobileNumber', 'primaryIdType', 'primaryIdNumber', 'positionTitle'].some((f) =>
          customAllowed.has(f)
        )),
    canEditUploadsStep:
      target === 'full_package' ||
      target === 'photo_only' ||
      (target === 'custom' && customAllowed.has('uploadedDocuments')),
  };
}

export function isTermExpired(termEndsAt?: string): boolean {
  if (!termEndsAt) return false;
  const end = new Date(termEndsAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < Date.now();
}

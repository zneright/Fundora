/**
 * Fundora — Review Decision & Rejection Category Templates
 */

import type { ResubmissionTarget } from '../types';
import { RESUBMISSION_PRESETS } from './lifecycle';

export function buildSelectiveResubmissionDecision(
  target: ResubmissionTarget,
  rejectionReason: string,
  customFields?: string[]
): {
  resubmissionTarget: ResubmissionTarget;
  allowedFields: string[];
  rejectionReason: string;
} {
  const preset = RESUBMISSION_PRESETS[target] || RESUBMISSION_PRESETS.full_package;
  return {
    resubmissionTarget: target,
    allowedFields:
      target === 'custom' && customFields ? customFields : preset.allowedFields,
    rejectionReason,
  };
}

export interface RejectionCategoryOption {
  code: string;
  label: string;
  defaultReason: string;
  recommendedTarget: ResubmissionTarget;
}

export const REJECTION_CATEGORIES: RejectionCategoryOption[] = [
  {
    code: 'BLURRY_OR_UNREADABLE_ID',
    label: 'Blurry or Unreadable ID Photo',
    defaultReason:
      'Your uploaded ID photo or live selfie was blurry or had glare. Please re-upload clear, unobstructed images.',
    recommendedTarget: 'photo_only',
  },
  {
    code: 'NAME_OR_DOB_TYPO',
    label: 'Name / Birth Date Mismatch with ID',
    defaultReason:
      'The legal name or birth date entered does not match your government ID. Please update your personal details.',
    recommendedTarget: 'details_only',
  },
  {
    code: 'ADDRESS_OR_JURISDICTION_MISMATCH',
    label: 'Address Outside Barangay Jurisdiction',
    defaultReason:
      'Your submitted address or proof of residency does not match the selected barangay jurisdiction.',
    recommendedTarget: 'full_package',
  },
  {
    code: 'EXPIRED_OR_INVALID_CREDENTIAL',
    label: 'Expired ID or Missing Oath/Appointment Paper',
    defaultReason:
      'The submitted identification or official appointment document is expired or incomplete.',
    recommendedTarget: 'full_package',
  },
];

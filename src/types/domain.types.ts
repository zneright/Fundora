/**
 * Fundora — Domain Types & Canonical Data Models
 * Aligned with FD-SDLC-06 (Database & Data Model Specification)
 * and FD-SDLC-08 (Registration & UX Specification).
 */

export type UserRole =
  | 'resident'
  | 'sk_official'
  | 'barangay_admin'
  | 'system_admin'
  | 'viewer';

export type VerificationStatus =
  | 'unverified'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'expired';

export type ResubmissionTarget =
  | 'photo_only'
  | 'details_only'
  | 'full_package'
  | 'custom';

export type DocumentTag =
  | 'Primary ID Front'
  | 'Primary ID Back'
  | 'Secondary ID Front'
  | 'Secondary ID Back'
  | 'Proof of Residency'
  | 'Live Selfie'
  | 'Appointment / Oath Paper'
  | 'Official LGU Credential'
  | 'Resubmission Attachment';

export interface UploadedDocumentItem {
  id: string;
  tag: DocumentTag;
  label: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  uploadedAt: string;
}

export interface TypoCorrectionSuggestion {
  field: string;
  submittedValue: string;
  extractedValue: string;
  confidence: number;
}

export interface VerificationScoreCard {
  overallScore: number;
  nameMatchScore: number;
  jurisdictionMatchScore: number;
  documentAuthenticityScore: number;
  residencyConsistencyScore: number;
  ageComplianceScore: number;
  livenessScore: number;
  verdict: 'PASS' | 'REVIEW_REQUIRED' | 'REJECT_RECOMMENDED';
  summary: string;
  flags: string[];
  typoSuggestions?: TypoCorrectionSuggestion[];
  auditedAt: string;
}

/**
 * 1. `barangays/{barangayId}`
 */
export interface BarangayDocument {
  id: string;
  psgcCode: string;
  name: string;
  regionName: string;
  regionCode: string;
  provinceName: string;
  provinceCode: string;
  cityMunicipalityName: string;
  cityMunicipalityCode: string;
  zipCode: string;
  hallAddress: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'suspended';
  adminUid: string;
  adminFullName: string;
  nearTreasuryAccountId?: string;
  quorumBps: number; // default 6000 (60%)
  minVotesRequired: number; // default 3; 1 strictly for brgy_demo_001
  termStartDate: string;
  termEndDate: string;
  isDemoJurisdiction?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 2. `users/{uid}` — Core Non-Sensitive Identity & Role Routing Record
 * Strictly contains NO private keys and NO raw ID document payloads.
 */
export interface UserProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  role: UserRole;
  requestedRole?: UserRole;
  barangayId: string;
  barangayName: string;
  psgcCode: string;
  cityMunicipalityName: string;
  provinceName: string;
  regionName: string;
  zipCode: string;
  ageYears: number;
  ageBracketStatus:
    | 'eligible_youth'
    | 'over_30_viewer'
    | 'under_15_blocked'
    | 'ineligible_sk_age';
  verificationStatus: VerificationStatus;
  nearAccountId?: string;
  resubmissionTarget?: ResubmissionTarget;
  resubmissionAllowedFields?: string[];
  rejectionReason?: string;
  rejectionCategory?: string;
  termEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 3. `registration_records/{uid}` — Protected PII & Onboarding Metadata
 * Separated from `users/{uid}` per FD-SDLC-06 to prevent horizontal PII exposure.
 */
export interface RegistrationRecordDocument {
  uid: string;
  barangayId: string;
  psgcCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  birthDate: string;
  ageYears: number;
  sex: 'Male' | 'Female' | 'Prefer not to say';
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated';
  mobileNumber: string;
  houseStreetSitio: string;
  fullFormattedAddress: string;
  primaryIdType: string;
  primaryIdNumber: string;
  secondaryIdType?: string;
  secondaryIdNumber?: string;
  positionTitle?: string;
  termStartDate?: string;
  termEndDate?: string;
  dataPrivacyConsent: boolean;
  truthfulnessAttestation: boolean;
  consentTimestamp: string;
  documentHashes: string[];
  resubmissionCount: number;
  lastSubmittedAt: string;
  updatedAt: string;
}

/**
 * 4. `verification_records/{verificationId}` — Immutable AI & Admin KYC Audit Log
 */
export interface VerificationRecordDocument {
  id: string;
  uid: string;
  barangayId: string;
  submittedRole: UserRole;
  status: VerificationStatus;
  scoreCard: VerificationScoreCard;
  duplicateDetected: boolean;
  duplicateMatchedUid?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewDecisionNotes?: string;
  resubmissionTarget?: ResubmissionTarget;
  resubmissionAllowedFields?: string[];
  createdAt: string;
  reviewedAt?: string;
}

/**
 * 5. `uploaded_documents/{docId}` — Restricted Document Vault
 */
export interface UploadedDocumentRecord {
  id: string;
  ownerUid: string;
  barangayId: string;
  tag: DocumentTag;
  label: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  uploadedAt: string;
}

/**
 * 6. `proposals/{proposalId}` — Civic Project & Milestone Escrow Metadata
 */
export interface ProposalLineItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPricePhp: number;
  totalPricePhp: number;
  dtiBenchmarkPricePhp?: number;
  variancePct?: number;
}

export interface ProposalMilestone {
  index: number;
  label: string;
  allocationBps: number; // 4000, 4000, 2000
  amountYocto: string;
  amountPhpEquivalent: number;
  status: 'LOCKED' | 'EVIDENCE_SUBMITTED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED';
  evidenceHash?: string;
  evidenceSummary?: string;
  evidencePhotoUrls?: string[];
  submittedAt?: string;
  releasedAt?: string;
  nearTxHash?: string;
}

export interface ProposalDocument {
  id: string; // canonical `prop_<uuid>` shared with NEAR smart contract
  barangayId: string;
  barangayName: string;
  psgcCode: string;
  title: string;
  category: string;
  summary: string;
  beneficiarySummary: string;
  proposerUid: string;
  proposerName: string;
  proposerNearAccountId: string;
  beneficiaryNearAccountId: string;
  totalBudgetPhp: number;
  totalBudgetNear: string;
  totalBudgetYocto: string;
  lineItems: ProposalLineItem[];
  milestones: ProposalMilestone[];
  status:
    | 'DRAFT'
    | 'PENDING_AI_AUDIT'
    | 'REVISION_REQUESTED'
    | 'COMMUNITY_VOTE'
    | 'ACTIVE_ESCROW'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDED';
  aiAuditRecordId?: string;
  aiOverallRiskScore?: number;
  aiVerdict?: 'PASS' | 'WARN' | 'FAIL';
  approveVotes: number;
  rejectVotes: number;
  quorumBps: number;
  minVotesRequired: number;
  nearEscrowCreatedTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 7. `ai_audit_records/{auditId}` — Server-Written Procurement & Milestone Audits
 */
export interface AiBorrowingRecommendation {
  itemName: string;
  purchaseCostPhp: number;
  recommendedSourceAgency: string;
  estimatedSavingsPhp: number;
  rationale: string;
}

export interface AiAuditRecordDocument {
  id: string;
  proposalId: string;
  barangayId: string;
  auditType: 'PROCUREMENT_PROPOSAL' | 'MILESTONE_EVIDENCE';
  overallRiskScore: number; // 0-100
  verdict: 'PASS' | 'WARN' | 'FAIL';
  summary: string;
  flaggedItems: Array<{
    itemName: string;
    submittedUnitPricePhp: number;
    dtiBenchmarkPricePhp: number;
    variancePct: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    note: string;
  }>;
  borrowingRecommendations: AiBorrowingRecommendation[];
  reportSha256Hash: string;
  nearAttestationTxHash?: string;
  createdAt: string;
}

/**
 * 8. `transaction_references/{txId}` — Verifiable On-Chain NEAR Ledger References
 */
export interface TransactionReferenceDocument {
  id: string;
  nearTxHash: string;
  proposalId: string;
  barangayId: string;
  actionType:
    | 'CREATE_PROPOSAL'
    | 'FUND_ESCROW'
    | 'RECORD_AI_AUDIT'
    | 'CAST_VOTE'
    | 'SUBMIT_MILESTONE_PROOF'
    | 'RELEASE_MILESTONE'
    | 'REFUND_ESCROW';
  signerNearAccountId: string;
  recipientNearAccountId?: string;
  amountYocto: string;
  amountNear: string;
  amountPhpEquivalent: number;
  milestoneIndex?: number;
  explorerUrl: string;
  receiptSerialNumber: string;
  createdAt: string;
}

/**
 * 9. `wallet_links/{linkId}` — Public NEAR AccountId Registry (NO PRIVATE KEYS)
 */
export interface WalletLinkDocument {
  id: string;
  uid: string;
  barangayId: string;
  nearAccountId: string;
  networkId: 'testnet' | 'mainnet';
  walletProviderId: string;
  isPrimary: boolean;
  linkedAt: string;
}

/**
 * 10. `audit_logs/{logId}` & `notifications/{notifId}`
 */
export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  barangayId: string;
  action: string;
  targetId: string;
  details: string;
  nearTxHash?: string;
  createdAt: string;
}

export interface NotificationEntry {
  id: string;
  recipientUid: string;
  barangayId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

/**
 * Wizard state for the 5-pill step-by-step registration flow
 */
export interface RegistrationWizardState {
  email: string;
  password?: string;
  selectedRole: 'resident' | 'sk_official' | 'barangay_admin';
  regionCode: string;
  regionName: string;
  provinceCode: string;
  provinceName: string;
  cityMunicipalityCode: string;
  cityMunicipalityName: string;
  barangayCode: string;
  barangayName: string;
  barangayId: string;
  zipCode: string;
  hallAddress: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  skSubRole?:
    | 'elected_chairperson'
    | 'elected_kagawad'
    | 'appointed_secretary'
    | 'appointed_treasurer';
  sex: 'Male' | 'Female' | 'Prefer not to say';
  civilStatus: 'Single' | 'Married' | 'Widowed' | 'Separated';
  mobileNumber: string;
  houseStreetSitio: string;
  primaryIdType: string;
  primaryIdNumber: string;
  secondaryIdType: string;
  secondaryIdNumber: string;
  positionTitle: string;
  termStartDate: string;
  termEndDate: string;
  dataPrivacyConsent: boolean;
  truthfulnessAttestation: boolean;
  uploadedDocuments: UploadedDocumentItem[];
}

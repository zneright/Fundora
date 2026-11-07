/**
 * Fundora — Phase 3 Protected Backend AI Auditor & Verification API Types
 * Defines strict request/response schemas, DTI SRP benchmark structures,
 * inter-agency borrowing models, and NEAR attestation states.
 */

import type {
  ResubmissionTarget,
  TypoCorrectionSuggestion,
  UserRole,
  VerificationScoreCard,
} from '../../src/types/domain.types.ts';

export type EvaluationMode = 'gemini_live' | 'deterministic_fallback';

export type AttestationTargetType = 'proposal_procurement' | 'milestone_evidence';

export type ContractRecommendation = 'approve' | 'revise' | 'flag_high_risk';

export type NearAttestationStatus =
  | 'RECORDED_ONCHAIN'
  | 'PENDING_RETRY'
  | 'FAILED'
  | 'SKIPPED_PROJECT_NOT_ONCHAIN';

export interface NearAttestationOutcome {
  status: NearAttestationStatus;
  txHash?: string;
  signerAccountId: string;
  contractId: string;
  projectId: string;
  targetType: AttestationTargetType;
  milestoneIdx: number | null;
  reportSha256Hash: string;
  score: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  explorerUrl?: string;
  retryable: boolean;
  error?: string;
  recordedAt: string;
  advisoryTrustNotice: string;
}

export interface AuthenticatedCallerContext {
  uid: string;
  email?: string;
  role: UserRole;
  barangayId: string;
  status: 'active' | 'pending' | 'onboarding' | 'suspended';
}

export interface UploadedImageInput {
  tag: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  sha256Hash?: string;
}

// ============================================================================
// 1. POST /api/ai/verify-identity
// ============================================================================

export interface VerifyIdentityRequest {
  uid: string;
  barangayId: string;
  psgcCode: string;
  selectedRole: 'resident' | 'sk_official' | 'barangay_admin';
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  birthDate: string;
  mobileNumber?: string;
  houseStreetSitio?: string;
  barangayName: string;
  cityMunicipalityName: string;
  provinceName?: string;
  primaryIdType?: string;
  primaryIdNumber?: string;
  secondaryIdType?: string;
  secondaryIdNumber?: string;
  resubmissionTarget?: ResubmissionTarget;
  resubmissionAllowedFields?: string[];
  documents?: UploadedImageInput[];
  documentTags?: string[];
  simulatedOcrOverrides?: {
    extractedFirstName?: string;
    extractedLastName?: string;
    extractedBirthDate?: string;
    extractedIdNumber?: string;
    extractedBarangay?: string;
  };
}

export interface PrivacyPreservingDuplicateSummary {
  duplicateDetected: boolean;
  duplicateRisk: 'Low' | 'Possible' | 'High' | 'Confirmed';
  matchedSignals: Array<
    'DOCUMENT_SHA256_HASH' | 'ID_NUMBER_HASH' | 'MOBILE_NUMBER_HASH' | 'NAME_BIRTHDATE_HASH'
  >;
  idNumberHash: string;
  mobileHash?: string;
  nameBirthdateHash: string;
  reasons: string[];
}

export interface ExtractedOcrSummary {
  extractedFullName?: string;
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedBirthDate?: string;
  extractedBarangay?: string;
  extractedIdType?: string;
  idNumberMasked?: string;
  imageQualityReadable: boolean;
}

export interface VerifyIdentityResponse {
  verificationId: string;
  uid: string;
  barangayId: string;
  evaluationMode: EvaluationMode;
  aiServiceAvailable: boolean;
  fallbackReason?: string;
  scoreCard: VerificationScoreCard;
  extractedOcr: ExtractedOcrSummary;
  duplicateCheck: PrivacyPreservingDuplicateSummary;
  promptInjectionDetected: boolean;
  humanReviewRequired: true;
  advisoryNotice: string;
  typoSuggestions: TypoCorrectionSuggestion[];
  createdAt: string;
}

// ============================================================================
// 2. POST /api/ai/audit-proposal
// ============================================================================

export interface ProposalBudgetItemInput {
  id?: string;
  itemName: string;
  category?: string;
  quantity: number;
  unit: string;
  unitPricePhp: number;
  totalPricePhp?: number;
}

export interface ProposalPhaseInput {
  index?: number;
  phaseNumber?: number;
  title: string;
  description?: string;
  percentageBps?: number; // e.g., 4000, 4000, 2000
  percentage?: number; // e.g., 40, 40, 20
  amountNear?: number;
  amountYocto?: string;
  isUpfront?: boolean;
  requiredProofs?: string[];
}

export interface AuditProposalRequest {
  projectId: string;
  barangayId: string;
  psgcCode?: string;
  projectName: string;
  category: string;
  description: string;
  totalBudgetPhp: number;
  totalBudgetNear: number;
  phpPerNearRate?: number;
  lineItems: ProposalBudgetItemInput[];
  milestones: ProposalPhaseInput[];
  recordOnChainAttestation?: boolean;
}

export interface DtiSrpBenchmarkFinding {
  itemName: string;
  quantity: number;
  unit: string;
  proposedUnitPricePhp: number;
  estimatedDtiSrpPhp: number;
  maxAcceptablePricePhp: number;
  variancePct: number;
  status: 'within_srp' | 'above_srp' | 'below_srp' | 'unverified_custom';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  dtiReferenceSource: string;
  dtiEffectiveDate: string;
  note: string;
}

export interface InterAgencyBorrowingFinding {
  itemName: string;
  proposedPurchaseCostPhp: number;
  suggestedSourceAgency: string;
  estimatedSavingsPhp: number;
  rationale: string;
  alternativeFallbackAgency?: string;
}

export interface MilestoneAllocationAssessment {
  isValidCount: boolean;
  milestoneCount: number;
  totalPercentageBps: number;
  isExact100Percent: boolean;
  upfrontPercentageBps: number;
  upfrontAssessment: 'optimal' | 'high_upfront_risk' | 'no_upfront';
  budgetLineItemSumPhp: number;
  declaredTotalBudgetPhp: number;
  isBudgetBalanced: boolean;
  budgetDiscrepancyPhp: number;
  notes: string[];
}

export interface ProposalAuditReportPayload {
  projectId: string;
  barangayId: string;
  auditType: 'proposal_procurement';
  evaluationMode: EvaluationMode;
  feasibilityScore: number;
  overallRiskScore: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  verdict: 'PASS' | 'WARN' | 'FAIL';
  suggestedBudgetPhp: number;
  suggestedBudgetNear: number;
  dtiSrpBenchmarkFindings: DtiSrpBenchmarkFinding[];
  borrowingRecommendations: InterAgencyBorrowingFinding[];
  milestoneAssessment: MilestoneAllocationAssessment;
  riskFlags: string[];
  summaryAnalysis: string;
  promptInjectionDetected: boolean;
}

export interface AuditProposalResponse {
  auditId: string;
  projectId: string;
  barangayId: string;
  evaluationMode: EvaluationMode;
  aiServiceAvailable: boolean;
  fallbackReason?: string;
  report: ProposalAuditReportPayload;
  reportSha256Hash: string;
  nearAttestation: NearAttestationOutcome;
  humanOversightNotice: string;
  createdAt: string;
}

// ============================================================================
// 3. POST /api/ai/audit-evidence
// ============================================================================

export interface OfficialReceiptInput {
  receiptNumber?: string;
  supplierName: string;
  tinNumber?: string;
  amountPhp: number;
  receiptDate?: string;
  description?: string;
}

export interface AuditEvidenceRequest {
  projectId: string;
  barangayId: string;
  milestoneIndex: number; // 1-based milestone index (1..5)
  milestoneTitle: string;
  milestoneBudgetPhp: number;
  milestoneBudgetNear?: number;
  requiredProofs: string[];
  accomplishmentNotes: string;
  officialReceipts?: OfficialReceiptInput[];
  evidenceImages: UploadedImageInput[];
  recordOnChainAttestation?: boolean;
}

export interface DeliverableVerificationItem {
  requirement: string;
  met: boolean;
  confidence: number;
  observation: string;
}

export interface ReceiptVerificationSummary {
  receiptCount: number;
  totalReceiptsAmountPhp: number;
  milestoneBudgetPhp: number;
  variancePhp: number;
  variancePct: number;
  isConsistentWithBudget: boolean;
  missingReceiptNumbers: boolean;
  notes: string;
}

export interface EvidenceAuditReportPayload {
  projectId: string;
  barangayId: string;
  auditType: 'milestone_evidence';
  milestoneIndex: number;
  milestoneTitle: string;
  evaluationMode: EvaluationMode;
  feasibilityScore: number;
  overallRiskScore: number;
  recommendation: 'approve' | 'revise' | 'flag_high_risk';
  verdict: 'PASS' | 'WARN' | 'FAIL';
  deliverablesVerified: DeliverableVerificationItem[];
  receiptConsistency: ReceiptVerificationSummary;
  questionableDocumentationFlags: string[];
  summaryForVoters: string;
  summaryAnalysis: string;
  promptInjectionDetected: boolean;
}

export interface AuditEvidenceResponse {
  auditId: string;
  projectId: string;
  barangayId: string;
  milestoneIndex: number;
  evaluationMode: EvaluationMode;
  aiServiceAvailable: boolean;
  fallbackReason?: string;
  report: EvidenceAuditReportPayload;
  reportSha256Hash: string;
  nearAttestation: NearAttestationOutcome;
  humanQuorumBindingNotice: string;
  createdAt: string;
}

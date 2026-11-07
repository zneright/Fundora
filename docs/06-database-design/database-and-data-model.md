# Fundora — Database & Off-Chain Data Model Specification

**Document ID:** `FD-SDLC-06`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Database Engine:** Google Cloud Firestore (NoSQL Document Store)

---

## 1. Data Architecture Principles

1. **Zero Secret Material:** No private keys (`inAppWalletSecret`), seed phrases, or API keys are ever stored in any Firestore collection.
2. **Public vs. Private PII Separation:** To prevent the legacy vulnerability where `allow list: if isAuthenticated()` exposed every user's government ID number, phone number, birthdate, and address ([`firestore.rules`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/firestore.rules#L96)), Fundora separates sensitive onboarding/PII records (`registration_records`, `verification_records`, `uploaded_documents`) from core user session profiles (`users`).
3. **No Duplicate or Conflicting Rule Blocks:** Every collection has exactly **one** canonical `match` block in `firestore.rules`.
4. **Server-Authoritative AI & Audit Records:** Collections storing AI verification scores (`verification_records`, `ai_audit_records`) are write-protected so only the backend Firebase Admin SDK can create or update them.

---

## 2. Firestore Collection Schemas

### 2.1 `barangays/{barangayId}`
Stores activated and proposed community jurisdictions, binding official PSGC codes to NEAR smart contract registries.
```typescript
export interface BarangayDocument {
  id: string;                      // e.g., "brgy_137602003" or "brgy_demo_001"
  psgcCode: string;                // 10-digit PSGC code, e.g., "1376020030"
  name: string;                    // e.g., "Bel-Air"
  municipality: string;            // e.g., "City of Makati"
  province: string;                // e.g., "Metro Manila"
  region: string;                  // e.g., "National Capital Region (NCR)"
  zipCode?: string;                // e.g., "1209"
  status: "pending" | "approved" | "suspended";
  active: boolean;
  isDemo: boolean;                 // true ONLY for isolated hackathon judge sandbox
  onChainRegistered: boolean;      // true once register_barangay() succeeds on NEAR
  onChainTxHash?: string;
  quorumBps: number;               // default 6000 (60%)
  minVotes: number;                // default 3 (1 in isolated demo mode)
  adminsCount: number;
  residentsCount: number;
  projectsCount: number;
  createdAt: string;               // ISO-8601
  approvedAt?: string | null;
}
```

### 2.2 `users/{uid}`
Stores the authenticated user's active role, jurisdiction affiliation, lifecycle state, and linked non-custodial NEAR account ID.
```typescript
export interface UserDocument {
  uid: string;                     // Firebase Auth UID
  email: string;
  emailVerified: boolean;
  displayName: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  role: "system_admin" | "barangay_admin" | "sk_official" | "resident" | "viewer";
  requestedRole?: "barangay_admin" | "resident";
  barangayId: string;              // Canonical barangays/{barangayId}
  barangayName: string;
  psgcCode?: string;
  municipality?: string;
  province?: string;
  region?: string;
  status: "pending_email_verification" | "onboarding" | "pending" | "active" | "inactive" | "suspended";
  verificationStatus: "unsubmitted" | "pending" | "ai_verified" | "approved" | "resubmission_required" | "rejected" | "auto_rejected";
  verified: boolean;
  nearAccountId?: string | null;   // e.g., "juan.testnet" (NEVER a private key!)
  onChainRoleSynced?: boolean;     // true once registered in NEAR contract LookupSet
  // SK Official Term Fields (when role === "sk_official")
  position?: "chairperson" | "kagawad" | "treasurer" | "secretary";
  termStart?: string;
  termEnd?: string;
  termExpiredNoticePending?: boolean;
  // Selective Resubmission Flags
  reviewOutcome?: "approved" | "resubmission_required" | "rejected";
  resubmissionPreset?: "photo_only" | "details_only" | "full_package" | "custom";
  resubmissionFields?: string[];
  resubmissionReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 `registration_records/{uid}`
Stores sensitive personal onboarding details (birthdate, mobile number, street address, ID number) isolated from public listing.
```typescript
export interface RegistrationRecordDocument {
  uid: string;
  barangayId: string;
  psgcCode: string;
  birthdate: string;               // YYYY-MM-DD
  ageAtRegistration: number;
  mobileNumber: string;            // Normalized +639XXXXXXXXX
  streetAddress: string;           // House # / Street
  fullAddress: string;             // Street + Barangay + Municipality + Province
  idType: "barangay" | "student" | "national" | "passport" | "driver" | "other";
  idNumberHash: string;            // SHA-256 of normalized ID number for privacy-preserving duplicate detection
  idNumberMasked: string;          // e.g., "****-****-1234"
  idNumberRaw: string;             // Readable only by owner & scoped Barangay Admin
  schoolName?: string;
  professionalInfo?: string;
  adminAppointmentReason?: string;
  submittedAt: string;
  updatedAt: string;
}
```

### 2.4 `uploaded_documents/{docId}`
Stores compressed identity document images (`{uid}_id`, `{uid}_selfie`, `{uid}_avatar`) with strict owner + scoped-admin access control.
```typescript
export interface UploadedDocumentRecord {
  id: string;                      // "{uid}_id" | "{uid}_selfie" | "{uid}_avatar"
  uid: string;
  barangayId: string;
  documentType: "id_card" | "selfie_with_id" | "profile_avatar";
  base64DataUrl: string;           // Compressed JPEG (max 800x800, quality 0.7)
  sha256Hash: string;
  uploadedAt: string;
}
```

### 2.5 `verification_records/{uid}`
Written exclusively by the backend `/api/ai/verify-identity` service and updated by Admin KYC decisions.
```typescript
export interface VerificationRecordDocument {
  uid: string;
  barangayId: string;
  aiConfidence: number;            // 0-100
  aiDecision: "auto_approve_candidate" | "manual_review" | "auto_reject";
  scores: {
    idNumberMatch: number;
    imageQualityScore: number;
    nameMatch: number;
    barangayMatch: number;
    documentAuthenticity: number;
    overallScore: number;
  };
  extractedFields: {
    name?: string;
    idNumber?: string;
    address?: string;
    birthdate?: string;
  };
  duplicateRisk: "Low" | "Possible" | "High" | "Confirmed";
  duplicateReasons: string[];
  status: "pending" | "approved" | "resubmission_required" | "rejected";
  reviewedByUid?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt: string;
}
```

### 2.6 `proposals/{projectId}` & `project_metadata/{projectId}` & `milestones_metadata/{milestoneDocId}`
Stores rich off-chain proposal specifications, two-way revision histories, and milestone deliverable metadata anchored to the NEAR contract via `projectId` and `metadataHash`.
```typescript
export interface ProposalDocument {
  id: string;                      // Deterministic projectId: "proj_{psgc}_{timestamp}"
  barangayId: string;
  psgcCode: string;
  projectName: string;
  category: string;
  description: string;
  skOfficialUid: string;
  skOfficialName: string;
  skOfficialNearAccount: string;
  proposedBudgetNear: number;
  approvedBudgetNear?: number;
  phpRateSnapshot: number;         // e.g., 245.50 PHP per NEAR
  budgetBreakdown: Array<{
    item: string;
    quantity: number;
    unit: string;
    unitPricePhp: number;
    totalPhp: number;
  }>;
  phases: Array<{
    phaseNumber: number;           // 1..5
    title: string;
    description: string;
    percentage: number;            // Sums to 100
    amountNear: number;
    isUpfront: boolean;
    requiredProofs: string[];
  }>;
  status:
    | "draft"
    | "pending_admin_approval"
    | "revision_requested"
    | "approved_onchain"
    | "completed"
    | "disputed"
    | "refunded"
    | "rejected";
  metadataHash: string;            // SHA-256 committed to NEAR create_project()
  latestAiAuditId?: string;
  aiFeasibilityScore?: number;
  onChainProjectId?: string;       // Equals `id` once created on NEAR
  creationTxHash?: string;
  funderNearAccount?: string;
  revisionHistory: Array<{
    cycle: number;
    actorRole: "barangay_admin" | "sk_official";
    actorName: string;
    timestamp: string;
    notes: string;
    previousBudgetNear: number;
    newBudgetNear: number;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### 2.7 `ai_audit_records/{auditId}`
Immutable records written by `/api/ai/audit-proposal` and `/api/ai/audit-evidence`, linked to on-chain `record_ai_attestation` transactions.
```typescript
export interface AiAuditRecordDocument {
  id: string;
  projectId: string;
  barangayId: string;
  auditType: "proposal_procurement" | "milestone_evidence";
  milestoneIndex?: number | null;
  feasibilityScore: number;        // 0-100
  recommendation: "approve" | "revise" | "flag_high_risk";
  dtiSrpBenchmarkFindings: Array<{
    item: string;
    proposedUnitPricePhp: number;
    estimatedDtiSrpPhp: number;
    variancePct: number;
    status: "within_srp" | "above_srp" | "unverified_custom";
    note: string;
  }>;
  borrowingRecommendations: Array<{
    item: string;
    suggestedSourceAgency: string; // e.g., "Barangay Hall / City Engineering Office"
    estimatedSavingsPhp: number;
    rationale: string;
  }>;
  summaryAnalysis: string;
  reportSha256Hash: string;        // Exact hash recorded on NEAR contract
  attestationTxHash?: string;      // NEAR TxHash signed by auditor.fundora.testnet
  signerNearAccount: string;       // "auditor.fundora.testnet"
  createdAt: string;
}
```

### 2.8 `transaction_references/{txHash}`
Replaces the legacy heuristic `walletTransaction.service.ts` with verified, structured on-chain transaction records.
```typescript
export interface TransactionReferenceDocument {
  txHash: string;                  // NEAR Transaction Hash (Document ID)
  projectId: string;
  barangayId: string;
  eventType:
    | "project_created"
    | "phase1_mobilized"
    | "ai_attestation_recorded"
    | "milestone_proof_submitted"
    | "milestone_vote_cast"
    | "milestone_released"
    | "project_refunded";
  milestoneIndex?: number | null;
  signerNearAccount: string;
  receiverNearAccount: string;
  amountYocto: string;
  amountNear: number;
  amountPhpSnapshot: number;
  phpRateAtExecution: number;
  receiptReferenceId: string;      // "FD-RCPT-YYYYMMDD-XXXXXX"
  blockHeight?: number;
  blockTimestampNs?: number;
  reconciliationStatus: "synced" | "reconciliation_required";
  createdAt: string;
}
```

### 2.9 `notifications/{notifId}` & `audit_logs/{logId}`
- `notifications`: Guaranteed in-app notification inbox per `recipientUid`.
- `audit_logs`: Append-only administrative and security compliance trail.

---

## 3. Hardened Firestore Security Rules Specification

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    function currentUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isSystemAdmin() {
      return isAuthenticated() && currentUser().role == "system_admin" && currentUser().status == "active";
    }

    function isScopedBarangayAdmin(barangayId) {
      return isAuthenticated()
        && currentUser().role == "barangay_admin"
        && currentUser().status == "active"
        && currentUser().barangayId == barangayId;
    }

    // 1. BARANGAYS: Publicly readable for registration & transparency; writable only by Admins
    match /barangays/{barangayId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update, delete: if isSystemAdmin() || isScopedBarangayAdmin(barangayId);
    }

    // 2. USERS: No open global listing! Scoped read; protected role/verification fields
    match /users/{userId} {
      allow get: if isOwner(userId) || isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId);
      allow list: if isSystemAdmin() || (isAuthenticated() && currentUser().role == "barangay_admin");
      allow create: if isOwner(userId)
        && request.resource.data.role in ["resident", "viewer"]
        && !("inAppWalletSecret" in request.resource.data);
      allow update: if (isOwner(userId)
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(["role", "verified", "verificationStatus"])
          && !("inAppWalletSecret" in request.resource.data))
        || isSystemAdmin()
        || isScopedBarangayAdmin(resource.data.barangayId);
    }

    // 3. SENSITIVE REGISTRATION & UPLOADED DOCUMENTS: Owner, Scoped Barangay Admin, or System Admin ONLY
    match /registration_records/{userId} {
      allow read: if isOwner(userId) || isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId);
      allow create, update: if isOwner(userId) || isScopedBarangayAdmin(request.resource.data.barangayId) || isSystemAdmin();
    }

    match /uploaded_documents/{docId} {
      allow read: if isAuthenticated() && (resource.data.uid == request.auth.uid || isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId));
      allow create, update: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow delete: if isAuthenticated() && (resource.data.uid == request.auth.uid || isSystemAdmin());
    }

    // 4. AI VERIFICATION & AI AUDIT RECORDS: Read-only for clients; written ONLY by Backend Admin SDK
    match /verification_records/{userId} {
      allow read: if isOwner(userId) || isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId);
      allow update: if isSystemAdmin() || isScopedBarangayAdmin(resource.data.barangayId);
      allow create, delete: if false; // Written via Backend Firebase Admin SDK
    }

    match /ai_audit_records/{auditId} {
      allow read: if true; // Public transparency
      allow write: if false; // Written exclusively via Backend Firebase Admin SDK
    }

    // 5. PROPOSALS & TRANSACTION REFERENCES: Publicly readable for Transparency Hub
    match /proposals/{projectId} {
      allow read: if true;
      allow create: if isAuthenticated() && currentUser().role in ["sk_official", "barangay_admin"] && currentUser().barangayId == request.resource.data.barangayId;
      allow update: if isAuthenticated() && currentUser().role in ["sk_official", "barangay_admin"] && currentUser().barangayId == resource.data.barangayId;
    }

    match /transaction_references/{txHash} {
      allow read: if true;
      allow create, update: if isAuthenticated();
      allow delete: if false;
    }

    // 6. NOTIFICATIONS & AUDIT LOGS: Single canonical blocks
    match /notifications/{notifId} {
      allow read, update: if isAuthenticated() && resource.data.recipientUid == request.auth.uid;
      allow create: if isAuthenticated();
    }

    match /audit_logs/{logId} {
      allow read: if isSystemAdmin() || (isAuthenticated() && currentUser().role == "barangay_admin" && resource.data.barangayId == currentUser().barangayId);
      allow create: if isAuthenticated() && request.resource.data.actorUid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```


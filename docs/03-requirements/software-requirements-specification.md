# Fundora — Software Requirements Specification (SRS)

**Document ID:** `FD-SDLC-03`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Product Name:** **Fundora**

---

## 1. Introduction & Conventions

This Software Requirements Specification (SRS) defines the formal functional, non-functional, role-permission, business-rule, data, security, integration, and error-recovery requirements for **Fundora**.

Every requirement is assigned:
- **Unique ID:** `FR-*` (Functional), `NFR-*` (Non-Functional), `BR-*` (Business Rule), `DR-*` (Data), `SR-*` (Security), `IR-*` (Integration), `ERR-*` (Error & Recovery).
- **Priority:** `P0` (Critical for Hackathon MVP), `P1` (Important for Hackathon Polish), `P2` (Post-MVP / Stretch Goal).
- **Acceptance Criteria:** Testable conditions required for sign-off.
- **Dependencies:** Upstream components or requirements.

---

## 2. User Roles and Permission Matrix

Fundora enforces five distinct user roles plus one automated agent role across two enforcement boundaries: **Authoritative On-Chain RBAC (NEAR Smart Contract)** and **Supporting Off-Chain RBAC (Firebase Auth + Firestore Rules)**.

| Role ID | Display Name | Age / Eligibility Rule | Off-Chain Permissions (Firestore / API) | On-Chain Permissions (NEAR Contract) |
| :--- | :--- | :--- | :--- | :--- |
| `system_admin` | System Administrator | Platform operator | Approve initial `barangay_admin` requests; activate `barangays`; view global compliance logs. | Call `register_barangay`, `set_barangay_admin`, `set_auditor_account`, `pause_barangay`. |
| `barangay_admin` | Barangay Admin (Secretariat) | Verified LGU / Barangay official bound to one `barangayId` | Review resident KYC & trigger selective resubmissions; appoint/revoke SK officials; review/return proposals; inspect private milestone proofs. | Call `register_verified_resident`, `revoke_resident`, `set_sk_official`, `revoke_sk_official`, `create_project` (attaching NEAR escrow), `refund_project`, `resolve_dispute`. |
| `sk_official` | SK Official | Verified youth council official (15–30) with active term in `barangayId` | Create/revise project proposals; request AI procurement audits; upload milestone evidence & additional private deliverables. | Receive Phase 1 mobilization & approved milestone payouts; call `submit_milestone_proof`. |
| `resident` | Verified Youth Resident | Verified resident aged **15–30** (R.A. 10742) in `barangayId` | View barangay projects, AI audit reports, and public proofs; submit community feedback. | Call `vote_milestone(project_id, milestone_idx, approve)` (1 vote per milestone per resident in matching `barangay_id`). |
| `viewer` | Public Guest / Adult Resident | Unauthenticated visitor OR registered resident aged **> 30** | Read-only access to Public Transparency Hub, project progress, AI audit summaries, and transaction-linked digital receipts. | Read-only NEAR RPC `view` calls (`get_project`, `get_barangay`, `get_projects_by_barangay`). Cannot vote or mutate state. |
| `ai_auditor` | AI Auditor Agent (`auditor.fundora.testnet`) | Backend service account | Write immutable `ai_audit_records` and `verification_records` via Firebase Admin SDK. | Call `record_ai_attestation(project_id, target_type, milestone_idx, report_hash, score, recommendation)`. |

---

## 3. Functional Requirements (`FR`)

### 3.1 Guided Step-by-Step Registration & Onboarding (`FR-REG`)

| ID | Description | Priority | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `FR-REG-01` | **5-Pill Guided Registration Wizard:** The system shall preserve the multi-step registration wizard (`1. Account` [`LoginStep`], `2. Role / LGU` [`RoleLGUStep`], `3. Identity` [`DetailsStep`], `4. Details` [`AddInfoStep`], `5. Docs` [`UploadsStep`], followed by `VerificationLoadingTimeline` and `SuccessStep`). | `P0` | User can navigate forward/backward through all wizard steps; step validation prevents advancing with missing required fields; progress bar highlights current/completed steps. | Firebase Auth, Firestore |
| `FR-REG-02` | **Email Verification Gate:** Upon completing Step 1 (`email` + `password`), the system shall send a Firebase verification email, create an initial profile with `status: "pending_email_verification"`, and display `VerifyEmailView` until verified, after which status transitions to `"onboarding"` at Step 3 (`RoleLGUStep`). | `P0` | Unverified users cannot bypass `VerifyEmailView`; clicking `"I Verified My Email"` refreshes auth state and transitions to Step 3 (`2. Role / LGU`). | `FR-REG-01`, Firebase Auth |
| `FR-REG-03` | **Role-Specific Geographic & Barangay Selection:** In `RoleLGUStep`, selecting `"resident"` shall cascade `Region` $\rightarrow$ `Province` $\rightarrow$ `City/Municipality` $\rightarrow$ `Barangay` filtered to active/approved barangays in Firestore; selecting `"barangay_admin"` shall query the PSGC hierarchy (`psgc.cloud/api` with NCR fallback and local static fallback) and store the canonical `psgcCode` and barangay name. | `P0` | Resident cannot register for an unapproved barangay; Barangay Admin can select any Philippine barangay including NCR cities (where `provinces` is empty); `psgcCode` is persisted. | `FR-REG-02`, PSGC Service |
| `FR-REG-04` | **Age-Bracket Eligibility Enforcement:** During profile submission, the system shall compute age from `birthdate`: applicants with `age < 15` for `resident` are rejected with a clear error; applicants with `15 <= age <= 30` proceed as `resident`; applicants with `age > 30` are automatically assigned `role: "viewer"` with read-only transparency access. | `P0` | Unit and E2E tests confirm `<15` is blocked, `15–30` enters resident KYC queue, and `>30` becomes an active `viewer` without voting rights. | `FR-REG-01` |
| `FR-REG-05` | **Server-Side AI Identity Verification & Typo Suggestion:** In `UploadsStep`, compressed ID/selfie/profile images shall be submitted to the backend verification service, which runs duplicate checks and Gemini OCR rubric scoring, returning progress to `VerificationLoadingTimeline` and offering one-click fuzzy typo corrections (`address`, `name`, `idNumber`). | `P0` | No Gemini API key is used in browser network requests; confidence $< 50$ triggers clean rollback/resubmission notice; fuzzy matches ($50\%–99\%$) render selectable typo correction cards. | Backend Verification API |
| `FR-REG-06` | **Selective Resubmission Mode:** When an admin flags a registration with `reviewOutcome: "resubmission_required"` using a preset (`photo_only`, `details_only`, `full_package`, `custom`), `AuthPage` shall prefill existing profile data and only require/display wizard steps containing the flagged `resubmissionFields`. | `P0` | Flagging `photo_only` skips `RoleLGUStep`, `DetailsStep`, and `AddInfoStep` and opens `UploadsStep` directly for photo replacement. | `FR-REG-01`, `FR-KYC-01` |

### 3.2 KYC Review, SK Appointment & Barangay Governance (`FR-KYC`)

| ID | Description | Priority | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `FR-KYC-01` | **Scoped Resident KYC Desk:** Barangay Admins shall view pending resident registrations exclusively within their `barangayId`, inspect uploaded ID/avatar documents, AI confidence breakdowns, and duplicate risk badges, and execute `Approve`, `Request Resubmission`, or `Reject`. | `P0` | Approving a resident with a linked NEAR account registers their `AccountId` in the NEAR contract's `verified_residents` set for that `barangayId`. | `FR-REG-05`, NEAR Contract |
| `FR-KYC-02` | **System Admin Barangay Activation:** System Admins shall review initial `barangay_admin` applications, verify their official appointment credentials, activate the Barangay (`status: "approved"`, `active: true`) in Firestore, and register the `barangay_id` and admin `AccountId` on the NEAR contract. | `P0` | Activated barangay immediately appears in the `RoleLGUStep` resident dropdown and exists in the NEAR contract's `barangays` registry. | NEAR Contract |
| `FR-KYC-03` | **SK Official Appointment & Term Lifecycle:** Barangay Admins shall appoint verified residents (`15–30`) to SK Council positions (`Chairperson`, `Kagawad`, `Treasurer`, `Secretary`) with a `termEnd` date and register their NEAR `AccountId` via `set_sk_official`. Upon `termEnd` expiration, the user is shown `ExpiredNoticeView` and transitioned back to `resident`. | `P0` | Appointed user gains access to `SKWorkspace` and on-chain `sk_officials` permissions; expired user is gracefully demoted on acknowledgment. | `FR-KYC-01`, NEAR Contract |

### 3.3 Proposal Creation, AI Procurement Audit & Two-Way Revision (`FR-PROP`)

| ID | Description | Priority | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `FR-PROP-01` | **Multi-Phase Proposal Authoring:** SK Officials shall create project proposals specifying `projectName`, `category`, `description`, itemized `budgetBreakdown`, `proposedBudgetNear` (with live PHP equivalent), and $2\text{–}5$ milestone release phases (`percentage` summing to $100\%$, `title`, `description`, and `requiredProofs`). | `P0` | Form blocks submission if phase percentages do not sum to $100\%$ or budget is $\le 0$; pre-generates a deterministic `projectId`. | `FR-KYC-03` |
| `FR-PROP-02` | **Server-Side AI Procurement & Borrowing Advisor:** SK Officials and Barangay Admins shall trigger an AI procurement audit via `/api/ai/audit-proposal`, which benchmarks itemized costs against DTI Suggested Retail Prices (SRP), identifies free LGU/inter-agency equipment-borrowing opportunities, returns a structured feasibility score ($0\text{–}100$), and records an on-chain attestation via `auditor.fundora.testnet`. | `P0` | Audit report displays DTI price warnings, borrowing recommendations, suggested budget adjustment, and a verified NEAR `transaction_hash` from `auditor.fundora.testnet`. | Backend AI API, NEAR Contract |
| `FR-PROP-03` | **Two-Way Proposal Revision & Diff History:** Barangay Admins shall be able to return a proposal for revision (`status: "revision_requested"`) with line-item edits and notes; SK Officials can accept or counter-edit and resubmit, preserving an immutable `revisionHistory` array viewable via `ProposalDiffModal`. | `P1` | Both Admin and SK Official can open `ProposalDiffModal` and inspect side-by-side changes across revision cycles before on-chain funding. | `FR-PROP-01` |

### 3.4 NEAR Programmable Escrow, Milestone Proofs & Community Voting (`FR-ESC`)

| ID | Description | Priority | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `FR-ESC-01` | **Escrow Creation & Upfront Phase 1 Mobilization:** When a Barangay Admin approves a proposal in `AdminPanel`, the system shall invoke `create_project` on the NEAR contract via NEAR Wallet Selector, attaching the full approved budget in native `NEAR` (`yoctoNEAR`). If Phase 1 is designated as upfront mobilization, the contract immediately transfers Phase 1 funds to the `sk_official` NEAR account and locks the remaining tranches. | `P0` | Contract verifies attached deposit equals total budget + storage buffer; Phase 1 transfers to `sk_official`; remaining balance stays locked in contract; Firestore stores `onChainProjectId` and `creationTxHash`. | `FR-PROP-01`, NEAR Wallet Selector |
| `FR-ESC-02` | **Milestone Evidence Submission & AI Evidence Pre-Audit:** For subsequent phases, the SK Official shall upload public proof deliverables (receipts, site photos, summary notes) and optional private admin deliverables, trigger `/api/ai/audit-evidence`, and call `submit_milestone_proof(project_id, milestone_idx, proof_cid_or_hash)` on the NEAR contract to open community voting. | `P0` | Contract transitions milestone status from `Pending` (`0`) to `SubmittedForVote` (`1`); AI evidence audit score and hash are visible to residents and admins. | `FR-ESC-01`, Backend AI API |
| `FR-ESC-03` | **Sybil-Resistant Community Quorum Voting:** Verified Youth Residents in the project's `barangayId` shall cast `Approve` or `Reject` votes via `vote_milestone` on the NEAR contract. The contract enforces 1 vote per resident per milestone, checks that the voter is in `verified_residents` for that `barangay_id`, and evaluates quorum (`total_votes >= min_votes` and `votes_approve / total_votes >= quorum_bps`). | `P0` | Unverified or cross-barangay wallets are rejected by the contract with an explicit panic; duplicate votes by the same resident are rejected; meeting approval quorum automatically releases the milestone's locked `yoctoNEAR` to `sk_official`. | `FR-ESC-02`, `FR-KYC-01` |
| `FR-ESC-04` | **Treasury Refund on Milestone Rejection:** If rejection votes reach the rejection threshold or the Barangay Admin cancels a failed/rejected project, calling `refund_project(project_id)` on the NEAR contract shall transfer all remaining locked `yoctoNEAR` strictly back to `project.funder_treasury` (the Barangay Admin treasury account). | `P0` | Remaining escrow balance returns to `funder_treasury` (never to `sk_official`); project status transitions to `Refunded` (`3`); NEP-297 `project_refunded` event is emitted. | `FR-ESC-03` |

### 3.5 Transparency Hub, QR Flows & Transaction-Linked Digital Receipts (`FR-TRAN`)

| ID | Description | Priority | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| `FR-TRAN-01` | **Public Transparency Hub:** Unauthenticated visitors, `viewer` users, and residents shall access a public dashboard displaying barangay treasury stats, active/completed projects, milestone progress bars, AI procurement/evidence audit badges, and direct links to NearBlocks Testnet. | `P0` | Loads without requiring wallet connection; accurately reflects on-chain NEAR contract state via RPC `view` calls. | NEAR RPC |
| `FR-TRAN-02` | **Transaction-Linked Digital Receipts (Modal & PDF):** Every on-chain financial or governance action (Escrow Funded, Phase 1 Mobilized, Milestone Released, Vote Cast, Escrow Refunded) shall generate a downloadable PDF and interactive receipt containing a deterministic Receipt ID (`FD-OR-YYYYMMDD-XXXXXX`), SHA-256 verification hash, NEAR `transaction_hash`, `yoctoNEAR` + PHP amount, and a scannable QR code linking to the NearBlocks Testnet transaction. | `P0` | Receipt displays real on-chain data (zero fabricated fallback numbers) and uses honest terminology ("Transaction-Linked Digital Receipt — Cryptographically Verifiable on NEAR Testnet") without unverified statutory accreditation claims. | `FR-ESC-01`, `jsPDF`, `qrcode.react` |
| `FR-TRAN-03` | **Isolated Judge Demo Mode:** The platform shall provide a clearly labeled `"Judge Demo Mode"` banner/drawer restricted to an isolated demo jurisdiction (`Brgy. San Antonio (Demo)`, `barangayId: "brgy_demo_001"`), allowing hackathon judges to switch views (`Barangay Admin`, `SK Official`, `Youth Resident`, `Public Auditor`) and test the end-to-end lifecycle without polluting real barangay data. | `P1` | Demo mode mutations are strictly isolated to `brgy_demo_001`; production barangay registries remain unaffected. | All modules |

---

## 4. Non-Functional Requirements (`NFR`)

| ID | Category | Description | Target Metric / Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| `NFR-PERF-01` | Performance | NEAR RPC `view` state hydration and Firestore metadata merging shall complete rapidly on initial dashboard load. | Dashboard interactive within $< 2.5\text{ seconds}$ on standard broadband; RPC calls batched/cached with 10-second stale-while-revalidate. |
| `NFR-REL-01` | Reliability | Geographic PSGC selection during registration shall remain functional even if `https://psgc.cloud/api` experiences downtime. | Automatic fallback to bundled static PSGC hierarchy dataset within $3\text{ seconds}$ of API timeout. |
| `NFR-SEC-01` | Security | Zero client-side secret exposure. | Build artifact (`dist/`) contains zero occurrences of `GEMINI_API_KEY`, private keys (`ed25519:`), or Firebase Admin credentials. |
| `NFR-USAB-01` | Usability | Non-technical community members must understand all financial and blockchain states. | All NEAR amounts display alongside `≈ ₱X,XXX.XX PHP`; transaction states show human-readable banners (`Submitted`, `Pending`, `Successful`, `Failed`, `Reconciliation Required`). |
| `NFR-COMP-01` | Responsiveness | Dual-theme (Dark/Light) responsive layout supporting mobile phones (field officials/youth) and desktop workstations (secretariat). | Zero horizontal overflow from `360px` mobile width through `1920px` desktop width. |

---

## 5. Business Rules (`BR`), Data (`DR`), Security (`SR`), Integration (`IR`) & Error Recovery (`ERR`)

- **`BR-01` (Statutory Youth Voting Age):** Under R.A. 10742, only verified residents aged **15 to 30 years old** inclusive at the time of registration/verification are eligible for the `resident` voting role.
- **`BR-02` (100% Milestone Allocation):** The sum of all milestone phase percentages in a proposal must equal exactly `100%` (`10000` basis points), and the sum of phase `yoctoNEAR` allocations must equal `total_budget_yocto`.
- **`BR-03` (Human-in-the-Loop AI Authority):** The AI Auditor (`auditor.fundora.testnet`) provides advisory risk scores, DTI SRP comparisons, and on-chain attestations, but **never autonomously confiscates funds or executes unilateral payouts** without human Barangay Admin funding or Resident Quorum approval.
- **`DR-01` (Source of Truth Boundary):** The NEAR smart contract is the sole source of truth for escrow balances, milestone statuses, vote tallies, and on-chain role permissions. Firestore is the source of truth for off-chain prose descriptions, itemized tables, revision diffs, and KYC documents.
- **`SR-01` (PII Isolation):** Uploaded ID photos (`uploaded_documents`) and detailed OCR outputs (`verification_records`) shall only be readable by the document owner, the scoped `barangay_admin` of that user's `barangayId`, and `system_admin`.
- **`IR-01` (Deterministic Project IDs):** Before invoking `create_project` on NEAR, the application uses the canonical Firestore `proposal.id` (or deterministic `proj_{psgc}_{timestamp}`) as the on-chain `project_id` argument so both systems share an immutable primary key prior to transaction broadcast.
- **`ERR-01` (Reconciliation Required State):** If an on-chain NEAR transaction succeeds (`FinalExecutionOutcome` status `SuccessValue`), but the subsequent Firestore metadata update fails (e.g., network drop), the client persists the pending `txHash` in local recovery storage and displays a `"Reconciliation Required — Sync On-Chain State"` banner that re-queries NEAR RPC and updates Firestore idempotently.


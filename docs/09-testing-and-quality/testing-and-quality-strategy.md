# Fundora — Testing & Quality Assurance Strategy

**Document ID:** `FD-SDLC-09`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Product Name:** **Fundora**

---

## 1. Quality Assurance Philosophy & Legacy Remediation

In [`barangay-bond`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/test.rs#L51-L294), the smart contract test suite (`test.rs`) was completely out of sync with `lib.rs` (calling `create_project` with 6 arguments instead of 7 and expecting a 2-vote quorum when `lib.rs` hardcoded 1 vote), and there were zero automated tests for Firestore rules, registration flows, or AI schema validation.

In **Fundora**, every architectural boundary is backed by automated, measurable verification gates before hackathon submission.

---

## 2. Multi-Layer Testing Matrix

| Test Layer | Tooling / Framework | Scope | Target Coverage / Gate |
| :--- | :--- | :--- | :--- |
| **1. Smart Contract Unit Tests** | `cargo test` (`near-sdk::testing_env!`) | Synchronous state logic, RBAC assertions, multi-barangay isolation, deterministic `project_id`, quorum math, refund routing. | 100% of public contract methods (`>= 15` unit tests). |
| **2. Smart Contract Sandbox Integration Tests** | `near-workspaces` (Rust / TypeScript) | Real WASM compilation, cross-account native NEAR transfers, `Promise` callbacks (`on_transfer_complete`, `on_refund_complete`), storage staking. | Full multi-account lifecycle tested on local NEAR Sandbox. |
| **3. Firestore Security Rules Tests** | `@firebase/rules-unit-testing` + Firestore Emulator | Verify `users` list protection, `registration_records` PII isolation, `ai_audit_records` client-write denial, and cross-barangay admin isolation. | 100% pass on allow/deny security matrix. |
| **4. Frontend Unit & Component Tests** | `Vitest` + `@testing-library/react` | Registration field normalization, age-bracket routing (`<15`, `15–30`, `>30`), PSGC cascading & NCR fallback, selective resubmission field filtering, NEAR/PHP formatting. | All critical utilities and registration steps covered. |
| **5. Backend AI & Verification API Tests** | `Vitest` (Node environment) | Schema validation (`ProposalAuditResult`, `EvidenceAuditResult`, `VerificationRecord`), prompt-injection sanitization, deterministic fallback when Gemini API is unreachable, `auditor.fundora.testnet` attestation signing. | 100% schema conformance under normal and fallback modes. |
| **6. End-to-End (E2E) Workflow & Demo Tests** | `Playwright` / Guided E2E Checklist | Full user journeys across Registration, Admin KYC, Proposal AI Audit, NEAR Wallet Selector Escrow Funding, Milestone Proof, Community Quorum Voting, Treasury Refund, and PDF Receipt generation. | Zero blocking defects across all 14 E2E acceptance scenarios. |

---

## 3. Detailed Test Specifications by Domain

### 3.1 NEAR Smart Contract Test Suite (`contracts/fundora-escrow/tests/`)
1. **`test_multi_barangay_isolation`:** Register `brgy_makati_belair` (Admin A, Resident A1) and `brgy_taguig_fort` (Admin B, Resident B1). Verify Admin A cannot create projects or verify residents in `brgy_taguig_fort`, and Resident A1 cannot vote on `brgy_taguig_fort` projects.
2. **`test_voter_eligibility_strict_default_false`:** Verify an unregistered wallet calling `vote_milestone` panics with `ERR_NOT_VERIFIED_RESIDENT` (preventing the legacy `unwrap_or(true)` bug).
3. **`test_configurable_quorum_and_min_votes`:** Configure `min_votes = 3`, `quorum_bps = 6000`. Verify that 1 or 2 `approve` votes do **not** release funds; when the 3rd resident votes (`2 approve`, `1 reject` = `66.66% >= 60%`), the milestone transitions to `ApprovedAndReleased` and transfers exact `yoctoNEAR` to `sk_official`.
4. **`test_treasury_refund_to_funder_not_sk`:** Create a `10 NEAR` project (`4 NEAR` upfront Phase 1 to `sk_official`, `6 NEAR` locked for Phase 2). Have 3 residents vote `reject` on Phase 2. Call `refund_project` and assert that `project.funder_treasury` (Barangay Admin) receives the `6 NEAR` refund while `sk_official` receives `0 NEAR` from the refund.
5. **`test_deterministic_project_id_uniqueness`:** Verify `create_project("proj_001", ...)` succeeds once and a second call with `"proj_001"` panics with `ERR_DUPLICATE_PROJECT_ID`.
6. **`test_ai_attestation_authorization`:** Verify only `auditor.fundora.testnet` can invoke `record_ai_attestation`, and the recorded SHA-256 `report_hash` and `feasibility_score` are retrievable via `get_ai_attestations(project_id)`.

### 3.2 Authentication, Step-by-Step Registration & Geographic Data Tests
1. **`test_step_by_step_wizard_progression`:** Verify that `AuthPage` enforces step order (`Step 1 Account` $\rightarrow$ `VerifyEmailView` $\rightarrow$ `Step 3 Role/LGU` $\rightarrow$ `Step 4 Identity` $\rightarrow$ `Step 5 Details` $\rightarrow$ `Step 6 Docs` $\rightarrow$ `VerificationLoadingTimeline` $\rightarrow$ `Step 7 Success`).
2. **`test_psgc_cascading_and_ncr_special_case`:** Verify selecting `NCR` (`130000000`) in `RoleLGUStep` handles empty `provinces` by synthesizing `"Metro Manila"`, loads NCR cities, loads barangays, and records the 10-digit `psgcCode`.
3. **`test_psgc_offline_static_fallback`:** Simulate a network timeout on `https://psgc.cloud/api` and verify `usePsgcGeographicSelector` seamlessly switches to `psgcFallback.json` within $3\text{ seconds}$.
4. **`test_age_bracket_enforcement`:**
   - Birthdate yielding age `14` $\rightarrow$ Rejected with age validation error.
   - Birthdate yielding age `22` $\rightarrow$ Registered as `role: "resident"`, `status: "pending"`.
   - Birthdate yielding age `34` $\rightarrow$ Auto-routed to `role: "viewer"`, `status: "active"`, `verified: true`.
5. **`test_selective_resubmission_presets`:** Verify [`getResubmissionFieldsForPreset()`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/utils/reviewDecision.ts#L169-L174) for `photo_only`, `details_only`, `full_package`, and `custom`, and confirm `AuthPage` skips unflagged steps.

### 3.3 Wallet, Transaction Failure & Reconciliation Tests
1. **`test_no_private_keys_in_storage_or_firestore`:** Inspect Firestore writes and `localStorage` during wallet linking and signing to assert no `inAppWalletSecret` or Full-Access secret key is ever persisted.
2. **`test_reconciliation_required_recovery`:** Simulate a successful NEAR `create_project` transaction followed by an offline Firestore write failure. Verify the UI displays the `"Reconciliation Required"` banner and that clicking `"Sync State"` queries NEAR RPC `get_project(project_id)` and completes the Firestore update.
3. **`test_digital_receipt_accuracy`:** Generate a receipt (`ReceiptModal` and `receiptPdfGenerator`) for an on-chain transaction and verify the `txHash`, `yoctoNEAR` amount, PHP snapshot equivalent, SHA-256 integrity hash, and NearBlocks Testnet QR URL match the actual transaction without fabricated fallback constants.

### 3.4 Isolated Judge Demo Environment Tests
1. **`test_demo_sandbox_isolation`:** Execute Demo Mode role switches (`Demo Admin`, `Demo SK`, `Demo Resident`) in `brgy_demo_001` and verify that no documents or on-chain records in non-demo barangays are modified.


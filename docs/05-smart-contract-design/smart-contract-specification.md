# Fundora — NEAR Smart Contract Design Specification (`near-sdk-rs`)

**Document ID:** `FD-SDLC-05`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Target SDK:** `near-sdk = "5.6.0"` (Rust `wasm32-unknown-unknown`)  
**Target Network:** NEAR Testnet (`contract.fundora.testnet`)

> [!IMPORTANT]
> This document is the formal architectural and specification blueprint for the Fundora smart contract. Per SDLC governance rules, no production `.rs` implementation code is compiled or deployed until planning approval is granted.

---

## 1. Design Objectives & Legacy Remediation

The Fundora NEAR smart contract is designed from the ground up to remediate every smart contract defect discovered in [`contracts/contracts/barangay-bond/src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs):

| Legacy Soroban Flaw | Fundora NEAR Contract Specification Fix |
| :--- | :--- |
| Single global `DataKey::Admin` ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L6-L15)) | Multi-tenant `LookupMap<BarangayId, BarangayConfig>` where each Barangay has its own scoped `admin_accounts`, `sk_officials`, `verified_residents`, and quorum settings. |
| Voter eligibility defaults to `true` (`unwrap_or(true)` at [`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L300)) | Strict allowlist membership check: `barangay.verified_residents.contains(&predecessor)` (defaults to `false`). Cross-barangay voting is impossible. |
| `create_project` never checks `IsSK(sk_official)` ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L137-L245)) | `create_project` explicitly asserts `barangay.sk_officials.contains(&sk_official)` and `barangay.admin_accounts.contains(&predecessor)`. |
| Hardcoded 1-vote quorum (`votes_approve >= 1` at [`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L357)) | Configurable per-barangay `min_votes: u32` ($\ge 3$ in production barangays; configurable for isolated demo barangay) and `quorum_bps: u16` (e.g., `6000` = 60.00%). |
| `refund_project` sends rejected escrow back to `sk_official` ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L419-L458)) | `Project` stores `funder_treasury: AccountId` (the Barangay Admin account that funded the escrow). `refund_project` transfers `remaining_balance` strictly back to `funder_treasury`. |
| Race-prone sequential `ProjectCount` ID ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L156)) | Caller supplies a deterministic, pre-generated `project_id: String` (matching the off-chain proposal ID). Contract enforces uniqueness. |

---

## 2. Contract State & Data Structures

### 2.1 Primary Contract State (`FundoraContract`)
- `system_admin: AccountId` — Platform administrator capable of activating new barangay jurisdictions and rotating the AI auditor account.
- `ai_auditor: AccountId` — Authorized NEAR account (`auditor.fundora.testnet`) permitted to call `record_ai_attestation`.
- `barangays: IterableMap<String, BarangayConfig>` — Keyed by canonical `barangay_id` (e.g., `"brgy_137602003"` or `"brgy_demo_001"`).
- `projects: IterableMap<String, Project>` — Keyed by deterministic `project_id`.
- `projects_by_barangay: LookupMap<String, Vector<String>>` — Index mapping `barangay_id` $\rightarrow$ list of `project_id`s.
- `ai_attestations: LookupMap<String, Vector<AiAttestation>>` — Keyed by `project_id`.

### 2.2 Barangay Jurisdiction State (`BarangayConfig`)
- `barangay_id: String` — Unique identifier.
- `psgc_code: String` — Official 10-digit Philippine Standard Geographic Code.
- `name: String` — Human-readable Barangay & Municipality name.
- `active: bool` — Emergency pause / activation flag.
- `is_demo: bool` — True only for isolated hackathon judge sandbox (`"brgy_demo_001"`).
- `quorum_bps: u16` — Approval ratio in basis points (default `6000` = 60%).
- `min_votes: u32` — Minimum total votes required to resolve a milestone (enforced $\ge 3$ for standard non-demo barangays; `1` strictly for isolated demo barangay `brgy_demo_001`).
- `admin_accounts: UnorderedSet<AccountId>` — Authorized Barangay Admin treasury accounts for this jurisdiction.
- `sk_officials: UnorderedSet<AccountId>` — Active SK Officials in this jurisdiction.
- `verified_residents: UnorderedSet<AccountId>` — Verified Youth Residents (15–30) eligible to vote in this jurisdiction.

### 2.3 Project & Milestone State (`Project`, `Milestone`)
- `project_id: String` — Pre-generated deterministic ID.
- `barangay_id: String` — Owning jurisdiction.
- `name: String` — Project title.
- `metadata_hash: String` — SHA-256 hash of the approved proposal specification in Firestore.
- `funder_treasury: AccountId` — The Barangay Admin `AccountId` that attached the NEAR escrow deposit (sole recipient of any future refund).
- `sk_official: AccountId` — The SK Official recipient of milestone payouts.
- `total_budget_yocto: NearToken` (`u128`) — Total escrow budget in `yoctoNEAR`.
- `remaining_balance_yocto: NearToken` (`u128`) — Currently locked balance remaining in escrow.
- `storage_deposit_reserved: NearToken` (`u128`) — Reserved storage stake (`0.05 NEAR`) so resident votes require `0 yoctoNEAR` attached deposit.
- `status: ProjectStatus` — `Active (0)` | `Completed (1)` | `Disputed (2)` | `Refunded (3)`.
- `current_milestone_idx: u32` — 1-based index of the active milestone.
- `quorum_bps: u16` — Snapshot of barangay `quorum_bps` at project creation.
- `min_votes: u32` — Snapshot of barangay `min_votes` at project creation.
- `milestones: Vec<Milestone>` — Ordered vector of $2\text{–}5$ phases:
  - `index: u32` (1-based)
  - `title: String`
  - `percentage_bps: u16` (sum across all milestones $= 10000$)
  - `amount_yocto: NearToken`
  - `is_upfront: bool` (`true` for Phase 1 mobilization)
  - `status: MilestoneStatus` — `Locked (0)` | `SubmittedForVote (1)` | `ApprovedAndReleased (2)` | `Rejected (3)` | `PayoutInFlight (4)`
  - `proof_hash: Option<String>` — SHA-256 hash / CID of submitted milestone deliverables.
  - `votes_approve: u32`
  - `votes_reject: u32`
  - `voters: UnorderedMap<AccountId, bool>` — Prevents double-voting and records each resident's choice.

### 2.4 AI Attestation Record (`AiAttestation`)
- `attestation_id: String`
- `project_id: String`
- `target_type: String` — `"proposal_procurement"` | `"milestone_evidence"`
- `milestone_idx: Option<u32>`
- `report_hash: String` — SHA-256 digest of the structured AI audit report in Firestore.
- `feasibility_score: u8` ($0\text{–}100$)
- `recommendation: String` — `"approve"` | `"revise"` | `"flag_high_risk"`
- `recorded_at_ns: u64` — `env::block_timestamp()`
- `signer: AccountId` — Verified `ai_auditor` account.

---

## 3. Contract Methods & Access Control Specification

### 3.1 Administrative & Role Management Methods
1. **`new(system_admin: AccountId, ai_auditor: AccountId) -> Self` (`#[init]`)**
   - Initializes the contract state and sets up the default isolated demo barangay (`"brgy_demo_001"`).
2. **`register_barangay(barangay_id: String, psgc_code: String, name: String, initial_admin: AccountId, quorum_bps: u16, min_votes: u32, is_demo: bool)`**
   - **Caller:** `system_admin`.
   - **Validation:** Asserts `quorum_bps >= 5000 && quorum_bps <= 10000`. If `!is_demo`, asserts `min_votes >= 3` (and `barangay_id != "brgy_demo_001"`). If `is_demo`, asserts `barangay_id == "brgy_demo_001"` and `min_votes >= 1`.
3. **`set_sk_official(barangay_id: String, account_id: AccountId, active: bool)`**
   - **Caller:** Scoped `BarangayAdmin` of `barangay_id` (or `system_admin`).
   - **Action:** Adds or removes `account_id` from `barangay.sk_officials` (used both for appointment and term expiration revocation).
4. **`register_verified_resident(barangay_id: String, account_id: AccountId, eligible: bool)`**
   - **Caller:** Scoped `BarangayAdmin` of `barangay_id` (or `system_admin`).
   - **Action:** Adds or removes `account_id` from `barangay.verified_residents`.

### 3.2 AI Attestation Method & Trust Boundary
5. **`record_ai_attestation(project_id: String, target_type: String, milestone_idx: Option<u32>, report_hash: String, feasibility_score: u8, recommendation: String)`**
   - **Caller:** Strictly `self.ai_auditor` (`auditor.fundora.testnet`).
   - **Honest Trust Boundary:** Recording an AI attestation on-chain proves **cryptographic provenance and non-repudiation**—that the authorized backend AI Auditor evaluated a specific proposal/milestone at a specific block timestamp and committed to `report_hash` and `feasibility_score`. It does **not** prove the AI model's real-world price estimate is infallible, which is why human Barangay Admin approval and Resident Quorum voting remain the binding execution gates.

### 3.3 Programmable Escrow & Governance Methods
6. **`#[payable] create_project(project_id: String, barangay_id: String, name: String, metadata_hash: String, sk_official: AccountId, milestones_input: Vec<MilestoneInput>, immediate_phase_1: bool)`**
   - **Caller:** Scoped `BarangayAdmin` of `barangay_id`.
   - **Validations:**
     - `!self.projects.contains_key(&project_id)`
     - `barangay.active == true`
     - `barangay.admin_accounts.contains(&predecessor)`
     - `barangay.sk_officials.contains(&sk_official)`
     - `milestones_input.len() >= 2 && milestones_input.len() <= 5`
     - Sum of `percentage_bps == 10000`
     - `env::attached_deposit() >= total_budget_yocto + STORAGE_RESERVE (0.05 NEAR)`
   - **Execution:**
     - Stores `funder_treasury = env::predecessor_account_id()`.
     - If `immediate_phase_1 == true`, marks Milestone #1 as `PayoutInFlight` and dispatches `Promise::new(sk_official).transfer(phase_1_amount).then(ext_self::on_transfer_complete(project_id, 1, phase_1_amount))`.
7. **`submit_milestone_proof(project_id: String, milestone_idx: u32, proof_hash: String)`**
   - **Caller:** `project.sk_official` (requires `0 yoctoNEAR` deposit; compatible with Function-Call Access Key).
   - **Validations:** `project.status == Active`, `milestone.status == Locked` (or re-opened after dispute), and previous milestone is `ApprovedAndReleased`.
   - **Action:** Sets `milestone.proof_hash = Some(proof_hash)` and `milestone.status = SubmittedForVote`.
8. **`vote_milestone(project_id: String, milestone_idx: u32, approve: bool)`**
   - **Caller:** Any `AccountId` registered in `barangay.verified_residents` for `project.barangay_id` (requires `0 yoctoNEAR` deposit; compatible with Function-Call Access Key).
   - **Validations:**
     - `barangay.verified_residents.contains(&predecessor)` (strictly panics if not registered).
     - `predecessor != project.sk_official` (proposer conflict-of-interest guard).
     - `!milestone.voters.contains_key(&predecessor)` (1-resident-1-vote).
     - `milestone.status == SubmittedForVote`.
   - **Quorum Resolution:**
     - Increments `votes_approve` or `votes_reject` and inserts `(predecessor, approve)` into `milestone.voters`.
     - Let `total_votes = votes_approve + votes_reject`.
     - If `total_votes >= project.min_votes`:
       - Approval ratio in bps: `approve_bps = (votes_approve * 10000) / total_votes`.
       - Rejection ratio in bps: `reject_bps = (votes_reject * 10000) / total_votes`.
       - If `approve_bps >= project.quorum_bps`: sets `milestone.status = PayoutInFlight`, deducts `milestone.amount_yocto` from `remaining_balance_yocto`, and executes `Promise::new(project.sk_official).transfer(milestone.amount_yocto).then(ext_self::on_transfer_complete(...))`.
       - Else if `reject_bps > (10000 - project.quorum_bps)`: sets `milestone.status = Rejected` and `project.status = Disputed`.
9. **`refund_project(project_id: String)`**
   - **Caller:** Scoped `BarangayAdmin` of `project.barangay_id` (or `project.funder_treasury`).
   - **Validations:** `project.status == Disputed` (or a milestone is `Rejected`) and `project.remaining_balance_yocto > 0`.
   - **Action:** Transfers `project.remaining_balance_yocto` strictly back to **`project.funder_treasury`** (never `sk_official`!) via `Promise::new(project.funder_treasury).transfer(amount).then(ext_self::on_refund_complete(project_id, amount))`.

---

## 4. Asynchronous Execution, Callbacks & Storage Staking

Because NEAR Protocol executes transfers asynchronously across shards using receipts, Fundora follows the **Checks-Effects-Interactions + Private Callback (`#[private]`)** pattern:
1. **Optimistic State Lock (`PayoutInFlight`):** Before dispatching `Promise::new(recipient).transfer(amount)`, the contract transitions the milestone to `PayoutInFlight` and decrements `remaining_balance_yocto` so re-entrant or concurrent calls cannot double-spend the tranche.
2. **Callback Verification (`#[private] on_transfer_complete`):** Inspects `env::promise_result(0)`.
   - If `PromiseResult::Successful(_)`: sets `milestone.status = ApprovedAndReleased`, advances `current_milestone_idx` (or marks `project.status = Completed` if final milestone), and emits the NEP-297 `milestone_released` event.
   - If `PromiseResult::Failed`: rolls back `remaining_balance_yocto += amount`, resets `milestone.status = SubmittedForVote`, and emits `transfer_failed_rollback`.
3. **Storage Staking Management:** Creating a project reserves `0.05 NEAR` (`50_000_000_000_000_000_000_000 yoctoNEAR`) inside the contract to cover the byte growth of resident votes in `milestone.voters`. When the project reaches `Completed` or `Refunded`, any unused storage reserve remains in the contract pool to subsidize future community votes.

---

## 5. NEP-297 Standard Event Logs

All state-mutating methods emit structured JSON events (`EVENT_JSON:{"standard":"fundora","version":"1.0.0","event":"...","data":[...]}`) for deterministic indexing and digital receipt verification:
- `barangay_registered`
- `role_updated`
- `ai_attestation_recorded`
- `project_created`
- `milestone_proof_submitted`
- `milestone_vote_cast`
- `milestone_released`
- `milestone_rejected`
- `project_refunded`

---

## 6. Smart Contract Threat Model & Test Scenarios

| Test ID | Scenario | Expected Contract Outcome |
| :--- | :--- | :--- |
| `SC-TEST-01` | Unverified wallet calls `vote_milestone` | Panics with `"ERR_NOT_VERIFIED_RESIDENT: Account is not a verified youth resident of this Barangay"`. |
| `SC-TEST-02` | Verified resident of `Barangay A` attempts to vote on a project in `Barangay B` | Panics with `"ERR_NOT_VERIFIED_RESIDENT"` due to per-barangay set isolation. |
| `SC-TEST-03` | Single resident votes `approve` when `min_votes == 3` | Vote is recorded (`votes_approve = 1`), milestone remains `SubmittedForVote`, no funds are transferred. |
| `SC-TEST-04` | 3 residents vote (`2 approve`, `1 reject` = `66.66% >= 60%`) when `min_votes == 3` | Quorum met; Milestone transitions to `ApprovedAndReleased` and `sk_official` balance increases by `milestone.amount_yocto`. |
| `SC-TEST-05` | 3 residents vote `reject` and Barangay Admin calls `refund_project` | Remaining locked escrow is transferred back to `project.funder_treasury` (Barangay Admin), NOT `sk_official`. |
| `SC-TEST-06` | Duplicate `project_id` submitted to `create_project` | Panics with `"ERR_DUPLICATE_PROJECT_ID"`. |
| `SC-TEST-07` | Non-auditor account calls `record_ai_attestation` | Panics with `"ERR_UNAUTHORIZED_AUDITOR"`. |

---

## 7. Phase 2 Implementation & Verification Record

- **Implementation Crate:** [`contracts/fundora-escrow`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/Cargo.toml) (`near-sdk = "5.6.0"`, resolved to `5.30.1`, Rust `1.95.0`).
- **Implemented Modules:**
  - [`src/errors.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/errors.rs) — Deterministic error codes (`ERR_*`).
  - [`src/models.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/models.rs) — `ProjectStatus` (`Active`, `PayoutInFlight`, `Completed`, `Disputed`, `RefundInFlight`, `Refunded`, `ReconciliationRequired`), `MilestoneStatus` (`Pending`, `SubmittedForVote`, `PayoutInFlight`, `Completed`, `Rejected`, `Failed`, `ReconciliationRequired`), `BarangayConfig`, `BarangayView`, `MilestoneInput`, `Milestone`, `Project`, `AiAttestation`.
  - [`src/events.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/events.rs) — NEP-297 `EVENT_JSON` emitter.
  - [`src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/lib.rs) — Complete `FundoraContract` implementation including `retry_failed_milestone_payout` and `retry_failed_refund` recovery methods and configurable `2..=5` milestone splits (`percentage_bps` summing to `10000`, natively supporting both `40/40/20` and `40/30/30`).
- **Compiled WASM Artifact:**
  - Path: `contracts/fundora-escrow/target/wasm32-unknown-unknown/release/fundora_escrow.wasm`
  - Size: `389,772 bytes` (`380.64 KB`)
  - SHA-256: `a25d34cd0eec0ea8494a9680bd453cbe748d7f8cfd3ac34e3099a754fce9976b`
- **Automated Verification Results:** `22/22` tests passing (`20` unit tests in [`src/tests.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/tests.rs) + `2` multi-account sandbox integration & WASM verification tests in [`tests/sandbox_integration.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/tests/sandbox_integration.rs)).



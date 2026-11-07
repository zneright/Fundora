# Fundora — Architecture & Product Decision Log (ADR)

**Document ID:** `FD-SDLC-12`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Product Name:** **Fundora**

---

## 1. Purpose

This Decision Log records all foundational product, security, blockchain, AI, data, and UX architecture decisions for **Fundora**, linking each decision to verified source evidence from [`C:\Users\Renz Jericho Buday\barangay-bond`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/package.json) and documenting alternatives considered, consequences, and current approval status.

---

## 2. Formal Decision Records

### `ADR-01`: Clean-Room Rebuild in `Fundora` Preserving Civic Workflows (`Strategy C`)
- **Decision:** Create **Fundora** in `C:\Users\Renz Jericho Buday\Fundora` as a clean-room NEAR-native application that preserves the domain workflows, UI design system, and step-by-step registration journey of `barangay-bond` while replacing its Stellar Soroban contract, custodial wallet service, and client-side AI calls.
- **Reason:** The civic workflows in `barangay-bond` (PSGC onboarding, DTI SRP procurement checks, two-way proposal revisions, milestone quorum voting, digital receipts) have strong product-market fit, whereas the underlying cryptographic and security layers had 12 critical vulnerabilities.
- **Alternatives Considered:**
  - *Option A (In-place patch of `barangay-bond`):* Violates strict non-modification rules and retains legacy Stellar debt.
  - *Option B (Minimal single-screen escrow demo):* Loses the distinctive civic KYC, PSGC jurisdiction binding, and AI procurement advisor that differentiate Fundora.
  - *Option D (Unrelated new app):* Discards months of validated domain research.
- **Source Evidence:** [`package.json`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/package.json), [`src/App.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/App.tsx).
- **Consequences:** Preserves `barangay-bond` untouched while delivering a cohesive, production-grade NEAR architecture under the **Fundora** brand.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-02`: Native `NEAR` (`yoctoNEAR`) with Live PHP Equivalent for Hackathon MVP (Deferring NEP-141 Stablecoins)
- **Decision:** Use native `NEAR` (`yoctoNEAR`) for on-chain escrow locking, Phase 1 mobilization, milestone payouts, and treasury refunds on NEAR Testnet, paired with real-time `PHP` (`₱`) equivalent display across all UI views and digital receipts. Defer NEP-141 (`USDC.e` / `USDT`) token integration to Post-MVP.
- **Reason:** Native `NEAR` transfers (`Promise::new(recipient).transfer(amount)`) execute atomically within the escrow contract without requiring every youth council official and barangay admin to pre-register `NEP-145` `storage_deposit` on an external token contract or manage multi-hop `ft_transfer_call` / `ft_on_transfer` failure callbacks within a 7-day sprint.
- **Alternatives Considered:**
  - *NEP-141 Testnet Faucet Stablecoin:* Introduces high UX friction on Testnet (faucet availability, `storage_deposit` panics on unregistered SK recipient accounts).
- **Source Evidence:** [`src/utils/currency.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/utils/currency.ts), [`contracts/contracts/barangay-bond/src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L179-L195).
- **Consequences:** Rock-solid escrow execution on NEAR Testnet with intuitive PHP budgeting for non-technical Filipino users; contract data structures remain extensible to NEP-141 in Phase 2.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-03`: Elimination of Custodial Private Keys in Firestore in Favor of NEAR Wallet Selector
- **Decision:** Permanently eliminate `inAppWallet.service.ts` and `inAppWalletSecret` in Firestore. Use **NEAR Wallet Selector** (`@near-wallet-selector/core`, MyNearWallet, Meteor Wallet, Here Wallet) with Full-Access confirmation for payable escrow funding (`create_project`) and optional `0 yoctoNEAR` Function-Call Access Key sessions for non-payable governance actions (`vote_milestone`, `submit_milestone_proof`).
- **Reason:** Storing plaintext private keys in Firestore (`users/{uid}.inAppWalletSecret`) alongside `allow list: if isAuthenticated()` exposed every user's wallet to trivial theft. Furthermore, NEAR Function-Call Access Keys cannot sign transactions with $> 0$ attached deposit and do not waive gas fees on their own.
- **Alternatives Considered:**
  - *Client-encrypted private keys in Firestore:* Still vulnerable to weak user passwords and XSS key exfiltration.
- **Source Evidence:** [`src/services/inAppWallet.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/inAppWallet.service.ts#L62-L71), [`firestore.rules`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/firestore.rules#L96).
- **Consequences:** Zero custodial key liability; honest adherence to NEAR Protocol access-key semantics.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-04`: Multi-Barangay On-Chain Registry, Strict Voter Eligibility & Configurable Quorum
- **Decision:** Design the Fundora NEAR smart contract with a multi-tenant `IterableMap<BarangayId, BarangayConfig>` where each Barangay has its own `psgc_code`, `admin_accounts`, `sk_officials`, `verified_residents`, `quorum_bps` (default `6000` = 60%), and `min_votes` ($\ge 3$ in production barangays). Voter eligibility checks strictly default to `false`.
- **Reason:** Remediates three critical flaws in legacy `lib.rs`: (1) single global `Admin`, (2) `unwrap_or(true)` allowing any wallet to vote, and (3) hardcoded `votes_approve >= 1` quorum.
- **Alternatives Considered:**
  - *Deploying a separate smart contract per Barangay:* High operational overhead and harder global transparency indexing.
- **Source Evidence:** [`contracts/contracts/barangay-bond/src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L6-L15), [`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L300-L377).
- **Consequences:** One contract deployment (`contract.fundora.testnet`) securely isolates hundreds of Barangays on-chain.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-05`: Routing Rejected Project Refunds Strictly Back to `funder_treasury` (Barangay Admin)
- **Decision:** Record `funder_treasury: AccountId` on every `Project` at creation time and route `refund_project(project_id)` transfers strictly back to `project.funder_treasury`.
- **Reason:** In legacy `lib.rs` (`L419–L458`), `refund_project` transferred remaining locked funds to `project.creator` (`sk_official`), rewarding the proposer when their milestone was rejected by the community.
- **Alternatives Considered:** None — returning unspent escrow funds to the funding Barangay Treasury is the only financially sound behavior.
- **Source Evidence:** [`contracts/contracts/barangay-bond/src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L419-L458).
- **Consequences:** Protects public treasury funds when a project fails community quorum or is cancelled.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-06`: Server-Side AI Auditor Service with On-Chain Attestation (`auditor.fundora.testnet`)
- **Decision:** Move all Gemini 2.5 Flash operations (`verify-identity`, `audit-proposal`, `audit-evidence`) to backend serverless API routes, write results via the Firebase Admin SDK, and sign an on-chain `record_ai_attestation` transaction on NEAR using `auditor.fundora.testnet`.
- **Reason:** Eliminates client-side `VITE_GEMINI_API_KEY` exposure and prevents malicious clients from forging AI verification or procurement feasibility scores in Firestore.
- **Alternatives Considered:**
  - *Running AI inside a TEE / Shade Agent:* High infrastructure complexity for a 7-day deadline; a server-side signing agent (`auditor.fundora.testnet`) with SHA-256 report hashing provides verifiable provenance today and can be upgraded to a TEE worker post-MVP.
- **Source Evidence:** [`src/services/gemini.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/gemini.ts#L217), [`src/services/aiProposalAdvisor.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/aiProposalAdvisor.service.ts#L55).
- **Consequences:** Secures API credentials, prevents score tampering, and anchors AI audit integrity on the NEAR blockchain while keeping human admins and residents as the final authority.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-07`: Deterministic Pre-Generated `project_id` Across Firestore and NEAR
- **Decision:** Generate a deterministic `project_id: String` (e.g., `"proj_1376020030_1762500000"`) when the proposal is created in Firestore and pass that exact `project_id` into the NEAR contract's `create_project(project_id, ...)` method.
- **Reason:** Eliminates the legacy race condition where `AdminPanel.tsx` called `getProjectCount()` in a separate RPC request after `createProject` and fell back to lowercase project name matching.
- **Alternatives Considered:** Parsing sequential integer IDs from transaction receipts (still requires post-creation linking).
- **Source Evidence:** [`src/components/AdminPanel.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/components/AdminPanel.tsx#L431-L436), [`AdminPanel.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/components/AdminPanel.tsx#L1270-L1273).
- **Consequences:** Guaranteed 1:1 primary key identity between off-chain metadata and on-chain escrow state.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-08`: Full Preservation of the Guided 5-Step Registration Wizard & PSGC Geographic Engine
- **Decision:** Preserve the complete step-by-step registration wizard (`LoginStep` $\rightarrow$ `VerifyEmailView` $\rightarrow$ `RoleLGUStep` $\rightarrow$ `DetailsStep` $\rightarrow$ `AddInfoStep` $\rightarrow$ `UploadsStep` $\rightarrow$ `VerificationLoadingTimeline` $\rightarrow$ `SuccessStep`), R.A. 10742 age routing (`<15` blocked, `15–30` Resident, `>30` Viewer), selective resubmission presets, and live PSGC geographic selection, while adding canonical 10-digit `psgcCode` storage and a static offline PSGC fallback.
- **Reason:** The guided onboarding and barangay jurisdiction binding are cornerstone product strengths of `barangay-bond` and explicitly mandated by the project owner.
- **Alternatives Considered:** Simplifying registration to a single form (rejected — degrades UX and violates project requirements).
- **Source Evidence:** [`src/views/auth/AuthPage.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/views/auth/AuthPage.tsx#L1-L1193), [`src/views/auth/RoleLGUStep.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/views/auth/RoleLGUStep.tsx#L1-L371).
- **Consequences:** Seamless civic onboarding experience with stronger privacy (`registration_records` separation) and offline PSGC resilience.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-09`: Honest Terminology for Transaction-Linked Digital Receipts & Removal of Synthetic AI Cover Art
- **Decision:** Present generated receipts accurately as **"Fundora Transaction-Linked Digital Receipts"** backed by SHA-256 payload hashes and NearBlocks Testnet QR codes (removing unverified statutory R.A. 8792 / BIR / COA accreditation claims), and remove `aiImageGenerator.service.ts` (`Pollinations.ai` / `Imagen` synthetic cover art).
- **Reason:** Civic accountability platforms must never fabricate transaction numbers (`walletTransaction.service.ts`), use synthetic AI imagery alongside real physical evidence, or make unverified legal accreditation claims.
- **Alternatives Considered:** Keeping synthetic cover art for proposals without photos (rejected — clean category icons and real uploaded site photos are more trustworthy).
- **Source Evidence:** [`src/utils/receiptPdfGenerator.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/utils/receiptPdfGenerator.ts), [`src/services/walletTransaction.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/walletTransaction.service.ts#L141-L162), [`src/services/aiImageGenerator.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/aiImageGenerator.service.ts).
- **Consequences:** High credibility with hackathon judges, civic auditors, and community users.
- **Approval Status:** `Approved — Authorized for Implementation (Nov 7, 2026)`

---

### `ADR-10`: Configurable `10,000 bps` Milestone Splits (`40/40/20` and `40/30/30`) & Asynchronous Callback Reconciliation
- **Decision:** Implement `FundoraContract::create_project` to accept `2..=5` configurable milestone phases (`Vec<MilestoneInput>`) whose `percentage_bps > 0` sum to `10,000 bps` (`100.00%`) and whose `amount_yocto` sum to `total_budget_yocto`, natively supporting both `40/40/20` (`[4000, 4000, 2000]`) and `40/30/30` (`[4000, 3000, 3000]`) splits. Pair all outbound transfers (`Promise::new(recipient).transfer`) with `reserved_in_flight_yocto` locks (`PayoutInFlight`, `RefundInFlight`), private callbacks (`on_transfer_complete`, `on_refund_complete`), and `ReconciliationRequired` recovery methods (`retry_failed_milestone_payout`, `retry_failed_refund`).
- **Reason:** Ensures full compatibility with both standard Philippine SK infrastructure tranche schedules (`40/40/20` and `40/30/30`) while preventing cross-shard balance desynchronization if an asynchronous NEAR transfer fails.
- **Source Evidence:** [`contracts/fundora-escrow/src/lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/lib.rs), [`contracts/fundora-escrow/src/tests.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/tests.rs).
- **Consequences:** Strict financial conservation (`remaining + reserved_in_flight + disbursed + refunded == total_budget`) across all normal and failure-recovery paths.
- **Approval Status:** `Implemented & Verified in Phase 2 (Nov 7, 2026)`



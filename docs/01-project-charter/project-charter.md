# Fundora — Project Charter

**Document ID:** `FD-SDLC-01`  
**Version:** `1.0.0`  
**Date:** November 7, 2026  
**Target Event:** NEAR Hackathon 2026 (Submission Deadline: November 14, 2026)  
**Product Name:** **Fundora**  
**Reference Legacy System:** `C:\Users\Renz Jericho Buday\barangay-bond` (Read-Only Reference)  
**New Workspace:** `C:\Users\Renz Jericho Buday\Fundora`

---

## 1. Project Background

Grassroots civic organizations, local government units (LGUs), and youth councils—most notably the Philippine **Sangguniang Kabataan (SK)** and **Barangays**—manage billions of pesos in public community development funds annually (under Republic Act No. 10742, the SK Reform Act of 2015, which mandates 10% of the general fund of the barangay for youth development). Despite statutory mandates for transparency, grassroots public procurement and project execution continue to suffer from four structural failures:

1. **Procurement Overpricing & Information Asymmetry:** Community officials and residents lack automated tools to benchmark itemized project budgets against official Department of Trade and Industry (DTI) Suggested Retail Prices (SRP) or identify existing inter-agency equipment that could be borrowed for free.
2. **Upfront Disbursement Without Milestone Accountability:** Once a budget is approved, funds are frequently disbursed in bulk or without cryptographic enforcement tying subsequent tranches to verified physical deliverables.
3. **Opaque Community Oversight:** Residents have no tamper-evident mechanism to inspect milestone proofs or cast binding, Sybil-resistant community approval votes before final contractor or supplier payouts occur.
4. **Web3 Usability Barriers for Non-Technical Citizens:** Prior attempts at blockchain-based civic budgeting fail when non-technical youth residents and local officials are forced to manage complex seed phrases, gas mechanics, and raw cryptographic addresses.

**Fundora** is conceived as a clean-room, NEAR-native evolution of the earlier prototype ([`barangay-bond`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/README.md)), preserving its strongest civic workflows—guided step-by-step registration with Philippine Standard Geographic Code (PSGC) jurisdiction binding, AI procurement auditing, two-way proposal revision, milestone-based escrow, and transaction-linked digital receipts—while eliminating its critical security, smart contract, and architectural defects.

---

## 2. Problem Statement

The legacy reference system ([`barangay-bond`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/package.json)) demonstrated strong domain product-market fit for SK and Barangay governance, but a rigorous source-code audit revealed **12 critical architectural and security defects** that prevent production or hackathon viability in its current state:

- **Custodial Key Exposure:** Plaintext Stellar secret keys (`S...`) were generated client-side and stored directly inside world-listable Firestore user documents ([`inAppWallet.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/inAppWallet.service.ts#L62-L71), [`firestore.rules`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/firestore.rules#L96)).
- **Broken On-Chain Governance & Quorum:** The Soroban smart contract defaulted unverified voter lookups to `true` (`unwrap_or(true)`) and hardcoded milestone approval/rejection to a `1-vote` threshold ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L300-L377)).
- **Misrouted Escrow Refunds:** Rejected project escrows refunded remaining funds to the `sk_official` (the proposer whose milestone failed) rather than back to the `Barangay Treasury` ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L419-L458)).
- **Single Global On-Chain Administrator:** The contract supported only a single global `DataKey::Admin`, making multi-barangay treasury isolation impossible on-chain ([`lib.rs`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/contracts/contracts/barangay-bond/src/lib.rs#L6-L15)).
- **Client-Exposed & Client-Trusted AI:** Gemini API keys were bundled into the browser via `VITE_GEMINI_API_KEY` ([`gemini.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/gemini.ts#L217)), and client-computed AI verification/audit scores were written directly to Firestore without server-side validation or on-chain attestation.
- **Fragile Project Linking & Fabricated Ledger Fallbacks:** Projects were linked via race-prone `getProjectCount()` calls or lowercase name matching ([`AdminPanel.tsx`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/components/AdminPanel.tsx#L431-L436)), and transaction history fell back to hardcoded budget constants ([`walletTransaction.service.ts`](file:///C:/Users/Renz%20Jericho%20Buday/barangay-bond/src/services/walletTransaction.service.ts#L141-L162)).

Fundora solves these problems by rebuilding the financial, governance, and AI attestation core on **NEAR Protocol** (`near-sdk-rs`) with a secure server-side AI Auditor service, non-custodial NEAR Wallet Selector integration, and strict separation between **authoritative on-chain financial/governance state** and **supporting off-chain Firestore metadata**.

---

## 3. Product Vision and Objectives

### 3.1 Product Vision
**Fundora** is an **AI-audited civic treasury and milestone-based programmable escrow platform built on NEAR Protocol**. Its flagship vertical is community project funding for **Philippine Sangguniang Kabataan (SK) and Barangays**, built on a multi-tenant jurisdiction architecture extensible to NGOs, municipal LGUs, disaster relief funds, and student councils.

### 3.2 Core Objectives
1. **Authoritative NEAR Programmable Escrow (`near-sdk-rs`):** Enforce multi-barangay treasury isolation, role-based access control (RBAC), milestone tranche locking, configurable community quorum voting, and automatic treasury refunds upon milestone rejection directly on NEAR Testnet.
2. **Verifiable Server-Side AI Procurement & Evidence Auditor:** Execute Gemini 2.5 Flash procurement price checks (against DTI SRP benchmarks and LGU equipment-borrowing opportunities) and milestone evidence audits on a secure backend, signing cryptographic audit attestations on-chain via a dedicated NEAR AI Auditor account (`auditor.fundora.testnet`).
3. **Preserved & Hardened Guided Step-by-Step Registration:** Retain the intuitive 5-stage guided onboarding wizard (`1. Account` $\rightarrow$ `2. Role / LGU` $\rightarrow$ `3. Identity` $\rightarrow$ `4. Details` $\rightarrow$ `5. Docs` + AI Verification Timeline & Selective Resubmission) with live PSGC geographic cascading and barangay code binding, while moving sensitive OCR and duplicate checks to a protected backend boundary.
4. **Non-Technical Civic UX with Transparent Financial Records:** Combine human-readable NEAR accounts (`.testnet`), real-time PHP-equivalent currency displays, QR-verifiable project payment flows, and transaction-linked digital receipts that link directly to NEAR Explorer / NearBlocks transactions.

---

## 4. Target Users and Stakeholders

| Stakeholder / Role | Description | Primary Needs in Fundora |
| :--- | :--- | :--- |
| **Youth Resident (`resident`, ages 15–30)** | Verified resident of a registered Barangay under R.A. 10742 (Katipunan ng Kabataan member). | Simple step-by-step registration, transparent view of barangay projects, inspection of milestone photos/receipts, and 1-person-1-vote milestone approval/rejection. |
| **SK Official (`sk_official`)** | Appointed or elected Sangguniang Kabataan council member (Chairperson, Kagawad, Treasurer, Secretary). | Guided proposal creation, AI procurement advisor (DTI SRP & borrowing tips), two-way budget revision with Admin, upfront mobilization receipt, and milestone proof submission. |
| **Barangay Admin / Secretariat (`barangay_admin`)** | Authorized local treasury administrator for a specific Barangay jurisdiction (`barangayId` / `psgcCode`). | Resident KYC approval/resubmission desk, SK official appointment & term management, proposal budget review, NEAR escrow funding, and private proof auditing. |
| **System Administrator (`system_admin`)** | Platform-level governance operator. | Verification of initial Barangay Admin jurisdiction requests, activation of new Barangays on-chain and off-chain, and platform compliance monitoring. |
| **Public Guest / Adult Resident (`viewer`, age > 30 or unauthenticated)** | Citizens outside the 15–30 SK voting bracket, journalists, COA auditors, or hackathon judges. | Read-only access to the Public Transparency Hub, AI audit reports, milestone progress, and transaction-linked digital receipts without voting privileges. |
| **AI Auditor Agent (`auditor.fundora.testnet`)** | Automated server-side AI co-pilot and on-chain attestation signer. | Evaluates proposal budgets and milestone proofs, records SHA-256 report hashes and risk scores on NEAR, and flags anomalies for human decision-makers. |

---

## 5. Project Scope and Exclusions

### 5.1 In-Scope for Hackathon MVP (Nov 7 – Nov 14, 2026)
- **Complete Rebrand & Independent Workspace:** Clean-room implementation in `C:\Users\Renz Jericho Buday\Fundora` under the **Fundora** brand.
- **NEAR Rust Smart Contract (`near-sdk-rs`):** Multi-barangay registry, scoped RBAC (`SystemAdmin`, `BarangayAdmin`, `SKOfficial`, `VerifiedResident`, `AIAuditor`), pre-generated stable `project_id` support, native NEAR multi-phase escrow locking, configurable quorum voting (`60%` approval threshold and minimum $\ge 3$ eligible votes in standard barangays; minimum $1$ vote strictly in isolated demo barangay `brgy_demo_001`), AI attestation recording, tranche release via NEAR `Promise::new(recipient).transfer()`, and treasury refund on rejection.
- **NEAR Wallet Selector Integration:** Non-custodial wallet connection (MyNearWallet, Meteor Wallet, Here Wallet) with clear signing flows and optional scoped Function-Call Access Key session support.
- **Server-Side AI & Verification API:** Vercel Serverless Functions / Node API hosting Gemini 2.5 Flash for (a) Identity OCR & rubric scoring, (b) Proposal Procurement DTI SRP & resource-borrowing audit, and (c) Milestone Proof verification, plus signing on-chain attestations via `auditor.fundora.testnet`.
- **Preserved Guided Registration & PSGC Geographic Engine:** Full 5-pill step-by-step registration wizard (`LoginStep`, `RoleLGUStep`, `DetailsStep`, `AddInfoStep`, `UploadsStep`, `VerificationLoadingTimeline`, `SuccessStep`, `VerifyEmailView`) with PSGC Cloud API cascading, NCR fallback handling, and selective resubmission mode.
- **Core Role Workspaces:** `AdminPanel`, `SKWorkspace`, `YouthDashboard`, `TransparencyHub`, `ActivityView`, `QrModal`, and `ReceiptModal` / PDF generator refactored for NEAR Testnet and honest transaction-linked digital receipts.
- **Isolated Judge Demo Mode:** Pre-seeded demo jurisdiction (`Brgy. San Antonio (Demo)`) with instant role-switching and live NEAR Testnet walkthrough controls.

### 5.2 Explicit Exclusions (Out of Scope for MVP)
- **Plaintext Custodial Private Keys in Firestore:** Strictly prohibited and permanently removed.
- **NEP-141 Stablecoin (`USDC.e` / `USDT`) Cross-Contract Calls:** Deferred to Post-MVP to avoid `ft_transfer_call` / `NEP-145` storage-deposit failure modes during the 7-day sprint; MVP uses native `NEAR` (`yoctoNEAR`) with real-time PHP display conversion.
- **NEAR Intents & Chain Signatures (MPC Cross-Chain):** Excluded because all civic treasury participants operate within the same jurisdiction and currency context; cross-chain swaps add unnecessary complexity without solving a core civic problem.
- **AI-Generated Synthetic Proposal Cover Images (`Pollinations.ai` / `Imagen`):** Removed to avoid synthetic imagery in a civic transparency and evidence-auditing platform.
- **Unverified Statutory Accreditation Claims:** Digital receipts will not claim statutory BIR / COA / R.A. 8792 legal accreditation unless formally certified; they are presented honestly as **Transaction-Linked Digital Receipts** backed by NEAR Testnet explorer links.

---

## 6. Success Criteria

1. **Zero Critical Security Leaks:** No private keys in Firestore (`users` collection restricted from public listing; no `inAppWalletSecret`), no `VITE_GEMINI_API_KEY` in client bundle, and hardened `firestore.rules` passing emulator security tests.
2. **100% Smart Contract Test Pass Rate:** All unit and `near-workspaces` integration tests pass, covering multi-barangay isolation, role checks, pre-generated `project_id`, quorum thresholds, tranche payouts, and rejected-project refunds back to the Barangay Admin treasury.
3. **End-to-End NEAR Testnet Lifecycle:** A judge or user can create a proposal, run a server-side AI procurement audit (with on-chain attestation hash recorded on NEAR Testnet), fund the escrow in NEAR, submit milestone evidence, meet community quorum votes, and verify the native NEAR payout and downloadable digital receipt on NearBlocks Testnet.
4. **Preserved Registration UX:** New users can complete the entire guided step-by-step registration flow with live PSGC geographic selection and barangay code binding without regression.

---

## 7. Assumptions, Constraints, and Dependencies

### 7.1 Assumptions
- Users and judges have internet access to reach Firebase Auth/Firestore, NEAR Testnet RPC (`https://rpc.testnet.near.org`), and the PSGC API (`https://psgc.cloud/api`) or bundled static fallback.
- For the hackathon MVP, native NEAR on NEAR Testnet accurately models programmable escrow mechanics while displaying live PHP equivalents (`1 NEAR` $\approx$ live CoinGecko PHP rate with fallback).

### 7.2 Constraints
- **Hard Deadline:** November 14, 2026 (7 calendar days from charter approval).
- **Strict Non-Modification of Legacy Repo:** `C:\Users\Renz Jericho Buday\barangay-bond` must remain 100% untouched.
- **NEAR Storage Staking:** Every new project, milestone, and vote stored on NEAR consumes contract state storage (`100 KB = 1 NEAR`), requiring the contract to retain a small storage buffer or require attached deposit on `create_project`.

### 7.3 External Dependencies
- **NEAR Protocol Testnet & `@near-wallet-selector/*`:** Blockchain execution and non-custodial wallet connection.
- **Google Gemini 2.5 Flash API:** Server-side multimodal OCR and procurement/evidence auditing.
- **Firebase (Authentication & Cloud Firestore):** Identity authentication and off-chain metadata persistence.
- **PSGC Cloud API (`psgc.cloud/api`):** Official Philippine geographic hierarchy (Regions, Provinces, Cities/Municipalities, Barangays) with local static JSON fallback.


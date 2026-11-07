# Fundora Escrow Smart Contract (`fundora-escrow`)

Authoritative NEAR Protocol Rust smart contract (`near-sdk = "5.6.0"`, resolved to `near-sdk 5.30.1`) powering **Fundora's** multi-barangay civic treasury, milestone-based programmable escrow, resident quorum voting, and on-chain AI procurement/evidence audit attestations.

---

## 1. Architecture & Core Invariants

1. **Multi-Barangay Namespace Isolation:**
   - Every barangay is registered on-chain under its canonical 10-digit PSGC identifier (`brgy_<psgcCode>`, e.g., `brgy_0421090180` for Molino III / Bucandala III, Cavite; `brgy_1376020030` for Poblacion / Bel-Air, Makati) plus the pre-seeded `brgy_demo_001` hackathon evaluation namespace (`min_votes = 1`).
   - Standard production barangays (`is_demo == false`) strictly enforce `min_votes >= 3` and `5000 <= quorum_bps <= 10000`.
   - Barangay roles (`admin_accounts`, `sk_officials`, `verified_residents`) are scoped per barangay inside `BarangayConfig`.
   - Unassigned accounts default strictly to `false` for all role checks (`is_barangay_admin`, `is_sk_official`, `is_verified_resident`).

2. **Configurable Milestone Splits Summing to `10,000 bps` (`100.00%`):**
   - Each project requires `2..=5` milestones (`Vec<MilestoneInput>`).
   - Every milestone must have `percentage_bps > 0`.
   - The sum of all `percentage_bps` must equal **`10,000 bps`** (`100.00%`), and the sum of milestone `amount_yocto` allocations equals `total_budget_yocto`.
   - Natively supports both the standard **40% / 40% / 20%** (`[4000, 4000, 2000]`) and **40% / 30% / 30%** (`[4000, 3000, 3000]`) civic infrastructure splits, with optional immediate Phase 1 upfront mobilization (`immediate_phase_1: true`).

3. **Exact Treasury Funding & Storage Reserve Protection:**
   - Only a scoped `barangay_admin` of `barangay_id` may create and fund a project via `#[payable] create_project(...)`.
   - Attached deposit must be `>= total_budget_yocto + STORAGE_RESERVE_YOCTO` (`0.05 NEAR` = `50_000_000_000_000_000_000_000 yoctoNEAR`) so resident votes and proof submissions require `0 yoctoNEAR` attached deposit.

4. **Integer Basis-Point Resident Quorum Voting:**
   - Verified residents cast at most one vote per milestone (`vote_milestone`) tracked in `milestone.voters: BTreeMap<AccountId, bool>`.
   - Conflict-of-interest self-voting by `project.sk_official` or any `barangay_admin` is blocked (`ERR_SEPARATION_OF_DUTIES`).
   - Quorum evaluation uses pure integer math (`(votes_approve as u64) * 10_000 >= (total_votes as u64) * (quorum_bps as u64)` once `total_votes >= min_votes`).

5. **Asynchronous Cross-Contract Transfer Safety (`PayoutInFlight` / `RefundInFlight`):**
   - Outbound transfers reserve funds (`reserved_in_flight_yocto`) and lock the milestone (`PayoutInFlight`) or project (`RefundInFlight`) before dispatching `Promise::new(recipient).transfer(...)`.
   - Private callbacks (`on_transfer_complete`, `on_refund_complete`) inspect `env::promise_result(0)`:
     - On `PromiseResult::Successful`, balances (`total_disbursed_yocto`, `total_refunded_yocto`) are finalized and NEP-297 events are emitted.
     - On `PromiseResult::Failed`, reserved balances are restored to `remaining_balance_yocto` and status transitions to `ReconciliationRequired` / `Failed`, allowing safe recovery via `retry_failed_milestone_payout` or `retry_failed_refund`.

6. **Treasury-Only Refund Policy:**
   - `refund_project` returns `remaining_balance_yocto` strictly to the project's recorded `funder_treasury` account (the Barangay Admin account that funded the escrow)—never to `sk_official`. Individual resident/citizen crowdfunding deposits are not accepted in the MVP.

---

## 2. Build & Verification Commands

### Run Unit & Sandbox Integration Tests (`22/22` Tests)
```powershell
cd contracts/fundora-escrow
cargo test
```

### Compile Optimized Release WASM Binary
```powershell
cd contracts/fundora-escrow
cargo build --target wasm32-unknown-unknown --release
```

- **Compiled WASM Artifact Path:** `contracts/fundora-escrow/target/wasm32-unknown-unknown/release/fundora_escrow.wasm`
- **Compiled WASM Size:** `389,772 bytes` (`380.64 KB`)
- **Compiled WASM SHA-256 Checksum:** `a25d34cd0eec0ea8494a9680bd453cbe748d7f8cfd3ac34e3099a754fce9976b`

---

## 3. NEAR Testnet Deployment Readiness Checklist (Explicit Approval Gate)

> **IMPORTANT:** Do not execute live NEAR Testnet deployment without explicit user authorization.

1. **Testnet Account Requirements:**
   - Contract Account: `contract.fundora.testnet` (minimum `15 NEAR` balance for WASM storage + operational reserve)
   - System Admin Account: `admin.fundora.testnet`
   - AI Auditor Signer Account: `auditor.fundora.testnet`
   - Barangay Accounts (`brgy_0421090180`): `admin.molino3.testnet`, `sk.molino3.testnet`, `resident1.molino3.testnet`, `resident2.molino3.testnet`, `resident3.molino3.testnet`

2. **Deploy & Initialize Contract:**
   ```bash
   near contract deploy contract.fundora.testnet use-file target/wasm32-unknown-unknown/release/fundora_escrow.wasm with-init-call new json-args '{"system_admin":"admin.fundora.testnet","ai_auditor":"auditor.fundora.testnet"}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
   ```

3. **Register Initial Barangay (`brgy_0421090180`):**
   ```bash
   near contract call-function as-transaction contract.fundora.testnet register_barangay json-args '{"barangay_id":"brgy_0421090180","psgc_code":"0421090180","name":"Molino III","initial_admin":"admin.molino3.testnet","quorum_bps":6000,"min_votes":3,"is_demo":false}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as admin.fundora.testnet network-config testnet sign-with-keychain send
   ```

4. **Post-Deployment Verification:**
   ```bash
   near contract call-function as-read-only contract.fundora.testnet get_barangay json-args '{"barangay_id":"brgy_demo_001"}' network-config testnet now
   near contract call-function as-read-only contract.fundora.testnet get_barangay json-args '{"barangay_id":"brgy_0421090180"}' network-config testnet now
   ```

5. **Rollback / Recovery Procedure:**
   - If a milestone payout or refund promise fails on-chain (`ProjectStatus::ReconciliationRequired`), verify the recipient account exists on NEAR Testnet and invoke `retry_failed_milestone_payout` or `retry_failed_refund` as a scoped `barangay_admin` or `system_admin`.

6. **Linux CI / WSL2 `near-workspaces` Real Sandbox Verification Procedure:**
   - Because `near-workspaces` (`0.14+` / `0.21+`) only distributes `near-sandbox` binaries for `linux-x86_64` and `macos-arm64`, the Windows test runner executes `20/20` unit tests in [`src/tests.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/src/tests.rs) plus `2/2` VM callback & WASM artifact integrity tests in [`tests/sandbox_integration.rs`](file:///C:/Users/Renz%20Jericho%20Buday/Fundora/contracts/fundora-escrow/tests/sandbox_integration.rs).
   - To run a full `near-sandbox` local node test on Linux CI or WSL2 Ubuntu:
     ```bash
     # Inside WSL2 Ubuntu (x86_64) or Linux CI:
     cd contracts/fundora-escrow
     cargo build --target wasm32-unknown-unknown --release
     cargo test -- --nocapture
     ```

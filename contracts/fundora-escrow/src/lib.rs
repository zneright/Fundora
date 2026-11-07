//! Fundora — Authoritative NEAR Rust Smart Contract (`near-sdk-rs`)
//! Implements Multi-Barangay Isolation, Scoped Role-Based Access Control (RBAC),
//! Milestone-Based Programmable Native NEAR Escrow, Integer Basis-Point Quorum Voting,
//! Asynchronous Transfer Callbacks with Rollback/Reconciliation, Treasury-Only Refunds,
//! and Verifiable AI Auditor Attestations.

pub mod errors;
pub mod events;
pub mod models;

use errors::*;
use events::emit_nep297_event;
use models::*;

use near_sdk::borsh::BorshSerialize;
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseResult,
};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};

const GAS_FOR_TRANSFER_CALLBACK: Gas = Gas::from_tgas(15);

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Barangays,
    BarangayIds,
    Projects,
    ProjectsByBarangay,
    ProjectsByBarangayInner { barangay_id_hash: Vec<u8> },
    AiAttestations,
}

#[allow(dead_code)]
#[ext_contract(ext_self)]
pub trait ExtFundoraCallbacks {
    fn on_transfer_complete(
        &mut self,
        project_id: String,
        milestone_idx: u32,
        amount_yocto: U128,
    ) -> bool;

    fn on_refund_complete(&mut self, project_id: String, amount_yocto: U128) -> bool;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct FundoraContract {
    pub system_admin: AccountId,
    pub ai_auditor: AccountId,
    pub barangays: LookupMap<String, BarangayConfig>,
    pub barangay_ids: Vector<String>,
    pub projects: LookupMap<String, Project>,
    pub projects_by_barangay: LookupMap<String, Vector<String>>,
    pub ai_attestations: LookupMap<String, Vec<AiAttestation>>,
}

pub fn is_valid_sha256_hex(hash: &str) -> bool {
    let clean = hash.trim();
    clean.len() == 64 && clean.chars().all(|c| c.is_ascii_hexdigit())
}

#[near]
impl FundoraContract {
    /// Initializes the Fundora smart contract and registers the isolated Judge Demo Barangay (`brgy_demo_001`).
    #[init]
    pub fn new(system_admin: AccountId, ai_auditor: AccountId) -> Self {
        let mut contract = Self {
            system_admin: system_admin.clone(),
            ai_auditor,
            barangays: LookupMap::new(StorageKey::Barangays),
            barangay_ids: Vector::new(StorageKey::BarangayIds),
            projects: LookupMap::new(StorageKey::Projects),
            projects_by_barangay: LookupMap::new(StorageKey::ProjectsByBarangay),
            ai_attestations: LookupMap::new(StorageKey::AiAttestations),
        };

        // Pre-seed isolated demo jurisdiction `brgy_demo_001` (quorum 6000 bps, min_votes = 1)
        let mut demo_admins = BTreeSet::new();
        demo_admins.insert(system_admin);
        let demo_cfg = BarangayConfig {
            barangay_id: DEMO_BARANGAY_ID.to_string(),
            psgc_code: "1374030250".to_string(),
            name: "San Antonio (Demo Sandbox)".to_string(),
            active: true,
            is_demo: true,
            quorum_bps: 6000,
            min_votes: 1,
            admin_accounts: demo_admins,
            sk_officials: BTreeSet::new(),
            verified_residents: BTreeSet::new(),
        };
        contract
            .barangays
            .insert(DEMO_BARANGAY_ID.to_string(), demo_cfg);
        contract.barangay_ids.push(DEMO_BARANGAY_ID.to_string());

        contract
    }

    // =========================================================================
    // 1. MULTI-BARANGAY REGISTRY & ROLE-BASED ACCESS CONTROL (RBAC)
    // =========================================================================

    /// Registers a new Barangay jurisdiction. Only `system_admin` may register barangays.
    /// Enforces:
    /// - `quorum_bps` in `5000..=10000`
    /// - Standard barangays (`is_demo == false`): `min_votes >= 3` and `barangay_id != "brgy_demo_001"`
    /// - Demo barangay (`is_demo == true`): `barangay_id == "brgy_demo_001"` and `min_votes >= 1`
    pub fn register_barangay(
        &mut self,
        barangay_id: String,
        psgc_code: String,
        name: String,
        initial_admin: AccountId,
        quorum_bps: u16,
        min_votes: u32,
        is_demo: bool,
    ) {
        self.assert_system_admin();
        let clean_id = barangay_id.trim().to_string();
        require!(!clean_id.is_empty(), ERR_BARANGAY_NOT_FOUND);
        require!(
            !self.barangays.contains_key(&clean_id),
            ERR_BARANGAY_ALREADY_EXISTS
        );
        Self::validate_quorum_parameters(&clean_id, quorum_bps, min_votes, is_demo);

        let mut admins = BTreeSet::new();
        admins.insert(initial_admin.clone());

        let config = BarangayConfig {
            barangay_id: clean_id.clone(),
            psgc_code: psgc_code.trim().to_string(),
            name: name.trim().to_string(),
            active: true,
            is_demo,
            quorum_bps,
            min_votes,
            admin_accounts: admins,
            sk_officials: BTreeSet::new(),
            verified_residents: BTreeSet::new(),
        };

        self.barangays.insert(clean_id.clone(), config);
        self.barangay_ids.push(clean_id.clone());

        emit_nep297_event(
            "barangay_registered",
            &json!({
                "barangay_id": clean_id,
                "psgc_code": psgc_code,
                "name": name,
                "initial_admin": initial_admin,
                "quorum_bps": quorum_bps,
                "min_votes": min_votes,
                "is_demo": is_demo,
            }),
        );
    }

    /// Adds or removes a Barangay Admin for a specific barangay.
    /// Callable by `system_admin` or an existing `barangay_admin` of that same barangay.
    pub fn set_barangay_admin(
        &mut self,
        barangay_id: String,
        account_id: AccountId,
        active: bool,
    ) {
        self.assert_system_or_scoped_barangay_admin(&barangay_id);
        let brgy = self
            .barangays
            .get_mut(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));

        if active {
            brgy.admin_accounts.insert(account_id.clone());
        } else {
            require!(
                brgy.admin_accounts.len() > 1 || env::predecessor_account_id() == self.system_admin,
                "Cannot remove the last barangay_admin without system_admin authorization"
            );
            brgy.admin_accounts.remove(&account_id);
        }

        emit_nep297_event(
            "role_updated",
            &json!({
                "barangay_id": barangay_id,
                "role": "barangay_admin",
                "account_id": account_id,
                "active": active,
                "actor": env::predecessor_account_id(),
            }),
        );
    }

    /// Updates quorum settings for a barangay.
    pub fn configure_barangay_quorum(
        &mut self,
        barangay_id: String,
        quorum_bps: u16,
        min_votes: u32,
    ) {
        self.assert_system_or_scoped_barangay_admin(&barangay_id);
        let is_demo = self
            .barangays
            .get(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND))
            .is_demo;

        Self::validate_quorum_parameters(&barangay_id, quorum_bps, min_votes, is_demo);

        let brgy = self.barangays.get_mut(&barangay_id).unwrap();
        brgy.quorum_bps = quorum_bps;
        brgy.min_votes = min_votes;

        emit_nep297_event(
            "barangay_quorum_updated",
            &json!({
                "barangay_id": barangay_id,
                "quorum_bps": quorum_bps,
                "min_votes": min_votes,
            }),
        );
    }

    /// Activates or pauses a barangay jurisdiction. Callable by `system_admin`.
    pub fn set_barangay_active(&mut self, barangay_id: String, active: bool) {
        self.assert_system_admin();
        let brgy = self
            .barangays
            .get_mut(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));
        brgy.active = active;
    }

    /// Appoints or revokes an SK Official within the specified barangay.
    /// Callable only by an authorized `barangay_admin` of `barangay_id` (or `system_admin`).
    pub fn set_sk_official(&mut self, barangay_id: String, account_id: AccountId, active: bool) {
        self.assert_system_or_scoped_barangay_admin(&barangay_id);
        let brgy = self
            .barangays
            .get_mut(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));

        if active {
            brgy.sk_officials.insert(account_id.clone());
        } else {
            brgy.sk_officials.remove(&account_id);
        }

        emit_nep297_event(
            "role_updated",
            &json!({
                "barangay_id": barangay_id,
                "role": "sk_official",
                "account_id": account_id,
                "active": active,
                "actor": env::predecessor_account_id(),
            }),
        );
    }

    /// Registers or revokes a verified Youth Resident voter (ages 15-30) within `barangay_id`.
    /// Callable only by an authorized `barangay_admin` of `barangay_id` (or `system_admin`).
    pub fn register_verified_resident(
        &mut self,
        barangay_id: String,
        account_id: AccountId,
        eligible: bool,
    ) {
        self.assert_system_or_scoped_barangay_admin(&barangay_id);
        let brgy = self
            .barangays
            .get_mut(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));

        if eligible {
            brgy.verified_residents.insert(account_id.clone());
        } else {
            brgy.verified_residents.remove(&account_id);
        }

        emit_nep297_event(
            "role_updated",
            &json!({
                "barangay_id": barangay_id,
                "role": "verified_resident",
                "account_id": account_id,
                "eligible": eligible,
                "actor": env::predecessor_account_id(),
            }),
        );
    }

    /// Rotates the designated `ai_auditor` account. Callable only by `system_admin`.
    pub fn set_ai_auditor(&mut self, new_auditor: AccountId) {
        self.assert_system_admin();
        self.ai_auditor = new_auditor.clone();
        emit_nep297_event(
            "ai_auditor_updated",
            &json!({ "ai_auditor": new_auditor }),
        );
    }

    // =========================================================================
    // 2. PROGRAMMABLE MILESTONE ESCROW & FINANCIAL LIFECYCLE
    // =========================================================================

    /// Creates and funds a new multi-phase project escrow in native NEAR (`yoctoNEAR`).
    ///
    /// Enforces:
    /// - Deterministic, pre-generated `project_id` uniqueness
    /// - Caller is an authorized `barangay_admin` of `barangay_id`
    /// - `sk_official` is a verified `sk_official` of `barangay_id` and `sk_official != caller`
    /// - `milestones_input.len()` is between `2` and `5`
    /// - Milestone `percentage_bps` values sum to `10000` (`100.00%`)
    /// - Attached deposit `>= total_budget_yocto + STORAGE_RESERVE_YOCTO (0.05 NEAR)`
    /// - Records `funder_treasury = env::predecessor_account_id()` for strict refund routing
    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn create_project(
        &mut self,
        project_id: String,
        barangay_id: String,
        name: String,
        metadata_hash: String,
        sk_official: AccountId,
        total_budget_yocto: U128,
        milestones_input: Vec<MilestoneInput>,
        immediate_phase_1: bool,
    ) {
        let caller = env::predecessor_account_id();
        let clean_project_id = project_id.trim().to_string();
        require!(!clean_project_id.is_empty(), ERR_PROJECT_NOT_FOUND);
        require!(
            !self.projects.contains_key(&clean_project_id),
            ERR_DUPLICATE_PROJECT_ID
        );

        let brgy = self
            .barangays
            .get(&barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));
        require!(brgy.active, ERR_BARANGAY_INACTIVE);
        require!(
            brgy.admin_accounts.contains(&caller),
            ERR_UNAUTHORIZED_BARANGAY_ADMIN
        );
        require!(
            brgy.sk_officials.contains(&sk_official),
            ERR_UNAUTHORIZED_SK_OFFICIAL
        );
        require!(caller != sk_official, ERR_SEPARATION_OF_DUTIES);

        let budget_u128 = total_budget_yocto.0;
        require!(budget_u128 > 0, ERR_ZERO_BUDGET);

        let attached = env::attached_deposit().as_yoctonear();
        let required_deposit = budget_u128
            .checked_add(STORAGE_RESERVE_YOCTO)
            .expect("Deposit addition overflow");
        require!(
            attached >= required_deposit,
            ERR_INSUFFICIENT_ATTACHED_DEPOSIT
        );

        let m_count = milestones_input.len();
        require!((2..=5).contains(&m_count), ERR_INVALID_MILESTONE_COUNT);

        let mut total_bps: u32 = 0;
        for m in &milestones_input {
            require!(m.percentage_bps > 0, ERR_INVALID_MILESTONE_BPS_SUM);
            total_bps += m.percentage_bps as u32;
        }
        require!(total_bps == 10_000, ERR_INVALID_MILESTONE_BPS_SUM);

        // Compute exact yoctoNEAR per milestone using integer math
        let mut allocated_sum: u128 = 0;
        let mut milestones: Vec<Milestone> = Vec::with_capacity(m_count);
        for (i, m_in) in milestones_input.iter().enumerate() {
            let is_last = i + 1 == m_count;
            let calculated_amount = if is_last {
                budget_u128
                    .checked_sub(allocated_sum)
                    .unwrap_or_else(|| env::panic_str(ERR_MILESTONE_AMOUNT_MISMATCH))
            } else {
                (budget_u128 * (m_in.percentage_bps as u128)) / 10_000
            };

            let final_amount = match m_in.amount_yocto {
                Some(explicit) => {
                    require!(explicit.0 > 0, ERR_MILESTONE_AMOUNT_MISMATCH);
                    explicit.0
                }
                None => calculated_amount,
            };

            allocated_sum = allocated_sum
                .checked_add(final_amount)
                .unwrap_or_else(|| env::panic_str(ERR_MILESTONE_AMOUNT_MISMATCH));

            milestones.push(Milestone {
                index: (i + 1) as u32,
                title: m_in.title.trim().to_string(),
                percentage_bps: m_in.percentage_bps,
                amount_yocto: U128(final_amount),
                is_upfront: i == 0 && (immediate_phase_1 || m_in.is_upfront),
                status: MilestoneStatus::Pending,
                proof_hash: None,
                votes_approve: 0,
                votes_reject: 0,
                voters: BTreeMap::new(),
                released_at_ns: None,
            });
        }
        require!(
            allocated_sum == budget_u128,
            ERR_MILESTONE_AMOUNT_MISMATCH
        );

        let quorum_bps = brgy.quorum_bps;
        let min_votes = brgy.min_votes;
        let now = env::block_timestamp();

        let mut project = Project {
            project_id: clean_project_id.clone(),
            barangay_id: barangay_id.clone(),
            name: name.trim().to_string(),
            metadata_hash: metadata_hash.trim().to_string(),
            funder_treasury: caller.clone(),
            sk_official: sk_official.clone(),
            total_budget_yocto: U128(budget_u128),
            remaining_balance_yocto: U128(budget_u128),
            reserved_in_flight_yocto: U128(0),
            total_disbursed_yocto: U128(0),
            total_refunded_yocto: U128(0),
            storage_deposit_reserved: U128(STORAGE_RESERVE_YOCTO),
            status: ProjectStatus::Active,
            current_milestone_idx: 1,
            quorum_bps,
            min_votes,
            milestones,
            created_at_ns: now,
            updated_at_ns: now,
        };

        let should_mobilize_phase_1 = project.milestones[0].is_upfront;
        let phase_1_amount = project.milestones[0].amount_yocto.0;

        if should_mobilize_phase_1 {
            // Reserve Phase 1 funds before dispatching transfer
            project.remaining_balance_yocto = U128(budget_u128 - phase_1_amount);
            project.reserved_in_flight_yocto = U128(phase_1_amount);
            project.milestones[0].status = MilestoneStatus::PayoutInFlight;
            project.status = ProjectStatus::PayoutInFlight;
        }

        self.projects.insert(clean_project_id.clone(), project);

        if !self.projects_by_barangay.contains_key(&barangay_id) {
            self.projects_by_barangay.insert(
                barangay_id.clone(),
                Vector::new(StorageKey::ProjectsByBarangayInner {
                    barangay_id_hash: env::sha256(barangay_id.as_bytes()),
                }),
            );
        }
        if let Some(list) = self.projects_by_barangay.get_mut(&barangay_id) {
            list.push(clean_project_id.clone());
        }

        emit_nep297_event(
            "project_created",
            &json!({
                "project_id": clean_project_id,
                "barangay_id": barangay_id,
                "funder_treasury": caller,
                "sk_official": sk_official,
                "total_budget_yocto": total_budget_yocto,
                "quorum_bps": quorum_bps,
                "min_votes": min_votes,
                "immediate_phase_1": should_mobilize_phase_1,
            }),
        );

        if should_mobilize_phase_1 {
            self.dispatch_milestone_transfer(
                clean_project_id,
                sk_official,
                1,
                phase_1_amount,
            );
        }
    }

    /// Submits milestone deliverable evidence (`proof_hash`) to open community voting.
    /// Requires `0 yoctoNEAR` deposit (compatible with scoped Function-Call Access Keys).
    pub fn submit_milestone_proof(
        &mut self,
        project_id: String,
        milestone_idx: u32,
        proof_hash: String,
    ) {
        let caller = env::predecessor_account_id();
        let clean_proof = proof_hash.trim().to_string();
        require!(!clean_proof.is_empty(), "Proof hash cannot be empty");

        let project = self
            .projects
            .get_mut(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));

        require!(
            caller == project.sk_official,
            ERR_UNAUTHORIZED_SK_OFFICIAL
        );
        require!(
            project.status == ProjectStatus::Active,
            ERR_INVALID_PROJECT_STATE
        );
        require!(
            milestone_idx >= 1 && (milestone_idx as usize) <= project.milestones.len(),
            ERR_INVALID_MILESTONE_INDEX
        );

        // Enforce sequential milestone progression
        if milestone_idx > 1 {
            let prev = &project.milestones[(milestone_idx - 2) as usize];
            require!(
                prev.status == MilestoneStatus::Completed,
                ERR_PREVIOUS_MILESTONE_INCOMPLETE
            );
        }

        let m = &mut project.milestones[(milestone_idx - 1) as usize];
        require!(
            m.status == MilestoneStatus::Pending,
            ERR_INVALID_MILESTONE_STATE
        );

        m.proof_hash = Some(clean_proof.clone());
        m.status = MilestoneStatus::SubmittedForVote;
        project.current_milestone_idx = milestone_idx;
        project.updated_at_ns = env::block_timestamp();

        emit_nep297_event(
            "milestone_proof_submitted",
            &json!({
                "project_id": project_id,
                "milestone_idx": milestone_idx,
                "proof_hash": clean_proof,
                "sk_official": caller,
            }),
        );
    }

    /// Casts a verified resident's vote (`approve: true/false`) on a milestone in `SubmittedForVote`.
    ///
    /// Security & Financial Invariants:
    /// - Voter must be registered in `barangay.verified_residents` for `project.barangay_id` (defaults to `false`)
    /// - Voter cannot be `project.sk_official` or a `barangay_admin` of that barangay
    /// - Strictly 1 vote per resident per milestone (`!milestone.voters.contains_key(&caller)`)
    /// - Evaluates quorum using pure integer basis-point arithmetic (`u64`)
    pub fn vote_milestone(&mut self, project_id: String, milestone_idx: u32, approve: bool) {
        let voter = env::predecessor_account_id();

        let (barangay_id, sk_official, project_status, min_votes, quorum_bps) = {
            let p = self
                .projects
                .get(&project_id)
                .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));
            (
                p.barangay_id.clone(),
                p.sk_official.clone(),
                p.status,
                p.min_votes,
                p.quorum_bps,
            )
        };

        require!(
            project_status == ProjectStatus::Active,
            ERR_INVALID_PROJECT_STATE
        );

        let (is_resident, is_admin, eligible_residents_count, brgy_active) = {
            let brgy = self
                .barangays
                .get(&barangay_id)
                .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));
            (
                brgy.verified_residents.contains(&voter),
                brgy.admin_accounts.contains(&voter),
                brgy.verified_residents.len() as u32,
                brgy.active,
            )
        };

        require!(brgy_active, ERR_BARANGAY_INACTIVE);
        require!(is_resident, ERR_NOT_VERIFIED_RESIDENT);
        require!(
            voter != sk_official && !is_admin,
            ERR_SEPARATION_OF_DUTIES
        );

        let project = self.projects.get_mut(&project_id).unwrap();
        require!(
            milestone_idx >= 1 && (milestone_idx as usize) <= project.milestones.len(),
            ERR_INVALID_MILESTONE_INDEX
        );

        let m = &mut project.milestones[(milestone_idx - 1) as usize];
        require!(
            m.status == MilestoneStatus::SubmittedForVote,
            ERR_INVALID_MILESTONE_STATE
        );
        require!(!m.voters.contains_key(&voter), ERR_ALREADY_VOTED);

        m.voters.insert(voter.clone(), approve);
        if approve {
            m.votes_approve += 1;
        } else {
            m.votes_reject += 1;
        }

        let votes_approve = m.votes_approve;
        let votes_reject = m.votes_reject;
        let total_votes = votes_approve + votes_reject;
        let milestone_amount = m.amount_yocto.0;

        emit_nep297_event(
            "milestone_vote_cast",
            &json!({
                "project_id": project_id,
                "milestone_idx": milestone_idx,
                "voter": voter,
                "approve": approve,
                "votes_approve": votes_approve,
                "votes_reject": votes_reject,
                "total_votes": total_votes,
            }),
        );

        // Evaluate quorum only when minimum vote count is met
        if total_votes >= min_votes {
            let approve_scaled = (votes_approve as u64) * 10_000;
            let reject_scaled = (votes_reject as u64) * 10_000;
            let threshold_scaled = (total_votes as u64) * (quorum_bps as u64);

            if approve_scaled >= threshold_scaled {
                // Approval Quorum Reached: Reserve funds & transition to PayoutInFlight
                require!(
                    project.remaining_balance_yocto.0 >= milestone_amount,
                    ERR_INSUFFICIENT_ESCROW_BALANCE
                );
                project.remaining_balance_yocto =
                    U128(project.remaining_balance_yocto.0 - milestone_amount);
                project.reserved_in_flight_yocto =
                    U128(project.reserved_in_flight_yocto.0 + milestone_amount);
                project.milestones[(milestone_idx - 1) as usize].status =
                    MilestoneStatus::PayoutInFlight;
                project.status = ProjectStatus::PayoutInFlight;
                project.updated_at_ns = env::block_timestamp();

                self.dispatch_milestone_transfer(
                    project_id,
                    sk_official,
                    milestone_idx,
                    milestone_amount,
                );
            } else if reject_scaled >= threshold_scaled || total_votes >= eligible_residents_count {
                // Rejection Quorum Reached (or all eligible residents voted without reaching approval threshold)
                project.milestones[(milestone_idx - 1) as usize].status = MilestoneStatus::Rejected;
                project.status = ProjectStatus::Disputed;
                project.updated_at_ns = env::block_timestamp();

                emit_nep297_event(
                    "milestone_rejected",
                    &json!({
                        "project_id": project_id,
                        "milestone_idx": milestone_idx,
                        "votes_approve": votes_approve,
                        "votes_reject": votes_reject,
                    }),
                );
            }
        }
    }

    /// Allows the scoped `barangay_admin` to finalize a milestone vote once `total_votes >= min_votes`
    /// if the voting period concludes without meeting the `quorum_bps` approval threshold.
    pub fn finalize_milestone_vote(&mut self, project_id: String, milestone_idx: u32) {
        let barangay_id = self
            .projects
            .get(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND))
            .barangay_id
            .clone();
        self.assert_system_or_scoped_barangay_admin(&barangay_id);

        let project = self.projects.get_mut(&project_id).unwrap();
        require!(
            project.status == ProjectStatus::Active,
            ERR_INVALID_PROJECT_STATE
        );
        require!(
            milestone_idx >= 1 && (milestone_idx as usize) <= project.milestones.len(),
            ERR_INVALID_MILESTONE_INDEX
        );

        let m = &mut project.milestones[(milestone_idx - 1) as usize];
        require!(
            m.status == MilestoneStatus::SubmittedForVote,
            ERR_INVALID_MILESTONE_STATE
        );

        let total_votes = m.votes_approve + m.votes_reject;
        require!(
            total_votes >= project.min_votes,
            "Minimum votes not yet reached to finalize milestone"
        );

        let approve_scaled = (m.votes_approve as u64) * 10_000;
        let threshold_scaled = (total_votes as u64) * (project.quorum_bps as u64);
        require!(
            approve_scaled < threshold_scaled,
            "Milestone already meets approval threshold"
        );

        m.status = MilestoneStatus::Rejected;
        project.status = ProjectStatus::Disputed;
        project.updated_at_ns = env::block_timestamp();

        emit_nep297_event(
            "milestone_rejected",
            &json!({
                "project_id": project_id,
                "milestone_idx": milestone_idx,
                "votes_approve": m.votes_approve,
                "votes_reject": m.votes_reject,
                "finalized_by_admin": env::predecessor_account_id(),
            }),
        );
    }

    /// Refunds remaining locked escrow balance strictly back to `project.funder_treasury`
    /// after a milestone rejection (`ProjectStatus::Disputed`).
    /// Never sends refunds to `sk_official`.
    pub fn refund_project(&mut self, project_id: String) {
        let caller = env::predecessor_account_id();
        let (barangay_id, funder_treasury) = {
            let p = self
                .projects
                .get(&project_id)
                .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));
            (p.barangay_id.clone(), p.funder_treasury.clone())
        };

        let is_authorized = caller == funder_treasury
            || caller == self.system_admin
            || self.is_barangay_admin(barangay_id, caller);
        require!(is_authorized, ERR_UNAUTHORIZED_BARANGAY_ADMIN);

        let project = self.projects.get_mut(&project_id).unwrap();
        require!(
            project.status == ProjectStatus::Disputed,
            ERR_REFUND_NOT_ELIGIBLE
        );
        require!(
            project.remaining_balance_yocto.0 > 0 && project.reserved_in_flight_yocto.0 == 0,
            ERR_REFUND_NOT_ELIGIBLE
        );

        let refund_amount = project.remaining_balance_yocto.0;
        project.remaining_balance_yocto = U128(0);
        project.reserved_in_flight_yocto = U128(refund_amount);
        project.status = ProjectStatus::RefundInFlight;
        project.updated_at_ns = env::block_timestamp();

        emit_nep297_event(
            "project_refund_initiated",
            &json!({
                "project_id": project_id,
                "recipient_funder_treasury": funder_treasury,
                "amount_yocto": U128(refund_amount),
            }),
        );

        let _ = Promise::new(funder_treasury)
            .transfer(NearToken::from_yoctonear(refund_amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_TRANSFER_CALLBACK)
                    .on_refund_complete(project_id, U128(refund_amount)),
            );
    }

    // =========================================================================
    // 3. ASYNCHRONOUS PRIVATE CALLBACKS & FAILURE RECONCILIATION
    // =========================================================================

    #[private]
    pub fn on_transfer_complete(
        &mut self,
        project_id: String,
        milestone_idx: u32,
        amount_yocto: U128,
    ) -> bool {
        #[allow(deprecated)]
        let succeeded = matches!(env::promise_result(0), PromiseResult::Successful(_));
        self.apply_transfer_callback_outcome(project_id, milestone_idx, amount_yocto, succeeded)
    }

    #[private]
    pub fn on_refund_complete(&mut self, project_id: String, amount_yocto: U128) -> bool {
        #[allow(deprecated)]
        let succeeded = matches!(env::promise_result(0), PromiseResult::Successful(_));
        self.apply_refund_callback_outcome(project_id, amount_yocto, succeeded)
    }

    /// Re-initiates a milestone payout after an asynchronous transfer failure (`ReconciliationRequired`).
    /// Callable only by an authorized `barangay_admin` of the project's barangay.
    pub fn retry_failed_milestone_payout(&mut self, project_id: String, milestone_idx: u32) {
        let barangay_id = self
            .projects
            .get(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND))
            .barangay_id
            .clone();
        self.assert_system_or_scoped_barangay_admin(&barangay_id);

        let project = self.projects.get_mut(&project_id).unwrap();
        require!(
            project.status == ProjectStatus::ReconciliationRequired,
            ERR_INVALID_PROJECT_STATE
        );
        require!(
            milestone_idx >= 1 && (milestone_idx as usize) <= project.milestones.len(),
            ERR_INVALID_MILESTONE_INDEX
        );

        let m = &mut project.milestones[(milestone_idx - 1) as usize];
        require!(
            m.status == MilestoneStatus::Failed
                || m.status == MilestoneStatus::ReconciliationRequired,
            ERR_INVALID_MILESTONE_STATE
        );

        let amount = m.amount_yocto.0;
        require!(
            project.remaining_balance_yocto.0 >= amount,
            ERR_INSUFFICIENT_ESCROW_BALANCE
        );

        let sk_official = project.sk_official.clone();
        project.remaining_balance_yocto = U128(project.remaining_balance_yocto.0 - amount);
        project.reserved_in_flight_yocto = U128(project.reserved_in_flight_yocto.0 + amount);
        m.status = MilestoneStatus::PayoutInFlight;
        project.status = ProjectStatus::PayoutInFlight;
        project.updated_at_ns = env::block_timestamp();

        self.dispatch_milestone_transfer(project_id, sk_official, milestone_idx, amount);
    }

    /// Re-initiates a treasury refund after an asynchronous refund failure (`ReconciliationRequired`).
    pub fn retry_failed_refund(&mut self, project_id: String) {
        let barangay_id = self
            .projects
            .get(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND))
            .barangay_id
            .clone();
        self.assert_system_or_scoped_barangay_admin(&barangay_id);

        let project = self.projects.get_mut(&project_id).unwrap();
        require!(
            project.status == ProjectStatus::ReconciliationRequired,
            ERR_INVALID_PROJECT_STATE
        );
        require!(
            project.remaining_balance_yocto.0 > 0 && project.reserved_in_flight_yocto.0 == 0,
            ERR_REFUND_NOT_ELIGIBLE
        );

        let refund_amount = project.remaining_balance_yocto.0;
        let funder_treasury = project.funder_treasury.clone();
        project.remaining_balance_yocto = U128(0);
        project.reserved_in_flight_yocto = U128(refund_amount);
        project.status = ProjectStatus::RefundInFlight;
        project.updated_at_ns = env::block_timestamp();

        let _ = Promise::new(funder_treasury)
            .transfer(NearToken::from_yoctonear(refund_amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_TRANSFER_CALLBACK)
                    .on_refund_complete(project_id, U128(refund_amount)),
            );
    }

    // =========================================================================
    // 4. AI ATTESTATION RECORDING (ADVISORY NON-REPUDIATION ANCHOR)
    // =========================================================================

    /// Records a SHA-256 commitment of a backend AI procurement or milestone evidence audit.
    ///
    /// Security & Trust Boundary:
    /// - Strictly callable ONLY by `self.ai_auditor`
    /// - Never modifies escrow balances, milestone statuses, or resident votes
    pub fn record_ai_attestation(
        &mut self,
        project_id: String,
        target_type: String,
        milestone_idx: Option<u32>,
        report_sha256_hash: String,
        score: u8,
        recommendation: String,
    ) {
        let caller = env::predecessor_account_id();
        require!(caller == self.ai_auditor, ERR_UNAUTHORIZED_AUDITOR);

        let project = self
            .projects
            .get(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));

        let clean_target = target_type.trim().to_string();
        require!(
            clean_target == "proposal_procurement" || clean_target == "milestone_evidence",
            ERR_INVALID_ATTESTATION_TARGET
        );

        if clean_target == "milestone_evidence" {
            let idx = milestone_idx.unwrap_or_else(|| env::panic_str(ERR_INVALID_MILESTONE_INDEX));
            require!(
                idx >= 1 && (idx as usize) <= project.milestones.len(),
                ERR_INVALID_MILESTONE_INDEX
            );
        }

        let clean_hash = report_sha256_hash.trim().to_lowercase();
        require!(is_valid_sha256_hex(&clean_hash), ERR_INVALID_SHA256_HASH);
        require!(score <= 100, ERR_INVALID_AI_SCORE);

        let clean_rec = recommendation.trim().to_string();
        require!(
            clean_rec == "approve" || clean_rec == "revise" || clean_rec == "flag_high_risk",
            ERR_INVALID_AI_RECOMMENDATION
        );

        let barangay_id = project.barangay_id.clone();

        if !self.ai_attestations.contains_key(&project_id) {
            self.ai_attestations.insert(project_id.clone(), Vec::new());
        }

        let list = self.ai_attestations.get_mut(&project_id).unwrap();
        let is_dup = list.iter().any(|a| {
            a.target_type == clean_target
                && a.milestone_idx == milestone_idx
                && a.report_sha256_hash == clean_hash
        });
        require!(!is_dup, ERR_DUPLICATE_ATTESTATION);

        let attestation = AiAttestation {
            attestation_id: format!("att_{}_{}", project_id, list.len() + 1),
            project_id: project_id.clone(),
            barangay_id: barangay_id.clone(),
            target_type: clean_target.clone(),
            milestone_idx,
            report_sha256_hash: clean_hash.clone(),
            score,
            recommendation: clean_rec.clone(),
            recorded_at_ns: env::block_timestamp(),
            signer: caller.clone(),
        };

        list.push(attestation.clone());

        emit_nep297_event("ai_attestation_recorded", &attestation);
    }

    // =========================================================================
    // 5. READ-ONLY VIEW METHODS
    // =========================================================================

    pub fn get_system_admin(&self) -> AccountId {
        self.system_admin.clone()
    }

    pub fn get_ai_auditor(&self) -> AccountId {
        self.ai_auditor.clone()
    }

    pub fn get_barangay(&self, barangay_id: String) -> Option<BarangayView> {
        self.barangays.get(&barangay_id).map(BarangayView::from)
    }

    pub fn list_barangays(&self) -> Vec<BarangayView> {
        let mut out = Vec::new();
        for id in self.barangay_ids.iter() {
            if let Some(cfg) = self.barangays.get(id) {
                out.push(BarangayView::from(cfg));
            }
        }
        out
    }

    /// Strictly defaults to `false` if barangay or account is not found.
    pub fn is_barangay_admin(&self, barangay_id: String, account_id: AccountId) -> bool {
        self.barangays
            .get(&barangay_id)
            .map(|b| b.active && b.admin_accounts.contains(&account_id))
            .unwrap_or(false)
    }

    /// Strictly defaults to `false` if barangay or account is not found.
    pub fn is_sk_official(&self, barangay_id: String, account_id: AccountId) -> bool {
        self.barangays
            .get(&barangay_id)
            .map(|b| b.active && b.sk_officials.contains(&account_id))
            .unwrap_or(false)
    }

    /// Strictly defaults to `false` if barangay or account is not found.
    pub fn is_verified_resident(&self, barangay_id: String, account_id: AccountId) -> bool {
        self.barangays
            .get(&barangay_id)
            .map(|b| b.active && b.verified_residents.contains(&account_id))
            .unwrap_or(false)
    }

    pub fn get_project(&self, project_id: String) -> Option<Project> {
        self.projects.get(&project_id).cloned()
    }

    pub fn get_projects_by_barangay(&self, barangay_id: String) -> Vec<Project> {
        let mut out = Vec::new();
        if let Some(ids) = self.projects_by_barangay.get(&barangay_id) {
            for pid in ids.iter() {
                if let Some(proj) = self.projects.get(pid) {
                    out.push(proj.clone());
                }
            }
        }
        out
    }

    pub fn get_ai_attestations(&self, project_id: String) -> Vec<AiAttestation> {
        self.ai_attestations
            .get(&project_id)
            .cloned()
            .unwrap_or_default()
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    fn assert_system_admin(&self) {
        require!(
            env::predecessor_account_id() == self.system_admin,
            ERR_UNAUTHORIZED_SYSTEM_ADMIN
        );
    }

    fn assert_system_or_scoped_barangay_admin(&self, barangay_id: &str) {
        let caller = env::predecessor_account_id();
        if caller == self.system_admin {
            return;
        }
        let brgy = self
            .barangays
            .get(barangay_id)
            .unwrap_or_else(|| env::panic_str(ERR_BARANGAY_NOT_FOUND));
        require!(brgy.active, ERR_BARANGAY_INACTIVE);
        require!(
            brgy.admin_accounts.contains(&caller),
            ERR_UNAUTHORIZED_BARANGAY_ADMIN
        );
    }

    fn validate_quorum_parameters(
        barangay_id: &str,
        quorum_bps: u16,
        min_votes: u32,
        is_demo: bool,
    ) {
        require!(
            (5000..=10_000).contains(&quorum_bps),
            ERR_INVALID_QUORUM_CONFIG
        );
        if is_demo {
            require!(
                barangay_id == DEMO_BARANGAY_ID && min_votes >= 1,
                ERR_INVALID_QUORUM_CONFIG
            );
        } else {
            require!(
                barangay_id != DEMO_BARANGAY_ID && min_votes >= 3,
                ERR_INVALID_QUORUM_CONFIG
            );
        }
    }

    fn dispatch_milestone_transfer(
        &self,
        project_id: String,
        recipient: AccountId,
        milestone_idx: u32,
        amount_yocto: u128,
    ) {
        emit_nep297_event(
            "milestone_payout_initiated",
            &json!({
                "project_id": project_id,
                "milestone_idx": milestone_idx,
                "recipient": recipient,
                "amount_yocto": U128(amount_yocto),
            }),
        );

        let _ = Promise::new(recipient)
            .transfer(NearToken::from_yoctonear(amount_yocto))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_TRANSFER_CALLBACK)
                    .on_transfer_complete(project_id, milestone_idx, U128(amount_yocto)),
            );
    }

    pub fn apply_transfer_callback_outcome(
        &mut self,
        project_id: String,
        milestone_idx: u32,
        amount_yocto: U128,
        succeeded: bool,
    ) -> bool {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Callback can only be invoked by the contract itself"
        );
        let project = self
            .projects
            .get_mut(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));

        let m_pos = (milestone_idx - 1) as usize;
        require!(
            project.milestones[m_pos].status == MilestoneStatus::PayoutInFlight,
            ERR_INVALID_MILESTONE_STATE
        );

        let amount = amount_yocto.0;
        project.reserved_in_flight_yocto =
            U128(project.reserved_in_flight_yocto.0.saturating_sub(amount));

        if succeeded {
            project.total_disbursed_yocto = U128(project.total_disbursed_yocto.0 + amount);
            project.milestones[m_pos].status = MilestoneStatus::Completed;
            project.milestones[m_pos].released_at_ns = Some(env::block_timestamp());

            let all_completed = project
                .milestones
                .iter()
                .all(|m| m.status == MilestoneStatus::Completed);

            if all_completed {
                project.status = ProjectStatus::Completed;
            } else {
                project.status = ProjectStatus::Active;
                if (milestone_idx as usize) < project.milestones.len() {
                    project.current_milestone_idx = milestone_idx + 1;
                }
            }
            project.updated_at_ns = env::block_timestamp();

            emit_nep297_event(
                "milestone_released",
                &json!({
                    "project_id": project_id,
                    "milestone_idx": milestone_idx,
                    "recipient_sk_official": project.sk_official,
                    "amount_yocto": amount_yocto,
                    "remaining_balance_yocto": project.remaining_balance_yocto,
                    "project_status": project.status,
                }),
            );
            true
        } else {
            // Rollback reserved balance into remaining_balance_yocto and flag ReconciliationRequired
            project.remaining_balance_yocto = U128(project.remaining_balance_yocto.0 + amount);
            project.milestones[m_pos].status = MilestoneStatus::Failed;
            project.status = ProjectStatus::ReconciliationRequired;
            project.updated_at_ns = env::block_timestamp();

            emit_nep297_event(
                "transfer_failed_rollback",
                &json!({
                    "project_id": project_id,
                    "milestone_idx": milestone_idx,
                    "restored_amount_yocto": amount_yocto,
                    "remaining_balance_yocto": project.remaining_balance_yocto,
                }),
            );
            false
        }
    }

    pub fn apply_refund_callback_outcome(
        &mut self,
        project_id: String,
        amount_yocto: U128,
        succeeded: bool,
    ) -> bool {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Callback can only be invoked by the contract itself"
        );
        let project = self
            .projects
            .get_mut(&project_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROJECT_NOT_FOUND));

        require!(
            project.status == ProjectStatus::RefundInFlight,
            ERR_INVALID_PROJECT_STATE
        );

        let amount = amount_yocto.0;
        project.reserved_in_flight_yocto =
            U128(project.reserved_in_flight_yocto.0.saturating_sub(amount));

        if succeeded {
            project.total_refunded_yocto = U128(project.total_refunded_yocto.0 + amount);
            project.status = ProjectStatus::Refunded;
            project.updated_at_ns = env::block_timestamp();

            emit_nep297_event(
                "project_refunded",
                &json!({
                    "project_id": project_id,
                    "recipient_funder_treasury": project.funder_treasury,
                    "refunded_amount_yocto": amount_yocto,
                }),
            );
            true
        } else {
            // Rollback reserved refund amount and mark ReconciliationRequired
            project.remaining_balance_yocto = U128(project.remaining_balance_yocto.0 + amount);
            project.status = ProjectStatus::ReconciliationRequired;
            project.updated_at_ns = env::block_timestamp();

            emit_nep297_event(
                "refund_failed_rollback",
                &json!({
                    "project_id": project_id,
                    "restored_amount_yocto": amount_yocto,
                    "remaining_balance_yocto": project.remaining_balance_yocto,
                }),
            );
            false
        }
    }
}

#[cfg(test)]
mod tests;


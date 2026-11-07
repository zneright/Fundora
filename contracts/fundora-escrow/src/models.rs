//! Fundora — Smart Contract Data Structures & State Models

use near_sdk::json_types::U128;
use near_sdk::near;
use near_sdk::AccountId;
use std::collections::{BTreeMap, BTreeSet};

/// Reserved storage stake per project (`0.05 NEAR` = `50 * 10^21 yoctoNEAR`)
pub const STORAGE_RESERVE_YOCTO: u128 = 50_000_000_000_000_000_000_000;

/// Canonical demo barangay ID allowed to configure `min_votes = 1`
pub const DEMO_BARANGAY_ID: &str = "brgy_demo_001";

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProjectStatus {
    Active,
    PayoutInFlight,
    Completed,
    Disputed,
    RefundInFlight,
    Refunded,
    ReconciliationRequired,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MilestoneStatus {
    Pending,
    SubmittedForVote,
    PayoutInFlight,
    Completed,
    Rejected,
    Failed,
    ReconciliationRequired,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct BarangayConfig {
    pub barangay_id: String,
    pub psgc_code: String,
    pub name: String,
    pub active: bool,
    pub is_demo: bool,
    pub quorum_bps: u16,
    pub min_votes: u32,
    pub admin_accounts: BTreeSet<AccountId>,
    pub sk_officials: BTreeSet<AccountId>,
    pub verified_residents: BTreeSet<AccountId>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BarangayView {
    pub barangay_id: String,
    pub psgc_code: String,
    pub name: String,
    pub active: bool,
    pub is_demo: bool,
    pub quorum_bps: u16,
    pub min_votes: u32,
    pub admin_accounts: Vec<AccountId>,
    pub sk_officials: Vec<AccountId>,
    pub verified_residents_count: u32,
}

impl From<&BarangayConfig> for BarangayView {
    fn from(cfg: &BarangayConfig) -> Self {
        Self {
            barangay_id: cfg.barangay_id.clone(),
            psgc_code: cfg.psgc_code.clone(),
            name: cfg.name.clone(),
            active: cfg.active,
            is_demo: cfg.is_demo,
            quorum_bps: cfg.quorum_bps,
            min_votes: cfg.min_votes,
            admin_accounts: cfg.admin_accounts.iter().cloned().collect(),
            sk_officials: cfg.sk_officials.iter().cloned().collect(),
            verified_residents_count: cfg.verified_residents.len() as u32,
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct MilestoneInput {
    pub title: String,
    pub percentage_bps: u16,
    pub is_upfront: bool,
    pub amount_yocto: Option<U128>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub index: u32,
    pub title: String,
    pub percentage_bps: u16,
    pub amount_yocto: U128,
    pub is_upfront: bool,
    pub status: MilestoneStatus,
    pub proof_hash: Option<String>,
    pub votes_approve: u32,
    pub votes_reject: u32,
    pub voters: BTreeMap<AccountId, bool>,
    pub released_at_ns: Option<u64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Project {
    pub project_id: String,
    pub barangay_id: String,
    pub name: String,
    pub metadata_hash: String,
    pub funder_treasury: AccountId,
    pub sk_official: AccountId,
    pub total_budget_yocto: U128,
    pub remaining_balance_yocto: U128,
    pub reserved_in_flight_yocto: U128,
    pub total_disbursed_yocto: U128,
    pub total_refunded_yocto: U128,
    pub storage_deposit_reserved: U128,
    pub status: ProjectStatus,
    pub current_milestone_idx: u32,
    pub quorum_bps: u16,
    pub min_votes: u32,
    pub milestones: Vec<Milestone>,
    pub created_at_ns: u64,
    pub updated_at_ns: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AiAttestation {
    pub attestation_id: String,
    pub project_id: String,
    pub barangay_id: String,
    pub target_type: String,
    pub milestone_idx: Option<u32>,
    pub report_sha256_hash: String,
    pub score: u8,
    pub recommendation: String,
    pub recorded_at_ns: u64,
    pub signer: AccountId,
}


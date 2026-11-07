//! Fundora — Comprehensive Smart Contract Unit Test Suite
//! Covers SC-TEST-01 through SC-TEST-07 and Security/Financial Invariants.

use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, NearToken};

const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn setup_context(predecessor: &str, deposit_yocto: u128) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(acc("escrow.fundora.testnet"))
        .signer_account_id(acc(predecessor))
        .predecessor_account_id(acc(predecessor))
        .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
        .block_timestamp(1_762_500_000_000_000_000);
    builder
}

fn init_contract() -> FundoraContract {
    let ctx = setup_context("sysadmin.fundora.testnet", 0);
    testing_env!(ctx.build());
    FundoraContract::new(
        acc("sysadmin.fundora.testnet"),
        acc("auditor.fundora.testnet"),
    )
}

fn setup_two_barangays(contract: &mut FundoraContract) {
    let ctx = setup_context("sysadmin.fundora.testnet", 0);
    testing_env!(ctx.build());

    // Register Bucandala III (Imus, Cavite)
    contract.register_barangay(
        "brgy_0421090180".to_string(),
        "0421090180".to_string(),
        "Bucandala III".to_string(),
        acc("admin.bucandala3.testnet"),
        6000,
        3,
        false,
    );

    // Register Bel-Air (Makati, NCR)
    contract.register_barangay(
        "brgy_1376020030".to_string(),
        "1376020030".to_string(),
        "Bel-Air".to_string(),
        acc("admin.belair.testnet"),
        6000,
        3,
        false,
    );

    // Populate roles for Bucandala III
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.set_sk_official("brgy_0421090180".to_string(), acc("sk.bucandala3.testnet"), true);
    contract.register_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res1.bucandala3.testnet"),
        true,
    );
    contract.register_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res2.bucandala3.testnet"),
        true,
    );
    contract.register_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res3.bucandala3.testnet"),
        true,
    );
    contract.register_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res4.bucandala3.testnet"),
        true,
    );
    contract.register_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res5.bucandala3.testnet"),
        true,
    );

    // Populate roles for Bel-Air
    testing_env!(setup_context("admin.belair.testnet", 0).build());
    contract.set_sk_official("brgy_1376020030".to_string(), acc("sk.belair.testnet"), true);
    contract.register_verified_resident(
        "brgy_1376020030".to_string(),
        acc("res1.belair.testnet"),
        true,
    );
}

fn default_milestones_40_40_20() -> Vec<MilestoneInput> {
    vec![
        MilestoneInput {
            title: "Phase 1: Site Mobilization & Materials".to_string(),
            percentage_bps: 4000,
            is_upfront: true,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 2: Mid-Project Installation".to_string(),
            percentage_bps: 4000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 3: Final Inspection & Turnover".to_string(),
            percentage_bps: 2000,
            is_upfront: false,
            amount_yocto: None,
        },
    ]
}

fn assert_project_balance_invariant(project: &Project) {
    let sum = project.remaining_balance_yocto.0
        + project.reserved_in_flight_yocto.0
        + project.total_disbursed_yocto.0
        + project.total_refunded_yocto.0;
    assert_eq!(
        sum, project.total_budget_yocto.0,
        "Financial Invariant Violation: remaining + in_flight + disbursed + refunded != total_budget"
    );
}

// =============================================================================
// SC-TEST-01: Barangay Registration and Multi-Barangay Isolation
// =============================================================================

#[test]
fn sc_test_01_barangay_registration_and_isolation() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);

    let b1 = contract
        .get_barangay("brgy_0421090180".to_string())
        .expect("Bucandala III should exist");
    assert_eq!(b1.psgc_code, "0421090180");
    assert_eq!(b1.quorum_bps, 6000);
    assert_eq!(b1.min_votes, 3);
    assert!(!b1.is_demo);
    assert_eq!(b1.verified_residents_count, 5);

    let demo = contract
        .get_barangay("brgy_demo_001".to_string())
        .expect("Demo barangay should be pre-seeded");
    assert!(demo.is_demo);
    assert_eq!(demo.min_votes, 1);

    // Verify cross-barangay isolation on view checks
    assert!(contract.is_barangay_admin(
        "brgy_0421090180".to_string(),
        acc("admin.bucandala3.testnet")
    ));
    assert!(!contract.is_barangay_admin(
        "brgy_1376020030".to_string(),
        acc("admin.bucandala3.testnet")
    ));
    assert!(contract.is_verified_resident(
        "brgy_0421090180".to_string(),
        acc("res1.bucandala3.testnet")
    ));
    assert!(!contract.is_verified_resident(
        "brgy_1376020030".to_string(),
        acc("res1.bucandala3.testnet")
    ));
}

#[test]
#[should_panic(expected = "ERR_BARANGAY_ALREADY_EXISTS")]
fn sc_test_01_rejects_duplicate_barangay_registration() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);

    testing_env!(setup_context("sysadmin.fundora.testnet", 0).build());
    contract.register_barangay(
        "brgy_0421090180".to_string(),
        "0421090180".to_string(),
        "Bucandala III Duplicate".to_string(),
        acc("admin.bucandala3.testnet"),
        6000,
        3,
        false,
    );
}

#[test]
#[should_panic(expected = "ERR_UNAUTHORIZED_SYSTEM_ADMIN")]
fn sc_test_01_rejects_unauthorized_barangay_registration() {
    let mut contract = init_contract();
    testing_env!(setup_context("attacker.testnet", 0).build());
    contract.register_barangay(
        "brgy_9999999999".to_string(),
        "9999999999".to_string(),
        "Fake Barangay".to_string(),
        acc("attacker.testnet"),
        6000,
        3,
        false,
    );
}

#[test]
#[should_panic(expected = "ERR_INVALID_QUORUM_CONFIG")]
fn sc_test_01_rejects_standard_barangay_with_min_votes_below_3() {
    let mut contract = init_contract();
    testing_env!(setup_context("sysadmin.fundora.testnet", 0).build());
    contract.register_barangay(
        "brgy_0421090160".to_string(),
        "0421090160".to_string(),
        "Bucandala I".to_string(),
        acc("admin.bucandala1.testnet"),
        6000,
        1, // Not allowed for non-demo barangays!
        false,
    );
}

#[test]
#[should_panic(expected = "ERR_UNAUTHORIZED_BARANGAY_ADMIN")]
fn sc_test_01_prevents_cross_barangay_admin_mutation() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);

    // Admin of Bucandala III attempts to register a resident in Bel-Air
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.register_verified_resident(
        "brgy_1376020030".to_string(),
        acc("intruder.testnet"),
        true,
    );
}

// =============================================================================
// SC-TEST-02: Role Authorization & Default-to-False Invariant
// =============================================================================

#[test]
fn sc_test_02_role_authorization_defaults_to_false() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);

    // Unknown account and unknown barangay must always return false (never unwrap_or(true))
    assert!(!contract.is_verified_resident(
        "brgy_0421090180".to_string(),
        acc("unregistered.testnet")
    ));
    assert!(!contract.is_verified_resident(
        "brgy_nonexistent".to_string(),
        acc("res1.bucandala3.testnet")
    ));
    assert!(!contract.is_sk_official(
        "brgy_0421090180".to_string(),
        acc("res1.bucandala3.testnet")
    ));

    // Revoking SK official immediately removes permission
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.set_sk_official(
        "brgy_0421090180".to_string(),
        acc("sk.bucandala3.testnet"),
        false,
    );
    assert!(!contract.is_sk_official(
        "brgy_0421090180".to_string(),
        acc("sk.bucandala3.testnet")
    ));
}

// =============================================================================
// SC-TEST-03: Project Creation, Configurable Allocations (40/40/20 & 40/30/30) & Funding
// =============================================================================

#[test]
fn sc_test_03_project_creation_supports_40_40_20_and_40_30_30_splits() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);

    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    // 1. Create Project with 40/40/20 split
    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_bucandala3_40_40_20".to_string(),
        "brgy_0421090180".to_string(),
        "Youth Digital Hub".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );

    let p1 = contract
        .get_project("prop_bucandala3_40_40_20".to_string())
        .unwrap();
    assert_eq!(p1.milestones[0].amount_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p1.milestones[1].amount_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p1.milestones[2].amount_yocto.0, 2 * ONE_NEAR);
    assert_eq!(p1.reserved_in_flight_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p1.remaining_balance_yocto.0, 6 * ONE_NEAR);
    assert_project_balance_invariant(&p1);

    // 2. Create Project with 40/30/30 split
    let milestones_40_30_30 = vec![
        MilestoneInput {
            title: "Phase 1".to_string(),
            percentage_bps: 4000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 2".to_string(),
            percentage_bps: 3000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 3".to_string(),
            percentage_bps: 3000,
            is_upfront: false,
            amount_yocto: None,
        },
    ];
    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_bucandala3_40_30_30".to_string(),
        "brgy_0421090180".to_string(),
        "Community Sports Clinic".to_string(),
        "b".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        milestones_40_30_30,
        false,
    );

    let p2 = contract
        .get_project("prop_bucandala3_40_30_30".to_string())
        .unwrap();
    assert_eq!(p2.milestones[0].amount_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p2.milestones[1].amount_yocto.0, 3 * ONE_NEAR);
    assert_eq!(p2.milestones[2].amount_yocto.0, 3 * ONE_NEAR);
    assert_project_balance_invariant(&p2);
}

#[test]
#[should_panic(expected = "ERR_DUPLICATE_PROJECT_ID")]
fn sc_test_03_rejects_duplicate_project_id() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_dup_001".to_string(),
        "brgy_0421090180".to_string(),
        "First Project".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );

    contract.create_project(
        "prop_dup_001".to_string(),
        "brgy_0421090180".to_string(),
        "Second Project Same ID".to_string(),
        "b".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_ATTACHED_DEPOSIT")]
fn sc_test_03_rejects_insufficient_attached_deposit() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;

    // Missing STORAGE_RESERVE_YOCTO
    testing_env!(setup_context("admin.bucandala3.testnet", budget).build());
    contract.create_project(
        "prop_underfunded".to_string(),
        "brgy_0421090180".to_string(),
        "Underfunded Project".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
}

#[test]
#[should_panic(expected = "ERR_INVALID_MILESTONE_BPS_SUM")]
fn sc_test_03_rejects_invalid_milestone_percentages() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    let bad_milestones = vec![
        MilestoneInput {
            title: "Phase 1".to_string(),
            percentage_bps: 5000,
            is_upfront: true,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 2".to_string(),
            percentage_bps: 4000, // Sum is 9000 != 10000
            is_upfront: false,
            amount_yocto: None,
        },
    ];

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_bad_bps".to_string(),
        "brgy_0421090180".to_string(),
        "Bad BPS Project".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        bad_milestones,
        true,
    );
}

#[test]
#[should_panic(expected = "ERR_UNAUTHORIZED_SK_OFFICIAL")]
fn sc_test_03_rejects_cross_barangay_sk_official_in_create_project() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    // Admin of Bucandala III tries to assign SK Official from Bel-Air
    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_cross_sk".to_string(),
        "brgy_0421090180".to_string(),
        "Cross SK Project".to_string(),
        "a".repeat(64),
        acc("sk.belair.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
}

// =============================================================================
// SC-TEST-04: Initial & Subsequent Milestone Payouts, Callbacks & Failed Transfer Rollback
// =============================================================================

#[test]
fn sc_test_04_milestone_payouts_and_failed_transfer_recovery() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_payout_001".to_string(),
        "brgy_0421090180".to_string(),
        "Solar Streetlights".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );

    // 1. Confirm Phase 1 Upfront Mobilization Callback Success
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    let ok = contract.apply_transfer_callback_outcome(
        "prop_payout_001".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );
    assert!(ok);

    let p_after_m1 = contract.get_project("prop_payout_001".to_string()).unwrap();
    assert_eq!(p_after_m1.milestones[0].status, MilestoneStatus::Completed);
    assert_eq!(p_after_m1.total_disbursed_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p_after_m1.remaining_balance_yocto.0, 6 * ONE_NEAR);
    assert_eq!(p_after_m1.reserved_in_flight_yocto.0, 0);
    assert_eq!(p_after_m1.status, ProjectStatus::Active);
    assert_project_balance_invariant(&p_after_m1);

    // 2. Submit Proof for Milestone 2 (40% = 4 NEAR)
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof(
        "prop_payout_001".to_string(),
        2,
        "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi".to_string(),
    );

    // 3. Three Verified Residents Vote Approve -> Triggers PayoutInFlight
    for voter in [
        "res1.bucandala3.testnet",
        "res2.bucandala3.testnet",
        "res3.bucandala3.testnet",
    ] {
        testing_env!(setup_context(voter, 0).build());
        contract.vote_milestone("prop_payout_001".to_string(), 2, true);
    }

    let p_in_flight = contract.get_project("prop_payout_001".to_string()).unwrap();
    assert_eq!(
        p_in_flight.milestones[1].status,
        MilestoneStatus::PayoutInFlight
    );
    assert_eq!(p_in_flight.status, ProjectStatus::PayoutInFlight);
    assert_eq!(p_in_flight.reserved_in_flight_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p_in_flight.remaining_balance_yocto.0, 2 * ONE_NEAR);
    assert_project_balance_invariant(&p_in_flight);

    // 4. Simulate Asynchronous Transfer Failure -> Verifies Rollback & ReconciliationRequired
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    let failed_cb = contract.apply_transfer_callback_outcome(
        "prop_payout_001".to_string(),
        2,
        U128(4 * ONE_NEAR),
        false,
    );
    assert!(!failed_cb);

    let p_rolled_back = contract.get_project("prop_payout_001".to_string()).unwrap();
    assert_eq!(p_rolled_back.milestones[1].status, MilestoneStatus::Failed);
    assert_eq!(
        p_rolled_back.status,
        ProjectStatus::ReconciliationRequired
    );
    assert_eq!(p_rolled_back.reserved_in_flight_yocto.0, 0);
    assert_eq!(p_rolled_back.remaining_balance_yocto.0, 6 * ONE_NEAR); // 4 NEAR restored!
    assert_project_balance_invariant(&p_rolled_back);

    // 5. Authorized Admin Retries Failed Milestone Payout & Callback Succeeds
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.retry_failed_milestone_payout("prop_payout_001".to_string(), 2);

    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_payout_001".to_string(),
        2,
        U128(4 * ONE_NEAR),
        true,
    );

    let p_m2_done = contract.get_project("prop_payout_001".to_string()).unwrap();
    assert_eq!(p_m2_done.milestones[1].status, MilestoneStatus::Completed);
    assert_eq!(p_m2_done.total_disbursed_yocto.0, 8 * ONE_NEAR);
    assert_eq!(p_m2_done.remaining_balance_yocto.0, 2 * ONE_NEAR);
    assert_eq!(p_m2_done.status, ProjectStatus::Active);
    assert_project_balance_invariant(&p_m2_done);
}

// =============================================================================
// SC-TEST-05: Resident Eligibility, Quorum Math (Exact 60%, Below 60%, Min Votes) & Demo Mode
// =============================================================================

#[test]
fn sc_test_05_quorum_exact_60_percent_and_minimum_votes() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_quorum_60".to_string(),
        "brgy_0421090180".to_string(),
        "Barangay Library Upgrade".to_string(),
        "c".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        false, // Phase 1 requires vote too when immediate_phase_1 == false and is_upfront == false
    );

    // Phase 1 had is_upfront = true in default_milestones_40_40_20, so confirm Phase 1 first
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_quorum_60".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );

    // Submit proof for Milestone 2
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_quorum_60".to_string(), 2, "proof_m2_hash".to_string());

    // Vote 1: Approve (1/1 = 100%, but total_votes = 1 < min_votes = 3 -> stays SubmittedForVote)
    testing_env!(setup_context("res1.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_quorum_60".to_string(), 2, true);
    assert_eq!(
        contract
            .get_project("prop_quorum_60".to_string())
            .unwrap()
            .milestones[1]
            .status,
        MilestoneStatus::SubmittedForVote
    );

    // Vote 2: Reject (1/2 = 50%, total_votes = 2 < min_votes = 3 -> stays SubmittedForVote)
    testing_env!(setup_context("res2.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_quorum_60".to_string(), 2, false);

    // Vote 3: Approve (2/3 = 66.66% >= 60%, total_votes = 3 >= 3 -> PayoutInFlight!)
    testing_env!(setup_context("res3.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_quorum_60".to_string(), 2, true);
    assert_eq!(
        contract
            .get_project("prop_quorum_60".to_string())
            .unwrap()
            .milestones[1]
            .status,
        MilestoneStatus::PayoutInFlight
    );

    // Complete Milestone 2 callback
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_quorum_60".to_string(),
        2,
        U128(4 * ONE_NEAR),
        true,
    );

    // Submit proof for Milestone 3 and test 4 votes (2 approve, 2 reject = 50% < 60%) followed by 5th vote (3/5 = exact 60.00%)
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_quorum_60".to_string(), 3, "proof_m3_hash".to_string());

    // Configure min_votes = 4 for this test or cast: Approve, Reject, Approve, Reject (at vote 3 it would be 2/3, so cast Reject, Approve, Reject, Approve!)
    // Look: Vote 1 = Reject (0/1), Vote 2 = Approve (1/2), Vote 3 = Reject (1/3 = 33.33% approve, 66.67% reject -> Rejects at 3!)
    // What if min_votes is set to 4 before project creation? Let's test exact 3/5 = 60.00% with min_votes = 5!
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.configure_barangay_quorum("brgy_0421090180".to_string(), 6000, 4);

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_exact_60_of_5".to_string(),
        "brgy_0421090180".to_string(),
        "Exact 60 Percent Test".to_string(),
        "d".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_exact_60_of_5".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_exact_60_of_5".to_string(), 2, "proof_hash".to_string());

    // Cast 4 votes: 2 approve, 2 reject (50.00% approve, 50.00% reject -> neither >= 60%, stays SubmittedForVote!)
    testing_env!(setup_context("res1.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_exact_60_of_5".to_string(), 2, true);
    testing_env!(setup_context("res2.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_exact_60_of_5".to_string(), 2, false);
    testing_env!(setup_context("res3.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_exact_60_of_5".to_string(), 2, true);
    testing_env!(setup_context("res4.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_exact_60_of_5".to_string(), 2, false);

    let p_at_4 = contract
        .get_project("prop_exact_60_of_5".to_string())
        .unwrap();
    assert_eq!(
        p_at_4.milestones[1].status,
        MilestoneStatus::SubmittedForVote
    );

    // 5th vote: Approve -> 3 approve, 2 reject = 3/5 = EXACTLY 60.00% (6000 bps) -> PayoutInFlight!
    testing_env!(setup_context("res5.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_exact_60_of_5".to_string(), 2, true);
    let p_at_5 = contract
        .get_project("prop_exact_60_of_5".to_string())
        .unwrap();
    assert_eq!(
        p_at_5.milestones[1].status,
        MilestoneStatus::PayoutInFlight
    );
}

#[test]
fn sc_test_05_demo_barangay_allows_single_judge_vote() {
    let mut contract = init_contract();
    let budget = 5 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("sysadmin.fundora.testnet", 0).build());
    contract.set_sk_official(
        "brgy_demo_001".to_string(),
        acc("sk.demo.testnet"),
        true,
    );
    contract.register_verified_resident(
        "brgy_demo_001".to_string(),
        acc("judge.demo.testnet"),
        true,
    );

    testing_env!(setup_context("sysadmin.fundora.testnet", deposit).build());
    contract.create_project(
        "prop_demo_001".to_string(),
        "brgy_demo_001".to_string(),
        "Demo Sandbox Project".to_string(),
        "e".repeat(64),
        acc("sk.demo.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );

    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_demo_001".to_string(),
        1,
        U128(2 * ONE_NEAR),
        true,
    );

    testing_env!(setup_context("sk.demo.testnet", 0).build());
    contract.submit_milestone_proof("prop_demo_001".to_string(), 2, "demo_proof".to_string());

    // Single judge vote in brgy_demo_001 (min_votes = 1) immediately approves Milestone 2
    testing_env!(setup_context("judge.demo.testnet", 0).build());
    contract.vote_milestone("prop_demo_001".to_string(), 2, true);

    let demo_proj = contract.get_project("prop_demo_001".to_string()).unwrap();
    assert_eq!(
        demo_proj.milestones[1].status,
        MilestoneStatus::PayoutInFlight
    );
}

#[test]
#[should_panic(expected = "ERR_NOT_VERIFIED_RESIDENT")]
fn sc_test_05_rejects_cross_barangay_resident_vote() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_buc3".to_string(),
        "brgy_0421090180".to_string(),
        "Bucandala Project".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_buc3".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_buc3".to_string(), 2, "proof".to_string());

    // Verified resident of Bel-Air tries to vote on Bucandala III project
    testing_env!(setup_context("res1.belair.testnet", 0).build());
    contract.vote_milestone("prop_buc3".to_string(), 2, true);
}

#[test]
#[should_panic(expected = "ERR_ALREADY_VOTED")]
fn sc_test_05_rejects_duplicate_vote_by_same_resident() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_dup_vote".to_string(),
        "brgy_0421090180".to_string(),
        "Dup Vote Test".to_string(),
        "a".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_dup_vote".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_dup_vote".to_string(), 2, "proof".to_string());

    testing_env!(setup_context("res1.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_dup_vote".to_string(), 2, true);
    // Second vote by same resident must panic
    contract.vote_milestone("prop_dup_vote".to_string(), 2, false);
}

// =============================================================================
// SC-TEST-06: Rejection and Treasury Refund (Strictly to funder_treasury, Never SK)
// =============================================================================

#[test]
fn sc_test_06_rejection_and_treasury_refund_with_failure_recovery() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_refund_001".to_string(),
        "brgy_0421090180".to_string(),
        "Failed Drainage Project".to_string(),
        "f".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );

    // Phase 1 (4 NEAR) mobilized to sk_official
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_refund_001".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );

    // Submit Milestone 2 proof
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_refund_001".to_string(), 2, "substandard_proof".to_string());

    // 3 residents vote: 1 approve, 2 reject (66.67% reject >= 60% -> Milestone 2 Rejected & Project Disputed)
    testing_env!(setup_context("res1.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_refund_001".to_string(), 2, true);
    testing_env!(setup_context("res2.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_refund_001".to_string(), 2, false);
    testing_env!(setup_context("res3.bucandala3.testnet", 0).build());
    contract.vote_milestone("prop_refund_001".to_string(), 2, false);

    let p_disputed = contract.get_project("prop_refund_001".to_string()).unwrap();
    assert_eq!(p_disputed.milestones[1].status, MilestoneStatus::Rejected);
    assert_eq!(p_disputed.status, ProjectStatus::Disputed);
    assert_eq!(p_disputed.remaining_balance_yocto.0, 6 * ONE_NEAR);

    // Barangay Admin calls refund_project -> reserves remaining 6 NEAR for funder_treasury
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.refund_project("prop_refund_001".to_string());

    let logs = get_logs();
    assert!(logs
        .iter()
        .any(|l| l.contains("\"recipient_funder_treasury\":\"admin.bucandala3.testnet\"")));
    assert!(!logs
        .iter()
        .any(|l| l.contains("\"recipient_funder_treasury\":\"sk.bucandala3.testnet\"")));

    let p_in_refund = contract.get_project("prop_refund_001".to_string()).unwrap();
    assert_eq!(p_in_refund.status, ProjectStatus::RefundInFlight);
    assert_eq!(p_in_refund.remaining_balance_yocto.0, 0);
    assert_eq!(p_in_refund.reserved_in_flight_yocto.0, 6 * ONE_NEAR);
    assert_project_balance_invariant(&p_in_refund);

    // Simulate failed refund transfer first -> verifies rollback to ReconciliationRequired
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    let refund_fail = contract.apply_refund_callback_outcome(
        "prop_refund_001".to_string(),
        U128(6 * ONE_NEAR),
        false,
    );
    assert!(!refund_fail);

    let p_refund_rollback = contract.get_project("prop_refund_001".to_string()).unwrap();
    assert_eq!(
        p_refund_rollback.status,
        ProjectStatus::ReconciliationRequired
    );
    assert_eq!(p_refund_rollback.remaining_balance_yocto.0, 6 * ONE_NEAR);
    assert_eq!(p_refund_rollback.reserved_in_flight_yocto.0, 0);
    assert_project_balance_invariant(&p_refund_rollback);

    // Retry failed refund & confirm success
    testing_env!(setup_context("admin.bucandala3.testnet", 0).build());
    contract.retry_failed_refund("prop_refund_001".to_string());

    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    let refund_ok = contract.apply_refund_callback_outcome(
        "prop_refund_001".to_string(),
        U128(6 * ONE_NEAR),
        true,
    );
    assert!(refund_ok);

    let p_refunded = contract.get_project("prop_refund_001".to_string()).unwrap();
    assert_eq!(p_refunded.status, ProjectStatus::Refunded);
    assert_eq!(p_refunded.remaining_balance_yocto.0, 0);
    assert_eq!(p_refunded.reserved_in_flight_yocto.0, 0);
    assert_eq!(p_refunded.total_disbursed_yocto.0, 4 * ONE_NEAR);
    assert_eq!(p_refunded.total_refunded_yocto.0, 6 * ONE_NEAR);
    assert_project_balance_invariant(&p_refunded);
}

#[test]
#[should_panic(expected = "ERR_UNAUTHORIZED_BARANGAY_ADMIN")]
fn sc_test_06_rejects_unauthorized_refund_caller() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_unauth_refund".to_string(),
        "brgy_0421090180".to_string(),
        "Project".to_string(),
        "f".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        true,
    );
    testing_env!(setup_context("escrow.fundora.testnet", 0).build());
    contract.apply_transfer_callback_outcome(
        "prop_unauth_refund".to_string(),
        1,
        U128(4 * ONE_NEAR),
        true,
    );
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.submit_milestone_proof("prop_unauth_refund".to_string(), 2, "proof".to_string());

    for voter in [
        "res1.bucandala3.testnet",
        "res2.bucandala3.testnet",
        "res3.bucandala3.testnet",
    ] {
        testing_env!(setup_context(voter, 0).build());
        contract.vote_milestone("prop_unauth_refund".to_string(), 2, false);
    }

    // SK Official attempts to call refund_project -> must panic
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.refund_project("prop_unauth_refund".to_string());
}

// =============================================================================
// SC-TEST-07: AI Attestation Recording, Event Emission & Advisory Trust Boundary
// =============================================================================

#[test]
fn sc_test_07_ai_attestation_and_events_preserve_human_trust_boundary() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    let mut non_upfront_milestones = default_milestones_40_40_20();
    non_upfront_milestones[0].is_upfront = false;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_ai_001".to_string(),
        "brgy_0421090180".to_string(),
        "AI Audited Health Center Equipment".to_string(),
        "1".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        non_upfront_milestones,
        false,
    );

    let hash_prop = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90".to_string();
    let hash_evid = "f0e1d2c3b4a5968778695a4b3c2d1e0ff0e1d2c3b4a5968778695a4b3c2d1e0f".to_string();

    testing_env!(setup_context("auditor.fundora.testnet", 0).build());
    contract.record_ai_attestation(
        "prop_ai_001".to_string(),
        "proposal_procurement".to_string(),
        None,
        hash_prop.clone(),
        92,
        "approve".to_string(),
    );

    contract.record_ai_attestation(
        "prop_ai_001".to_string(),
        "milestone_evidence".to_string(),
        Some(1),
        hash_evid.clone(),
        45,
        "flag_high_risk".to_string(),
    );

    let attestations = contract.get_ai_attestations("prop_ai_001".to_string());
    assert_eq!(attestations.len(), 2);
    assert_eq!(attestations[0].report_sha256_hash, hash_prop);
    assert_eq!(attestations[0].score, 92);
    assert_eq!(attestations[1].milestone_idx, Some(1));
    assert_eq!(attestations[1].recommendation, "flag_high_risk");

    // Verify NEP-297 event log emission
    let logs = get_logs();
    assert!(logs
        .iter()
        .any(|l| l.starts_with("EVENT_JSON:") && l.contains("\"event\":\"ai_attestation_recorded\"")));

    // Verify AI attestation NEVER unilaterally alters escrow balances or project/milestone status
    let proj = contract.get_project("prop_ai_001".to_string()).unwrap();
    assert_eq!(proj.status, ProjectStatus::Active);
    assert_eq!(proj.remaining_balance_yocto.0, budget);
}

#[test]
#[should_panic(expected = "ERR_UNAUTHORIZED_AUDITOR")]
fn sc_test_07_rejects_unauthorized_ai_attestation_caller() {
    let mut contract = init_contract();
    setup_two_barangays(&mut contract);
    let budget = 10 * ONE_NEAR;
    let deposit = budget + STORAGE_RESERVE_YOCTO;

    testing_env!(setup_context("admin.bucandala3.testnet", deposit).build());
    contract.create_project(
        "prop_ai_unauth".to_string(),
        "brgy_0421090180".to_string(),
        "Project".to_string(),
        "1".repeat(64),
        acc("sk.bucandala3.testnet"),
        U128(budget),
        default_milestones_40_40_20(),
        false,
    );

    // SK Official attempts to forge an AI attestation
    testing_env!(setup_context("sk.bucandala3.testnet", 0).build());
    contract.record_ai_attestation(
        "prop_ai_unauth".to_string(),
        "proposal_procurement".to_string(),
        None,
        "a".repeat(64),
        99,
        "approve".to_string(),
    );
}


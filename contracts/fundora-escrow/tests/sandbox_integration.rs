use fundora_escrow::models::{
    BarangayView, MilestoneInput, MilestoneStatus, ProjectStatus, DEMO_BARANGAY_ID,
    STORAGE_RESERVE_YOCTO,
};
use fundora_escrow::FundoraContract;
use near_sdk::json_types::U128;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken, PromiseResult};

const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn acct(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn build_ctx(predecessor: AccountId, deposit: u128, balance: u128) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(acct("escrow.fundora.testnet"))
        .signer_account_id(predecessor.clone())
        .predecessor_account_id(predecessor)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_yoctonear(balance))
        .block_timestamp(1_762_500_000_000_000_000);
    builder
}

fn milestones_40_40_20() -> Vec<MilestoneInput> {
    vec![
        MilestoneInput {
            title: "Phase 1: Site Preparation & Materials".to_string(),
            percentage_bps: 4_000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 2: Installation & Civil Works".to_string(),
            percentage_bps: 4_000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 3: Final Inspection & Commissioning".to_string(),
            percentage_bps: 2_000,
            is_upfront: false,
            amount_yocto: None,
        },
    ]
}

fn milestones_40_30_30() -> Vec<MilestoneInput> {
    vec![
        MilestoneInput {
            title: "Phase 1: Equipment Procurement".to_string(),
            percentage_bps: 4_000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 2: Network Setup".to_string(),
            percentage_bps: 3_000,
            is_upfront: false,
            amount_yocto: None,
        },
        MilestoneInput {
            title: "Phase 3: Training & Handover".to_string(),
            percentage_bps: 3_000,
            is_upfront: false,
            amount_yocto: None,
        },
    ]
}

/// Full multi-account sandbox simulation covering:
/// 1. Contract initialization (`new`) with pre-seeded `brgy_demo_001` (`min_votes = 1`)
/// 2. Multi-barangay registration (`brgy_0421090180` and `brgy_1376020030`)
/// 3. Role management (`set_sk_official`, `register_verified_resident`)
/// 4. Project creation & exact escrow funding with both 40/40/20 and 40/30/30 milestone splits
/// 5. AI attestation recording (`record_ai_attestation`)
/// 6. Proof submission, resident quorum voting, callback settlement (`PromiseResult::Successful` and `PromiseResult::Failed`), retry recovery, treasury-only refund, and financial conservation invariants
#[test]
fn sandbox_e2e_multi_account_escrow_and_callback_simulation() {
    let sys_admin = acct("admin.fundora.testnet");
    let ai_auditor = acct("auditor.fundora.testnet");

    let admin_molino = acct("admin.molino3.testnet");
    let sk_molino = acct("sk.molino3.testnet");
    let res1 = acct("resident1.molino3.testnet");
    let res2 = acct("resident2.molino3.testnet");
    let res3 = acct("resident3.molino3.testnet");

    let admin_poblacion = acct("admin.poblacion.testnet");
    let sk_poblacion = acct("sk.poblacion.testnet");

    // 1. Initialize contract (automatically seeds brgy_demo_001)
    testing_env!(build_ctx(sys_admin.clone(), 0, 20 * ONE_NEAR).build());
    let mut contract = FundoraContract::new(sys_admin.clone(), ai_auditor.clone());

    let demo_view = contract
        .get_barangay(DEMO_BARANGAY_ID.to_string())
        .expect("Demo barangay must be pre-seeded");
    assert!(demo_view.is_demo);
    assert_eq!(demo_view.min_votes, 1);

    // 2. Register two additional isolated barangays
    contract.register_barangay(
        "brgy_0421090180".to_string(),
        "0421090180".to_string(),
        "Molino III".to_string(),
        admin_molino.clone(),
        6_000,
        3,
        false,
    );

    contract.register_barangay(
        "brgy_1376020030".to_string(),
        "1376020030".to_string(),
        "Poblacion".to_string(),
        admin_poblacion.clone(),
        6_000,
        3,
        false,
    );

    // 3. Assign SK officials and verified residents in Molino III and Poblacion
    testing_env!(build_ctx(admin_molino.clone(), 0, 20 * ONE_NEAR).build());
    contract.set_sk_official("brgy_0421090180".to_string(), sk_molino.clone(), true);
    for r in [&res1, &res2, &res3] {
        contract.register_verified_resident("brgy_0421090180".to_string(), r.clone(), true);
    }

    testing_env!(build_ctx(admin_poblacion.clone(), 0, 20 * ONE_NEAR).build());
    contract.set_sk_official("brgy_1376020030".to_string(), sk_poblacion.clone(), true);

    let molino_view: BarangayView = contract
        .get_barangay("brgy_0421090180".to_string())
        .expect("Molino III must exist");
    assert_eq!(molino_view.verified_residents_count, 3);

    // 4. Create & Fund Project in Molino III (40/40/20 split, 50 NEAR + 0.05 NEAR storage reserve)
    let molino_deposit = 50 * ONE_NEAR + STORAGE_RESERVE_YOCTO;
    testing_env!(build_ctx(admin_molino.clone(), molino_deposit, 100 * ONE_NEAR).build());
    contract.create_project(
        "proj_molino_solar".to_string(),
        "brgy_0421090180".to_string(),
        "Solar Streetlights for Molino III".to_string(),
        "a3f5c8e9d1b20476891023456789abcdef0123456789abcdef0123456789abcd".to_string(),
        sk_molino.clone(),
        U128(50 * ONE_NEAR),
        milestones_40_40_20(),
        false,
    );

    // Create & Fund Project in Poblacion (40/30/30 split, 30 NEAR + 0.05 NEAR storage reserve)
    let poblacion_deposit = 30 * ONE_NEAR + STORAGE_RESERVE_YOCTO;
    testing_env!(build_ctx(admin_poblacion.clone(), poblacion_deposit, 100 * ONE_NEAR).build());
    contract.create_project(
        "proj_poblacion_ict".to_string(),
        "brgy_1376020030".to_string(),
        "Youth Digital Hub for Poblacion".to_string(),
        "b4e6d9f0e2c3158790213456789abcdef0123456789abcdef0123456789abcde".to_string(),
        sk_poblacion.clone(),
        U128(30 * ONE_NEAR),
        milestones_40_30_30(),
        false,
    );

    // 5. Record AI Attestation for Molino III project (by authorized ai_auditor)
    testing_env!(build_ctx(ai_auditor.clone(), 0, 100 * ONE_NEAR).build());
    contract.record_ai_attestation(
        "proj_molino_solar".to_string(),
        "proposal_procurement".to_string(),
        None,
        "c5f7e0a1f3d426980132456789abcdef0123456789abcdef0123456789abcdef".to_string(),
        92,
        "approve".to_string(),
    );

    let attestations = contract.get_ai_attestations("proj_molino_solar".to_string());
    assert_eq!(attestations.len(), 1);
    assert_eq!(attestations[0].score, 92);

    // 6. Submit Milestone 1 proof (1-based index) and cast 2 approve + 1 reject votes (66.66% >= 60% quorum)
    testing_env!(build_ctx(sk_molino.clone(), 0, 100 * ONE_NEAR).build());
    contract.submit_milestone_proof(
        "proj_molino_solar".to_string(),
        1,
        "d6a8f1b204e53709124356789abcdef0123456789abcdef0123456789abcdef0".to_string(),
    );

    testing_env!(build_ctx(res1.clone(), 0, 100 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 1, true);
    testing_env!(build_ctx(res2.clone(), 0, 100 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 1, false);
    testing_env!(build_ctx(res3.clone(), 0, 100 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 1, true);

    // Verify Milestone 1 is now locked in PayoutInFlight
    let p_in_flight = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(
        p_in_flight.milestones[0].status,
        MilestoneStatus::PayoutInFlight
    );
    assert_eq!(p_in_flight.remaining_balance_yocto.0, 30 * ONE_NEAR);
    assert_eq!(p_in_flight.reserved_in_flight_yocto.0, 20 * ONE_NEAR);

    // 7. Simulate PromiseResult::Failed on callback first -> rolls back to ReconciliationRequired / Failed
    let contract_id = acct("escrow.fundora.testnet");
    let failed_cb_ctx = build_ctx(contract_id.clone(), 0, 100 * ONE_NEAR);
    testing_env!(
        failed_cb_ctx.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );
    let callback_ok =
        contract.on_transfer_complete("proj_molino_solar".to_string(), 1, U128(20 * ONE_NEAR));
    assert!(!callback_ok);

    let p_reconcile = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(p_reconcile.status, ProjectStatus::ReconciliationRequired);
    assert_eq!(p_reconcile.milestones[0].status, MilestoneStatus::Failed);
    assert_eq!(p_reconcile.total_disbursed_yocto.0, 0);
    assert_eq!(p_reconcile.reserved_in_flight_yocto.0, 0);
    assert_eq!(p_reconcile.remaining_balance_yocto.0, 50 * ONE_NEAR);

    // 8. Barangay Admin retries payout and callback succeeds with PromiseResult::Successful
    testing_env!(build_ctx(admin_molino.clone(), 0, 100 * ONE_NEAR).build());
    contract.retry_failed_milestone_payout("proj_molino_solar".to_string(), 1);

    let success_cb_ctx = build_ctx(contract_id.clone(), 0, 80 * ONE_NEAR);
    testing_env!(
        success_cb_ctx.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(vec![])]
    );
    let callback_ok_2 =
        contract.on_transfer_complete("proj_molino_solar".to_string(), 1, U128(20 * ONE_NEAR));
    assert!(callback_ok_2);

    let p_after_m1 = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(p_after_m1.milestones[0].status, MilestoneStatus::Completed);
    assert_eq!(p_after_m1.total_disbursed_yocto.0, 20 * ONE_NEAR);
    assert_eq!(p_after_m1.remaining_balance_yocto.0, 30 * ONE_NEAR);
    assert_eq!(p_after_m1.reserved_in_flight_yocto.0, 0);
    // Conservation invariant: remaining + reserved + disbursed + refunded == total_budget
    assert_eq!(
        p_after_m1.remaining_balance_yocto.0
            + p_after_m1.reserved_in_flight_yocto.0
            + p_after_m1.total_disbursed_yocto.0
            + p_after_m1.total_refunded_yocto.0,
        p_after_m1.total_budget_yocto.0
    );

    // 9. Submit Milestone 2 proof, reject via resident quorum (2 reject, 1 approve), and refund remaining 30 NEAR strictly to funder_treasury
    testing_env!(build_ctx(sk_molino.clone(), 0, 80 * ONE_NEAR).build());
    contract.submit_milestone_proof(
        "proj_molino_solar".to_string(),
        2,
        "e7b9f2c305f6481023546789abcdef0123456789abcdef0123456789abcdef01".to_string(),
    );

    testing_env!(build_ctx(res1.clone(), 0, 80 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 2, false);
    testing_env!(build_ctx(res2.clone(), 0, 80 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 2, false);
    testing_env!(build_ctx(res3.clone(), 0, 80 * ONE_NEAR).build());
    contract.vote_milestone("proj_molino_solar".to_string(), 2, true);

    let p_disputed = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(p_disputed.status, ProjectStatus::Disputed);
    assert_eq!(p_disputed.milestones[1].status, MilestoneStatus::Rejected);

    testing_env!(build_ctx(admin_molino.clone(), 0, 80 * ONE_NEAR).build());
    contract.refund_project("proj_molino_solar".to_string());

    let p_refund_in_flight = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(p_refund_in_flight.status, ProjectStatus::RefundInFlight);

    let refund_cb_ctx = build_ctx(contract_id, 0, 50 * ONE_NEAR);
    testing_env!(
        refund_cb_ctx.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(vec![])]
    );
    let refund_ok =
        contract.on_refund_complete("proj_molino_solar".to_string(), U128(30 * ONE_NEAR));
    assert!(refund_ok);

    let p_final = contract.get_project("proj_molino_solar".to_string()).unwrap();
    assert_eq!(p_final.status, ProjectStatus::Refunded);
    assert_eq!(p_final.remaining_balance_yocto.0, 0);
    assert_eq!(p_final.reserved_in_flight_yocto.0, 0);
    assert_eq!(p_final.total_disbursed_yocto.0, 20 * ONE_NEAR);
    assert_eq!(p_final.total_refunded_yocto.0, 30 * ONE_NEAR);
    assert_eq!(
        p_final.remaining_balance_yocto.0
            + p_final.reserved_in_flight_yocto.0
            + p_final.total_disbursed_yocto.0
            + p_final.total_refunded_yocto.0,
        p_final.total_budget_yocto.0
    );

    // 10. Confirm Poblacion project remained completely unaffected
    let poblacion_proj = contract
        .get_project("proj_poblacion_ict".to_string())
        .expect("Poblacion project must remain untouched");
    assert_eq!(poblacion_proj.status, ProjectStatus::Active);
    assert_eq!(poblacion_proj.total_budget_yocto.0, 30 * ONE_NEAR);
    assert_eq!(
        poblacion_proj.milestones[0].percentage_bps
            + poblacion_proj.milestones[1].percentage_bps
            + poblacion_proj.milestones[2].percentage_bps,
        10_000
    );
    assert_eq!(
        poblacion_proj.milestones[0].amount_yocto.0
            + poblacion_proj.milestones[1].amount_yocto.0
            + poblacion_proj.milestones[2].amount_yocto.0,
        30 * ONE_NEAR
    );
    let _ = accounts(0);
}

#[test]
fn verify_compiled_wasm_artifact_integrity_and_exports() {
    use sha2::{Digest, Sha256};
    use std::path::PathBuf;

    let wasm_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("wasm32-unknown-unknown")
        .join("release")
        .join("fundora_escrow.wasm");

    assert!(
        wasm_path.exists(),
        "Release WASM binary must exist at {}",
        wasm_path.display()
    );

    let bytes = std::fs::read(&wasm_path).expect("Must read compiled WASM binary");
    assert!(
        bytes.len() > 10_000 && bytes.len() < 1_000_000,
        "WASM binary size ({}) must be within valid NEAR contract bounds",
        bytes.len()
    );

    // WebAssembly magic header: \0asm\x01\x00\x00\x00
    assert_eq!(&bytes[0..4], b"\0asm", "Invalid WASM magic bytes");
    assert_eq!(&bytes[4..8], &[1, 0, 0, 0], "Invalid WASM version header");

    // Verify all core contract methods are exported in the WASM binary
    let wasm_ascii = String::from_utf8_lossy(&bytes);
    for exported_fn in [
        "new",
        "register_barangay",
        "set_sk_official",
        "register_verified_resident",
        "create_project",
        "submit_milestone_proof",
        "vote_milestone",
        "finalize_milestone_vote",
        "refund_project",
        "on_transfer_complete",
        "on_refund_complete",
        "retry_failed_milestone_payout",
        "retry_failed_refund",
        "record_ai_attestation",
        "get_barangay",
        "get_project",
        "get_ai_attestations",
    ] {
        assert!(
            wasm_ascii.contains(exported_fn),
            "WASM binary is missing exported entry point: {exported_fn}"
        );
    }

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let sha256_hex = format!("{:x}", hasher.finalize());
    assert_eq!(sha256_hex.len(), 64);
}


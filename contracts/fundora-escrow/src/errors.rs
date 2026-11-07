//! Fundora — Deterministic Smart Contract Error Constants

pub const ERR_UNAUTHORIZED_SYSTEM_ADMIN: &str =
    "ERR_UNAUTHORIZED_SYSTEM_ADMIN: Caller is not the authorized system_admin";
pub const ERR_UNAUTHORIZED_BARANGAY_ADMIN: &str =
    "ERR_UNAUTHORIZED_BARANGAY_ADMIN: Caller is not an authorized barangay_admin for this jurisdiction";
pub const ERR_UNAUTHORIZED_SK_OFFICIAL: &str =
    "ERR_UNAUTHORIZED_SK_OFFICIAL: Account is not an active verified sk_official for this jurisdiction";
pub const ERR_NOT_VERIFIED_RESIDENT: &str =
    "ERR_NOT_VERIFIED_RESIDENT: Caller is not a verified youth resident of this Barangay jurisdiction";
pub const ERR_UNAUTHORIZED_AUDITOR: &str =
    "ERR_UNAUTHORIZED_AUDITOR: Caller is not the designated ai_auditor account";
pub const ERR_BARANGAY_NOT_FOUND: &str =
    "ERR_BARANGAY_NOT_FOUND: Specified barangay_id does not exist";
pub const ERR_BARANGAY_ALREADY_EXISTS: &str =
    "ERR_BARANGAY_ALREADY_EXISTS: Specified barangay_id is already registered";
pub const ERR_BARANGAY_INACTIVE: &str =
    "ERR_BARANGAY_INACTIVE: Barangay jurisdiction is currently paused or inactive";
pub const ERR_INVALID_QUORUM_CONFIG: &str =
    "ERR_INVALID_QUORUM_CONFIG: quorum_bps must be between 5000 and 10000, and min_votes >= 3 for standard barangays (or >= 1 strictly for brgy_demo_001)";
pub const ERR_DUPLICATE_PROJECT_ID: &str =
    "ERR_DUPLICATE_PROJECT_ID: A project with this deterministic project_id already exists";
pub const ERR_PROJECT_NOT_FOUND: &str =
    "ERR_PROJECT_NOT_FOUND: Specified project_id does not exist";
pub const ERR_INVALID_MILESTONE_COUNT: &str =
    "ERR_INVALID_MILESTONE_COUNT: Project must define between 2 and 5 milestones";
pub const ERR_INVALID_MILESTONE_BPS_SUM: &str =
    "ERR_INVALID_MILESTONE_BPS_SUM: Milestone percentage_bps values must all be > 0 and sum to exactly 10000 (100%)";
pub const ERR_MILESTONE_AMOUNT_MISMATCH: &str =
    "ERR_MILESTONE_AMOUNT_MISMATCH: Milestone yoctoNEAR amounts do not sum to total_budget_yocto";
pub const ERR_ZERO_BUDGET: &str =
    "ERR_ZERO_BUDGET: Project total_budget_yocto must be greater than 0";
pub const ERR_INSUFFICIENT_ATTACHED_DEPOSIT: &str =
    "ERR_INSUFFICIENT_ATTACHED_DEPOSIT: Attached NEAR deposit must be >= total_budget_yocto + 0.05 NEAR storage reserve";
pub const ERR_SEPARATION_OF_DUTIES: &str =
    "ERR_SEPARATION_OF_DUTIES: Barangay Admin funding treasury cannot be the same account as the SK Official payout recipient, and officials cannot vote on milestones";
pub const ERR_INVALID_MILESTONE_INDEX: &str =
    "ERR_INVALID_MILESTONE_INDEX: Specified 1-based milestone_idx does not exist on this project";
pub const ERR_INVALID_MILESTONE_STATE: &str =
    "ERR_INVALID_MILESTONE_STATE: Milestone is not in the required state for this operation";
pub const ERR_INVALID_PROJECT_STATE: &str =
    "ERR_INVALID_PROJECT_STATE: Project is not in the required state for this operation";
pub const ERR_PREVIOUS_MILESTONE_INCOMPLETE: &str =
    "ERR_PREVIOUS_MILESTONE_INCOMPLETE: Previous milestone must be Completed before submitting proof for the next milestone";
pub const ERR_ALREADY_VOTED: &str =
    "ERR_ALREADY_VOTED: Resident has already cast a vote on this milestone";
pub const ERR_INSUFFICIENT_ESCROW_BALANCE: &str =
    "ERR_INSUFFICIENT_ESCROW_BALANCE: Remaining escrow balance is insufficient for transfer";
pub const ERR_REFUND_NOT_ELIGIBLE: &str =
    "ERR_REFUND_NOT_ELIGIBLE: Project is not in Disputed state or has no refundable balance";
pub const ERR_INVALID_SHA256_HASH: &str =
    "ERR_INVALID_SHA256_HASH: Hash must be a valid 64-character hexadecimal SHA-256 digest";
pub const ERR_INVALID_ATTESTATION_TARGET: &str =
    "ERR_INVALID_ATTESTATION_TARGET: target_type must be 'proposal_procurement' or 'milestone_evidence'";
pub const ERR_INVALID_AI_SCORE: &str =
    "ERR_INVALID_AI_SCORE: AI score must be between 0 and 100 inclusive";
pub const ERR_INVALID_AI_RECOMMENDATION: &str =
    "ERR_INVALID_AI_RECOMMENDATION: recommendation must be 'approve', 'revise', or 'flag_high_risk'";
pub const ERR_DUPLICATE_ATTESTATION: &str =
    "ERR_DUPLICATE_ATTESTATION: Identical attestation hash already recorded for this target";


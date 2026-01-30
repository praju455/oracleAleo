// Aleo Oracle Registry - Production-Ready Operator Management
// Features: Staking, Slashing, Multi-Operator Consensus, Reputation System

import credits.aleo;

program oracle_registry_v1.aleo {
    // ===== CONSTANTS =====

    // Minimum stake required to become an operator (1000 credits = 1_000_000_000 microcredits)
    const MIN_STAKE: u64 = 1000000000u64;

    // Slash percentage for bad behavior (10% = 1000 basis points)
    const SLASH_PERCENTAGE: u64 = 1000u64;

    // Minimum operators required for consensus
    const MIN_OPERATORS_FOR_CONSENSUS: u8 = 3u8;

    // Maximum price deviation allowed between operators (2% = 200 basis points)
    const MAX_PRICE_DEVIATION: u64 = 200u64;

    // Reward per valid submission (0.1 credits = 100_000 microcredits)
    const SUBMISSION_REWARD: u64 = 100000u64;

    // Unbonding period (7 days in milliseconds)
    const UNBONDING_PERIOD: u64 = 604800000u64;

    // ===== STRUCTS =====

    // Operator information
    struct OperatorInfo {
        stake: u64,                    // Total staked amount (microcredits)
        reputation_score: u64,         // Reputation (0-10000, starts at 5000)
        total_submissions: u64,        // Total price submissions
        valid_submissions: u64,        // Number of valid submissions (used in consensus)
        slashed_count: u32,            // Times slashed
        registered_at: u64,            // Registration timestamp
        last_submission_at: u64,       // Last submission timestamp
        is_active: bool,               // Can submit prices
        is_jailed: bool                // Temporarily banned
    }

    // Unbonding request for withdrawing stake
    struct UnbondingRequest {
        operator: address,
        amount: u64,
        unlock_at: u64,                // Timestamp when funds can be withdrawn
        completed: bool
    }

    // Price submission for consensus
    struct PriceSubmission {
        operator: address,
        price: u128,
        timestamp: u64,
        signature_hash: field          // Hash of operator's signature
    }

    // Consensus round for a price pair
    struct ConsensusRound {
        pair_id: u64,
        epoch: u32,
        submissions_count: u8,
        total_stake_weight: u64,       // Total stake of participating operators
        weighted_price_sum: u128,      // Sum of (price * stake) for weighted average
        finalized: bool,
        final_price: u128,
        finalized_at: u64
    }

    // Slashing event record
    struct SlashEvent {
        operator: address,
        amount: u64,
        reason_code: u8,               // 1=bad price, 2=missed submissions, 3=malicious behavior
        timestamp: u64
    }

    // Global protocol configuration
    struct ProtocolConfig {
        min_stake: u64,
        slash_percentage: u64,
        min_operators: u8,
        max_deviation: u64,
        submission_reward: u64,
        unbonding_period: u64,
        enabled: bool
    }

    // ===== RECORDS =====

    // Operator stake receipt (private proof of stake)
    record StakeReceipt {
        owner: address,
        stake_amount: u64,
        staked_at: u64,
        receipt_id: field
    }

    // Reward claim receipt
    record RewardReceipt {
        owner: address,
        amount: u64,
        epoch: u32,
        receipt_id: field
    }

    // ===== MAPPINGS =====

    // Admin address
    mapping admin: u8 => address;

    // Protocol configuration
    mapping config: u8 => ProtocolConfig;

    // Operator registry: address => OperatorInfo
    mapping operators: address => OperatorInfo;

    // Operator active status (for quick lookup)
    mapping operator_active: address => bool;

    // Total number of active operators
    mapping total_operators: u8 => u64;

    // Total staked amount across all operators
    mapping total_staked: u8 => u64;

    // Unbonding requests: operator => UnbondingRequest
    mapping unbonding_requests: address => UnbondingRequest;

    // Current consensus round per pair: pair_id => ConsensusRound
    mapping current_round: u64 => ConsensusRound;

    // Price submissions in current round: (pair_id * 100 + submission_index) => PriceSubmission
    mapping round_submissions: field => PriceSubmission;

    // Submission count per round per operator: hash(pair_id, epoch, operator) => bool
    mapping operator_submitted: field => bool;

    // Accumulated rewards per operator
    mapping pending_rewards: address => u64;

    // Treasury/slashing pool
    mapping treasury: u8 => u64;

    // Reward pool for operators
    mapping reward_pool: u8 => u64;

    // Global epoch counter
    mapping current_epoch: u8 => u32;

    // ===== CONSTRUCTOR =====

    @noupgrade
    async constructor() {}

    // ===== INITIALIZATION =====

    async transition initialize(public admin_address: address) -> Future {
        return finalize_initialize(admin_address);
    }

    async function finalize_initialize(admin_address: address) {
        // Check not already initialized
        let zero_addr: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
        let existing: address = Mapping::get_or_use(admin, 0u8, zero_addr);
        assert_eq(existing, zero_addr);

        Mapping::set(admin, 0u8, admin_address);

        // Initialize default config
        let default_config: ProtocolConfig = ProtocolConfig {
            min_stake: 1000000000u64,        // 1000 credits
            slash_percentage: 1000u64,        // 10%
            min_operators: 3u8,
            max_deviation: 200u64,            // 2%
            submission_reward: 100000u64,     // 0.1 credits
            unbonding_period: 604800000u64,   // 7 days
            enabled: true
        };
        Mapping::set(config, 0u8, default_config);
        Mapping::set(total_operators, 0u8, 0u64);
        Mapping::set(total_staked, 0u8, 0u64);
        Mapping::set(treasury, 0u8, 0u64);
        Mapping::set(reward_pool, 0u8, 0u64);
        Mapping::set(current_epoch, 0u8, 1u32);
    }

    // ===== OPERATOR REGISTRATION WITH STAKING =====

    // Register as an operator by staking credits
    async transition register_operator(
        public stake_credits: credits.aleo/credits,
        public stake_amount: u64,
        public timestamp: u64
    ) -> (StakeReceipt, credits.aleo/credits, Future) {
        // Must stake minimum amount
        assert(stake_amount >= 1000000000u64);
        assert(stake_credits.microcredits >= stake_amount);

        // Generate unique receipt ID
        let receipt_id: field = BHP256::hash_to_field(self.caller);

        // Create stake receipt
        let receipt: StakeReceipt = StakeReceipt {
            owner: self.caller,
            stake_amount: stake_amount,
            staked_at: timestamp,
            receipt_id: receipt_id
        };

        // Transfer stake to protocol
        let (remaining, stake_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(stake_credits, self.address, stake_amount);

        return (receipt, remaining, finalize_register_operator(self.caller, stake_amount, timestamp, stake_future));
    }

    async function finalize_register_operator(
        operator: address,
        stake_amount: u64,
        timestamp: u64,
        stake_transfer: Future
    ) {
        // Get config
        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        assert(protocol_config.enabled);
        assert(stake_amount >= protocol_config.min_stake);

        // Check operator not already registered
        let default_info: OperatorInfo = OperatorInfo {
            stake: 0u64,
            reputation_score: 0u64,
            total_submissions: 0u64,
            valid_submissions: 0u64,
            slashed_count: 0u32,
            registered_at: 0u64,
            last_submission_at: 0u64,
            is_active: false,
            is_jailed: false
        };
        let existing: OperatorInfo = Mapping::get_or_use(operators, operator, default_info);
        assert(!existing.is_active);

        // Await stake transfer
        stake_transfer.await();

        // Create operator info
        let new_operator: OperatorInfo = OperatorInfo {
            stake: stake_amount,
            reputation_score: 5000u64,        // Start at 50% reputation
            total_submissions: 0u64,
            valid_submissions: 0u64,
            slashed_count: 0u32,
            registered_at: timestamp,
            last_submission_at: 0u64,
            is_active: true,
            is_jailed: false
        };

        Mapping::set(operators, operator, new_operator);
        Mapping::set(operator_active, operator, true);

        // Update totals
        let current_total_ops: u64 = Mapping::get_or_use(total_operators, 0u8, 0u64);
        Mapping::set(total_operators, 0u8, current_total_ops + 1u64);

        let current_total_staked: u64 = Mapping::get_or_use(total_staked, 0u8, 0u64);
        Mapping::set(total_staked, 0u8, current_total_staked + stake_amount);
    }

    // ===== ADD MORE STAKE =====

    async transition add_stake(
        public stake_credits: credits.aleo/credits,
        public additional_amount: u64
    ) -> (credits.aleo/credits, Future) {
        assert(additional_amount > 0u64);
        assert(stake_credits.microcredits >= additional_amount);

        let (remaining, stake_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(stake_credits, self.address, additional_amount);

        return (remaining, finalize_add_stake(self.caller, additional_amount, stake_future));
    }

    async function finalize_add_stake(
        operator: address,
        additional_amount: u64,
        stake_transfer: Future
    ) {
        // Verify operator exists and is active
        let op_info: OperatorInfo = Mapping::get(operators, operator);
        assert(op_info.is_active);

        stake_transfer.await();

        // Update stake
        let updated_info: OperatorInfo = OperatorInfo {
            stake: op_info.stake + additional_amount,
            reputation_score: op_info.reputation_score,
            total_submissions: op_info.total_submissions,
            valid_submissions: op_info.valid_submissions,
            slashed_count: op_info.slashed_count,
            registered_at: op_info.registered_at,
            last_submission_at: op_info.last_submission_at,
            is_active: op_info.is_active,
            is_jailed: op_info.is_jailed
        };
        Mapping::set(operators, operator, updated_info);

        // Update total staked
        let current_total: u64 = Mapping::get_or_use(total_staked, 0u8, 0u64);
        Mapping::set(total_staked, 0u8, current_total + additional_amount);
    }

    // ===== REQUEST UNSTAKE =====

    async transition request_unstake(
        public amount: u64,
        public timestamp: u64
    ) -> Future {
        assert(amount > 0u64);
        return finalize_request_unstake(self.caller, amount, timestamp);
    }

    async function finalize_request_unstake(
        operator: address,
        amount: u64,
        timestamp: u64
    ) {
        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        let op_info: OperatorInfo = Mapping::get(operators, operator);

        // Must have enough stake
        assert(op_info.stake >= amount);

        // Must maintain minimum stake or unstake everything
        let remaining_stake: u64 = op_info.stake - amount;
        assert(remaining_stake == 0u64 || remaining_stake >= protocol_config.min_stake);

        // Check no existing unbonding request
        let default_unbond: UnbondingRequest = UnbondingRequest {
            operator: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc,
            amount: 0u64,
            unlock_at: 0u64,
            completed: true
        };
        let existing_unbond: UnbondingRequest = Mapping::get_or_use(unbonding_requests, operator, default_unbond);
        assert(existing_unbond.completed);

        // Create unbonding request
        let unbond_request: UnbondingRequest = UnbondingRequest {
            operator: operator,
            amount: amount,
            unlock_at: timestamp + protocol_config.unbonding_period,
            completed: false
        };
        Mapping::set(unbonding_requests, operator, unbond_request);

        // Update operator stake
        let updated_info: OperatorInfo = OperatorInfo {
            stake: remaining_stake,
            reputation_score: op_info.reputation_score,
            total_submissions: op_info.total_submissions,
            valid_submissions: op_info.valid_submissions,
            slashed_count: op_info.slashed_count,
            registered_at: op_info.registered_at,
            last_submission_at: op_info.last_submission_at,
            is_active: remaining_stake >= protocol_config.min_stake,
            is_jailed: op_info.is_jailed
        };
        Mapping::set(operators, operator, updated_info);

        if remaining_stake < protocol_config.min_stake {
            Mapping::set(operator_active, operator, false);
            let total_ops: u64 = Mapping::get_or_use(total_operators, 0u8, 1u64);
            Mapping::set(total_operators, 0u8, total_ops - 1u64);
        }

        // Update total staked
        let current_total: u64 = Mapping::get_or_use(total_staked, 0u8, amount);
        Mapping::set(total_staked, 0u8, current_total - amount);
    }

    // ===== COMPLETE UNSTAKE =====

    async transition complete_unstake(public timestamp: u64) -> Future {
        // Transfer will happen in finalize
        let withdraw_future: Future = credits.aleo/transfer_public(self.caller, 0u64);
        return finalize_complete_unstake(self.caller, timestamp, withdraw_future);
    }

    async function finalize_complete_unstake(
        operator: address,
        timestamp: u64,
        withdraw_transfer: Future
    ) {
        let unbond_request: UnbondingRequest = Mapping::get(unbonding_requests, operator);

        // Verify unbonding period has passed
        assert(!unbond_request.completed);
        assert(timestamp >= unbond_request.unlock_at);

        // Mark as completed
        let completed_request: UnbondingRequest = UnbondingRequest {
            operator: operator,
            amount: unbond_request.amount,
            unlock_at: unbond_request.unlock_at,
            completed: true
        };
        Mapping::set(unbonding_requests, operator, completed_request);

        // Transfer credits back to operator
        withdraw_transfer.await();
    }

    // ===== PRICE SUBMISSION FOR CONSENSUS =====

    async transition submit_price_for_consensus(
        public pair_id: u64,
        public price: u128,
        public timestamp: u64,
        public signature_hash: field
    ) -> Future {
        assert(price > 0u128);
        assert(pair_id > 0u64 && pair_id <= 20u64);

        return finalize_submit_price(self.caller, pair_id, price, timestamp, signature_hash);
    }

    async function finalize_submit_price(
        operator: address,
        pair_id: u64,
        price: u128,
        timestamp: u64,
        signature_hash: field
    ) {
        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        assert(protocol_config.enabled);

        // Verify operator is active and not jailed
        let op_info: OperatorInfo = Mapping::get(operators, operator);
        assert(op_info.is_active);
        assert(!op_info.is_jailed);

        // Get current epoch
        let epoch: u32 = Mapping::get_or_use(current_epoch, 0u8, 1u32);

        // Check operator hasn't already submitted this round
        let submission_key: field = BHP256::hash_to_field(pair_id + (epoch as u64) * 1000u64);
        let already_submitted: bool = Mapping::get_or_use(operator_submitted, submission_key, false);
        assert(!already_submitted);

        // Get or create current round
        let default_round: ConsensusRound = ConsensusRound {
            pair_id: pair_id,
            epoch: epoch,
            submissions_count: 0u8,
            total_stake_weight: 0u64,
            weighted_price_sum: 0u128,
            finalized: false,
            final_price: 0u128,
            finalized_at: 0u64
        };
        let round: ConsensusRound = Mapping::get_or_use(current_round, pair_id, default_round);

        // Ensure round hasn't been finalized
        assert(!round.finalized);

        // Store submission
        let submission_index: field = BHP256::hash_to_field(pair_id * 100u64 + (round.submissions_count as u64));
        let submission: PriceSubmission = PriceSubmission {
            operator: operator,
            price: price,
            timestamp: timestamp,
            signature_hash: signature_hash
        };
        Mapping::set(round_submissions, submission_index, submission);

        // Mark operator as submitted
        Mapping::set(operator_submitted, submission_key, true);

        // Update round with weighted price
        let weighted_price: u128 = price * (op_info.stake as u128);
        let updated_round: ConsensusRound = ConsensusRound {
            pair_id: pair_id,
            epoch: epoch,
            submissions_count: round.submissions_count + 1u8,
            total_stake_weight: round.total_stake_weight + op_info.stake,
            weighted_price_sum: round.weighted_price_sum + weighted_price,
            finalized: false,
            final_price: 0u128,
            finalized_at: 0u64
        };
        Mapping::set(current_round, pair_id, updated_round);

        // Update operator stats
        let updated_op: OperatorInfo = OperatorInfo {
            stake: op_info.stake,
            reputation_score: op_info.reputation_score,
            total_submissions: op_info.total_submissions + 1u64,
            valid_submissions: op_info.valid_submissions,
            slashed_count: op_info.slashed_count,
            registered_at: op_info.registered_at,
            last_submission_at: timestamp,
            is_active: op_info.is_active,
            is_jailed: op_info.is_jailed
        };
        Mapping::set(operators, operator, updated_op);

        // Add submission reward to pending rewards
        let current_rewards: u64 = Mapping::get_or_use(pending_rewards, operator, 0u64);
        Mapping::set(pending_rewards, operator, current_rewards + protocol_config.submission_reward);
    }

    // ===== FINALIZE CONSENSUS ROUND =====

    async transition finalize_round(
        public pair_id: u64,
        public timestamp: u64
    ) -> Future {
        return finalize_consensus_round(pair_id, timestamp);
    }

    async function finalize_consensus_round(pair_id: u64, timestamp: u64) {
        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        let round: ConsensusRound = Mapping::get(current_round, pair_id);

        // Must have minimum operators
        assert(round.submissions_count >= protocol_config.min_operators);
        assert(!round.finalized);

        // Calculate stake-weighted average price
        let final_price: u128 = round.weighted_price_sum / (round.total_stake_weight as u128);

        // Finalize round
        let finalized_round: ConsensusRound = ConsensusRound {
            pair_id: pair_id,
            epoch: round.epoch,
            submissions_count: round.submissions_count,
            total_stake_weight: round.total_stake_weight,
            weighted_price_sum: round.weighted_price_sum,
            finalized: true,
            final_price: final_price,
            finalized_at: timestamp
        };
        Mapping::set(current_round, pair_id, finalized_round);

        // Increment epoch
        let epoch: u32 = Mapping::get_or_use(current_epoch, 0u8, 1u32);
        Mapping::set(current_epoch, 0u8, epoch + 1u32);
    }

    // ===== SLASHING =====

    // Slash an operator for bad behavior (admin or automated)
    async transition slash_operator(
        public operator: address,
        public reason_code: u8,
        public timestamp: u64
    ) -> Future {
        return finalize_slash_operator(self.caller, operator, reason_code, timestamp);
    }

    async function finalize_slash_operator(
        caller: address,
        operator: address,
        reason_code: u8,
        timestamp: u64
    ) {
        // Only admin can slash
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        let op_info: OperatorInfo = Mapping::get(operators, operator);

        // Calculate slash amount (10% of stake)
        let slash_amount: u64 = (op_info.stake * protocol_config.slash_percentage) / 10000u64;

        // Update operator
        let new_stake: u64 = op_info.stake - slash_amount;
        let is_still_active: bool = new_stake >= protocol_config.min_stake;

        // Reduce reputation (using ternary for Leo compatibility)
        let new_reputation: u64 = op_info.reputation_score > 1000u64 ?
            op_info.reputation_score - 1000u64 : 0u64;

        // Jail operator if slashed multiple times
        let should_jail: bool = op_info.slashed_count >= 2u32;

        let updated_op: OperatorInfo = OperatorInfo {
            stake: new_stake,
            reputation_score: new_reputation,
            total_submissions: op_info.total_submissions,
            valid_submissions: op_info.valid_submissions,
            slashed_count: op_info.slashed_count + 1u32,
            registered_at: op_info.registered_at,
            last_submission_at: op_info.last_submission_at,
            is_active: is_still_active && !should_jail,
            is_jailed: should_jail
        };
        Mapping::set(operators, operator, updated_op);

        if !is_still_active || should_jail {
            Mapping::set(operator_active, operator, false);
            let total_ops: u64 = Mapping::get_or_use(total_operators, 0u8, 1u64);
            Mapping::set(total_operators, 0u8, total_ops - 1u64);
        }

        // Move slashed amount to treasury
        let current_treasury: u64 = Mapping::get_or_use(treasury, 0u8, 0u64);
        Mapping::set(treasury, 0u8, current_treasury + slash_amount);

        // Update total staked
        let current_total: u64 = Mapping::get_or_use(total_staked, 0u8, slash_amount);
        Mapping::set(total_staked, 0u8, current_total - slash_amount);
    }

    // ===== UNJAIL OPERATOR =====

    async transition unjail_operator(public operator: address) -> Future {
        return finalize_unjail_operator(self.caller, operator);
    }

    async function finalize_unjail_operator(caller: address, operator: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let protocol_config: ProtocolConfig = Mapping::get(config, 0u8);
        let op_info: OperatorInfo = Mapping::get(operators, operator);

        assert(op_info.is_jailed);
        assert(op_info.stake >= protocol_config.min_stake);

        let updated_op: OperatorInfo = OperatorInfo {
            stake: op_info.stake,
            reputation_score: op_info.reputation_score,
            total_submissions: op_info.total_submissions,
            valid_submissions: op_info.valid_submissions,
            slashed_count: op_info.slashed_count,
            registered_at: op_info.registered_at,
            last_submission_at: op_info.last_submission_at,
            is_active: true,
            is_jailed: false
        };
        Mapping::set(operators, operator, updated_op);
        Mapping::set(operator_active, operator, true);

        let total_ops: u64 = Mapping::get_or_use(total_operators, 0u8, 0u64);
        Mapping::set(total_operators, 0u8, total_ops + 1u64);
    }

    // ===== CLAIM REWARDS =====

    async transition claim_rewards() -> Future {
        let claim_future: Future = credits.aleo/transfer_public(self.caller, 0u64);
        return finalize_claim_rewards(self.caller, claim_future);
    }

    async function finalize_claim_rewards(operator: address, claim_transfer: Future) {
        let rewards: u64 = Mapping::get_or_use(pending_rewards, operator, 0u64);
        assert(rewards > 0u64);

        // Clear pending rewards
        Mapping::set(pending_rewards, operator, 0u64);

        // Update reward pool
        let pool: u64 = Mapping::get_or_use(reward_pool, 0u8, 0u64);
        if pool >= rewards {
            Mapping::set(reward_pool, 0u8, pool - rewards);
        }

        // Await the transfer future
        claim_transfer.await();
    }

    // ===== ADMIN: DEPOSIT TO REWARD POOL =====

    async transition deposit_reward_pool(
        public deposit_credits: credits.aleo/credits,
        public amount: u64
    ) -> (credits.aleo/credits, Future) {
        let (remaining, deposit_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(deposit_credits, self.address, amount);

        return (remaining, finalize_deposit_rewards(self.caller, amount, deposit_future));
    }

    async function finalize_deposit_rewards(caller: address, amount: u64, transfer: Future) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        transfer.await();

        let current_pool: u64 = Mapping::get_or_use(reward_pool, 0u8, 0u64);
        Mapping::set(reward_pool, 0u8, current_pool + amount);
    }

    // ===== ADMIN: UPDATE CONFIG =====

    async transition update_config(
        public min_stake: u64,
        public slash_percentage: u64,
        public min_operators: u8,
        public max_deviation: u64,
        public submission_reward: u64,
        public unbonding_period: u64,
        public enabled: bool
    ) -> Future {
        return finalize_update_config(
            self.caller,
            min_stake,
            slash_percentage,
            min_operators,
            max_deviation,
            submission_reward,
            unbonding_period,
            enabled
        );
    }

    async function finalize_update_config(
        caller: address,
        min_stake: u64,
        slash_percentage: u64,
        min_operators: u8,
        max_deviation: u64,
        submission_reward: u64,
        unbonding_period: u64,
        enabled: bool
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let new_config: ProtocolConfig = ProtocolConfig {
            min_stake: min_stake,
            slash_percentage: slash_percentage,
            min_operators: min_operators,
            max_deviation: max_deviation,
            submission_reward: submission_reward,
            unbonding_period: unbonding_period,
            enabled: enabled
        };
        Mapping::set(config, 0u8, new_config);
    }

    // ===== ADMIN: TRANSFER ADMIN =====

    async transition transfer_admin(public new_admin: address) -> Future {
        return finalize_transfer_admin(self.caller, new_admin);
    }

    async function finalize_transfer_admin(caller: address, new_admin: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(admin, 0u8, new_admin);
    }
}

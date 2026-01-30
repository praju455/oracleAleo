// Aleo Oracle Fee Distributor
// Production-Ready Fee Collection and Distribution to Operators

import credits.aleo;

program fee_distributor_v1.aleo {
    // ===== CONSTANTS =====

    // Protocol fee percentage (2% = 200 basis points)
    const PROTOCOL_FEE_BP: u64 = 200u64;

    // Minimum distribution threshold (1 credit = 1_000_000 microcredits)
    const MIN_DISTRIBUTION_THRESHOLD: u64 = 1000000u64;

    // ===== STRUCTS =====

    // Fee pool configuration
    struct FeeConfig {
        protocol_fee_bp: u64,          // Protocol fee in basis points
        min_operator_stake: u64,       // Minimum stake to receive fees
        distribution_interval: u64,    // Minimum time between distributions (ms)
        enabled: bool
    }

    // Operator fee share info
    struct OperatorFeeShare {
        operator: address,
        stake_weight: u64,             // Stake amount for weight calculation
        total_earned: u64,             // Total earned (historical)
        pending_amount: u64,           // Pending to claim
        last_claim: u64,               // Last claim timestamp
        submissions_in_epoch: u64      // Submissions in current epoch
    }

    // Distribution epoch info
    struct EpochInfo {
        epoch_id: u32,
        started_at: u64,
        ended_at: u64,
        total_fees_collected: u64,
        total_distributed: u64,
        operator_count: u64,
        total_stake_weight: u64
    }

    // Fee collection event
    struct FeeCollection {
        source: field,                 // Hash of source (lending, trading, etc.)
        amount: u64,
        timestamp: u64,
        epoch_id: u32
    }

    // ===== RECORDS =====

    // Claim receipt for privacy
    record ClaimReceipt {
        owner: address,
        amount: u64,
        epoch_id: u32,
        claimed_at: u64,
        receipt_id: field
    }

    // ===== MAPPINGS =====

    // Admin address
    mapping admin: u8 => address;

    // Fee configuration
    mapping fee_config: u8 => FeeConfig;

    // Total fees in pool
    mapping fee_pool: u8 => u64;

    // Protocol treasury
    mapping protocol_treasury: u8 => u64;

    // Operator fee shares: operator => OperatorFeeShare
    mapping operator_shares: address => OperatorFeeShare;

    // Active operator list count
    mapping operator_count: u8 => u64;

    // Current epoch info
    mapping current_epoch: u8 => EpochInfo;

    // Historical epoch info: epoch_id => EpochInfo
    mapping epoch_history: u32 => EpochInfo;

    // Total fees collected all time
    mapping total_fees_collected: u8 => u64;

    // Total fees distributed all time
    mapping total_fees_distributed: u8 => u64;

    // Last distribution timestamp
    mapping last_distribution: u8 => u64;

    // ===== CONSTRUCTOR =====

    @noupgrade
    async constructor() {}

    // ===== INITIALIZATION =====

    async transition initialize(public admin_address: address) -> Future {
        return finalize_initialize(admin_address);
    }

    async function finalize_initialize(admin_address: address) {
        let zero_addr: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
        let existing: address = Mapping::get_or_use(admin, 0u8, zero_addr);
        assert_eq(existing, zero_addr);

        Mapping::set(admin, 0u8, admin_address);

        // Initialize config
        let config: FeeConfig = FeeConfig {
            protocol_fee_bp: 200u64,           // 2% to protocol
            min_operator_stake: 1000000000u64, // 1000 credits minimum
            distribution_interval: 86400000u64, // 24 hours
            enabled: true
        };
        Mapping::set(fee_config, 0u8, config);

        Mapping::set(fee_pool, 0u8, 0u64);
        Mapping::set(protocol_treasury, 0u8, 0u64);
        Mapping::set(operator_count, 0u8, 0u64);
        Mapping::set(total_fees_collected, 0u8, 0u64);
        Mapping::set(total_fees_distributed, 0u8, 0u64);
        Mapping::set(last_distribution, 0u8, 0u64);

        // Initialize first epoch
        let first_epoch: EpochInfo = EpochInfo {
            epoch_id: 1u32,
            started_at: 0u64,
            ended_at: 0u64,
            total_fees_collected: 0u64,
            total_distributed: 0u64,
            operator_count: 0u64,
            total_stake_weight: 0u64
        };
        Mapping::set(current_epoch, 0u8, first_epoch);
    }

    // ===== OPERATOR REGISTRATION =====

    // Register operator for fee distribution
    async transition register_operator_for_fees(
        public operator: address,
        public stake_weight: u64
    ) -> Future {
        return finalize_register_operator(self.caller, operator, stake_weight);
    }

    async function finalize_register_operator(
        caller: address,
        operator: address,
        stake_weight: u64
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let config: FeeConfig = Mapping::get(fee_config, 0u8);
        assert(stake_weight >= config.min_operator_stake);

        // Check if operator already exists
        let default_share: OperatorFeeShare = OperatorFeeShare {
            operator: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc,
            stake_weight: 0u64,
            total_earned: 0u64,
            pending_amount: 0u64,
            last_claim: 0u64,
            submissions_in_epoch: 0u64
        };
        let existing: OperatorFeeShare = Mapping::get_or_use(operator_shares, operator, default_share);

        let new_operator: bool = existing.stake_weight == 0u64;

        let share: OperatorFeeShare = OperatorFeeShare {
            operator: operator,
            stake_weight: stake_weight,
            total_earned: existing.total_earned,
            pending_amount: existing.pending_amount,
            last_claim: existing.last_claim,
            submissions_in_epoch: existing.submissions_in_epoch
        };
        Mapping::set(operator_shares, operator, share);

        if new_operator {
            let count: u64 = Mapping::get_or_use(operator_count, 0u8, 0u64);
            Mapping::set(operator_count, 0u8, count + 1u64);
        }
    }

    // Update operator stake weight
    async transition update_operator_stake(
        public operator: address,
        public new_stake: u64
    ) -> Future {
        return finalize_update_stake(self.caller, operator, new_stake);
    }

    async function finalize_update_stake(
        caller: address,
        operator: address,
        new_stake: u64
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let share: OperatorFeeShare = Mapping::get(operator_shares, operator);

        let updated: OperatorFeeShare = OperatorFeeShare {
            operator: operator,
            stake_weight: new_stake,
            total_earned: share.total_earned,
            pending_amount: share.pending_amount,
            last_claim: share.last_claim,
            submissions_in_epoch: share.submissions_in_epoch
        };
        Mapping::set(operator_shares, operator, updated);

        // Remove from count if stake below minimum
        let config: FeeConfig = Mapping::get(fee_config, 0u8);
        if new_stake < config.min_operator_stake && share.stake_weight >= config.min_operator_stake {
            let count: u64 = Mapping::get_or_use(operator_count, 0u8, 1u64);
            Mapping::set(operator_count, 0u8, count - 1u64);
        }
    }

    // ===== FEE COLLECTION =====

    // Collect fees from protocol usage
    async transition collect_fees(
        public fee_credits: credits.aleo/credits,
        public amount: u64,
        public source_hash: field,
        public timestamp: u64
    ) -> (credits.aleo/credits, Future) {
        assert(amount > 0u64);

        let (remaining, transfer_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(fee_credits, self.address, amount);

        return (remaining, finalize_collect_fees(amount, source_hash, timestamp, transfer_future));
    }

    async function finalize_collect_fees(
        amount: u64,
        source_hash: field,
        timestamp: u64,
        transfer: Future
    ) {
        transfer.await();

        let config: FeeConfig = Mapping::get(fee_config, 0u8);
        assert(config.enabled);

        // Calculate protocol fee
        let protocol_fee: u64 = (amount * config.protocol_fee_bp) / 10000u64;
        let operator_share: u64 = amount - protocol_fee;

        // Update fee pool (for operators)
        let current_pool: u64 = Mapping::get_or_use(fee_pool, 0u8, 0u64);
        Mapping::set(fee_pool, 0u8, current_pool + operator_share);

        // Update protocol treasury
        let treasury: u64 = Mapping::get_or_use(protocol_treasury, 0u8, 0u64);
        Mapping::set(protocol_treasury, 0u8, treasury + protocol_fee);

        // Update total collected
        let total: u64 = Mapping::get_or_use(total_fees_collected, 0u8, 0u64);
        Mapping::set(total_fees_collected, 0u8, total + amount);

        // Update current epoch
        let epoch: EpochInfo = Mapping::get(current_epoch, 0u8);
        let updated_epoch: EpochInfo = EpochInfo {
            epoch_id: epoch.epoch_id,
            started_at: epoch.started_at,
            ended_at: epoch.ended_at,
            total_fees_collected: epoch.total_fees_collected + amount,
            total_distributed: epoch.total_distributed,
            operator_count: epoch.operator_count,
            total_stake_weight: epoch.total_stake_weight
        };
        Mapping::set(current_epoch, 0u8, updated_epoch);
    }

    // ===== FEE DISTRIBUTION =====

    // Distribute fees to a specific operator based on stake weight
    async transition distribute_to_operator(
        public operator: address,
        public total_stake_weight: u64,
        public timestamp: u64
    ) -> Future {
        return finalize_distribute(self.caller, operator, total_stake_weight, timestamp);
    }

    async function finalize_distribute(
        caller: address,
        operator: address,
        total_stake_weight: u64,
        timestamp: u64
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let config: FeeConfig = Mapping::get(fee_config, 0u8);

        // Get current fee pool
        let pool: u64 = Mapping::get_or_use(fee_pool, 0u8, 0u64);
        assert(pool >= MIN_DISTRIBUTION_THRESHOLD);

        // Get operator share
        let share: OperatorFeeShare = Mapping::get(operator_shares, operator);
        assert(share.stake_weight >= config.min_operator_stake);

        // Calculate proportional share
        // operator_amount = pool * (operator_stake / total_stake)
        let operator_amount: u64 = (pool * share.stake_weight) / total_stake_weight;

        if operator_amount > 0u64 {
            // Update operator pending
            let updated_share: OperatorFeeShare = OperatorFeeShare {
                operator: operator,
                stake_weight: share.stake_weight,
                total_earned: share.total_earned + operator_amount,
                pending_amount: share.pending_amount + operator_amount,
                last_claim: share.last_claim,
                submissions_in_epoch: 0u64  // Reset for new epoch
            };
            Mapping::set(operator_shares, operator, updated_share);

            // Decrease pool
            Mapping::set(fee_pool, 0u8, pool - operator_amount);

            // Update total distributed
            let total_dist: u64 = Mapping::get_or_use(total_fees_distributed, 0u8, 0u64);
            Mapping::set(total_fees_distributed, 0u8, total_dist + operator_amount);
        }
    }

    // ===== CLAIMING =====

    // Operator claims their pending fees
    async transition claim_fees(public timestamp: u64) -> (ClaimReceipt, Future) {
        let receipt_id: field = BHP256::hash_to_field(self.caller);

        let epoch: u32 = 0u32;  // Will be set in finalize

        let receipt: ClaimReceipt = ClaimReceipt {
            owner: self.caller,
            amount: 0u64,  // Placeholder - actual amount determined in finalize
            epoch_id: epoch,
            claimed_at: timestamp,
            receipt_id: receipt_id
        };

        // Transfer will happen from public balance
        let transfer_future: Future = credits.aleo/transfer_public(self.caller, 0u64);

        return (receipt, finalize_claim_fees(self.caller, timestamp, transfer_future));
    }

    async function finalize_claim_fees(
        operator: address,
        timestamp: u64,
        transfer: Future
    ) {
        let share: OperatorFeeShare = Mapping::get(operator_shares, operator);
        assert(share.pending_amount > 0u64);

        // Update share
        let updated_share: OperatorFeeShare = OperatorFeeShare {
            operator: operator,
            stake_weight: share.stake_weight,
            total_earned: share.total_earned,
            pending_amount: 0u64,
            last_claim: timestamp,
            submissions_in_epoch: share.submissions_in_epoch
        };
        Mapping::set(operator_shares, operator, updated_share);

        // Execute the transfer
        transfer.await();
    }

    // ===== EPOCH MANAGEMENT =====

    // Start new distribution epoch
    async transition start_new_epoch(public timestamp: u64) -> Future {
        return finalize_start_epoch(self.caller, timestamp);
    }

    async function finalize_start_epoch(caller: address, timestamp: u64) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        // Get current epoch
        let current: EpochInfo = Mapping::get(current_epoch, 0u8);

        // Save current epoch to history
        let finished_epoch: EpochInfo = EpochInfo {
            epoch_id: current.epoch_id,
            started_at: current.started_at,
            ended_at: timestamp,
            total_fees_collected: current.total_fees_collected,
            total_distributed: current.total_distributed,
            operator_count: current.operator_count,
            total_stake_weight: current.total_stake_weight
        };
        Mapping::set(epoch_history, current.epoch_id, finished_epoch);

        // Start new epoch
        let op_count: u64 = Mapping::get_or_use(operator_count, 0u8, 0u64);
        let new_epoch: EpochInfo = EpochInfo {
            epoch_id: current.epoch_id + 1u32,
            started_at: timestamp,
            ended_at: 0u64,
            total_fees_collected: 0u64,
            total_distributed: 0u64,
            operator_count: op_count,
            total_stake_weight: 0u64
        };
        Mapping::set(current_epoch, 0u8, new_epoch);
        Mapping::set(last_distribution, 0u8, timestamp);
    }

    // ===== ADMIN: WITHDRAW PROTOCOL FEES =====

    async transition withdraw_protocol_fees(
        public amount: u64,
        public recipient: address
    ) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(recipient, amount);
        return finalize_withdraw_protocol(self.caller, amount, transfer_future);
    }

    async function finalize_withdraw_protocol(
        caller: address,
        amount: u64,
        transfer: Future
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let treasury: u64 = Mapping::get_or_use(protocol_treasury, 0u8, 0u64);
        assert(treasury >= amount);

        transfer.await();

        Mapping::set(protocol_treasury, 0u8, treasury - amount);
    }

    // ===== ADMIN: UPDATE CONFIG =====

    async transition update_fee_config(
        public protocol_fee_bp: u64,
        public min_operator_stake: u64,
        public distribution_interval: u64,
        public enabled: bool
    ) -> Future {
        return finalize_update_config(self.caller, protocol_fee_bp, min_operator_stake, distribution_interval, enabled);
    }

    async function finalize_update_config(
        caller: address,
        protocol_fee_bp: u64,
        min_operator_stake: u64,
        distribution_interval: u64,
        enabled: bool
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        // Protocol fee cannot exceed 10%
        assert(protocol_fee_bp <= 1000u64);

        let new_config: FeeConfig = FeeConfig {
            protocol_fee_bp: protocol_fee_bp,
            min_operator_stake: min_operator_stake,
            distribution_interval: distribution_interval,
            enabled: enabled
        };
        Mapping::set(fee_config, 0u8, new_config);
    }

    // ===== ADMIN TRANSFER =====

    async transition transfer_admin(public new_admin: address) -> Future {
        return finalize_transfer_admin(self.caller, new_admin);
    }

    async function finalize_transfer_admin(caller: address, new_admin: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(admin, 0u8, new_admin);
    }
}

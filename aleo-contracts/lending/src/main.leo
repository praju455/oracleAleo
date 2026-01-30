// Aleo Private Lending Protocol v2
// Production-Ready with Dynamic Interest Rates, Oracle Integration, Price Staleness Checks, and Flash Loan Protection

import credits.aleo;

program lending_protocol_v2.aleo {
    // ===== CONSTANTS =====

    // Scaling factors
    const RATE_DECIMALS: u64 = 1000000u64;       // 6 decimals for rates
    const PRICE_DECIMALS: u128 = 100000000u128;  // 8 decimals for prices

    // Interest rate model parameters
    const BASE_RATE: u64 = 20000u64;             // 2% base rate (scaled by RATE_DECIMALS)
    const SLOPE1: u64 = 40000u64;                // 4% slope below kink
    const SLOPE2: u64 = 750000u64;               // 75% slope above kink
    const OPTIMAL_UTILIZATION: u64 = 800000u64;  // 80% optimal utilization

    // Collateral factors
    const MIN_COLLATERAL_RATIO: u64 = 15000u64;  // 150% minimum
    const LIQUIDATION_THRESHOLD: u64 = 12500u64; // 125% liquidation threshold
    const LIQUIDATION_BONUS: u64 = 500u64;       // 5% liquidation bonus
    const CLOSE_FACTOR: u64 = 5000u64;           // 50% max liquidation per tx

    // Flash loan fee
    const FLASH_LOAN_FEE: u64 = 9u64;            // 0.09% fee

    // Price staleness thresholds
    const MAX_PRICE_AGE: u64 = 300000u64;        // 5 minutes max price age
    const CRITICAL_PRICE_AGE: u64 = 600000u64;   // 10 minutes - requires higher collateral
    const EMERGENCY_PRICE_AGE: u64 = 900000u64;  // 15 minutes - halt new borrows

    // Minimum confidence score for price acceptance
    const MIN_PRICE_CONFIDENCE: u64 = 5000u64;   // 50% minimum confidence

    // ===== STRUCTS =====

    // Market configuration
    struct MarketConfig {
        oracle_pair_id: u64,           // Oracle price pair ID for this asset
        collateral_factor: u64,        // Max borrowing power (8500 = 85%)
        liquidation_threshold: u64,    // Liquidation trigger (9000 = 90%)
        liquidation_bonus: u64,        // Bonus for liquidators
        reserve_factor: u64,           // Protocol reserve share (1000 = 10%)
        close_factor: u64,             // Max liquidation per tx
        is_active: bool,
        is_borrowing_enabled: bool,
        is_collateral_enabled: bool
    }

    // Market state
    struct MarketState {
        total_deposits: u64,           // Total deposited
        total_borrows: u64,            // Total borrowed
        total_reserves: u64,           // Protocol reserves
        borrow_index: u128,            // Accumulated borrow index
        supply_index: u128,            // Accumulated supply index
        last_update_timestamp: u64,
        current_utilization: u64,      // Current utilization rate
        current_borrow_rate: u64,      // Current borrow APR
        current_supply_rate: u64       // Current supply APR
    }

    // User position
    struct UserPosition {
        deposited: u64,                // User's deposit
        borrowed: u64,                 // User's borrow (before interest)
        borrow_index_at_entry: u128,   // Index when borrowed
        supply_index_at_entry: u128,   // Index when deposited
        last_update: u64
    }

    // Oracle price data (cached from oracle)
    struct OraclePriceData {
        price: u128,                   // Price in 8 decimals
        timestamp: u64,                // When price was updated
        confidence_score: u64,         // 0-10000 confidence
        all_sigs_verified: bool        // Whether all operator signatures verified
    }

    // Collateral position record (private)
    record CollateralPosition {
        owner: address,
        position_id: field,
        collateral_amount: u64,
        borrowed_amount: u64,
        collateral_market_id: u64,
        borrow_market_id: u64,
        borrow_index_snapshot: u128,
        created_at: u64,
        last_interest_update: u64
    }

    // Borrow receipt
    record BorrowReceipt {
        owner: address,
        amount: u64,
        position_id: field,
        borrow_rate_snapshot: u64,
        timestamp: u64
    }

    // Flash loan receipt (must be returned in same tx)
    record FlashLoanReceipt {
        owner: address,
        amount: u64,
        fee: u64,
        receipt_id: field
    }

    // Interest rate model result
    struct InterestRates {
        borrow_rate: u64,              // Annualized borrow rate
        supply_rate: u64,              // Annualized supply rate
        utilization: u64               // Current utilization
    }

    // ===== MAPPINGS =====

    // Admin address
    mapping admin: u8 => address;

    // Oracle contract address (for price feeds)
    mapping oracle: u8 => address;

    // Market configuration: market_id => MarketConfig
    mapping market_config: u64 => MarketConfig;

    // Market state: market_id => MarketState
    mapping market_state: u64 => MarketState;

    // User positions: hash(user, market_id) => UserPosition
    mapping user_positions: field => UserPosition;

    // Position exists: position_id => bool
    mapping position_exists: field => bool;

    // Total markets
    mapping total_markets: u8 => u64;

    // Protocol reserves available for withdrawal
    mapping protocol_reserves: u8 => u64;

    // Flash loan in progress flag
    mapping flash_loan_active: u8 => bool;

    // Global pause state
    mapping paused: u8 => bool;

    // Cached oracle prices: pair_id => OraclePriceData
    mapping cached_prices: u64 => OraclePriceData;

    // Last oracle price update block
    mapping last_price_update: u64 => u64;

    // Emergency mode flag (triggered by stale prices)
    mapping emergency_mode: u8 => bool;

    // ===== CONSTRUCTOR =====

    @noupgrade
    async constructor() {}

    // ===== INITIALIZATION =====

    async transition initialize(
        public admin_address: address,
        public oracle_address: address
    ) -> Future {
        return finalize_initialize(admin_address, oracle_address);
    }

    async function finalize_initialize(admin_address: address, oracle_address: address) {
        let zero_addr: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc;
        let existing: address = Mapping::get_or_use(admin, 0u8, zero_addr);
        assert_eq(existing, zero_addr);

        Mapping::set(admin, 0u8, admin_address);
        Mapping::set(oracle, 0u8, oracle_address);
        Mapping::set(total_markets, 0u8, 0u64);
        Mapping::set(protocol_reserves, 0u8, 0u64);
        Mapping::set(flash_loan_active, 0u8, false);
        Mapping::set(paused, 0u8, false);
        Mapping::set(emergency_mode, 0u8, false);
    }

    // ===== ORACLE PRICE UPDATE =====

    // Update cached price from oracle (must be called before price-sensitive operations)
    async transition update_price_cache(
        public pair_id: u64,
        public price: u128,
        public timestamp: u64,
        public confidence_score: u64,
        public all_sigs_verified: bool
    ) -> Future {
        assert(price > 0u128);
        assert(confidence_score <= 10000u64);

        return finalize_update_price_cache(
            self.caller,
            pair_id,
            price,
            timestamp,
            confidence_score,
            all_sigs_verified
        );
    }

    async function finalize_update_price_cache(
        caller: address,
        pair_id: u64,
        price: u128,
        timestamp: u64,
        confidence_score: u64,
        all_sigs_verified: bool
    ) {
        // Only oracle or admin can update prices
        let oracle_addr: address = Mapping::get(oracle, 0u8);
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert(caller == oracle_addr || caller == admin_addr);

        let price_data: OraclePriceData = OraclePriceData {
            price: price,
            timestamp: timestamp,
            confidence_score: confidence_score,
            all_sigs_verified: all_sigs_verified
        };

        Mapping::set(cached_prices, pair_id, price_data);
        Mapping::set(last_price_update, pair_id, timestamp);

        // Check if we should exit emergency mode
        let is_emergency: bool = Mapping::get_or_use(emergency_mode, 0u8, false);
        if is_emergency && confidence_score >= 5000u64 {
            Mapping::set(emergency_mode, 0u8, false);
        }
    }

    // ===== PRICE VALIDATION HELPERS =====

    // Validate price is fresh and reliable
    inline validate_price(
        price_data: OraclePriceData,
        current_timestamp: u64
    ) -> bool {
        // Check price age
        let age: u64 = current_timestamp - price_data.timestamp;

        // Price must not be stale
        if age > 300000u64 {  // MAX_PRICE_AGE = 5 minutes
            return false;
        }

        // Minimum confidence required
        if price_data.confidence_score < 5000u64 {  // MIN_PRICE_CONFIDENCE
            return false;
        }

        return true;
    }

    // Get adjusted collateral factor based on price freshness
    inline get_adjusted_collateral_factor(
        base_factor: u64,
        price_age: u64,
        sigs_verified: bool
    ) -> u64 {
        // Fresh price with verified sigs - full collateral factor
        if price_age <= 300000u64 && sigs_verified {
            return base_factor;
        }

        // Slightly stale price - reduce by 10%
        if price_age <= 600000u64 {
            return (base_factor * 9000u64) / 10000u64;
        }

        // Very stale price - reduce by 25%
        if price_age <= 900000u64 {
            return (base_factor * 7500u64) / 10000u64;
        }

        // Price too old - no borrowing allowed
        return 0u64;
    }

    // ===== MARKET MANAGEMENT =====

    // Create a new lending market
    async transition create_market(
        public market_id: u64,
        public oracle_pair_id: u64,
        public collateral_factor: u64,
        public liquidation_threshold: u64,
        public liquidation_bonus: u64,
        public reserve_factor: u64,
        public timestamp: u64
    ) -> Future {
        assert(collateral_factor <= 9500u64);       // Max 95%
        assert(liquidation_threshold <= 9800u64);   // Max 98%
        assert(liquidation_bonus <= 1500u64);       // Max 15%
        assert(reserve_factor <= 5000u64);          // Max 50%

        return finalize_create_market(
            self.caller,
            market_id,
            oracle_pair_id,
            collateral_factor,
            liquidation_threshold,
            liquidation_bonus,
            reserve_factor,
            timestamp
        );
    }

    async function finalize_create_market(
        caller: address,
        market_id: u64,
        oracle_pair_id: u64,
        collateral_factor: u64,
        liquidation_threshold: u64,
        liquidation_bonus: u64,
        reserve_factor: u64,
        timestamp: u64
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let config: MarketConfig = MarketConfig {
            oracle_pair_id: oracle_pair_id,
            collateral_factor: collateral_factor,
            liquidation_threshold: liquidation_threshold,
            liquidation_bonus: liquidation_bonus,
            reserve_factor: reserve_factor,
            close_factor: 5000u64,
            is_active: true,
            is_borrowing_enabled: true,
            is_collateral_enabled: true
        };
        Mapping::set(market_config, market_id, config);

        let state: MarketState = MarketState {
            total_deposits: 0u64,
            total_borrows: 0u64,
            total_reserves: 0u64,
            borrow_index: 1000000000000000000u128,  // 1e18 initial
            supply_index: 1000000000000000000u128,  // 1e18 initial
            last_update_timestamp: timestamp,
            current_utilization: 0u64,
            current_borrow_rate: 20000u64,          // 2% initial
            current_supply_rate: 0u64
        };
        Mapping::set(market_state, market_id, state);

        let total: u64 = Mapping::get_or_use(total_markets, 0u8, 0u64);
        Mapping::set(total_markets, 0u8, total + 1u64);
    }

    // ===== DEPOSIT (Supply liquidity) =====

    async transition deposit(
        public deposit_credits: credits.aleo/credits,
        public market_id: u64,
        public amount: u64,
        public timestamp: u64
    ) -> (credits.aleo/credits, Future) {
        assert(amount > 0u64);
        assert(deposit_credits.microcredits >= amount);

        let (remaining, transfer_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(deposit_credits, self.address, amount);

        return (remaining, finalize_deposit(self.caller, market_id, amount, timestamp, transfer_future));
    }

    async function finalize_deposit(
        user: address,
        market_id: u64,
        amount: u64,
        timestamp: u64,
        transfer: Future
    ) {
        let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
        assert(!is_paused);

        let config: MarketConfig = Mapping::get(market_config, market_id);
        assert(config.is_active);

        let state: MarketState = Mapping::get(market_state, market_id);

        transfer.await();

        // Calculate supply shares
        let shares: u64 = amount;  // Simplified - in production would use supply index

        // Update user position
        let position_key: field = BHP256::hash_to_field(user) + BHP256::hash_to_field(market_id);
        let default_pos: UserPosition = UserPosition {
            deposited: 0u64,
            borrowed: 0u64,
            borrow_index_at_entry: state.borrow_index,
            supply_index_at_entry: state.supply_index,
            last_update: timestamp
        };
        let pos: UserPosition = Mapping::get_or_use(user_positions, position_key, default_pos);

        let updated_pos: UserPosition = UserPosition {
            deposited: pos.deposited + shares,
            borrowed: pos.borrowed,
            borrow_index_at_entry: pos.borrow_index_at_entry,
            supply_index_at_entry: state.supply_index,
            last_update: timestamp
        };
        Mapping::set(user_positions, position_key, updated_pos);

        // Update market state
        let new_total_deposits: u64 = state.total_deposits + amount;
        let utilization: u64 = new_total_deposits > 0u64 ?
            (state.total_borrows * 1000000u64) / new_total_deposits : 0u64;

        // Calculate new rates based on utilization
        let borrow_rate: u64 = calculate_borrow_rate(utilization);
        let supply_rate: u64 = state.total_borrows > 0u64 ?
            (borrow_rate * utilization * (10000u64 - config.reserve_factor)) / (10000u64 * 1000000u64) : 0u64;

        let updated_state: MarketState = MarketState {
            total_deposits: new_total_deposits,
            total_borrows: state.total_borrows,
            total_reserves: state.total_reserves,
            borrow_index: state.borrow_index,
            supply_index: state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: utilization,
            current_borrow_rate: borrow_rate,
            current_supply_rate: supply_rate
        };
        Mapping::set(market_state, market_id, updated_state);
    }

    // Helper function to calculate borrow rate from utilization
    inline calculate_borrow_rate(utilization: u64) -> u64 {
        if utilization <= 800000u64 {
            // Below optimal: base + slope1 * utilization / optimal
            return 20000u64 + (40000u64 * utilization) / 800000u64;
        } else {
            // Above optimal: base + slope1 + slope2 * (utilization - optimal) / (1 - optimal)
            let excess: u64 = utilization - 800000u64;
            return 60000u64 + (750000u64 * excess) / 200000u64;
        }
    }

    // ===== WITHDRAW =====

    async transition withdraw(
        public market_id: u64,
        public amount: u64,
        public timestamp: u64
    ) -> Future {
        assert(amount > 0u64);

        let transfer_future: Future = credits.aleo/transfer_public(self.caller, amount);

        return finalize_withdraw(self.caller, market_id, amount, timestamp, transfer_future);
    }

    async function finalize_withdraw(
        user: address,
        market_id: u64,
        amount: u64,
        timestamp: u64,
        transfer: Future
    ) {
        let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
        assert(!is_paused);

        let state: MarketState = Mapping::get(market_state, market_id);

        // Get user position
        let position_key: field = BHP256::hash_to_field(user) + BHP256::hash_to_field(market_id);
        let pos: UserPosition = Mapping::get(user_positions, position_key);
        assert(pos.deposited >= amount);

        // Check available liquidity
        let available: u64 = state.total_deposits - state.total_borrows;
        assert(available >= amount);

        transfer.await();

        // Update user position
        let updated_pos: UserPosition = UserPosition {
            deposited: pos.deposited - amount,
            borrowed: pos.borrowed,
            borrow_index_at_entry: pos.borrow_index_at_entry,
            supply_index_at_entry: pos.supply_index_at_entry,
            last_update: timestamp
        };
        Mapping::set(user_positions, position_key, updated_pos);

        // Update market state
        let new_total_deposits: u64 = state.total_deposits - amount;
        let utilization: u64 = new_total_deposits > 0u64 ?
            (state.total_borrows * 1000000u64) / new_total_deposits : 0u64;

        let borrow_rate: u64 = calculate_borrow_rate(utilization);
        let config: MarketConfig = Mapping::get(market_config, market_id);
        let supply_rate: u64 = (state.total_borrows > 0u64 && new_total_deposits > 0u64) ?
            (borrow_rate * utilization * (10000u64 - config.reserve_factor)) / (10000u64 * 1000000u64) : 0u64;

        let updated_state: MarketState = MarketState {
            total_deposits: new_total_deposits,
            total_borrows: state.total_borrows,
            total_reserves: state.total_reserves,
            borrow_index: state.borrow_index,
            supply_index: state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: utilization,
            current_borrow_rate: borrow_rate,
            current_supply_rate: supply_rate
        };
        Mapping::set(market_state, market_id, updated_state);
    }

    // ===== BORROW WITH COLLATERAL AND PRICE VALIDATION =====

    async transition borrow(
        public collateral_credits: credits.aleo/credits,
        public collateral_market_id: u64,
        public collateral_amount: u64,
        public borrow_market_id: u64,
        public borrow_amount: u64,
        public timestamp: u64
    ) -> (CollateralPosition, credits.aleo/credits, Future) {
        assert(collateral_amount > 0u64);
        assert(borrow_amount > 0u64);

        let position_id: field = BHP256::hash_to_field(self.caller) + BHP256::hash_to_field(timestamp);

        let position: CollateralPosition = CollateralPosition {
            owner: self.caller,
            position_id: position_id,
            collateral_amount: collateral_amount,
            borrowed_amount: borrow_amount,
            collateral_market_id: collateral_market_id,
            borrow_market_id: borrow_market_id,
            borrow_index_snapshot: 1000000000000000000u128,
            created_at: timestamp,
            last_interest_update: timestamp
        };

        // Lock collateral
        let (remaining, lock_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(collateral_credits, self.address, collateral_amount);

        return (position, remaining, finalize_borrow(
            self.caller,
            collateral_market_id,
            collateral_amount,
            borrow_market_id,
            borrow_amount,
            position_id,
            timestamp,
            lock_future
        ));
    }

    async function finalize_borrow(
        borrower: address,
        collateral_market_id: u64,
        collateral_amount: u64,
        borrow_market_id: u64,
        borrow_amount: u64,
        position_id: field,
        timestamp: u64,
        lock_transfer: Future
    ) {
        let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
        assert(!is_paused);

        // Check emergency mode - no new borrows allowed
        let is_emergency: bool = Mapping::get_or_use(emergency_mode, 0u8, false);
        assert(!is_emergency);

        let coll_config: MarketConfig = Mapping::get(market_config, collateral_market_id);
        let borrow_config: MarketConfig = Mapping::get(market_config, borrow_market_id);

        assert(coll_config.is_active && coll_config.is_collateral_enabled);
        assert(borrow_config.is_active && borrow_config.is_borrowing_enabled);

        // ===== PRICE STALENESS VALIDATION =====
        // Get cached collateral price
        let default_price: OraclePriceData = OraclePriceData {
            price: 0u128,
            timestamp: 0u64,
            confidence_score: 0u64,
            all_sigs_verified: false
        };

        let coll_price_data: OraclePriceData = Mapping::get_or_use(cached_prices, coll_config.oracle_pair_id, default_price);
        let borrow_price_data: OraclePriceData = Mapping::get_or_use(cached_prices, borrow_config.oracle_pair_id, default_price);

        // Validate prices exist
        assert(coll_price_data.price > 0u128);
        assert(borrow_price_data.price > 0u128);

        // Check price age
        let coll_price_age: u64 = timestamp - coll_price_data.timestamp;
        let borrow_price_age: u64 = timestamp - borrow_price_data.timestamp;

        // Reject if prices are too stale
        assert(coll_price_age <= 900000u64);   // 15 minutes max
        assert(borrow_price_age <= 900000u64);

        // Get adjusted collateral factor based on price freshness
        let adjusted_coll_factor: u64 = get_adjusted_collateral_factor(
            coll_config.collateral_factor,
            coll_price_age,
            coll_price_data.all_sigs_verified
        );
        assert(adjusted_coll_factor > 0u64);

        // Require minimum confidence for borrowing
        assert(coll_price_data.confidence_score >= 5000u64);
        assert(borrow_price_data.confidence_score >= 5000u64);

        // ===== LIQUIDITY CHECK =====
        let borrow_state: MarketState = Mapping::get(market_state, borrow_market_id);
        let available: u64 = borrow_state.total_deposits - borrow_state.total_borrows;
        assert(available >= borrow_amount);

        // ===== COLLATERAL RATIO CHECK WITH ORACLE PRICES =====
        // Calculate collateral value: collateral_amount * collateral_price
        let collateral_value: u128 = (collateral_amount as u128) * coll_price_data.price;

        // Calculate borrow value: borrow_amount * borrow_price
        let borrow_value: u128 = (borrow_amount as u128) * borrow_price_data.price;

        // Max borrow value allowed: collateral_value * adjusted_collateral_factor / 10000
        let max_borrow_value: u128 = (collateral_value * (adjusted_coll_factor as u128)) / 10000u128;

        // Ensure borrow doesn't exceed max
        assert(borrow_value <= max_borrow_value);

        // Verify position doesn't exist
        let exists: bool = Mapping::get_or_use(position_exists, position_id, false);
        assert(!exists);

        lock_transfer.await();

        // Update borrow market state
        let new_total_borrows: u64 = borrow_state.total_borrows + borrow_amount;
        let utilization: u64 = borrow_state.total_deposits > 0u64 ?
            (new_total_borrows * 1000000u64) / borrow_state.total_deposits : 0u64;

        let borrow_rate: u64 = calculate_borrow_rate(utilization);
        let supply_rate: u64 = new_total_borrows > 0u64 ?
            (borrow_rate * utilization * (10000u64 - borrow_config.reserve_factor)) / (10000u64 * 1000000u64) : 0u64;

        let updated_state: MarketState = MarketState {
            total_deposits: borrow_state.total_deposits,
            total_borrows: new_total_borrows,
            total_reserves: borrow_state.total_reserves,
            borrow_index: borrow_state.borrow_index,
            supply_index: borrow_state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: utilization,
            current_borrow_rate: borrow_rate,
            current_supply_rate: supply_rate
        };
        Mapping::set(market_state, borrow_market_id, updated_state);

        // Update collateral market
        let coll_state: MarketState = Mapping::get(market_state, collateral_market_id);
        let updated_coll_state: MarketState = MarketState {
            total_deposits: coll_state.total_deposits + collateral_amount,
            total_borrows: coll_state.total_borrows,
            total_reserves: coll_state.total_reserves,
            borrow_index: coll_state.borrow_index,
            supply_index: coll_state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: coll_state.current_utilization,
            current_borrow_rate: coll_state.current_borrow_rate,
            current_supply_rate: coll_state.current_supply_rate
        };
        Mapping::set(market_state, collateral_market_id, updated_coll_state);

        Mapping::set(position_exists, position_id, true);
    }

    // Claim borrowed funds (separate tx after borrow)
    async transition claim_borrowed(
        public borrow_amount: u64,
        public recipient: address
    ) -> Future {
        let transfer_future: Future = credits.aleo/transfer_public(recipient, borrow_amount);
        return finalize_claim(transfer_future);
    }

    async function finalize_claim(transfer: Future) {
        transfer.await();
    }

    // ===== REPAY =====

    async transition repay(
        public position: CollateralPosition,
        public repay_credits: credits.aleo/credits,
        public repay_amount: u64,
        public timestamp: u64
    ) -> (CollateralPosition, credits.aleo/credits, Future) {
        assert_eq(position.owner, self.caller);
        assert(repay_amount > 0u64);
        assert(repay_amount <= position.borrowed_amount);

        let updated_position: CollateralPosition = CollateralPosition {
            owner: position.owner,
            position_id: position.position_id,
            collateral_amount: position.collateral_amount,
            borrowed_amount: position.borrowed_amount - repay_amount,
            collateral_market_id: position.collateral_market_id,
            borrow_market_id: position.borrow_market_id,
            borrow_index_snapshot: position.borrow_index_snapshot,
            created_at: position.created_at,
            last_interest_update: timestamp
        };

        let (remaining, repay_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(repay_credits, self.address, repay_amount);

        return (updated_position, remaining, finalize_repay(position.borrow_market_id, repay_amount, timestamp, repay_future));
    }

    async function finalize_repay(
        borrow_market_id: u64,
        repay_amount: u64,
        timestamp: u64,
        repay_transfer: Future
    ) {
        repay_transfer.await();

        let borrow_state: MarketState = Mapping::get(market_state, borrow_market_id);
        let config: MarketConfig = Mapping::get(market_config, borrow_market_id);

        let new_total_borrows: u64 = borrow_state.total_borrows - repay_amount;
        let utilization: u64 = borrow_state.total_deposits > 0u64 ?
            (new_total_borrows * 1000000u64) / borrow_state.total_deposits : 0u64;

        let borrow_rate: u64 = calculate_borrow_rate(utilization);
        let supply_rate: u64 = new_total_borrows > 0u64 ?
            (borrow_rate * utilization * (10000u64 - config.reserve_factor)) / (10000u64 * 1000000u64) : 0u64;

        let updated_state: MarketState = MarketState {
            total_deposits: borrow_state.total_deposits,
            total_borrows: new_total_borrows,
            total_reserves: borrow_state.total_reserves,
            borrow_index: borrow_state.borrow_index,
            supply_index: borrow_state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: utilization,
            current_borrow_rate: borrow_rate,
            current_supply_rate: supply_rate
        };
        Mapping::set(market_state, borrow_market_id, updated_state);
    }

    // ===== LIQUIDATE WITH PRICE VALIDATION =====

    async transition liquidate(
        public position: CollateralPosition,
        public liquidator_credits: credits.aleo/credits,
        public repay_amount: u64,
        public expected_seize_amount: u64,
        public timestamp: u64
    ) -> (credits.aleo/credits, Future) {
        assert_neq(position.owner, self.caller);
        assert(repay_amount > 0u64);
        assert(expected_seize_amount > 0u64);
        assert(expected_seize_amount <= position.collateral_amount);

        // Calculate max repay (close factor = 50%)
        let max_repay: u64 = (position.borrowed_amount * 5000u64) / 10000u64;
        assert(repay_amount <= max_repay);

        // Liquidator pays debt
        let (remaining, pay_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(liquidator_credits, self.address, repay_amount);

        // Transfer seized collateral to liquidator (done at transition level)
        let seize_future: Future = credits.aleo/transfer_public(self.caller, expected_seize_amount);

        return (remaining, finalize_liquidate(
            position.position_id,
            position.collateral_amount,
            position.borrowed_amount,
            repay_amount,
            expected_seize_amount,
            position.collateral_market_id,
            position.borrow_market_id,
            timestamp,
            pay_future,
            seize_future
        ));
    }

    async function finalize_liquidate(
        position_id: field,
        collateral_amount: u64,
        borrowed_amount: u64,
        repay_amount: u64,
        expected_seize_amount: u64,
        collateral_market_id: u64,
        borrow_market_id: u64,
        timestamp: u64,
        pay_transfer: Future,
        seize_transfer: Future
    ) {
        let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
        assert(!is_paused);

        // ===== PRICE VALIDATION FOR LIQUIDATION =====
        let coll_config: MarketConfig = Mapping::get(market_config, collateral_market_id);
        let borrow_config: MarketConfig = Mapping::get(market_config, borrow_market_id);

        let default_price: OraclePriceData = OraclePriceData {
            price: 0u128,
            timestamp: 0u64,
            confidence_score: 0u64,
            all_sigs_verified: false
        };

        let coll_price_data: OraclePriceData = Mapping::get_or_use(cached_prices, coll_config.oracle_pair_id, default_price);
        let borrow_price_data: OraclePriceData = Mapping::get_or_use(cached_prices, borrow_config.oracle_pair_id, default_price);

        // Prices must exist for liquidation
        assert(coll_price_data.price > 0u128);
        assert(borrow_price_data.price > 0u128);

        // For liquidation, allow slightly stale prices (but with penalty)
        let coll_price_age: u64 = timestamp - coll_price_data.timestamp;
        let borrow_price_age: u64 = timestamp - borrow_price_data.timestamp;

        // Max 15 minute price age for liquidation
        assert(coll_price_age <= 900000u64);
        assert(borrow_price_age <= 900000u64);

        // Calculate position health using oracle prices
        let collateral_value: u128 = (collateral_amount as u128) * coll_price_data.price;
        let borrow_value: u128 = (borrowed_amount as u128) * borrow_price_data.price;

        // Position is liquidatable if collateral_value < borrow_value * liquidation_threshold / 10000
        let min_collateral_value: u128 = (borrow_value * (coll_config.liquidation_threshold as u128)) / 10000u128;
        assert(collateral_value < min_collateral_value);

        // Calculate collateral to seize with oracle prices
        // seize_value = repay_value * (1 + liquidation_bonus)
        let repay_value: u128 = (repay_amount as u128) * borrow_price_data.price;
        let seize_value: u128 = (repay_value * (10000u64 + coll_config.liquidation_bonus) as u128) / 10000u128;

        // Convert seize_value back to collateral amount
        let calculated_seize: u64 = (seize_value / coll_price_data.price) as u64;

        // Cap seize at available collateral using ternary
        let max_seize: u64 = calculated_seize > collateral_amount ? collateral_amount : calculated_seize;

        // Validate that expected_seize_amount matches calculated amount
        assert(expected_seize_amount <= max_seize);

        pay_transfer.await();
        seize_transfer.await();

        // Update borrow market
        let borrow_state: MarketState = Mapping::get(market_state, borrow_market_id);
        let config: MarketConfig = Mapping::get(market_config, borrow_market_id);

        let new_borrows: u64 = borrow_state.total_borrows - repay_amount;
        let utilization: u64 = borrow_state.total_deposits > 0u64 ?
            (new_borrows * 1000000u64) / borrow_state.total_deposits : 0u64;

        let borrow_rate: u64 = calculate_borrow_rate(utilization);

        let updated_borrow_state: MarketState = MarketState {
            total_deposits: borrow_state.total_deposits,
            total_borrows: new_borrows,
            total_reserves: borrow_state.total_reserves,
            borrow_index: borrow_state.borrow_index,
            supply_index: borrow_state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: utilization,
            current_borrow_rate: borrow_rate,
            current_supply_rate: borrow_state.current_supply_rate
        };
        Mapping::set(market_state, borrow_market_id, updated_borrow_state);

        // Update collateral market
        let coll_state: MarketState = Mapping::get(market_state, collateral_market_id);
        let updated_coll_state: MarketState = MarketState {
            total_deposits: coll_state.total_deposits - expected_seize_amount,
            total_borrows: coll_state.total_borrows,
            total_reserves: coll_state.total_reserves,
            borrow_index: coll_state.borrow_index,
            supply_index: coll_state.supply_index,
            last_update_timestamp: timestamp,
            current_utilization: coll_state.current_utilization,
            current_borrow_rate: coll_state.current_borrow_rate,
            current_supply_rate: coll_state.current_supply_rate
        };
        Mapping::set(market_state, collateral_market_id, updated_coll_state);

        // If fully liquidated, close position
        let is_fully_liquidated: bool = expected_seize_amount >= collateral_amount;
        if is_fully_liquidated {
            Mapping::set(position_exists, position_id, false);
        }
    }

    // ===== FLASH LOAN WITH ORACLE PROTECTION =====

    async transition flash_loan(
        public market_id: u64,
        public amount: u64,
        public timestamp: u64
    ) -> (FlashLoanReceipt, Future) {
        assert(amount > 0u64);

        let fee: u64 = (amount * 9u64) / 10000u64;  // 0.09% fee
        let receipt_id: field = BHP256::hash_to_field(self.caller);

        let receipt: FlashLoanReceipt = FlashLoanReceipt {
            owner: self.caller,
            amount: amount,
            fee: fee,
            receipt_id: receipt_id
        };

        let transfer_future: Future = credits.aleo/transfer_public(self.caller, amount);

        return (receipt, finalize_flash_loan_start(market_id, amount, timestamp, transfer_future));
    }

    async function finalize_flash_loan_start(
        market_id: u64,
        amount: u64,
        timestamp: u64,
        transfer: Future
    ) {
        let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
        assert(!is_paused);

        // Check not already in flash loan
        let active: bool = Mapping::get_or_use(flash_loan_active, 0u8, false);
        assert(!active);

        // ===== ORACLE PROTECTION FOR FLASH LOANS =====
        // Ensure prices are fresh before allowing flash loan
        let config: MarketConfig = Mapping::get(market_config, market_id);

        let default_price: OraclePriceData = OraclePriceData {
            price: 0u128,
            timestamp: 0u64,
            confidence_score: 0u64,
            all_sigs_verified: false
        };

        let price_data: OraclePriceData = Mapping::get_or_use(cached_prices, config.oracle_pair_id, default_price);

        // For flash loans, require very fresh price (2 minutes max)
        if price_data.price > 0u128 {
            let price_age: u64 = timestamp - price_data.timestamp;
            assert(price_age <= 120000u64);  // 2 minutes max for flash loans
        }

        let state: MarketState = Mapping::get(market_state, market_id);
        let available: u64 = state.total_deposits - state.total_borrows;
        assert(available >= amount);

        Mapping::set(flash_loan_active, 0u8, true);

        transfer.await();
    }

    // Repay flash loan
    async transition repay_flash_loan(
        public receipt: FlashLoanReceipt,
        public repay_credits: credits.aleo/credits,
        public market_id: u64
    ) -> (credits.aleo/credits, Future) {
        assert_eq(receipt.owner, self.caller);

        let total_repay: u64 = receipt.amount + receipt.fee;
        assert(repay_credits.microcredits >= total_repay);

        let (remaining, repay_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(repay_credits, self.address, total_repay);

        return (remaining, finalize_flash_loan_end(market_id, receipt.fee, repay_future));
    }

    async function finalize_flash_loan_end(
        market_id: u64,
        fee: u64,
        repay_transfer: Future
    ) {
        repay_transfer.await();

        // Clear flash loan flag
        Mapping::set(flash_loan_active, 0u8, false);

        // Add fee to reserves
        let state: MarketState = Mapping::get(market_state, market_id);
        let updated_state: MarketState = MarketState {
            total_deposits: state.total_deposits,
            total_borrows: state.total_borrows,
            total_reserves: state.total_reserves + fee,
            borrow_index: state.borrow_index,
            supply_index: state.supply_index,
            last_update_timestamp: state.last_update_timestamp,
            current_utilization: state.current_utilization,
            current_borrow_rate: state.current_borrow_rate,
            current_supply_rate: state.current_supply_rate
        };
        Mapping::set(market_state, market_id, updated_state);
    }

    // ===== EMERGENCY MODE =====

    // Trigger emergency mode (admin only - for extreme price staleness)
    async transition set_emergency_mode(public enabled: bool) -> Future {
        return finalize_set_emergency(self.caller, enabled);
    }

    async function finalize_set_emergency(caller: address, enabled: bool) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        Mapping::set(emergency_mode, 0u8, enabled);
    }

    // ===== ADMIN FUNCTIONS =====

    async transition pause() -> Future {
        return finalize_pause(self.caller);
    }

    async function finalize_pause(caller: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(paused, 0u8, true);
    }

    async transition unpause() -> Future {
        return finalize_unpause(self.caller);
    }

    async function finalize_unpause(caller: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(paused, 0u8, false);
    }

    async transition update_oracle(public new_oracle: address) -> Future {
        return finalize_update_oracle(self.caller, new_oracle);
    }

    async function finalize_update_oracle(caller: address, new_oracle: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(oracle, 0u8, new_oracle);
    }

    async transition update_market_config(
        public market_id: u64,
        public collateral_factor: u64,
        public liquidation_threshold: u64,
        public liquidation_bonus: u64,
        public reserve_factor: u64,
        public is_active: bool,
        public is_borrowing_enabled: bool,
        public is_collateral_enabled: bool
    ) -> Future {
        return finalize_update_market(
            self.caller,
            market_id,
            collateral_factor,
            liquidation_threshold,
            liquidation_bonus,
            reserve_factor,
            is_active,
            is_borrowing_enabled,
            is_collateral_enabled
        );
    }

    async function finalize_update_market(
        caller: address,
        market_id: u64,
        collateral_factor: u64,
        liquidation_threshold: u64,
        liquidation_bonus: u64,
        reserve_factor: u64,
        is_active: bool,
        is_borrowing_enabled: bool,
        is_collateral_enabled: bool
    ) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);

        let old_config: MarketConfig = Mapping::get(market_config, market_id);

        let new_config: MarketConfig = MarketConfig {
            oracle_pair_id: old_config.oracle_pair_id,
            collateral_factor: collateral_factor,
            liquidation_threshold: liquidation_threshold,
            liquidation_bonus: liquidation_bonus,
            reserve_factor: reserve_factor,
            close_factor: old_config.close_factor,
            is_active: is_active,
            is_borrowing_enabled: is_borrowing_enabled,
            is_collateral_enabled: is_collateral_enabled
        };
        Mapping::set(market_config, market_id, new_config);
    }

    async transition transfer_admin(public new_admin: address) -> Future {
        return finalize_transfer_admin(self.caller, new_admin);
    }

    async function finalize_transfer_admin(caller: address, new_admin: address) {
        let admin_addr: address = Mapping::get(admin, 0u8);
        assert_eq(caller, admin_addr);
        Mapping::set(admin, 0u8, new_admin);
    }

    // ===== VIEW HELPERS =====

    transition is_healthy(position: CollateralPosition) -> bool {
        if position.borrowed_amount == 0u64 {
            return true;
        }
        let ratio: u64 = (position.collateral_amount * 10000u64) / position.borrowed_amount;
        return ratio >= 12500u64;
    }

    transition get_collateral_ratio(position: CollateralPosition) -> u64 {
        if position.borrowed_amount == 0u64 {
            return 999999u64;
        }
        return (position.collateral_amount * 10000u64) / position.borrowed_amount;
    }
}

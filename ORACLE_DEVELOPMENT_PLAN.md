# Aleo Privacy-Preserving Oracle - Complete Development Plan (Phase 0-5)
## Project Overview
│   │  │  - lending.aleo (Private collateral positions)               │    │  │
│   │  │  - perps.aleo (Private perpetual futures)                    │    │  │
│   │  │  - options.aleo (Private options)                            │    │  │
│   │  │  - yield.aleo (Private yield vaults)                         │    │  │
│   │  │  - bridge.aleo (Cross-chain bridge)                          │    │  │
│   │  └─────────────────────────────────────────────────────────────┘    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         FRONTEND & SDK                               │  │
│   │  - Price dashboard          - Developer SDK (@aleo-oracle/sdk)      │  │
│   │  - Operator management      - Cross-chain bridge UI                  │  │
│   │  - DeFi interfaces          - Governance portal                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
### 1. Signature Scheme: Aleo Native Schnorr
- **Cross-chain:** Use ECDSA (`ecdsa.verify.*`) for Ethereum message verification (Phase 4)
### 2. Decentralization: Multi-Operator with Staking
- **Consensus:** On-chain median aggregation
- **Incentives:** Stake tokens, earn fees, get slashed for misbehavior
### 3. Price Freshness: Epoch-Based + Heartbeat
- **Heartbeat:** Mandatory update every 5 minutes

---
## Task 0.1: Off-Chain Oracle Node
**Directory:** `oracle-node/`
**Tech:** Node.js, TypeScript, Express
```
oracle-node/
├── src/
│       ├── prices.ts          # GET /price/:pair, GET /prices
│       └── health.ts          # GET /health
├── tests/
│   └── median.test.ts
├── package.json
└── tsconfig.json
```
Math.abs(p - median) / median <= 0.05
);
return filtered[Math.floor(filtered.length / 2)];
}
```
GET /operator             → This operator's Aleo address
```
**Initial Pairs:** ETH/USD, BTC/USD, ALEO/USD
## Task 0.2: On-Chain Oracle Contract
**Directory:** `aleo-contracts/oracle/`
**Program Name:** `price_oracle_XXXX.aleo`
```leo
program price_oracle_XXXX.aleo {
// ===== STRUCTS =====
struct AggregatedPrice {
price: u128,
timestamp: u64,
        num_sources: u8,
        epoch: u32
}
// ===== MAPPINGS =====
   mapping admin: u8 => address;
   mapping registered_operators: address => bool;
    mapping aggregated_prices: u64 => AggregatedPrice;
    mapping paused: u8 => bool;
// ===== CONSTRUCTOR =====
@noupgrade
async constructor() {}
    // ===== TRANSITIONS =====
async transition initialize(public admin_address: address) -> Future {
return finalize_initialize(admin_address);
}
async function finalize_initialize(admin_address: address) {
let existing: address = Mapping::get_or_use(admin, 0u8, aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc);
       assert_eq(existing, aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc);
Mapping::set(admin, 0u8, admin_address);
}
   async transition register_operator(public operator: address) -> Future {
return finalize_register_operator(self.caller, operator);
}
Mapping::set(registered_operators, operator, true);
}
async transition submit_price(
public pair_id: u64,
public price: u128,
public timestamp: u64,
public sig: signature
) -> Future {
return finalize_submit_price(self.caller, pair_id, price, timestamp);
}
price: u128,
timestamp: u64
) {
let is_paused: bool = Mapping::get_or_use(paused, 0u8, false);
assert_eq(is_paused, false);
let is_registered: bool = Mapping::get_or_use(registered_operators, operator, false);
assert(is_registered);
let agg: AggregatedPrice = AggregatedPrice {
price: price,
timestamp: timestamp,
Mapping::set(aggregated_prices, pair_id, agg);
}
async transition pause() -> Future {
return finalize_pause(self.caller);
}
## Task 0.3: Lending Protocol (Consumer Demo)
**Directory:** `aleo-contracts/lending/`
```leo
program lending_protocol_XXXX.aleo {
// ===== RECORDS (Private User Data) =====
record CollateralPosition {
owner: address,
       collateral_token: u64,
       collateral_amount: u128,
       borrowed_amount: u128,
       position_id: field
}
// ===== MAPPINGS =====
mapping position_counter: u8 => u64;
// ===== CONSTRUCTOR =====
@noupgrade
async constructor() {}
// ===== BORROW =====
transition borrow(
collateral_token: u64,
collateral_amount: u128,
borrow_amount: u128,
price: u128,
price_timestamp: u64
) -> CollateralPosition {
       // collateral_value = (collateral_amount * price) / 10^8
let collateral_value: u128 = (collateral_amount * price) / 100000000u128;
        // ratio = (collateral_value * 100) / borrow_amount >= 150%
let ratio: u128 = (collateral_value * 100u128) / borrow_amount;
assert(ratio >= 150u128);
let position_id: field = BHP256::hash_to_field(self.caller);
return CollateralPosition {
// ===== REPAY =====
transition repay(position: CollateralPosition) -> CollateralPosition {
assert_eq(position.owner, self.caller);
return CollateralPosition {
owner: position.owner,
collateral_token: position.collateral_token,
current_price: u128,
price_timestamp: u64
) -> bool {
let collateral_value: u128 = (position.collateral_amount * current_price) / 100000000u128;
let ratio: u128 = (collateral_value * 100u128) / position.borrowed_amount;
assert(ratio < 150u128);
return true;
}
}
## Task 0.4: Relayer Service
**Directory:** `relayer/`
```typescript
const DEVIATION_THRESHOLD = 0.005;  // 0.5%
const HEARTBEAT_INTERVAL = 300;     // 5 minutes
const POLL_INTERVAL = 30000;        // 30 seconds
async function relayerLoop() {
while (true) {
Number(latestPrice.price - lastOnChain.price)
) / Number(lastOnChain.price);
if (deviation > DEVIATION_THRESHOLD || timeSinceLast > HEARTBEAT_INTERVAL) {
await submitToBlockchain(pair, latestPrice);
}
}
await sleep(POLL_INTERVAL);
}
}
## Task 0.5: Frontend Interface
**Directory:** `frontend/`
**Tech:** Next.js, React, TypeScript, Tailwind CSS
```
frontend/
├── src/
│   │   └── positions/page.tsx    # My positions
│   ├── components/
│   │   ├── wallet/
│   │   │   ├── WalletWrapper.tsx
│   │   │   └── WalletConnect.tsx
│   │   ├── PriceDisplay.tsx
│   │   ├── BorrowForm.tsx
│   │   └── PositionsList.tsx
│   ├── services/
│   │   ├── oracleAPI.ts
│   │   └── aleoService.ts
│   └── hooks/
│       └── useAleo.ts
├── package.json
└── next.config.js
```
**Wallet Integration (from mistakes.md):**
```typescript
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import { PuzzleWalletAdapter } from 'aleo-adapters';
const PROGRAM_IDS = ['price_oracle_XXXX.aleo', 'lending_protocol_XXXX.aleo'];
export function WalletWrapper({ children }) {
const wallets = useMemo(() => [
new LeoWalletAdapter({ appName: 'Aleo Oracle' }),
new PuzzleWalletAdapter({
[WalletAdapterNetwork.TestnetBeta]: PROGRAM_IDS,
},
appName: 'Aleo Oracle',
}),
], []);
return (
        <WalletProvider wallets={wallets} network={WalletAdapterNetwork.TestnetBeta} autoConnect>
<WalletModalProvider>{children}</WalletModalProvider>
</WalletProvider>
);
## Task 0.6: Documentation
- Component-specific READMEs
## Phase 0 Deliverables
# PHASE 1: Production Hardening
**Objective:** Production-ready oracle with multi-operator support, monitoring, and security.
---
## Task 1.1: Expand to 10 Data Sources

**Exchanges:**
```typescript
interface PriceProvider {
name: string;
## Task 1.2: TWAP (Time-Weighted Average Price)
```typescript
function calculateTWAP(history: PriceHistory[], windowSeconds: number): number {
const now = Date.now() / 1000;
const relevant = history.filter(h => now - h.timestamp < windowSeconds);
## Task 1.3: Circuit Breaker
**Halt Conditions:**
```typescript
function checkCircuitBreaker(currentPrice: number, previousPrice: number): boolean {
    const percentChange = Math.abs(currentPrice - previousPrice) / previousPrice;

    if (percentChange > 0.10) {
        sendAlert('CIRCUIT BREAKER: Price moved >10%');
        return true; // Halt
    }
    return false;
}
```

## Task 1.4: PostgreSQL Database
**Schema:**
```sql
## Task 1.5: Monitoring (Prometheus + Grafana)
```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

const priceUpdates = new Counter({
name: 'oracle_price_updates_total',
labelNames: ['pair', 'status']
name: 'oracle_current_price',
labelNames: ['pair']
});
```
**Dashboard Panels:**
## Task 1.6: Multi-Operator On-Chain Aggregation
```leo
// Enhanced submit with multi-operator median
mapping epoch_submissions: field => u8;
mapping epoch_prices: field => u128;
async function finalize_submit_price(
operator: address,
let current_epoch: u32 = block.height / 10u32;
let epoch_key: field = BHP256::hash_to_field(current_epoch as field + pair_id as field);
let count: u8 = Mapping::get_or_use(epoch_submissions, epoch_key, 0u8);
let price_key: field = BHP256::hash_to_field(epoch_key + count as field);
Mapping::set(epoch_prices, price_key, price);
Mapping::set(epoch_submissions, epoch_key, count + 1u8);
    // Aggregate when 3+ submissions
if count >= 2u8 {
let p0: u128 = Mapping::get(epoch_prices, BHP256::hash_to_field(epoch_key + 0u8 as field));
let p1: u128 = Mapping::get(epoch_prices, BHP256::hash_to_field(epoch_key + 1u8 as field));
let p2: u128 = Mapping::get(epoch_prices, BHP256::hash_to_field(epoch_key + 2u8 as field));
let median: u128 = compute_median_3(p0, p1, p2);
let agg: AggregatedPrice = AggregatedPrice {
Mapping::set(aggregated_prices, pair_id, agg);
}
}
```
## Task 1.7: Operator Registry & Staking
**Contract:** `oracle_registry_XXXX.aleo`
```leo
program oracle_registry_XXXX.aleo {
struct Operator {
address: address,
stake: u128,
is_active: bool
}
mapping operators: address => Operator;
   mapping min_stake: u8 => u128;
mapping total_staked: u8 => u128;
@noupgrade
async constructor() {}
async transition stake(public amount: u128) -> Future {
return finalize_stake(self.caller, amount);
}
async function finalize_stake(operator: address, amount: u128) {
       let min: u128 = Mapping::get_or_use(min_stake, 0u8, 1000000000u128);
assert(amount >= min);
let existing: Operator = Mapping::get_or_use(operators, operator, Operator {
address: operator,
stake: 0u128,
           reputation: 1000u64,
is_active: false
});
};
Mapping::set(operators, operator, updated);
}
    async transition slash(public operator: address, public amount: u128) -> Future {
        return finalize_slash(self.caller, operator, amount);
}
   async function finalize_slash(caller: address, operator: address, amount: u128) {
        // Admin-only slashing
let op: Operator = Mapping::get(operators, operator);
let slash_amount: u128 = op.stake < amount ? op.stake : amount;
let updated: Operator = Operator {
address: op.address,
stake: op.stake - slash_amount,
           reputation: op.reputation - 100u64,
is_active: op.stake - slash_amount >= 1000000000u128
};
Mapping::set(operators, operator, updated);
}
}
```
## Task 1.8: Developer SDK
**Package:** `@aleo-oracle/sdk`
// Get latest price
const price = await oracle.getPrice('ETH/USD');
// Verify signature locally
const isValid = await oracle.verifySignature(price);
// Get historical data
const history = await oracle.getHistory('ETH/USD', { from, to });
// Build transaction inputs
const txInputs = oracle.buildPriceInputs('ETH/USD');
```
## Task 1.9: Integration Tests
**Scenarios:**
1. Happy path: Oracle updates → User borrows → No liquidation
2. Price drop: ETH $2500→$1800 → Liquidation triggered
3. Stale price attack: Old timestamp rejected
4. Wrong signature: Fake signature rejected
5. Exchange outage: 3/10 offline, oracle works with 7
## Phase 1 Deliverables
- [ ] Operator staking/slashing
# PHASE 2: DeFi Ecosystem Expansion
**Objective:** Build reference DeFi applications and expand price coverage.
---
## Task 2.1: Private Perpetual Futures

**Contract:** `perps_protocol_XXXX.aleo`
```leo
program perps_protocol_XXXX.aleo {
    record PerpPosition {
        owner: address,
        token: u64,           // e.g., 1u64 for ETH
        side: u8,             // 0 = long, 1 = short
        size: u128,           // Position size in USD
        entry_price: u128,    // Price when opened
        leverage: u8,         // 1x to 20x
        margin: u128,         // Collateral deposited
        position_id: field
    }

    mapping funding_rates: u64 => i128;        // pair_id => funding rate
    mapping open_interest_long: u64 => u128;   // Total long OI per pair
    mapping open_interest_short: u64 => u128;  // Total short OI per pair

    @noupgrade
    async constructor() {}

    transition open_long(
        token: u64,
        size: u128,
        leverage: u8,
        margin: u128,
        current_price: u128,
        price_timestamp: u64
    ) -> PerpPosition {
        // Validate leverage (1-20x)
        assert(leverage >= 1u8 && leverage <= 20u8);

        // Validate margin covers position
        let required_margin: u128 = size / (leverage as u128);
        assert(margin >= required_margin);

        return PerpPosition {
            owner: self.caller,
            token: token,
            side: 0u8,  // long
            size: size,
            entry_price: current_price,
            leverage: leverage,
            margin: margin,
            position_id: BHP256::hash_to_field(self.caller)
        };
    }

    transition open_short(
        token: u64,
        size: u128,
        leverage: u8,
        margin: u128,
        current_price: u128,
        price_timestamp: u64
    ) -> PerpPosition {
        assert(leverage >= 1u8 && leverage <= 20u8);

        let required_margin: u128 = size / (leverage as u128);
        assert(margin >= required_margin);

        return PerpPosition {
            owner: self.caller,
            token: token,
            side: 1u8,  // short
            size: size,
            entry_price: current_price,
            leverage: leverage,
            margin: margin,
            position_id: BHP256::hash_to_field(self.caller)
        };
    }

    transition close_position(
        position: PerpPosition,
        current_price: u128
    ) -> u128 {
        assert_eq(position.owner, self.caller);

        // Calculate PnL
        let pnl: u128 = 0u128;
        if position.side == 0u8 {
            // Long: profit if price went up
            if current_price > position.entry_price {
                pnl = ((current_price - position.entry_price) * position.size) / position.entry_price;
            }
        } else {
            // Short: profit if price went down
            if current_price < position.entry_price {
                pnl = ((position.entry_price - current_price) * position.size) / position.entry_price;
            }
        }

        return position.margin + pnl;
    }

    transition liquidate_position(
        position: PerpPosition,
        current_price: u128
    ) -> u128 {
        // Calculate unrealized loss
        let loss: u128 = 0u128;
        if position.side == 0u8 && current_price < position.entry_price {
            loss = ((position.entry_price - current_price) * position.size) / position.entry_price;
        } else if position.side == 1u8 && current_price > position.entry_price {
            loss = ((current_price - position.entry_price) * position.size) / position.entry_price;
        }

        // Liquidate if loss > 80% of margin
        let liquidation_threshold: u128 = (position.margin * 80u128) / 100u128;
        assert(loss >= liquidation_threshold);

        // Liquidator gets 5% bonus
        let liquidator_reward: u128 = (position.margin * 5u128) / 100u128;
        return liquidator_reward;
    }
}
```

**Features:**
- Liquidator earns 5% bonus
## Task 2.2: Private Options Protocol
**Contract:** `options_protocol_XXXX.aleo`
```leo
program options_protocol_XXXX.aleo {
    record Option {
        owner: address,          // Option holder
        writer: address,         // Option seller
        underlying: u64,         // e.g., ETH
        strike_price: u128,      // PRIVATE strike
        expiry: u64,             // Unix timestamp
        option_type: u8,         // 0 = call, 1 = put
        amount: u128,            // Size of option
        premium: u128,           // Paid by buyer
        collateral: u128,        // Locked by writer
        exercised: bool
    }

    mapping option_counter: u8 => u64;

    @noupgrade
    async constructor() {}

    // Writer creates a call option
    transition write_call(
        underlying: u64,
        strike_price: u128,
        expiry: u64,
        amount: u128,
        premium: u128,
        collateral: u128
    ) -> Option {
        // Collateral must cover potential payout
        assert(collateral >= amount);

        return Option {
            owner: aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc, // No owner yet
            writer: self.caller,
            underlying: underlying,
            strike_price: strike_price,
            expiry: expiry,
            option_type: 0u8,
            amount: amount,
            premium: premium,
            collateral: collateral,
            exercised: false
        };
    }

    // Buyer purchases the option
    transition buy_option(option: Option) -> Option {
        assert_eq(option.owner, aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc);

        return Option {
            owner: self.caller,
            writer: option.writer,
            underlying: option.underlying,
            strike_price: option.strike_price,
            expiry: option.expiry,
            option_type: option.option_type,
            amount: option.amount,
            premium: option.premium,
            collateral: option.collateral,
            exercised: false
        };
    }

    // Exercise call option at expiry
    transition exercise_call(
        option: Option,
        current_price: u128,
        current_timestamp: u64
    ) -> u128 {
        assert_eq(option.owner, self.caller);
        assert_eq(option.option_type, 0u8);
        assert(current_timestamp >= option.expiry);
        assert(!option.exercised);

        // Exercise if in-the-money (current > strike)
        assert(current_price > option.strike_price);

        // Payout = (current_price - strike_price) * amount / current_price
        let payout: u128 = ((current_price - option.strike_price) * option.amount) / current_price;
        return payout;
    }

    // Exercise put option at expiry
    transition exercise_put(
        option: Option,
        current_price: u128,
        current_timestamp: u64
    ) -> u128 {
        assert_eq(option.owner, self.caller);
        assert_eq(option.option_type, 1u8);
        assert(current_timestamp >= option.expiry);
        assert(!option.exercised);

        // Exercise if in-the-money (current < strike)
        assert(current_price < option.strike_price);

        // Payout = (strike_price - current_price) * amount / strike_price
        let payout: u128 = ((option.strike_price - current_price) * option.amount) / option.strike_price;
        return payout;
    }
}
```
**Privacy Features:**
- Strike price is private (hidden from public)
- Prove profitability in ZK without revealing strike

## Task 2.3: Private Yield Aggregator
**Contract:** `yield_vault_XXXX.aleo`
```leo
program yield_vault_XXXX.aleo {
    record VaultPosition {
        owner: address,
        deposited: u128,        // Amount deposited
        shares: u128,           // Vault shares owned
        deposit_timestamp: u64
    }
    mapping total_deposits: u8 => u128;
    mapping total_shares: u8 => u128;
    mapping current_apy: u8 => u64;           // APY in basis points (e.g., 500 = 5%)
    mapping vault_strategy: u8 => u8;         // Current strategy ID
    @noupgrade
    async constructor() {}
    transition deposit(amount: u128) -> VaultPosition {
        return VaultPosition {
            owner: self.caller,
            deposited: amount,
            shares: amount,  // 1:1 initially, changes with yield
            deposit_timestamp: 0u64  // Would use block.timestamp
        };
    }
    transition withdraw(
        position: VaultPosition,
        shares_to_withdraw: u128
    ) -> (VaultPosition, u128) {
        assert_eq(position.owner, self.caller);
        assert(position.shares >= shares_to_withdraw);

        // Calculate withdrawal amount based on current share value
        // withdrawal = shares * total_deposits / total_shares
        let withdrawal: u128 = shares_to_withdraw;  // Simplified

        let remaining: VaultPosition = VaultPosition {
            owner: position.owner,
            deposited: position.deposited,
            shares: position.shares - shares_to_withdraw,
            deposit_timestamp: position.deposit_timestamp
        };

        return (remaining, withdrawal);
    }

    // Harvest yields and compound
    async transition harvest() -> Future {
        return finalize_harvest();
    }

    async function finalize_harvest() {
        let total: u128 = Mapping::get_or_use(total_deposits, 0u8, 0u128);
        let apy: u64 = Mapping::get_or_use(current_apy, 0u8, 500u64);  // 5%

        // Add yield to total deposits
        let yield_amount: u128 = (total * (apy as u128)) / 1000000u128;
        Mapping::set(total_deposits, 0u8, total + yield_amount);
    }
}
```

**Strategies:**
- Strategy 1: Lend on lending.aleo (fixed APY)
- Strategy 2: LP on private DEX (variable APY)
- Strategy 3: Stake in validator (predictable rewards)

---

## Task 2.4: Price Feed Expansion (50+ Pairs)

**Categories:**
```typescript
const SUPPORTED_PAIRS = {
    // Major Crypto (10)
    major: ['ETH/USD', 'BTC/USD', 'ALEO/USD', 'SOL/USD', 'AVAX/USD',
            'MATIC/USD', 'DOT/USD', 'ATOM/USD', 'LINK/USD', 'UNI/USD'],
    // Stablecoins (5)
    stablecoins: ['USDC/USD', 'USDT/USD', 'DAI/USD', 'FRAX/USD', 'LUSD/USD'],

    // DeFi Tokens (15)
    defi: ['AAVE/USD', 'CRV/USD', 'MKR/USD', 'SNX/USD', 'COMP/USD',
           'SUSHI/USD', 'YFI/USD', 'BAL/USD', '1INCH/USD', 'LDO/USD',
           'RPL/USD', 'GMX/USD', 'DYDX/USD', 'PERP/USD', 'INJ/USD'],

    // L1/L2 Tokens (10)
    chains: ['ARB/USD', 'OP/USD', 'NEAR/USD', 'FTM/USD', 'ALGO/USD',
             'HBAR/USD', 'XTZ/USD', 'EGLD/USD', 'FLOW/USD', 'MINA/USD'],

    // Gaming/Metaverse (10)
    gaming: ['AXS/USD', 'SAND/USD', 'MANA/USD', 'ENJ/USD', 'GALA/USD',
             'IMX/USD', 'MAGIC/USD', 'GODS/USD', 'ILV/USD', 'PRIME/USD']
};
```

## Task 2.5: Cross-Protocol Price Consistency
**Epoch-based pricing:**
```leo
// All protocols read same epoch price
async transition get_price_for_epoch(
    public epoch: u32,
    public pair_id: u64
) -> Future {
    return finalize_get_price_for_epoch(epoch, pair_id);
}

async function finalize_get_price_for_epoch(epoch: u32, pair_id: u64) {
    let epoch_key: field = BHP256::hash_to_field(epoch as field + pair_id as field);
    let price: AggregatedPrice = Mapping::get(epoch_prices, epoch_key);
    // Consumer reads this
}
```
## Task 2.6: Historical Data API (Candles)
```typescript
// GET /api/v1/candles/:pair?interval=1h&from=X&to=Y

interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

const intervals = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

async function generateCandles(pair: string, interval: string, from: number, to: number): Promise<Candle[]> {
    const prices = await db.query(`
        SELECT price, timestamp
        FROM price_submissions
        WHERE pair = $1 AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp
    `, [pair, from, to]);

    // Group by interval and compute OHLC
    return groupByInterval(prices, interval);
}
```
---
## Task 2.7: Developer Grants Program

**Structure:**
- $10,000 per project
- Milestone-based: 25% approval, 50% testnet, 25% mainnet

**Target Projects:**
1. Private DEX (AMM)
2. Prediction markets
3. Insurance protocol
4. NFT lending
5. Synthetic assets

## Phase 2 Deliverables
- [ ] Developer grant program launched
# PHASE 3: Security & Mainnet Preparation
**Objective:** Complete security hardening, audits, and prepare for mainnet launch.
## Task 3.1: Security Audit Preparation
**Documentation:**
```
docs/
├── SECURITY.md              # Security policy
├── THREAT_MODEL.md          # Attack vectors & mitigations
├── AUDIT_SCOPE.md           # What auditors should focus on
└── KNOWN_LIMITATIONS.md     # Documented limitations
```

**Threat Model:**
| Threat | Impact | Mitigation |
|--------|--------|------------|
| Price manipulation | High | Multi-source aggregation, TWAP, circuit breaker |
| Stale price attack | High | Timestamp validation, heartbeat requirement |
| Operator collusion | High | Minimum 3 operators, slashing, reputation |
| Front-running | Medium | Epoch-based pricing |
| DoS on operators | Medium | Multiple operators, fallback sources |
| Smart contract bugs | Critical | Audits, formal verification |

---

## Task 3.2: Formal Verification

**Tools:**
- Use Leo's built-in testing framework
- Symbolic execution for critical paths
- Invariant testing

**Key Invariants:**
```leo
// Invariant 1: Price must be within reasonable bounds
assert(price > 0u128 && price < 1000000000000000u128);

// Invariant 2: Collateral ratio must always be checked
assert(collateral_ratio >= 150u128);

// Invariant 3: Only registered operators can submit
assert(is_registered == true);

// Invariant 4: Paused state blocks all submissions
assert(is_paused == false || submission_rejected == true);
```

---

## Task 3.3: External Security Audit

**Scope:**
1. `price_oracle_XXXX.aleo` - Core oracle logic
2. `oracle_registry_XXXX.aleo` - Staking & slashing
3. `lending_protocol_XXXX.aleo` - Consumer protocol
4. Oracle node TypeScript code
5. Relayer service

**Auditors to Contact:**
- Trail of Bits
- OpenZeppelin
- Quantstamp
- Zellic
- OtterSec

**Budget:** $50K-$80K

**Timeline:** 4-6 weeks

---

## Task 3.4: Bug Bounty Program

**Structure:**
```
| Severity | Reward | Examples |
|----------|--------|----------|
| Critical | $50,000 | Price manipulation, fund theft |
| High | $20,000 | Incorrect liquidation, DoS |
| Medium | $5,000 | Information leakage, griefing |
| Low | $1,000 | Minor issues, UX bugs |
```

**Platform:** Immunefi or custom program

---

## Task 3.5: Multi-Sig Admin

**Admin Operations Requiring Multi-Sig:**
- Pause/unpause oracle
- Add/remove operators
- Update minimum stake
- Slash operators
- Emergency withdrawal

**Implementation:**
```leo
struct MultiSigProposal {
    action: u8,           // 0=pause, 1=unpause, 2=slash, etc.
    target: address,      // Target of action
    value: u128,          // Amount (if applicable)
    approvals: u8,        // Number of approvals
    executed: bool
}

mapping admins: u8 => address;           // 3 admin addresses
mapping proposals: field => MultiSigProposal;
mapping proposal_approvals: field => u8; // Bitmap of who approved

const REQUIRED_APPROVALS: u8 = 2u8;      // 2-of-3

async transition propose_action(
    public action: u8,
    public target: address,
    public value: u128
) -> Future {
    return finalize_propose(self.caller, action, target, value);
}

async transition approve_proposal(public proposal_id: field) -> Future {
    return finalize_approve(self.caller, proposal_id);
}

async function finalize_approve(caller: address, proposal_id: field) {
    // Verify caller is admin
    // Increment approvals
    // If approvals >= REQUIRED_APPROVALS, execute
}
```

---

## Task 3.6: Rate Limiting & DoS Protection

**Oracle Node:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,             // 100 requests per minute
    message: 'Too many requests'
});

app.use('/price', limiter);
```

**On-Chain:**
```leo
mapping last_submission: address => u64;  // operator => timestamp
const MIN_SUBMISSION_INTERVAL: u64 = 10u64;  // 10 seconds

async function finalize_submit_price(...) {
    let last: u64 = Mapping::get_or_use(last_submission, operator, 0u64);
    assert(timestamp - last >= MIN_SUBMISSION_INTERVAL);
    Mapping::set(last_submission, operator, timestamp);
}
```

---

## Task 3.7: Testnet Stress Testing

**Tests:**
1. **Load test:** 1000 price submissions per minute
2. **Failover test:** Kill 2 of 3 operators
3. **Network partition:** Simulate operator disconnect
4. **Price spike:** 50% price change in 1 minute
5. **Concurrent users:** 100 simultaneous borrows

**Tools:**
- k6 for load testing
- Chaos Monkey for failover
- Custom scripts for blockchain stress

---

## Task 3.8: Mainnet Deployment Checklist

```
PRE-DEPLOYMENT:
[ ] All audits completed and issues resolved
[ ] Bug bounty program live
[ ] Multi-sig admin configured
[ ] At least 5 operators onboarded and staked
[ ] Monitoring & alerting active
[ ] Runbook for incident response
[ ] Legal review completed

DEPLOYMENT:
[ ] Deploy oracle_registry.aleo to mainnet
[ ] Deploy price_oracle.aleo to mainnet
[ ] Register initial operators
[ ] Configure admin multi-sig
[ ] Deploy consumer protocols (lending, etc.)
[ ] Update frontend to mainnet

POST-DEPLOYMENT:
[ ] Verify all contracts on explorer
[ ] Test end-to-end flow
[ ] Monitor for 24 hours
[ ] Announce launch
```

---

## Phase 3 Deliverables

- [ ] Threat model documented
- [ ] Security audit completed
- [ ] All critical/high issues resolved
- [ ] Bug bounty program launched
- [ ] Multi-sig admin implemented
- [ ] Rate limiting active
- [ ] Stress testing passed
- [ ] Mainnet deployment checklist ready

---

# PHASE 4: Cross-Chain & Advanced Features

**Objective:** Enable cross-chain interoperability and advanced oracle features.

---

## Task 4.1: Ethereum Price Verification (ECDSA)

**Use Case:** Verify Ethereum-signed messages on Aleo

```leo
// Using Aleo Stack v4.3.0 ECDSA support
async transition verify_eth_price(
    public price: u128,
    public timestamp: u64,
    public eth_signature: [u8; 65],  // r, s, v
    public eth_address: address
) -> Future {
    // Reconstruct message hash
    let message: field = BHP256::hash_to_field(price as field + timestamp as field);

    // Verify ECDSA signature
    // ecdsa.verify.secp256k1(message, signature, address)

    return finalize_verify_eth_price(price, timestamp);
}
```

**Use Cases:**
- Verify Chainlink prices on Aleo
- Cross-chain arbitrage detection
- Bridge price validation

---

## Task 4.2: Cross-Chain Bridge Oracle

**Contract:** `bridge_oracle_XXXX.aleo`

```leo
program bridge_oracle_XXXX.aleo {
    // Track prices across chains
    struct CrossChainPrice {
        aleo_price: u128,
        eth_price: u128,
        bsc_price: u128,
        timestamp: u64,
        deviation: u64  // Max deviation between chains (basis points)
    }

    mapping cross_chain_prices: u64 => CrossChainPrice;
    mapping bridge_paused: u8 => bool;

    @noupgrade
    async constructor() {}

    // Submit price from Aleo oracle
    async transition submit_aleo_price(
        public pair_id: u64,
        public price: u128,
        public timestamp: u64
    ) -> Future {
        return finalize_submit_aleo(pair_id, price, timestamp);
    }

    // Submit price from Ethereum (ECDSA verified)
    async transition submit_eth_price(
        public pair_id: u64,
        public price: u128,
        public timestamp: u64,
        public eth_signature: signature
    ) -> Future {
        // Verify ECDSA signature from Ethereum oracle
        return finalize_submit_eth(pair_id, price, timestamp);
    }

    async function finalize_submit_eth(pair_id: u64, price: u128, timestamp: u64) {
        let existing: CrossChainPrice = Mapping::get_or_use(
            cross_chain_prices,
            pair_id,
            CrossChainPrice {
                aleo_price: 0u128,
                eth_price: 0u128,
                bsc_price: 0u128,
                timestamp: 0u64,
                deviation: 0u64
            }
        );

        let updated: CrossChainPrice = CrossChainPrice {
            aleo_price: existing.aleo_price,
            eth_price: price,
            bsc_price: existing.bsc_price,
            timestamp: timestamp,
            deviation: calculate_deviation(existing.aleo_price, price)
        };

        // Pause bridge if deviation > 2%
        if updated.deviation > 200u64 {
            Mapping::set(bridge_paused, 0u8, true);
        }

        Mapping::set(cross_chain_prices, pair_id, updated);
    }
}
```

---

## Task 4.3: Volatility Oracle

**Track implied volatility for options pricing:**

```leo
struct VolatilityData {
    iv_30d: u64,       // 30-day implied volatility (basis points)
    iv_7d: u64,        // 7-day IV
    realized_vol: u64, // Historical realized volatility
    timestamp: u64
}

mapping volatility: u64 => VolatilityData;

// Used by options protocol for Black-Scholes pricing
```

**Off-Chain Calculation:**
```typescript
function calculateRealizedVolatility(prices: number[], windowDays: number): number {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push(Math.log(prices[i] / prices[i-1]));
    }

    const mean = returns.reduce((a, b) => a + b) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(365);

    return Math.round(annualizedVol * 10000); // Basis points
}
```

---

## Task 4.4: Gas Price Oracle

**Track Aleo network fees:**

```leo
struct GasData {
    base_fee: u64,       // Base fee in microcredits
    priority_fee: u64,   // Suggested priority fee
    block_utilization: u8, // 0-100%
    timestamp: u64
}

mapping gas_prices: u8 => GasData;
```

**Use Cases:**
- Dynamic fee estimation for relayers
- MEV protection strategies
- Transaction cost optimization

---

## Task 4.5: Prediction Market Oracle

**Contract:** `prediction_oracle_XXXX.aleo`

```leo
program prediction_oracle_XXXX.aleo {
    struct Outcome {
        event_id: field,
        description_hash: field,  // Hash of outcome description
        resolved: bool,
        winning_outcome: u8,      // 0, 1, 2... (index)
        resolution_timestamp: u64
    }

    record PredictionPosition {
        owner: address,
        event_id: field,
        outcome_bet: u8,
        amount: u128,
        odds: u64  // In basis points
    }

    mapping events: field => Outcome;
    mapping event_pools: field => u128;  // Total pool per event

    @noupgrade
    async constructor() {}

    // Create prediction event
    async transition create_event(
        public event_id: field,
        public description_hash: field,
        public num_outcomes: u8
    ) -> Future {
        return finalize_create_event(event_id, description_hash, num_outcomes);
    }

    // Place bet on outcome
    transition place_bet(
        event_id: field,
        outcome: u8,
        amount: u128
    ) -> PredictionPosition {
        return PredictionPosition {
            owner: self.caller,
            event_id: event_id,
            outcome_bet: outcome,
            amount: amount,
            odds: 0u64  // Calculated based on pool
        };
    }

    // Resolve event (oracle provides outcome)
    async transition resolve_event(
        public event_id: field,
        public winning_outcome: u8,
        public oracle_signature: signature
    ) -> Future {
        // Verify oracle signature
        return finalize_resolve(event_id, winning_outcome);
    }

    // Claim winnings
    transition claim_winnings(
        position: PredictionPosition,
        current_timestamp: u64
    ) -> u128 {
        // Verify event resolved and position won
        // Calculate payout based on odds
        return position.amount * 2u128;  // Simplified
    }
}
```

---

## Task 4.6: NFT Price Oracle

**Track NFT floor prices:**

```typescript
interface NFTCollection {
    contract_address: string;
    chain: string;
    floor_price: bigint;  // In native token (ETH, SOL, etc.)
    floor_price_usd: bigint;
    volume_24h: bigint;
    sales_24h: number;
    timestamp: number;
}

// Sources: OpenSea API, Blur API, Magic Eden API
```

**On-Chain:**
```leo
struct NFTPrice {
    collection_id: field,      // Hash of collection address
    floor_price: u128,         // Floor in native token
    floor_price_usd: u128,     // Floor in USD
    timestamp: u64
}

mapping nft_prices: field => NFTPrice;
```

---

## Task 4.7: Real-World Asset (RWA) Oracle

**Track tokenized real-world assets:**

```leo
struct RWAPrice {
    asset_id: field,        // Hash of asset identifier
    asset_type: u8,         // 0=gold, 1=silver, 2=real_estate, etc.
    price_usd: u128,
    last_audit: u64,        // Timestamp of last physical audit
    auditor: address,       // Auditor who verified
    timestamp: u64 }

mapping rwa_prices: field => RWAPrice;
```

**Asset Types:**
- Precious metals (Gold, Silver, Platinum)
- Real estate (tokenized properties)
- Commodities (Oil, Natural Gas)
- Treasury bonds

---

## Task 4.8: Advanced API Features

```typescript
// WebSocket for real-time updates
const ws = new WebSocket('wss://oracle-api.example.com/ws');

ws.on('message', (data) => {
    const update = JSON.parse(data);
    // { pair: 'ETH/USD', price: '250000000000',    timestamp:                1234567890 }
});

// Subscribe to specific pairs
ws.send(JSON.stringify({
    action: 'subscribe',
    pairs: ['ETH/USD', 'BTC/USD']
}));

// GraphQL API
const query = `
    query GetPriceHistory($pair: String!, $from: Int!, $to: Int!) {
        priceHistory(pair: $pair, from: $from, to: $to) {
            timestamp
            price
            sources
        }
    }
`;
```

---

## Phase 4 Deliverables

- [ ] ECDSA verification for Ethereum messages
- [ ] Cross-chain bridge oracle
- [ ] Volatility oracle for options
- [ ] Gas price oracle
- [ ] Prediction market oracle
- [ ] NFT price oracle
- [ ] RWA oracle
- [ ] WebSocket & GraphQL APIs

---

# PHASE 5: Full Decentralization & Governance

**Objective:** Transition to fully decentralized governance and sustainable tokenomics.

---

## Task 5.1: Governance Token ($ORACLE)

**Token Contract:** `oracle_token_XXXX.aleo`

```leo
program oracle_token_XXXX.aleo {
    // ARC-20 compatible token
    record Token {
        owner: address,
        amount: u128
    }

    mapping balances: address => u128;
    mapping total_supply: u8 => u128;
    mapping allowances: field => u128;  // hash(owner, spender) => amount

    // Token distribution
    // Total: 100,000,000 ORACLE
    // - 30% Operators (vested over 3 years)
    // - 25% Treasury (DAO controlled)
    // - 20% Team (vested over 4 years)
    // - 15% Ecosystem grants
    // - 10% Public sale

    @noupgrade
    async constructor() {}

    transition transfer(to: address, amount: u128) -> Token {
        return Token {
            owner: to,
            amount: amount
        };
    }

    async transition transfer_public(
        public to: address,
        public amount: u128
    ) -> Future {
        return finalize_transfer(self.caller, to, amount);
    }

    async function finalize_transfer(from: address, to: address, amount: u128) {
        let from_balance: u128 = Mapping::get_or_use(balances, from, 0u128);
        assert(from_balance >= amount);

        let to_balance: u128 = Mapping::get_or_use(balances, to, 0u128);

        Mapping::set(balances, from, from_balance - amount);
        Mapping::set(balances, to, to_balance + amount);
    }
}
```

---

## Task 5.2: DAO Governance

**Contract:** `oracle_dao_XXXX.aleo`

```leo
program oracle_dao_XXXX.aleo {
    struct Proposal {
        id: field,
        proposer: address,
        description_hash: field,
        action_type: u8,           // 0=parameter_change, 1=treasury, 2=upgrade
        target_contract: address,
        calldata_hash: field,
        votes_for: u128,
        votes_against: u128,
        start_block: u32,
        end_block: u32,
        executed: bool,
        canceled: bool
    }

    mapping proposals: field => Proposal;
    mapping proposal_votes: field => bool;  // hash(proposal_id, voter) => voted
    mapping voting_power: address => u128;  // Staked ORACLE tokens
    mapping delegate: address => address;   // Delegation

    // Governance parameters
    const PROPOSAL_THRESHOLD: u128 = 100000000000u128;  // 1% of supply to propose
    const QUORUM: u128 = 400000000000u128;              // 4% quorum
    const VOTING_PERIOD: u32 = 50400u32;               // ~7 days in blocks

    @noupgrade
    async constructor() {}

    // Create proposal
    async transition create_proposal(
        public description_hash: field,
        public action_type: u8,
        public target_contract: address,
        public calldata_hash: field
    ) -> Future {
        return finalize_create_proposal(
            self.caller,
            description_hash,
            action_type,
            target_contract,
            calldata_hash
        );
    }

    async function finalize_create_proposal(
        proposer: address,
        description_hash: field,
        action_type: u8,
        target_contract: address,
        calldata_hash: field
    ) {
        let power: u128 = Mapping::get_or_use(voting_power, proposer, 0u128);
        assert(power >= PROPOSAL_THRESHOLD);

        let proposal_id: field = BHP256::hash_to_field(proposer);

        let proposal: Proposal = Proposal {
            id: proposal_id,
            proposer: proposer,
            description_hash: description_hash,
            action_type: action_type,
            target_contract: target_contract,
            calldata_hash: calldata_hash,
            votes_for: 0u128,
            votes_against: 0u128,
            start_block: 0u32,  // Would use block.height
            end_block: 50400u32,
            executed: false,
            canceled: false
        };

        Mapping::set(proposals, proposal_id, proposal);
    }

    // Cast vote
    async transition vote(
        public proposal_id: field,
        public support: bool
    ) -> Future {
        return finalize_vote(self.caller, proposal_id, support);
    }

    async function finalize_vote(voter: address, proposal_id: field, support: bool) {
        let vote_key: field = BHP256::hash_to_field(proposal_id + voter as field);
        let has_voted: bool = Mapping::get_or_use(proposal_votes, vote_key, false);
        assert(!has_voted);

        let power: u128 = Mapping::get_or_use(voting_power, voter, 0u128);
        let proposal: Proposal = Mapping::get(proposals, proposal_id);

        let updated: Proposal = Proposal {
            id: proposal.id,
            proposer: proposal.proposer,
            description_hash: proposal.description_hash,
            action_type: proposal.action_type,
            target_contract: proposal.target_contract,
            calldata_hash: proposal.calldata_hash,
            votes_for: support ? proposal.votes_for + power : proposal.votes_for,
            votes_against: support ? proposal.votes_against : proposal.votes_against + power,
            start_block: proposal.start_block,
            end_block: proposal.end_block,
            executed: proposal.executed,
            canceled: proposal.canceled
        };

        Mapping::set(proposals, proposal_id, updated);
        Mapping::set(proposal_votes, vote_key, true);
    }

    // Execute passed proposal
    async transition execute_proposal(public proposal_id: field) -> Future {
        return finalize_execute(proposal_id);
    }

    async function finalize_execute(proposal_id: field) {
        let proposal: Proposal = Mapping::get(proposals, proposal_id);

        // Check voting period ended
        // Check quorum reached
        assert(proposal.votes_for + proposal.votes_against >= QUORUM);

        // Check passed
        assert(proposal.votes_for > proposal.votes_against);

        // Check not already executed
        assert(!proposal.executed);

        // Execute action (simplified - real implementation would call target)
        let updated: Proposal = Proposal {
            id: proposal.id,
            proposer: proposal.proposer,
            description_hash: proposal.description_hash,
            action_type: proposal.action_type,
            target_contract: proposal.target_contract,
            calldata_hash: proposal.calldata_hash,
            votes_for: proposal.votes_for,
            votes_against: proposal.votes_against,
            start_block: proposal.start_block,
            end_block: proposal.end_block,
            executed: true,
            canceled: proposal.canceled
        };

        Mapping::set(proposals, proposal_id, updated);
    }

    // Delegate voting power
    async transition delegate_votes(public delegatee: address) -> Future {
        return finalize_delegate(self.caller, delegatee);
    }

    async function finalize_delegate(delegator: address, delegatee: address) {
        Mapping::set(delegate, delegator, delegatee);
        // Transfer voting power
    }
}
```

---

## Task 5.3: Fee Distribution & Tokenomics

**Revenue Sources:**
1. **Protocol fees:** 0.01% of DeFi volume using oracle
2. **Data subscription:** Premium API access
3. **Bridge fees:** Cross-chain price verification

**Distribution:**
```
Revenue Split:
├── 50% → Operator rewards (proportional to stake)
├── 30% → DAO treasury
├── 15% → Stakers (ORACLE holders)
└── 5%  → Insurance fund
```

**Fee Distributor Contract:**
```leo
program fee_distributor_XXXX.aleo {
    mapping accumulated_fees: u8 => u128;
    mapping operator_shares: address => u128;
    mapping last_claim: address => u64;

    async transition distribute_fees() -> Future {
        return finalize_distribute();
    }

    async function finalize_distribute() {
        let total_fees: u128 = Mapping::get_or_use(accumulated_fees, 0u8, 0u128);

        // 50% to operators
        let operator_pool: u128 = (total_fees * 50u128) / 100u128;

        // 30% to treasury
        let treasury_share: u128 = (total_fees * 30u128) / 100u128;

        // 15% to stakers
        let staker_pool: u128 = (total_fees * 15u128) / 100u128;

        // 5% to insurance
        let insurance_share: u128 = (total_fees * 5u128) / 100u128;

        // Reset accumulated fees
        Mapping::set(accumulated_fees, 0u8, 0u128);
    }

    async transition claim_operator_rewards() -> Future {
        return finalize_claim_operator(self.caller);
    }

    async function finalize_claim_operator(operator: address) {
        let rewards: u128 = Mapping::get_or_use(operator_shares, operator, 0u128);
        Mapping::set(operator_shares, operator, 0u128);
        // Transfer rewards to operator
    }
}
```

---

## Task 5.4: Insurance Fund

**Purpose:** Cover losses from oracle failures

```leo
program insurance_fund_XXXX.aleo {
    mapping fund_balance: u8 => u128;
    mapping claims: field => ClaimRequest;
    mapping claim_counter: u8 => u64;

    struct ClaimRequest {
        id: field,
        claimant: address,
        amount: u128,
        reason_hash: field,
        approved: bool,
        paid: bool
    }

    async transition submit_claim(
        public amount: u128,
        public reason_hash: field
    ) -> Future {
        return finalize_submit_claim(self.caller, amount, reason_hash);
    }

    // DAO votes on claims
    async transition approve_claim(public claim_id: field) -> Future {
        // Requires DAO approval
        return finalize_approve_claim(claim_id);
    }

    async transition payout_claim(public claim_id: field) -> Future {
        return finalize_payout(claim_id);
    }
}
```

---

## Task 5.5: Operator Incentive Optimization

**Dynamic Rewards:**
```typescript
// Rewards based on:
// 1. Uptime (99.9% target)
// 2. Accuracy (deviation from final median)
// 3. Speed (time to submit after price change)
// 4. Stake amount

interface OperatorMetrics {
    uptime_30d: number;        // 0-100%
    accuracy_score: number;    // 0-100%
    avg_submission_delay: number; // seconds
    stake_amount: bigint;
}

function calculateRewardMultiplier(metrics: OperatorMetrics): number {
    let multiplier = 1.0;

    // Uptime bonus (up to +20%)
    if (metrics.uptime_30d >= 99.9) multiplier += 0.20;
    else if (metrics.uptime_30d >= 99.5) multiplier += 0.10;

    // Accuracy bonus (up to +15%)
    if (metrics.accuracy_score >= 99) multiplier += 0.15;
    else if (metrics.accuracy_score >= 95) multiplier += 0.08;

    // Speed bonus (up to +10%)
    if (metrics.avg_submission_delay <= 5) multiplier += 0.10;
    else if (metrics.avg_submission_delay <= 15) multiplier += 0.05;

    return multiplier;
}
```

---

## Task 5.6: Governance Portal (Frontend)

**Features:**
1. **Dashboard:**
   - Active proposals
   - Your voting power
   - Delegation status
   - Reward claims

2. **Proposal Creation:**
   - Template wizard
   - Description editor (stored on IPFS)
   - Simulation preview

3. **Voting:**
   - One-click voting
   - Delegation management
   - Vote history

4. **Analytics:**
   - Proposal pass rate
   - Voter participation
   - Treasury balance

```
frontend/
├── src/
│   ├── app/
│   │   ├── governance/
│   │   │   ├── page.tsx           # Proposals list
│   │   │   ├── [id]/page.tsx      # Proposal detail
│   │   │   └── create/page.tsx    # Create proposal
│   │   ├── stake/page.tsx         # Stake ORACLE
│   │   └── rewards/page.tsx       # Claim rewards
│   └── components/
│       ├── governance/
│       │   ├── ProposalCard.tsx
│       │   ├── VoteButton.tsx
│       │   └── DelegateModal.tsx
│       └── staking/
│           ├── StakeForm.tsx
│           └── RewardsDisplay.tsx
```

---

## Task 5.7: Decentralized Operator Onboarding

**Permissionless Operator Registration:**
```leo
// Anyone can become an operator by:
// 1. Staking minimum amount (e.g., 10,000 ORACLE)
// 2. Running oracle node
// 3. Passing probation period (30 days, reduced rewards)

async transition register_as_operator(public stake_amount: u128) -> Future {
    return finalize_register_operator(self.caller, stake_amount);
}

async function finalize_register_operator(operator: address, stake: u128) {
    let min_stake: u128 = Mapping::get_or_use(min_stake_config, 0u8, 10000000000000u128);
    assert(stake >= min_stake);

    let new_operator: Operator = Operator {
        address: operator,
        stake: stake,
        reputation: 500u64,  // Start at 50% (probation)
        is_active: true,
        joined_block: 0u32,  // Would use block.height
        probation_until: 216000u32  // ~30 days
    };

    Mapping::set(operators, operator, new_operator);
}
```

---

## Task 5.8: Protocol Upgrades

**Upgrade Process:**
1. Proposal submitted with new contract code hash
2. 7-day voting period
3. If passed, 2-day timelock
4. Migration executed

**Upgrade Contract:**
```leo
program upgrade_manager_XXXX.aleo {
    mapping current_implementations: u8 => address;  // module_id => contract
    mapping pending_upgrades: u8 => PendingUpgrade;

    struct PendingUpgrade {
        module_id: u8,
        new_implementation: address,
        execute_after: u32,  // Block height
        executed: bool
    }

    async transition schedule_upgrade(
        public module_id: u8,
        public new_implementation: address
    ) -> Future {
        // Only DAO can call
        return finalize_schedule(module_id, new_implementation);
    }

    async function finalize_schedule(module_id: u8, new_impl: address) {
        let execute_after: u32 = 14400u32;  // +2 days in blocks

        let upgrade: PendingUpgrade = PendingUpgrade {
            module_id: module_id,
            new_implementation: new_impl,
            execute_after: execute_after,
            executed: false
        };

        Mapping::set(pending_upgrades, module_id, upgrade);
    }

    async transition execute_upgrade(public module_id: u8) -> Future {
        return finalize_execute_upgrade(module_id);
    }

    async function finalize_execute_upgrade(module_id: u8) {
        let upgrade: PendingUpgrade = Mapping::get(pending_upgrades, module_id);
        // Check timelock passed
        assert(!upgrade.executed);

        Mapping::set(current_implementations, module_id, upgrade.new_implementation);

        let completed: PendingUpgrade = PendingUpgrade {
            module_id: upgrade.module_id,
            new_implementation: upgrade.new_implementation,
            execute_after: upgrade.execute_after,
            executed: true
        };
        Mapping::set(pending_upgrades, module_id, completed);
    }
}
```

---

## Phase 5 Deliverables

- [ ] $ORACLE governance token deployed
- [ ] DAO governance contract live
- [ ] Fee distribution mechanism active
- [ ] Insurance fund operational
- [ ] Dynamic operator incentives
- [ ] Governance portal frontend
- [ ] Permissionless operator onboarding
- [ ] Protocol upgrade mechanism
- [ ] Full decentralization achieved

---

# Summary: Complete Phase Roadmap

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **Phase 0** | MVP | Oracle node, 3 sources, lending demo, basic frontend |
| **Phase 1** | Production | 10 sources, TWAP, circuit breaker, monitoring, staking |
| **Phase 2** | DeFi Ecosystem | Perps, options, yield vault, 50+ pairs |
| **Phase 3** | Security | Audits, bug bounty, multi-sig, mainnet prep |
| **Phase 4** | Cross-Chain | ECDSA verification, bridge oracle, volatility, NFT prices |
| Phase 5 | Decentralization | Governance token, DAO, fee distribution, permissionless ops |
| **Phase 6** | **The Frontier** | **ZK-ML Price Volatility Prediction, Private Institutional Feeds, aUSD Stablecoin** |

---

# PHASE 6: The ZK-Oracle Frontier
**Objective:** Leverage advanced Zero-Knowledge primitives to provide high-value data products beyond simple price feeds.

## Task 6.1: ZK-ML Volatility Prediction
**Tech:** Aleo ZK-ML (TensorFlow to Leo)
- **Feature:** A machine learning model that runs inside a ZK circuit.
- **Output:** Predicts 1-hour "Volatility Score" (standard deviation prediction).
- **Use Case:** Options protocols can use this to auto-adjust premiums based on ZK-verified market sentiment.

## Task 6.2: Anonymous Institutional Liquidity Feeds
- **Problem:** Institutions want to share their order book depth but don't want their trade size revealed.
- **ZK Solution:** Institutions submit a ZK-proof that their liquidity is >$10M without revealing the exact number.
- **Result:** High-confidence "Liquidity Health" feed for whale traders.

## Task 6.3: Aleo Oracle Stablecoin ($aUSD)
- **Model:** Over-collateralized stablecoin natively integrated with the oracle heartbeat.
- **Feature:** "Instant Liquidation" using the oracle's own signed data to prevent cascading bad debt in ZK-space.

---

# Final Directory Structure

```
oracleAleo/
├── oracle-node/              # Off-chain price fetcher
│   ├── src/
│   │   ├── server.ts
│   │   ├── providers/        # 10 exchange providers
│   │   ├── services/         # Aggregation, TWAP, signing
│   │   └── routes/
│   ├── migrations/           # PostgreSQL migrations
│   └── tests/
│
├── aleo-contracts/           # On-chain Leo programs
│   ├── oracle/               # price_oracle_XXXX.aleo
│   ├── registry/             # oracle_registry_XXXX.aleo
│   ├── lending/              # lending_protocol_XXXX.aleo
│   ├── perps/                # perps_protocol_XXXX.aleo
│   ├── options/              # options_protocol_XXXX.aleo
│   ├── yield/                # yield_vault_XXXX.aleo
│   ├── bridge/               # bridge_oracle_XXXX.aleo
│   ├── token/                # oracle_token_XXXX.aleo
│   ├── dao/                  # oracle_dao_XXXX.aleo
│   ├── fee-distributor/      # fee_distributor_XXXX.aleo
│   └── insurance/            # insurance_fund_XXXX.aleo
│
├── relayer/                  # Auto-submitter
│
├── frontend/                 # React web UI
│   ├── src/app/
│   │   ├── page.tsx          # Dashboard
│   │   ├── borrow/
│   │   ├── perps/
│   │   ├── options/
│   │   ├── governance/
│   │   └── stake/
│   └── components/
│
├── sdk/                      # @aleo-oracle/sdk
│
├── monitoring/               # Prometheus + Grafana
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── THREAT_MODEL.md
│   └── API.md
│
├── tests/                    # Integration tests
│
├── mistakes.md               # Lessons learned
├── requirement.txt           # Original requirements
├── ORACLE_DEVELOPMENT_PLAN.md # This plan
└── README.md
```
# Questions Before Starting
1. **Token for staking:** ALEO or custom $ORACLE token?
2. **Fee model:** Who pays relayer fees initially?
3. **Initial operators:** How many operators at launch? (Minimum 3)
4. **Priority exchanges:** Which 10 exchanges to prioritize?
5. **Testnet first:** Start on testnet, mainnet after audit?
**Ready to start building Phase 0!**
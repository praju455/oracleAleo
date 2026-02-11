# Aleo Price Oracle

A decentralized price oracle for the Aleo blockchain with **real cryptographic signature verification** using Aleo's native `signature::verify`.

## Architecture

```
Exchanges (10+)  -->  Oracle Node  -->  Relayer  -->  Aleo Smart Contract
  Binance              Aggregates       Signs &       signature::verify
  Coinbase             Median filter    Submits       Circuit breaker
  Kraken               TWAP calc        Monitors      Price history
  OKX, Bybit...        REST API         Fallback      Consensus rounds
```

**Oracle Node** — Fetches prices from 10 exchanges, removes outliers, computes median. Exposes REST API.

**Relayer** — Polls oracle node, signs prices with `Account.sign()` from `@provablehq/sdk`, submits to on-chain contract.

**Smart Contract** — Verifies signatures with `signature::verify(sig, caller, message)` using Aleo's native BLS12-377 cryptography. Includes circuit breaker protection, price history, and consensus rounds.

## Quick Start

### Prerequisites
- Node.js v18+
- Leo CLI (for contract development)

### 1. Oracle Node
```bash
cd oracle-node
cp .env.example .env  # Configure operator keys
npm install
npm run dev
```
Runs on `http://localhost:3000`. Check `GET /health` and `GET /prices`.

### 2. Relayer
```bash
cd relayer
cp .env.example .env  # Set OPERATOR_PRIVATE_KEY and OPERATOR_ADDRESS
npm install
npm run dev
```
Polls oracle node, signs prices, submits transactions to Aleo testnet.

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Dashboard at `http://localhost:3001`.

## Contract

**Program:** `price_oracle_v2.aleo`

### Key Functions

| Function | Description |
|----------|-------------|
| `submit_signed_price` | Submit price with native Aleo `signature` type — verified on-chain via `signature::verify` |
| `submit_price_simple` | Simple submission (no signature, no round) — for single-operator MVP |
| `start_round` / `finalize_consensus` | Multi-operator consensus rounds with stake-weighted pricing |
| `submit_twap` | Submit TWAP data (5m, 1h, 24h, 7d windows) |
| `register_operator` | Admin registers operator by address + stake |
| `pause` / `unpause` | Emergency pause |

### Signature Verification

The contract uses Aleo's **native signature type**:

```leo
async transition submit_signed_price(
    public pair_id: u64,
    public price: u128,
    public timestamp: u64,
    public source_count: u8,
    public sig: signature     // Native Aleo signature
) -> Future {
    let message: field = BHP256::hash_to_field(
        PriceMessage { pair_id, price, timestamp, source_count }
    );
    assert(signature::verify(sig, self.caller, message));
    // ...
}
```

Off-chain, the relayer signs with `Account.sign()` from `@provablehq/sdk`, producing a compatible BLS12-377 signature.

## Supported Pairs

ETH/USD, BTC/USD, ALEO/USD, SOL/USD, AVAX/USD, MATIC/USD, DOT/USD, ATOM/USD, LINK/USD, UNI/USD

## Data Sources

Binance, Coinbase, Kraken, Huobi, OKX, Gate.io, Bybit, CoinGecko, KuCoin, CryptoCompare

## Tests

```bash
cd oracle-node && npm test
cd relayer && npm test
```

## License

MIT

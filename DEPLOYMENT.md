# Deployment Guide

## 1. Build & Deploy Contract

```bash
cd aleo-contracts/oracle

# Build
leo build

# Deploy to testnet (requires snarkos CLI and funded account)
snarkos developer deploy price_oracle_v2.aleo \
  --private-key YOUR_PRIVATE_KEY \
  --query https://api.explorer.provable.com/v1/testnet \
  --path ./build \
  --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast \
  --fee 5000000
```

## 2. Initialize Contract

```bash
# Initialize with admin address
snarkos developer execute price_oracle_v2.aleo initialize \
  "YOUR_ADMIN_ADDRESS" \
  --private-key YOUR_PRIVATE_KEY \
  --query https://api.explorer.provable.com/v1/testnet \
  --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast \
  --fee 1000000

# Add trading pairs (example: ETH/USD = pair_id 1)
snarkos developer execute price_oracle_v2.aleo add_pair \
  "1u64" "1234field" "5678field" "8u8" "10000u64" "$(date +%s)000u64" \
  --private-key YOUR_PRIVATE_KEY \
  --query https://api.explorer.provable.com/v1/testnet \
  --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast \
  --fee 1000000

# Register operator (address + initial stake of 1000 credits = 1000000000 microcredits)
snarkos developer execute price_oracle_v2.aleo register_operator \
  "OPERATOR_ADDRESS" "1000000000u64" \
  --private-key YOUR_PRIVATE_KEY \
  --query https://api.explorer.provable.com/v1/testnet \
  --broadcast https://api.explorer.provable.com/v1/testnet/transaction/broadcast \
  --fee 1000000
```

## 3. Start Oracle Node

```bash
cd oracle-node
cp .env.example .env
# Edit .env: set OPERATOR_ADDRESS and OPERATOR_PRIVATE_KEY
npm install
npm run build
npm start
```

Verify: `curl http://localhost:3000/health`

## 4. Start Relayer

```bash
cd relayer
cp .env.example .env
# Edit .env:
#   OPERATOR_PRIVATE_KEY=APrivateKey1...
#   OPERATOR_ADDRESS=aleo1...
#   ORACLE_PROGRAM_ID=price_oracle_v2.aleo
#   ALEO_RPC_URL=https://api.explorer.provable.com/v1/testnet
npm install
npm run build
npm start
```

The relayer will:
1. Fetch prices from oracle node
2. Sign with `Account.sign()` (real Aleo signatures)
3. Submit `submit_signed_price` (falls back to `submit_price_simple`)
4. Monitor transaction confirmations

## 5. Start Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_ORACLE_API_URL
npm install
npm run build
npm start
```

## Verification

1. Oracle node running: `curl http://localhost:3000/prices`
2. Relayer submitting: check logs for "tx submitted" messages
3. On-chain prices: query `consensus_prices` mapping via Aleo explorer
4. Frontend displaying: visit `http://localhost:3001`

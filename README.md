# Aleo Privacy-Preserving Oracle

[![Aleo](https://img.shields.io/badge/Aleo-Blockchain-00D1FF?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDIwaDZsMi02aDRsMiA2aDZMMTIgMneiIGZpbGw9IiMwMEQxRkYiLz48L3N2Zz4=)](https://aleo.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Status](https://img.shields.io/badge/Status-Phase_1_Complete-green?style=for-the-badge)](https://aleo-oracle.io)

A decentralized, privacy-preserving token price oracle for the Aleo blockchain. Optimized for **10 major assets** across **10 global exchanges**, featuring **Batch-Fetched CoinGecko pricing**, **TWAP (Time-Weighted Average Price)**, and **On-Chain Circuit Breaker Protection**.

---

## ⚡ Core Technical Specifications

| Feature | Specification |
|---------|---------------|
| **Data Sources** | 10 Tier-1 Exchanges (Binance, Coinbase, Kraken, OKX, etc.) |
| **Asset Pairs** | ETH, BTC, ALEO, SOL, AVAX, POL (formerly MATIC), DOT, ATOM, LINK, UNI |
| **Aggregation** | Outlier-resistant Median Aggregation with 5% threshold |
| **Refresh Rate** | 10s (Off-chain) \| 30s-300s (On-chain via Relayer) |
| **Integrations** | Next.js 14 Frontend, Leo Smart Contracts, TypeScript Node |
| **Privacy** | Zero-Knowledge collateral positions and private price consumption |

---

## 🏗 Architecture Overview

```mermaid
graph TD
    A[Global Exchanges x10] -->|REST/Websocket| B(Oracle Node)
    B -->|Batch Aggregation| C{Median Filter}
    C -->|Signed Data| D[REST API]
    D -->|Polling| E(Relayer Service)
    D -->|Live Data| F[Next.js Frontend]
    E -->|Proof of Price| G[Aleo Smart Contract]
```

---

## 🚀 Getting Started (WSL Recommended)

### 1. Prerequisites
- **Node.js** v18+ 
- **Leo CLI** installed (for contract development)
- **WSL (Ubuntu)** - Required for stable build performance

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/aleo-oracle.git
cd aleo-oracle

# Install all dependencies (Native WSL environment)
cd oracle-node && npm install
cd ../relayer && npm install
cd ../frontend && npm install
```

### 3. Execution (Simultaneous Terminals)

**Terminal 1: Oracle Node (The Brain)**
```bash
cd oracle-node
npm run dev
```

**Terminal 2: Relayer (The Messenger)**
```bash
cd relayer
npm run dev
```

**Terminal 3: Frontend (the Window)**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3001` to interact with the dashboard.

---

## 🛡 Security & Reliability Features

### CoinGecko Batching & Cooldown
The system implements a proprietary batching engine for CoinGecko. Instead of individual API calls, we perform **single-request fetches** to avoid rate limiting. If a `429` error is detected, the provider enters an automatic **2-minute cooldown** and falls back to stale cache data.

### Multi-Source Failover
Prices require at least **3 valid sources** (2 for ALEO/USD). If an exchange goes down, the oracle automatically recalculates using the remaining active sources without downtime.

### On-Chain Circuit Breaker
Every price submission is checked against the last on-chain value. If a single update exceeds **10% deviation**, the contract enters a **Halted** state, protecting consumer protocols (like Lending) from flash crashes or manipulation.

---

## 📅 Roadmap: Phase 1 & Beyond

### ✅ Phase 1: Heavy Expansion (Completed)
- [x] Expanded to 10 trading pairs & 10 providers.
- [x] Implemented TWAP (1h, 24h, 7d).
- [x] Hardened CoinGecko rate limiting.
- [x] Refactored Frontend for SSR & Wallet compatibility.

### 🔥 Phase 2: DeFi Deep Integration (In Progress)
- [ ] **Multi-Operator Consensus**: Median aggregation performed on-chain.
- [ ] **Oracle SDK**: NPM package for 1-line integration into Aleo dApps.
- [ ] **Perpetuals Engine**: Specific high-frequency feeds for leverage trading.
- [ ] **Governance Portal**: DAO voting to resume halted circuit breakers.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

Built for the **Aleo** community. Powered by Zero-Knowledge.

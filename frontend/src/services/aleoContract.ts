import { Transaction, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';

// Program IDs
export const LENDING_PROGRAM_ID = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || 'lending_protocol_v2.aleo';
export const ORACLE_PROGRAM_ID = process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo';
export const FEE_DISTRIBUTOR_PROGRAM_ID = process.env.NEXT_PUBLIC_FEE_DISTRIBUTOR_PROGRAM_ID || 'fee_distributor_v1.aleo';

// API endpoint for Aleo
const ALEO_API_URL = (process.env.NEXT_PUBLIC_ALEO_API_URL || 'https://api.explorer.aleo.org/v1/testnet').replace(/\/$/, '');
const NETWORK = WalletAdapterNetwork.TestnetBeta;

// Market IDs (mapped to oracle pair IDs)
export const MARKET_IDS: { [key: string]: number } = {
  'ETH/USD': 1,
  'BTC/USD': 2,
  'ALEO/USD': 3,
  'SOL/USD': 4,
  'AVAX/USD': 5,
  'MATIC/USD': 6,
  'DOT/USD': 7,
  'ATOM/USD': 8,
  'LINK/USD': 9,
  'UNI/USD': 10,
};

// Types
export interface CollateralPosition {
  owner: string;
  positionId: string;
  collateralAmount: bigint;
  borrowedAmount: bigint;
  collateralMarketId: number;
  borrowMarketId: number;
  borrowIndexSnapshot: bigint;
  createdAt: number;
  lastInterestUpdate: number;
}

export interface MarketState {
  totalDeposits: bigint;
  totalBorrows: bigint;
  totalReserves: bigint;
  borrowIndex: bigint;
  supplyIndex: bigint;
  lastUpdateTimestamp: number;
  currentUtilization: number;
  currentBorrowRate: number;
  currentSupplyRate: number;
}

export interface OperatorInfo {
  address: string;
  stake: bigint;
  reputation: number;
  submissionCount: number;
  accuracy: number;
  isActive: boolean;
  pendingRewards: bigint;
  lastSubmission: number;
}

export interface StakingStats {
  totalStaked: bigint;
  totalOperators: number;
  activeOperators: number;
  totalRewardsDistributed: bigint;
  currentEpoch: number;
  minStake: bigint;
  rewardRate: number;
  unbondingPeriod: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// Helper to convert Aleo u64 to BigInt
const parseAleoU64 = (value: string): bigint => {
  return BigInt(value.replace('u64', '').replace('u128', ''));
};

// Wallet context type for passing wallet capabilities
export interface WalletContext {
  publicKey: string;
  requestTransaction: (tx: any) => Promise<any>;
  requestRecordPlaintexts: (programId: string) => Promise<any[]>;
}

/**
 * Find a credits.aleo record with enough microcredits.
 * Returns the record plaintext string for use as a transaction input.
 */
async function findCreditsRecord(
  walletCtx: WalletContext,
  requiredMicrocredits: bigint
): Promise<string> {
  const records = await walletCtx.requestRecordPlaintexts('credits.aleo');

  if (!records || records.length === 0) {
    throw new Error('No credits records found in wallet. You need Aleo credits to transact.');
  }

  // Find a record with enough microcredits
  for (const record of records) {
    const plaintext = typeof record === 'string' ? record : record.plaintext || JSON.stringify(record);

    // Parse microcredits from the record
    const match = plaintext.match(/microcredits:\s*(\d+)u64/);
    if (match) {
      const microcredits = BigInt(match[1]);
      if (microcredits >= requiredMicrocredits) {
        return plaintext;
      }
    }
  }

  throw new Error(
    `Insufficient balance. Need at least ${requiredMicrocredits} microcredits but no single record has enough. ` +
    `You may need to consolidate your records.`
  );
}

// Contract interaction service
export const aleoContract = {
  // Get the current timestamp (in milliseconds, scaled for Aleo)
  getCurrentTimestamp(): number {
    return Date.now();
  },

  // Scale price to Aleo format (8 decimals)
  scalePrice(price: number): bigint {
    return BigInt(Math.floor(price * 100000000));
  },

  // Scale credits to microcredits
  scaleCredits(amount: number): bigint {
    return BigInt(Math.floor(amount * 1000000));
  },

  // Unscale microcredits to credits
  unscaleCredits(microcredits: bigint): number {
    return Number(microcredits) / 1000000;
  },

  /**
   * Execute borrow transaction.
   *
   * Contract signature:
   *   borrow(
   *     collateral_credits: credits.aleo/credits,  // private record
   *     collateral_market_id: u64,
   *     collateral_amount: u64,
   *     borrow_market_id: u64,
   *     borrow_amount: u64,
   *     timestamp: u64
   *   )
   */
  async borrow(
    walletCtx: WalletContext,
    collateralToken: string,
    collateralAmount: number,
    borrowAmount: number,
    _collateralPrice: number
  ): Promise<TransactionResult> {
    try {
      if (!walletCtx.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      const timestamp = this.getCurrentTimestamp();
      const collateralMarketId = MARKET_IDS[collateralToken] || 1;
      const borrowMarketId = 0; // USD stablecoin market

      // Convert amounts to microcredits
      const scaledCollateral = this.scaleCredits(collateralAmount);
      const scaledBorrow = this.scaleCredits(borrowAmount);

      // Find a credits record with enough balance for collateral
      const creditsRecord = await findCreditsRecord(walletCtx, scaledCollateral);

      // Build transaction inputs matching contract signature
      const inputs = [
        creditsRecord,                      // collateral_credits: credits.aleo/credits record
        `${collateralMarketId}u64`,         // collateral_market_id
        `${scaledCollateral}u64`,           // collateral_amount
        `${borrowMarketId}u64`,             // borrow_market_id
        `${scaledBorrow}u64`,              // borrow_amount
        `${timestamp}u64`,                 // timestamp
      ];

      const transaction = Transaction.createTransaction(
        walletCtx.publicKey,
        NETWORK,
        LENDING_PROGRAM_ID,
        'borrow',
        inputs,
        1_000_000, // 1 ALEO fee in microcredits
      );

      const txId = await walletCtx.requestTransaction(transaction);

      if (txId) {
        return {
          success: true,
          transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted',
        };
      }

      return { success: false, error: 'Transaction rejected by wallet' };
    } catch (error: any) {
      console.error('Borrow transaction failed:', error);
      return { success: false, error: error.message || 'Transaction failed' };
    }
  },

  /**
   * Execute repay transaction.
   *
   * Contract signature:
   *   repay(
   *     position: CollateralPosition,       // private record
   *     repay_credits: credits.aleo/credits, // private record
   *     repay_amount: u64,
   *     timestamp: u64
   *   )
   */
  async repay(
    walletCtx: WalletContext,
    positionRecord: string,
    repayAmount: number
  ): Promise<TransactionResult> {
    try {
      if (!walletCtx.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      const timestamp = this.getCurrentTimestamp();
      const scaledRepay = this.scaleCredits(repayAmount);

      // Find a credits record with enough balance for repayment
      const creditsRecord = await findCreditsRecord(walletCtx, scaledRepay);

      const inputs = [
        positionRecord,            // position: CollateralPosition record
        creditsRecord,             // repay_credits: credits.aleo/credits record
        `${scaledRepay}u64`,       // repay_amount
        `${timestamp}u64`,        // timestamp
      ];

      const transaction = Transaction.createTransaction(
        walletCtx.publicKey,
        NETWORK,
        LENDING_PROGRAM_ID,
        'repay',
        inputs,
        1_000_000,
      );

      const txId = await walletCtx.requestTransaction(transaction);

      if (txId) {
        return {
          success: true,
          transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted',
        };
      }

      return { success: false, error: 'Transaction rejected by wallet' };
    } catch (error: any) {
      console.error('Repay transaction failed:', error);
      return { success: false, error: error.message || 'Transaction failed' };
    }
  },

  /**
   * Claim fees from fee distributor.
   *
   * Contract signature:
   *   claim_fees(timestamp: u64)
   *
   * Note: The fee_distributor contract does NOT have a generic "stake" transition.
   * It has register_operator_for_fees (admin only) and claim_fees.
   */
  async claimFees(
    walletCtx: WalletContext,
  ): Promise<TransactionResult> {
    try {
      if (!walletCtx.publicKey) {
        return { success: false, error: 'Wallet not connected' };
      }

      const timestamp = this.getCurrentTimestamp();

      const inputs = [
        `${timestamp}u64`,
      ];

      const transaction = Transaction.createTransaction(
        walletCtx.publicKey,
        NETWORK,
        FEE_DISTRIBUTOR_PROGRAM_ID,
        'claim_fees',
        inputs,
        1_000_000,
      );

      const txId = await walletCtx.requestTransaction(transaction);

      if (txId) {
        return {
          success: true,
          transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted',
        };
      }

      return { success: false, error: 'Transaction rejected by wallet' };
    } catch (error: any) {
      console.error('Claim fees failed:', error);
      return { success: false, error: error.message || 'Transaction failed' };
    }
  },

  // Fetch market state from chain
  async getMarketState(marketId: number): Promise<MarketState | null> {
    try {
      const response = await fetch(
        `${ALEO_API_URL}/program/${LENDING_PROGRAM_ID}/mapping/market_state/${marketId}`
      );

      if (!response.ok) return null;

      const data = await response.json();

      return {
        totalDeposits: parseAleoU64(data.total_deposits || '0u64'),
        totalBorrows: parseAleoU64(data.total_borrows || '0u64'),
        totalReserves: parseAleoU64(data.total_reserves || '0u64'),
        borrowIndex: parseAleoU64(data.borrow_index || '1000000000000000000u128'),
        supplyIndex: parseAleoU64(data.supply_index || '1000000000000000000u128'),
        lastUpdateTimestamp: parseInt(data.last_update_timestamp || '0'),
        currentUtilization: parseInt(data.current_utilization || '0'),
        currentBorrowRate: parseInt(data.current_borrow_rate || '20000'),
        currentSupplyRate: parseInt(data.current_supply_rate || '0'),
      };
    } catch (error) {
      console.error('Failed to fetch market state:', error);
      return null;
    }
  },

  // Fetch staking stats
  async getStakingStats(): Promise<StakingStats> {
    try {
      const response = await fetch(
        `${ALEO_API_URL}/program/${FEE_DISTRIBUTOR_PROGRAM_ID}/mapping/staking_stats/0`
      );

      if (response.ok) {
        const data = await response.json();
        return {
          totalStaked: parseAleoU64(data.total_staked || '25000000000u64'),
          totalOperators: parseInt(data.total_operators || '5'),
          activeOperators: parseInt(data.active_operators || '5'),
          totalRewardsDistributed: parseAleoU64(data.total_rewards || '1250000000u64'),
          currentEpoch: parseInt(data.current_epoch || '1247'),
          minStake: BigInt(1000000000),
          rewardRate: 850,
          unbondingPeriod: 7 * 24 * 60 * 60 * 1000,
        };
      }
    } catch (error) {
      console.error('Failed to fetch staking stats:', error);
    }

    // Return defaults for testnet/demo
    return {
      totalStaked: BigInt(25000000000),
      totalOperators: 5,
      activeOperators: 5,
      totalRewardsDistributed: BigInt(1250000000),
      currentEpoch: 1247,
      minStake: BigInt(1000000000),
      rewardRate: 850,
      unbondingPeriod: 7 * 24 * 60 * 60 * 1000,
    };
  },

  // Fetch operator info
  async getOperatorInfo(address: string): Promise<OperatorInfo | null> {
    try {
      const response = await fetch(
        `${ALEO_API_URL}/program/${FEE_DISTRIBUTOR_PROGRAM_ID}/mapping/operator_shares/${address}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        address,
        stake: parseAleoU64(data.stake_weight || '0u64'),
        reputation: parseInt(data.reputation || '10000'),
        submissionCount: parseInt(data.submissions_in_epoch || '0'),
        accuracy: parseInt(data.accuracy || '10000') / 100,
        isActive: (parseAleoU64(data.stake_weight || '0u64')) > 0n,
        pendingRewards: parseAleoU64(data.pending_amount || '0u64'),
        lastSubmission: parseInt(data.last_claim || '0'),
      };
    } catch (error) {
      console.error('Failed to fetch operator info:', error);
      return null;
    }
  },

  // Fetch all operators (for leaderboard)
  async getAllOperators(): Promise<OperatorInfo[]> {
    // For production, this would need an indexer or events
    // For now, return mock data
    return [
      {
        address: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqspawn5q',
        stake: BigInt(8500000000),
        reputation: 9800,
        submissionCount: 15420,
        accuracy: 99.74,
        isActive: true,
        pendingRewards: BigInt(42500000),
        lastSubmission: Date.now() - 10000,
      },
      {
        address: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqcy7s3ns',
        stake: BigInt(6200000000),
        reputation: 9500,
        submissionCount: 12300,
        accuracy: 99.59,
        isActive: true,
        pendingRewards: BigInt(31000000),
        lastSubmission: Date.now() - 15000,
      },
      {
        address: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9e7jsu6',
        stake: BigInt(5000000000),
        reputation: 9200,
        submissionCount: 10500,
        accuracy: 99.05,
        isActive: true,
        pendingRewards: BigInt(25000000),
        lastSubmission: Date.now() - 20000,
      },
      {
        address: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqfe5klvs',
        stake: BigInt(3500000000),
        reputation: 8900,
        submissionCount: 8200,
        accuracy: 98.78,
        isActive: true,
        pendingRewards: BigInt(17500000),
        lastSubmission: Date.now() - 25000,
      },
      {
        address: 'aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0gcsjz5',
        stake: BigInt(1800000000),
        reputation: 8500,
        submissionCount: 4500,
        accuracy: 98.89,
        isActive: false,
        pendingRewards: BigInt(9000000),
        lastSubmission: Date.now() - 3600000,
      },
    ];
  },

  // Get user's staking position
  async getUserStake(address: string): Promise<{ staked: bigint; pendingRewards: bigint; unbonding: bigint } | null> {
    try {
      const response = await fetch(
        `${ALEO_API_URL}/program/${FEE_DISTRIBUTOR_PROGRAM_ID}/mapping/operator_shares/${address}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        staked: parseAleoU64(data.stake_weight || '0u64'),
        pendingRewards: parseAleoU64(data.pending_amount || '0u64'),
        unbonding: BigInt(0),
      };
    } catch (error) {
      console.error('Failed to fetch user stake:', error);
      return null;
    }
  },

  // Get transaction status
  async getTransactionStatus(txId: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      const response = await fetch(`${ALEO_API_URL}/transaction/${txId}`);
      if (!response.ok) return 'pending';

      const data = await response.json();
      return data.status === 'accepted' ? 'confirmed' : 'pending';
    } catch (error) {
      return 'pending';
    }
  },
};

export default aleoContract;

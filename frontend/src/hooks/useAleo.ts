'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { Transaction, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';
import { LENDING_PROGRAM_ID, ORACLE_PROGRAM_ID, FEE_DISTRIBUTOR_PROGRAM_ID, WalletContext } from '@/services/aleoContract';

const NETWORK = WalletAdapterNetwork.TestnetBeta;

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Find a credits.aleo record with enough microcredits from the wallet.
 */
async function findCreditsRecord(
  requestRecordPlaintexts: (programId: string) => Promise<any[]>,
  requiredMicrocredits: bigint
): Promise<string> {
  const records = await requestRecordPlaintexts('credits.aleo');

  if (!records || records.length === 0) {
    throw new Error('No credits records found in wallet.');
  }

  for (const record of records) {
    const plaintext = typeof record === 'string' ? record : record.plaintext || JSON.stringify(record);
    const match = plaintext.match(/microcredits:\s*(\d+)u64/);
    if (match) {
      const microcredits = BigInt(match[1]);
      if (microcredits >= requiredMicrocredits) {
        return plaintext;
      }
    }
  }

  throw new Error(
    `Insufficient balance. Need at least ${requiredMicrocredits} microcredits but no single record has enough.`
  );
}

export const useAleo = () => {
  const { publicKey, requestTransaction, requestRecordPlaintexts, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  // Build a WalletContext for use with aleoContract service
  const getWalletContext = useCallback((): WalletContext | null => {
    if (!connected || !publicKey || !requestTransaction || !requestRecordPlaintexts) {
      return null;
    }
    return {
      publicKey: publicKey!,
      requestTransaction: requestTransaction!,
      requestRecordPlaintexts: requestRecordPlaintexts!,
    };
  }, [connected, publicKey, requestTransaction, requestRecordPlaintexts]);

  /**
   * Execute borrow on the lending protocol.
   *
   * Contract signature:
   *   borrow(credits.aleo/credits, u64, u64, u64, u64, u64)
   */
  const borrow = useCallback(async (
    collateralMarketId: number,
    collateralAmount: bigint,
    borrowMarketId: number,
    borrowAmount: bigint,
    timestamp: number
  ): Promise<TransactionResult> => {
    if (!connected || !publicKey || !requestTransaction || !requestRecordPlaintexts) {
      return { success: false, error: 'Wallet not connected or missing record access permission' };
    }

    setLoading(true);

    try {
      // Find a credits record with enough microcredits for collateral
      const creditsRecord = await findCreditsRecord(requestRecordPlaintexts!, collateralAmount);

      const transaction = Transaction.createTransaction(
        publicKey!,
        NETWORK,
        LENDING_PROGRAM_ID,
        'borrow',
        [
          creditsRecord,                         // collateral_credits: credits.aleo/credits record
          `${collateralMarketId}u64`,            // collateral_market_id
          `${collateralAmount}u64`,              // collateral_amount
          `${borrowMarketId}u64`,                // borrow_market_id
          `${borrowAmount}u64`,                  // borrow_amount
          `${timestamp}u64`,                     // timestamp
        ],
        1_000_000
      );

      const txId = await requestTransaction!(transaction);

      return {
        success: true,
        transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted',
      };
    } catch (error) {
      console.error('Borrow transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, requestTransaction, requestRecordPlaintexts]);

  /**
   * Submit price to oracle (for operators).
   *
   * Contract signature:
   *   submit_price(pair_id: u64, price: u128, timestamp: u64, ...)
   */
  const submitPrice = useCallback(async (
    pairId: number,
    price: bigint,
    timestamp: number
  ): Promise<TransactionResult> => {
    if (!connected || !publicKey || !requestTransaction) {
      return { success: false, error: 'Wallet not connected' };
    }

    setLoading(true);

    try {
      const transaction = Transaction.createTransaction(
        publicKey!,
        NETWORK,
        ORACLE_PROGRAM_ID,
        'submit_price',
        [
          `${pairId}u64`,
          `${price}u128`,
          `${timestamp}u64`
        ],
        500_000
      );

      const txId = await requestTransaction!(transaction);

      return {
        success: true,
        transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted',
      };
    } catch (error) {
      console.error('Submit price transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, requestTransaction]);

  /**
   * Claim fees from fee distributor.
   *
   * Contract signature:
   *   claim_fees(timestamp: u64)
   */
  const claimFees = useCallback(async (): Promise<TransactionResult> => {
    if (!connected || !publicKey || !requestTransaction) {
      return { success: false, error: 'Wallet not connected' };
    }

    setLoading(true);

    try {
      const timestamp = Date.now();
      const transaction = Transaction.createTransaction(
        publicKey!,
        NETWORK,
        FEE_DISTRIBUTOR_PROGRAM_ID,
        'claim_fees',
        [`${timestamp}u64`],
        500_000
      );

      const txId = await requestTransaction!(transaction);

      return { success: true, transactionId: typeof txId === 'string' ? txId : txId?.transactionId || 'submitted' };
    } catch (error) {
      console.error('Claim fees transaction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, requestTransaction]);

  return {
    publicKey,
    connected,
    loading,
    borrow,
    submitPrice,
    claimFees,
    getWalletContext,
  };
};

export default useAleo;

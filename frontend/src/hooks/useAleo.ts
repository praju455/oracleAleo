'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { Transaction, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';

const NETWORK = WalletAdapterNetwork.TestnetBeta;
const ORACLE_PROGRAM_ID = process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo';

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export const useAleo = () => {
  const { publicKey, requestTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);

  /**
   * Submit price via submit_price_simple (bypasses consensus rounds).
   *
   * On-chain signature:
   *   submit_price_simple(pair_id: u64, price: u128, timestamp: u64)
   *
   * self.caller authenticates the operator — the wallet signs the transaction,
   * so no separate signature parameter is needed.
   *
   * Price must be scaled by 10^8 (PRICE_DECIMALS) before calling.
   */
  const submitPriceSimple = useCallback(async (
    pairId: number,
    scaledPrice: bigint,
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
        'submit_price_simple',
        [
          `${pairId}u64`,
          `${scaledPrice}u128`,
          `${timestamp}u64`
        ],
        500_000
      );

      const txId: string | { transactionId?: string } | any = await requestTransaction!(transaction);

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

  return {
    publicKey,
    connected,
    loading,
    submitPriceSimple,
  };
};

export default useAleo;

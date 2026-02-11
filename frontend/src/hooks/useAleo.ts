'use client';

import { useCallback, useState } from 'react';
import axios from 'axios';

const ALEO_RPC_URL = process.env.NEXT_PUBLIC_ALEO_RPC_URL || 'https://api.explorer.provable.com/v1/testnet';
const ORACLE_PROGRAM_ID = process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo';

export interface OnChainPrice {
  price: bigint;
  timestamp: number;
  raw: string;
}

export interface OperatorInfo {
  address: string;
  stake: bigint;
  raw: string;
}

export const useAleo = () => {
  const [loading, setLoading] = useState(false);

  const readOnChainPrice = useCallback(async (pairId: number): Promise<OnChainPrice | null> => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${ALEO_RPC_URL}/program/${ORACLE_PROGRAM_ID}/mapping/consensus_prices/${pairId}u64`
      );
      const raw = response.data;
      if (!raw || raw === 'null') return null;

      // Parse the on-chain struct — format varies by RPC but typically:
      // { price: 250050000000u128, timestamp: 1700000000u64, ... }
      const priceMatch = raw.match(/price:\s*(\d+)u128/);
      const tsMatch = raw.match(/timestamp:\s*(\d+)u64/);

      return {
        price: priceMatch ? BigInt(priceMatch[1]) : BigInt(0),
        timestamp: tsMatch ? parseInt(tsMatch[1]) : 0,
        raw: typeof raw === 'string' ? raw : JSON.stringify(raw),
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getOperatorInfo = useCallback(async (address: string): Promise<OperatorInfo | null> => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${ALEO_RPC_URL}/program/${ORACLE_PROGRAM_ID}/mapping/registered_operators/${address}`
      );
      const raw = response.data;
      if (!raw || raw === 'null') return null;

      const stakeMatch = raw.match(/stake:\s*(\d+)u64/);

      return {
        address,
        stake: stakeMatch ? BigInt(stakeMatch[1]) : BigInt(0),
        raw: typeof raw === 'string' ? raw : JSON.stringify(raw),
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    readOnChainPrice,
    getOperatorInfo,
  };
};

export default useAleo;

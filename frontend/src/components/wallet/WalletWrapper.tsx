'use client';

import { useMemo, FC, ReactNode, useEffect, useState } from 'react';
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import { PuzzleWalletAdapter } from 'aleo-adapters';
import {
  DecryptPermission,
  WalletAdapterNetwork,
} from '@demox-labs/aleo-wallet-adapter-base';

// Import styles
import '@demox-labs/aleo-wallet-adapter-reactui/styles.css';

// Only the oracle program — lending, registry, fee_distributor, multisig are removed
const PROGRAM_IDS = [
  process.env.NEXT_PUBLIC_ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo',
].filter(Boolean);

interface WalletWrapperProps {
  children: ReactNode;
}

export const WalletWrapper: FC<WalletWrapperProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wallets = useMemo(() => {
    if (typeof window === 'undefined') return [];

    try {
      return [
        new LeoWalletAdapter({
          appName: 'Aleo Oracle',
        }),
        new PuzzleWalletAdapter({
          programIdPermissions: {
            [WalletAdapterNetwork.TestnetBeta]: PROGRAM_IDS,
            [WalletAdapterNetwork.MainnetBeta]: PROGRAM_IDS,
          },
          appName: 'Aleo Oracle',
          appDescription: 'Privacy-Preserving Price Oracle for Aleo DeFi',
        }),
      ];
    } catch (e) {
      console.warn('Failed to initialize wallet adapters:', e);
      return [];
    }
  }, []);

  return (
    <WalletProvider
      wallets={wallets}
      decryptPermission={DecryptPermission.UponRequest}
      network={WalletAdapterNetwork.TestnetBeta}
      autoConnect
    >
      <WalletModalProvider>
        {mounted ? children : <div className="min-h-screen bg-[#020617]" />}
      </WalletModalProvider>
    </WalletProvider>
  );
};

export default WalletWrapper;

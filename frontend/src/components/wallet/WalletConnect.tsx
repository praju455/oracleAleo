'use client';

import { FC, useEffect, useState } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletMultiButton } from '@demox-labs/aleo-wallet-adapter-reactui';

const WalletConnectInner: FC = () => {
  const { publicKey, connected, connecting, disconnecting } = useWallet();

  return (
    <div className="flex items-center gap-3">
      {connected && publicKey && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-gray-300 font-mono">
            {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
          </span>
        </div>
      )}
      {connecting && (
        <span className="text-sm text-gray-400 animate-pulse">Connecting...</span>
      )}
      {disconnecting && (
        <span className="text-sm text-gray-400 animate-pulse">Disconnecting...</span>
      )}
      <WalletMultiButton
        className="!bg-gradient-to-r !from-indigo-500 !to-purple-600 hover:!from-indigo-600 hover:!to-purple-700 !rounded-xl !py-2.5 !px-5 !font-medium !text-sm !transition-all !duration-200 !shadow-lg !shadow-indigo-500/25 hover:!shadow-indigo-500/40 !border-0"
      />
    </div>
  );
};

export const WalletConnect: FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <button className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-medium text-white text-sm opacity-50">
          Connect Wallet
        </button>
      </div>
    );
  }

  return <WalletConnectInner />;
};

export default WalletConnect;

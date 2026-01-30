'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { Header } from '@/components/Header';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { Chatbot } from '@/components/Chatbot';
import { oracleAPI, PriceData } from '@/services/oracleAPI';
import { aleoContract, LENDING_PROGRAM_ID } from '@/services/aleoContract';

interface Position {
  id: string;
  collateralToken: string;
  collateralAmount: number;
  borrowedAmount: number;
  currentRatio: number;
  health: 'healthy' | 'warning' | 'danger';
}

const MARKET_ID_TO_TOKEN: { [key: string]: number } = {
  'ETH': 1, 'BTC': 2, 'ALEO': 3, 'SOL': 4, 'AVAX': 5,
  'MATIC': 6, 'DOT': 7, 'ATOM': 8, 'LINK': 9, 'UNI': 10,
};

const tokenIcons: { [key: string]: string } = {
  'ETH': '\u27e0',
  'BTC': '\u20bf',
  'ALEO': '\u25c8',
};

const tokenColors: { [key: string]: string } = {
  'ETH': 'from-blue-500 to-purple-600',
  'BTC': 'from-orange-500 to-yellow-500',
  'ALEO': 'from-green-500 to-emerald-600',
};

export default function PositionsPage() {
  const { connected, publicKey, requestTransaction, requestRecordPlaintexts } = useWallet();
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await oracleAPI.getAllPrices();
        setPrices(data.prices);

        if (connected && publicKey) {
          // Attempt to fetch user's records from the lending protocol
          try {
            const response = await fetch(
              `https://api.explorer.aleo.org/v1/testnet/program/${LENDING_PROGRAM_ID}/mapping/user_positions/${publicKey}`
            );
            if (response.ok) {
              const positionData = await response.json();
              if (positionData && positionData !== 'null') {
                // Parse on-chain position data into display format
                const parsedPositions: Position[] = [];
                // The position data from chain would be a struct - parse it
                // For now, display the raw data if available
                if (Array.isArray(positionData)) {
                  positionData.forEach((pos: any, idx: number) => {
                    const collateralValue = (pos.collateral_amount || 0) / 1000000;
                    const borrowValue = (pos.borrow_amount || 0) / 1000000;
                    const ratio = borrowValue > 0 ? (collateralValue / borrowValue) * 100 : 0;
                    parsedPositions.push({
                      id: String(idx + 1),
                      collateralToken: Object.keys(MARKET_ID_TO_TOKEN).find(
                        k => MARKET_ID_TO_TOKEN[k] === pos.collateral_market_id
                      ) || 'ALEO',
                      collateralAmount: collateralValue,
                      borrowedAmount: borrowValue,
                      currentRatio: ratio,
                      health: ratio >= 200 ? 'healthy' : ratio >= 150 ? 'warning' : 'danger',
                    });
                  });
                }
                setPositions(parsedPositions);
              } else {
                setPositions([]);
              }
            } else {
              // No positions found on chain
              setPositions([]);
            }
          } catch {
            // Chain query failed, show empty state
            setPositions([]);
          }
        } else {
          setPositions([]);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [connected, publicKey]);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Healthy
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            Warning
          </span>
        );
      case 'danger':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            At Risk
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">My Positions</h2>
            <p className="text-gray-500">Manage your private collateral positions</p>
          </div>
          {connected && (
            <Link
              href="/borrow"
              className="glass-button px-5 py-2.5 rounded-xl font-medium text-white text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Position
            </Link>
          )}
        </div>

        {!connected ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Connect Your Wallet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Connect your Aleo wallet to view and manage your private collateral positions
            </p>
            <WalletConnect />
          </div>
        ) : loading ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto mb-6" />
            <p className="text-gray-400">Loading your positions...</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">No Positions Yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your first private collateral position to start borrowing
            </p>
            <Link
              href="/borrow"
              className="inline-flex items-center gap-2 glass-button px-6 py-3 rounded-xl font-medium text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Position
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <div
                key={position.id}
                className="glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden"
              >
                {/* Background glow */}
                <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${tokenColors[position.collateralToken] || 'from-indigo-500 to-purple-600'} opacity-10 blur-3xl`} />

                <div className="flex items-center justify-between mb-6 relative">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tokenColors[position.collateralToken] || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-2xl shadow-lg`}>
                      {tokenIcons[position.collateralToken] || position.collateralToken.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {position.collateralToken} Collateral
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">
                        Position #{position.id}
                      </p>
                    </div>
                  </div>
                  {getHealthBadge(position.health)}
                </div>

                <div className="grid grid-cols-3 gap-6 mb-6 relative">
                  <div className="glass rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Collateral</p>
                    <p className="text-xl font-bold text-white">
                      {position.collateralAmount} <span className="text-gray-400 text-sm">{position.collateralToken}</span>
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Borrowed</p>
                    <p className="text-xl font-bold text-white">
                      ${position.borrowedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Collateral Ratio</p>
                    <p className={`text-xl font-bold ${position.currentRatio >= 200 ? 'text-green-400' :
                      position.currentRatio >= 150 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                      {position.currentRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 relative">
                  <Link href="/borrow" className="flex-1 py-3 glass-button rounded-xl font-medium text-white flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Collateral
                  </Link>
                  <button
                    onClick={async () => {
                      if (!publicKey || !requestTransaction || !requestRecordPlaintexts) return;
                      try {
                        const walletCtx = { publicKey, requestTransaction, requestRecordPlaintexts };
                        const result = await aleoContract.repay(walletCtx, position.id, position.borrowedAmount);
                        if (result.success) {
                          alert(`Repay submitted! TX: ${result.transactionId}`);
                        } else {
                          alert(`Repay failed: ${result.error}`);
                        }
                      } catch (err: any) {
                        alert(`Repay failed: ${err.message}`);
                      }
                    }}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Privacy Note */}
        <div className="mt-8 glass-card rounded-2xl p-6 border-indigo-500/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-400 mb-2">Your Data is Private</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Position records are stored privately on Aleo using zero-knowledge proofs. Only you can see your
                collateral amounts and borrowed values. The blockchain only sees encrypted data that proves your position is valid.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chatbot */}
      <Chatbot prices={prices} />
    </div>
  );
}

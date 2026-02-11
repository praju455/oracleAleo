'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { useAleo, TransactionResult } from '@/hooks/useAleo';
import { oracleAPI, PriceData } from '@/services/oracleAPI';

// On-chain pair ID mapping — must match what admin registered via add_pair()
// Contract enforces pair_id 1..50 (u64)
const PAIR_ID_MAP: { [pair: string]: number } = {
  'ETH/USD': 1,
  'BTC/USD': 2,
  'ALEO/USD': 3,
  'SOL/USD': 4,
  'AVAX/USD': 5,
  'DOT/USD': 6,
  'ATOM/USD': 7,
  'LINK/USD': 8,
  'UNI/USD': 9,
  'MATIC/USD': 10,
};

// Contract uses 10^8 scaling (PRICE_DECIMALS)
const PRICE_DECIMALS = 100_000_000;

function scalePriceToU128(price: number): bigint {
  return BigInt(Math.round(price * PRICE_DECIMALS));
}

function formatAge(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

interface SubmissionHistory {
  pair: string;
  price: number;
  scaledPrice: string;
  timestamp: number;
  txId: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export default function OperatorsPage() {
  const { publicKey, connected, loading: txLoading, submitPriceSimple } = useAleo();

  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [selectedPair, setSelectedPair] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'prices' | 'submit' | 'how-it-works'>('prices');

  // Fetch live prices from oracle-node API
  const fetchPrices = useCallback(async () => {
    try {
      const data = await oracleAPI.getAllPrices();
      setPrices(data.prices);
      if (!selectedPair && data.prices.length > 0) {
        setSelectedPair(data.prices[0].pair);
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, [selectedPair]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Get the selected price data
  const selectedPrice = prices.find(p => p.pair === selectedPair);

  // Handle price submission on-chain
  const handleSubmitPrice = async () => {
    if (!selectedPrice || !connected) return;

    const pairId = PAIR_ID_MAP[selectedPrice.pair];
    if (!pairId) {
      setTxStatus({ type: 'error', message: `Unknown pair ID for ${selectedPrice.pair}. Pair must be registered on-chain by admin via add_pair().` });
      return;
    }

    setSubmitting(true);
    setTxStatus({ type: 'info', message: 'Wallet will prompt you to sign the transaction...' });

    const scaledPrice = scalePriceToU128(selectedPrice.price);
    const timestamp = Math.floor(Date.now() / 1000);

    const result: TransactionResult = await submitPriceSimple(pairId, scaledPrice, timestamp);

    if (result.success) {
      const entry: SubmissionHistory = {
        pair: selectedPrice.pair,
        price: selectedPrice.price,
        scaledPrice: scaledPrice.toString(),
        timestamp: Date.now(),
        txId: result.transactionId || 'unknown',
        status: 'pending',
      };
      setSubmissions(prev => [entry, ...prev]);
      setTxStatus({
        type: 'success',
        message: `Price submitted! TX: ${result.transactionId?.slice(0, 20)}...`
      });
    } else {
      setTxStatus({ type: 'error', message: result.error || 'Transaction failed' });
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-sm text-gray-300">Oracle Operators</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Operator Dashboard</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Registered operators submit prices on-chain via <code className="text-indigo-400">submit_price_simple</code>.
            Your wallet signs the transaction — <code className="text-indigo-400">self.caller</code> authenticates you on-chain.
          </p>
        </div>

        {/* Connection Status */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${connected ? 'bg-emerald-500/20' : 'bg-white/5'} flex items-center justify-center`}>
                {connected ? (
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <div>
                <span className={`font-semibold ${connected ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {connected ? 'Wallet Connected' : 'Wallet Not Connected'}
                </span>
                {connected && publicKey && (
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {publicKey.slice(0, 16)}...{publicKey.slice(-8)}
                  </p>
                )}
              </div>
            </div>
            {connected && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium border border-indigo-500/20">
                  price_oracle_v2.aleo
                </span>
                <span className="px-3 py-1.5 rounded-full bg-white/5 text-gray-400 text-xs">
                  submit_price_simple
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {(['prices', 'submit', 'how-it-works'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'glass-card text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'prices' ? 'Live Prices' : tab === 'submit' ? 'Submit Price' : 'How It Works'}
            </button>
          ))}
        </div>

        {/* Live Prices Tab */}
        {activeTab === 'prices' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Live Oracle Prices</h3>
                  <p className="text-sm text-gray-400 mt-1">Aggregated from 10+ exchanges, refreshed every 10s</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Auto-refresh
                </div>
              </div>
            </div>

            {loadingPrices ? (
              <div className="p-12 text-center">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto" />
                <p className="text-gray-400 mt-4">Loading prices from oracle node...</p>
              </div>
            ) : prices.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400">No price data available. Oracle node may be starting up.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Pair</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Pair ID</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Price</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Scaled (u128)</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Sources</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Age</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-400">Signature</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-400">CB Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => {
                      const pairId = PAIR_ID_MAP[price.pair];
                      const age = price.age || (Date.now() - price.timestamp);
                      const isStale = age > 300_000; // 5 min staleness threshold from contract
                      return (
                        <tr key={price.pair} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-white font-medium">{price.pair}</span>
                          </td>
                          <td className="px-6 py-4">
                            {pairId ? (
                              <span className="text-indigo-400 font-mono text-sm">{pairId}u64</span>
                            ) : (
                              <span className="text-gray-600 text-sm">unmapped</span>
                            )}
                          </td>
                          <td className="text-right px-6 py-4 text-white font-medium">
                            ${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="text-right px-6 py-4">
                            <span className="text-gray-400 font-mono text-xs">
                              {scalePriceToU128(price.price).toString()}
                            </span>
                          </td>
                          <td className="text-right px-6 py-4 text-gray-300">{price.sourceCount}</td>
                          <td className="text-right px-6 py-4">
                            <span className={`text-sm ${isStale ? 'text-red-400' : 'text-gray-400'}`}>
                              {formatAge(age)}
                              {isStale && ' (stale)'}
                            </span>
                          </td>
                          <td className="text-center px-6 py-4">
                            {price.signatureVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Verified
                              </span>
                            ) : (
                              <span className="text-gray-500 text-xs">N/A</span>
                            )}
                          </td>
                          <td className="text-center px-6 py-4">
                            {price.circuitBreaker?.isHalted ? (
                              <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">HALTED</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Submit Price Tab */}
        {activeTab === 'submit' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Submit Form */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-2">Submit Price On-Chain</h3>
              <p className="text-sm text-gray-400 mb-6">
                Calls <code className="text-indigo-400">submit_price_simple(pair_id, price, timestamp)</code> on <code className="text-indigo-400">price_oracle_v2.aleo</code>
              </p>

              {!connected ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 mb-2">Connect your wallet to submit prices</p>
                  <p className="text-xs text-gray-500">
                    Your address must be registered as an operator on-chain (via <code className="text-indigo-400">register_operator</code>)
                    with stake &ge; 1,000,000,000 microcredits.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pair Selection */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Select Trading Pair</label>
                    <select
                      value={selectedPair}
                      onChange={(e) => setSelectedPair(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    >
                      {prices.map((p) => (
                        <option key={p.pair} value={p.pair} className="bg-gray-900">
                          {p.pair} {PAIR_ID_MAP[p.pair] ? `(ID: ${PAIR_ID_MAP[p.pair]})` : '(unmapped)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price Preview */}
                  {selectedPrice && (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-white/5">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-400">Current Oracle Price</span>
                          <span className="text-white font-bold text-lg">
                            ${selectedPrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Scaled (u128)</span>
                          <span className="text-xs text-indigo-400 font-mono">
                            {scalePriceToU128(selectedPrice.price).toString()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-white/5">
                          <div className="text-xs text-gray-500 mb-1">Pair ID</div>
                          <div className="text-white font-mono font-medium">
                            {PAIR_ID_MAP[selectedPrice.pair] ? `${PAIR_ID_MAP[selectedPrice.pair]}u64` : 'N/A'}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5">
                          <div className="text-xs text-gray-500 mb-1">Sources</div>
                          <div className="text-white font-medium">{selectedPrice.sourceCount}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5">
                          <div className="text-xs text-gray-500 mb-1">Age</div>
                          <div className="text-white font-medium">
                            {formatAge(selectedPrice.age || (Date.now() - selectedPrice.timestamp))}
                          </div>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <p className="text-xs text-gray-400 mb-2">Transaction will call:</p>
                        <code className="text-xs text-indigo-300 block">
                          submit_price_simple({PAIR_ID_MAP[selectedPrice.pair] || '?'}u64, {scalePriceToU128(selectedPrice.price).toString()}u128, {Math.floor(Date.now() / 1000)}u64)
                        </code>
                        <p className="text-xs text-gray-500 mt-2">Fee: 500,000 microcredits (0.0005 ALEO)</p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitPrice}
                    disabled={submitting || txLoading || !selectedPrice || !PAIR_ID_MAP[selectedPair]}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting || txLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Price On-Chain'
                    )}
                  </button>

                  {!PAIR_ID_MAP[selectedPair] && selectedPair && (
                    <p className="text-xs text-yellow-400 text-center">
                      This pair has no on-chain ID mapping. Admin must register it via <code className="text-indigo-400">add_pair()</code> first.
                    </p>
                  )}
                </div>
              )}

              {/* Transaction Status */}
              {txStatus && (
                <div className={`mt-6 p-4 rounded-xl ${
                  txStatus.type === 'success' ? 'bg-green-500/20 border border-green-500/30' :
                  txStatus.type === 'error' ? 'bg-red-500/20 border border-red-500/30' :
                  'bg-indigo-500/20 border border-indigo-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {txStatus.type === 'success' && (
                      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {txStatus.type === 'error' && (
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {txStatus.type === 'info' && (
                      <svg className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <p className={`text-sm ${
                      txStatus.type === 'success' ? 'text-green-400' :
                      txStatus.type === 'error' ? 'text-red-400' :
                      'text-indigo-400'
                    }`}>{txStatus.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submission History */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Submission History</h3>

              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-gray-400">No submissions yet this session</p>
                  <p className="text-xs text-gray-500 mt-1">Submit a price to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((sub, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{sub.pair}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sub.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          sub.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Price</span>
                        <span className="text-white">${sub.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">TX</span>
                        <span className="text-indigo-400 font-mono text-xs">{sub.txId.slice(0, 20)}...</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-400">Time</span>
                        <span className="text-gray-500 text-xs">{new Date(sub.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* How It Works Tab */}
        {activeTab === 'how-it-works' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Submission Flow */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">On-Chain Submission Flow</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-400 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Admin Registers Operator</h4>
                    <p className="text-sm text-gray-400">
                      Admin calls <code className="text-indigo-400">register_operator(operator_address, initial_stake)</code>.
                      Stake must be &ge; 1,000,000,000 microcredits (1,000 ALEO).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Oracle Node Fetches Prices</h4>
                    <p className="text-sm text-gray-400">
                      The oracle node aggregates prices from 10+ exchanges (Binance, Coinbase, Kraken, etc.)
                      with outlier detection, TWAP, and circuit breaker protection.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Operator Submits Price</h4>
                    <p className="text-sm text-gray-400">
                      Operator calls <code className="text-indigo-400">submit_price_simple(pair_id, price, timestamp)</code>.
                      The wallet signs the transaction — <code className="text-indigo-400">self.caller</code> on-chain proves operator identity.
                      No separate signature parameter needed.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">On-Chain Validation</h4>
                    <p className="text-sm text-gray-400">
                      Contract checks: operator is registered, not paused, circuit breaker not halted,
                      price change within bounds (5% per minute max). Price stored in <code className="text-indigo-400">consensus_prices</code> mapping.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">5</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">History & Epoch Tracking</h4>
                    <p className="text-sm text-gray-400">
                      Price stored in circular buffer (<code className="text-indigo-400">price_history</code>, 100 entries per pair).
                      Global epoch incremented. Update count and last update timestamp recorded.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Details */}
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6">Contract Details</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">Program</span>
                      <span className="text-white text-sm font-mono">price_oracle_v2.aleo</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">Price Decimals</span>
                      <span className="text-white text-sm font-mono">10^8 (100,000,000)</span>
                    </div>
                    <p className="text-xs text-gray-500">e.g. $2,500.50 = 250050000000u128</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">Max Pairs</span>
                      <span className="text-white text-sm font-mono">50</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">Min Operator Stake</span>
                      <span className="text-white text-sm font-mono">1,000,000,000 microcredits</span>
                    </div>
                    <p className="text-xs text-gray-500">= 1,000 ALEO</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">Staleness Threshold</span>
                      <span className="text-white text-sm font-mono">300,000 ms (5 min)</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">CB Max Change (1 min)</span>
                      <span className="text-white text-sm font-mono">500 bps (5%)</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400 text-sm">CB Hard Halt Duration</span>
                      <span className="text-white text-sm font-mono">900,000 ms (15 min)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-8">
                <h3 className="text-lg font-bold text-white mb-4">Two Submission Paths</h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-xs font-medium">PRIMARY</span>
                      <span className="text-white font-medium text-sm">submit_price_simple</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Single operator directly writes consensus price. Uses <code className="text-indigo-400">self.caller</code> for auth.
                      No rounds needed. Used by this dashboard.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-gray-500/30 text-gray-300 text-xs font-medium">ADVANCED</span>
                      <span className="text-white font-medium text-sm">submit_signed_price</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Multi-operator consensus rounds with native Aleo <code className="text-indigo-400">signature::verify</code>.
                      Requires <code className="text-indigo-400">start_round</code> + <code className="text-indigo-400">finalize_consensus</code> flow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

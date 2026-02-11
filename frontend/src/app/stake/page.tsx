'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { useAleo, OnChainPrice } from '@/hooks/useAleo';
import { oracleAPI, PriceData, RelayerHealth, RelayerStatus } from '@/services/oracleAPI';

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

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function freshnessColor(ageMs: number): string {
  if (ageMs < 60_000) return 'text-green-400';
  if (ageMs < 300_000) return 'text-yellow-400';
  return 'text-red-400';
}

type TabId = 'prices' | 'feed-status' | 'relayer' | 'on-chain' | 'how-it-works';

export default function OracleDashboard() {
  const { readOnChainPrice } = useAleo();

  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('prices');
  const [relayerHealth, setRelayerHealth] = useState<RelayerHealth | null>(null);
  const [relayerStatus, setRelayerStatus] = useState<RelayerStatus | null>(null);
  const [relayerOnline, setRelayerOnline] = useState(false);
  const [onChainPrices, setOnChainPrices] = useState<Map<number, OnChainPrice>>(new Map());

  // Fetch live prices
  const fetchPrices = useCallback(async () => {
    try {
      const data = await oracleAPI.getAllPrices();
      setPrices(data.prices);
    } catch (err) {
      console.error('Failed to fetch prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  // Fetch relayer status
  const fetchRelayerData = useCallback(async () => {
    try {
      const [health, status] = await Promise.all([
        oracleAPI.getRelayerHealth(),
        oracleAPI.getRelayerStatus(),
      ]);
      setRelayerHealth(health);
      setRelayerStatus(status);
      setRelayerOnline(true);
    } catch {
      setRelayerOnline(false);
      setRelayerHealth(null);
      setRelayerStatus(null);
    }
  }, []);

  // Fetch on-chain prices
  const fetchOnChainPrices = useCallback(async () => {
    const results = new Map<number, OnChainPrice>();
    for (const [, pairId] of Object.entries(PAIR_ID_MAP)) {
      const data = await readOnChainPrice(pairId);
      if (data) results.set(pairId, data);
    }
    setOnChainPrices(results);
  }, [readOnChainPrice]);

  useEffect(() => {
    fetchPrices();
    fetchRelayerData();
    const priceInterval = setInterval(fetchPrices, 10000);
    const relayerInterval = setInterval(fetchRelayerData, 10000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(relayerInterval);
    };
  }, [fetchPrices, fetchRelayerData]);

  // Fetch on-chain prices when that tab is active
  useEffect(() => {
    if (activeTab === 'on-chain') {
      fetchOnChainPrices();
      const interval = setInterval(fetchOnChainPrices, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchOnChainPrices]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'prices', label: 'Live Prices' },
    { id: 'feed-status', label: 'Feed Status' },
    { id: 'relayer', label: 'Relayer Status' },
    { id: 'on-chain', label: 'On-Chain' },
    { id: 'how-it-works', label: 'How It Works' },
  ];

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <div className={`w-2 h-2 rounded-full ${relayerOnline ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
            <span className="text-sm text-gray-300">
              {relayerOnline ? 'Oracle Active — Automated Submission' : 'Oracle Monitoring'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Oracle Dashboard</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Chainlink-style automated oracle. The relayer submits prices 24/7 — this dashboard monitors the system.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all text-sm ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'glass-card text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== Live Prices Tab ===== */}
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
                      const isStale = age > 300_000;
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

        {/* ===== Feed Status Tab ===== */}
        {activeTab === 'feed-status' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">Feed Status</h3>
              <p className="text-sm text-gray-400 mt-1">Per-pair monitoring with freshness and circuit breaker status</p>
            </div>
            {prices.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <p className="text-gray-400">No feed data available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {prices.map((price) => {
                  const age = price.age || (Date.now() - price.timestamp);
                  const pairId = PAIR_ID_MAP[price.pair];
                  const twapDev = price.twap?.deviation1h;
                  return (
                    <div key={price.pair} className="glass-card rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${age < 60_000 ? 'bg-green-400' : age < 300_000 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                          <span className="text-white font-bold text-lg">{price.pair}</span>
                        </div>
                        {pairId && (
                          <span className="text-indigo-400 font-mono text-xs">ID:{pairId}</span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Price</span>
                          <span className="text-white font-medium">
                            ${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Freshness</span>
                          <span className={`text-sm font-medium ${freshnessColor(age)}`}>
                            {formatAge(age)} {age > 300_000 ? '(STALE)' : age < 60_000 ? '(fresh)' : '(aging)'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Sources</span>
                          <span className="text-gray-300 text-sm">{price.sourceCount}</span>
                        </div>
                        {twapDev !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 text-sm">TWAP Deviation (1h)</span>
                            <span className={`text-sm ${Math.abs(twapDev) > 2 ? 'text-yellow-400' : 'text-gray-300'}`}>
                              {twapDev > 0 ? '+' : ''}{twapDev.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Circuit Breaker</span>
                          {price.circuitBreaker?.isHalted ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">HALTED</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">OK</span>
                          )}
                        </div>
                      </div>

                      {/* Freshness bar */}
                      <div className="mt-4 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${age < 60_000 ? 'bg-green-400' : age < 300_000 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.max(5, 100 - (age / 300_000) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== Relayer Status Tab ===== */}
        {activeTab === 'relayer' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">Relayer Status</h3>
              <p className="text-sm text-gray-400 mt-1">Automated submission service health and activity</p>
            </div>

            {/* Relayer Health Card */}
            <div className="glass-card rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-xl ${relayerOnline ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                  <div className={`w-4 h-4 rounded-full ${relayerOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                </div>
                <div>
                  <span className={`font-bold text-lg ${relayerOnline ? 'text-green-400' : 'text-red-400'}`}>
                    {relayerOnline ? 'Relayer Online' : 'Relayer Offline'}
                  </span>
                  {relayerHealth && (
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {relayerHealth.operator.slice(0, 16)}...{relayerHealth.operator.slice(-8)}
                    </p>
                  )}
                </div>
              </div>

              {relayerHealth ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-500 mb-1">Uptime</div>
                    <div className="text-white font-medium">{formatUptime(relayerHealth.uptime)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-500 mb-1">Balance</div>
                    <div className="text-white font-medium">{relayerHealth.balance.toFixed(4)} credits</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-500 mb-1">Total Submissions</div>
                    <div className="text-white font-medium">{relayerHealth.stats.totalSubmissions}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-500 mb-1">Success / Failed</div>
                    <div className="text-white font-medium">
                      <span className="text-green-400">{relayerHealth.stats.successfulSubmissions}</span>
                      {' / '}
                      <span className="text-red-400">{relayerHealth.stats.failedSubmissions}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Relayer is not reachable. Make sure it&apos;s running on port 3001.</p>
              )}
            </div>

            {/* Per-pair submission status */}
            {relayerStatus && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h4 className="text-lg font-bold text-white">Per-Pair Submissions</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Pair</th>
                        <th className="text-right px-6 py-3 text-sm font-medium text-gray-400">Last Price</th>
                        <th className="text-right px-6 py-3 text-sm font-medium text-gray-400">Last Update</th>
                        <th className="text-right px-6 py-3 text-sm font-medium text-gray-400">TX Count</th>
                        <th className="text-center px-6 py-3 text-sm font-medium text-gray-400">Status</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">Last TX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relayerStatus.pairs.map((p) => (
                        <tr key={p.pair} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-3 text-white font-medium">{p.pair}</td>
                          <td className="text-right px-6 py-3 text-white">
                            {p.lastPrice !== null ? `$${p.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="text-right px-6 py-3 text-gray-400 text-sm">
                            {p.lastTimestamp ? formatAge(Date.now() - p.lastTimestamp) + ' ago' : '—'}
                          </td>
                          <td className="text-right px-6 py-3 text-gray-300">{p.submissionCount}</td>
                          <td className="text-center px-6 py-3">
                            {p.pending ? (
                              <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">Pending</span>
                            ) : p.lastTxId ? (
                              <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">Active</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full bg-white/5 text-gray-500 text-xs">Waiting</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-indigo-400 font-mono text-xs">
                            {p.lastTxId ? `${p.lastTxId.slice(0, 16)}...` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {relayerStatus && relayerStatus.errors.length > 0 && (
              <div className="glass-card rounded-2xl p-6 mt-6">
                <h4 className="text-lg font-bold text-white mb-4">Recent Errors</h4>
                <div className="space-y-2">
                  {relayerStatus.errors.map((err, i) => (
                    <div key={i} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-red-400 font-medium text-sm">{err.pair}</span>
                        <span className="text-gray-500 text-xs">{new Date(err.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-gray-400 text-xs font-mono">{err.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== On-Chain Verification Tab ===== */}
        {activeTab === 'on-chain' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">On-Chain Price Verification</h3>
              <p className="text-sm text-gray-400 mt-1">
                Reads <code className="text-indigo-400">consensus_prices</code> mapping directly from Aleo RPC and compares to oracle node
              </p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Pair</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Oracle Price</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">On-Chain Price</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">On-Chain Time</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-400">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(PAIR_ID_MAP).map(([pair, pairId]) => {
                      const oraclePrice = prices.find(p => p.pair === pair);
                      const chainPrice = onChainPrices.get(pairId);
                      const chainPriceNum = chainPrice ? Number(chainPrice.price) / PRICE_DECIMALS : null;
                      const oraclePriceNum = oraclePrice?.price ?? null;

                      let deviation: number | null = null;
                      if (chainPriceNum && oraclePriceNum && oraclePriceNum > 0) {
                        deviation = Math.abs(chainPriceNum - oraclePriceNum) / oraclePriceNum * 100;
                      }

                      const chainAge = chainPrice?.timestamp ? Date.now() - chainPrice.timestamp * 1000 : null;

                      let matchColor = 'text-gray-500';
                      let matchLabel = 'N/A';
                      if (deviation !== null) {
                        if (deviation < 0.1) { matchColor = 'text-green-400'; matchLabel = 'Match'; }
                        else if (deviation < 1) { matchColor = 'text-yellow-400'; matchLabel = `${deviation.toFixed(2)}% dev`; }
                        else { matchColor = 'text-red-400'; matchLabel = `${deviation.toFixed(2)}% STALE`; }
                      } else if (chainPrice === undefined) {
                        matchLabel = 'No data';
                      }

                      return (
                        <tr key={pair} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{pair}</td>
                          <td className="text-right px-6 py-4 text-white">
                            {oraclePriceNum !== null ? `$${oraclePriceNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="text-right px-6 py-4 text-white">
                            {chainPriceNum !== null ? `$${chainPriceNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="text-right px-6 py-4 text-gray-400 text-sm">
                            {chainAge !== null ? formatAge(chainAge) + ' ago' : '—'}
                          </td>
                          <td className={`text-center px-6 py-4 text-sm font-medium ${matchColor}`}>
                            {matchLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={fetchOnChainPrices}
                className="px-6 py-2.5 rounded-xl glass-card text-gray-400 hover:text-white transition-colors text-sm"
              >
                Refresh On-Chain Data
              </button>
            </div>
          </div>
        )}

        {/* ===== How It Works Tab ===== */}
        {activeTab === 'how-it-works' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Automated Oracle Flow</h3>
              <p className="text-sm text-gray-400 mb-6">
                This oracle works like Chainlink — fully automated, no human clicking buttons.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-400 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Oracle Node Aggregates Prices</h4>
                    <p className="text-sm text-gray-400">
                      Fetches from 10+ exchanges (Binance, Coinbase, Kraken, etc.) every 10 seconds.
                      Applies outlier detection, TWAP, and circuit breaker protection.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Relayer Polls Every 30s</h4>
                    <p className="text-sm text-gray-400">
                      The relayer polls the oracle node REST API, checks deviation and heartbeat thresholds.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-cyan-400 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Auto-Submits on Triggers</h4>
                    <p className="text-sm text-gray-400">
                      Submits when: deviation &gt;0.5% OR heartbeat &gt;5 minutes.
                      Calls <code className="text-indigo-400">submit_price_simple(pair_id, price, timestamp)</code> on-chain.
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
                      Contract validates: registered operator, circuit breaker not halted, price change within bounds (5%/min max).
                      Price stored in <code className="text-indigo-400">consensus_prices</code> mapping.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 font-bold">5</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">No Human in the Loop</h4>
                    <p className="text-sm text-gray-400">
                      The entire pipeline is automated 24/7. This dashboard is monitoring only — it reads data from the oracle node,
                      the relayer health endpoint, and the Aleo chain directly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6">Architecture</h3>
                <div className="p-4 rounded-xl bg-white/5 font-mono text-xs text-gray-400 leading-relaxed whitespace-pre">
{`Exchanges (10+)
    |
    v
Oracle Node (:3000)
    |  REST API
    v
Relayer (:3001)
    |  submit_price_simple()
    v
Aleo Blockchain
    |
    v
Dashboard (this page)
  reads all 3 sources`}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-8">
                <h3 className="text-xl font-bold text-white mb-6">Contract Details</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Program</span>
                    <span className="text-white text-sm font-mono">price_oracle_v2.aleo</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Price Decimals</span>
                    <span className="text-white text-sm font-mono">10^8</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Staleness Threshold</span>
                    <span className="text-white text-sm font-mono">5 min</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">CB Max Change</span>
                    <span className="text-white text-sm font-mono">5%/min</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Deviation Trigger</span>
                    <span className="text-white text-sm font-mono">0.5%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Heartbeat</span>
                    <span className="text-white text-sm font-mono">5 min</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 flex justify-between">
                    <span className="text-gray-400 text-sm">Poll Interval</span>
                    <span className="text-white text-sm font-mono">30s</span>
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

'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { PriceDisplay } from '@/components/PriceDisplay';
import { Chatbot } from '@/components/Chatbot';
import { oracleAPI, PriceData, HealthStatus, CircuitBreakerConfig, CircuitBreakerStatus } from '@/services/oracleAPI';

interface CircuitBreakerData {
  config: CircuitBreakerConfig;
  states: CircuitBreakerStatus[];
  timestamp: number;
}

export default function Home() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [providerCount, setProviderCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'prices' | 'analytics'>('prices');
  const [circuitBreaker, setCircuitBreaker] = useState<CircuitBreakerData | null>(null);

  const fetchPrices = async () => {
    try {
      const data = await oracleAPI.getAllPrices();
      setPrices(data.prices);
      setProviderCount(data.providerCount || 0);
      setLastUpdate(Date.now());
      setError(null);
      // Extract circuit breaker data from prices response
      if (data.circuitBreaker) {
        setCircuitBreaker({
          config: data.circuitBreaker.config,
          states: data.circuitBreaker.states,
          timestamp: data.timestamp
        });
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError('Failed to fetch prices. Is the oracle node running?');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const healthData = await oracleAPI.getHealth();
      setHealth(healthData);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const fetchCircuitBreakerStatus = async () => {
    try {
      const cbStatus = await oracleAPI.getCircuitBreakerStatus();
      setCircuitBreaker(cbStatus);
    } catch (err) {
      console.error('Circuit breaker status check failed:', err);
    }
  };

  useEffect(() => {
    fetchPrices();
    fetchHealth();
    fetchCircuitBreakerStatus();
    const priceInterval = setInterval(fetchPrices, 10000);
    const healthInterval = setInterval(fetchHealth, 30000);
    const cbInterval = setInterval(fetchCircuitBreakerStatus, 15000);
    return () => {
      clearInterval(priceInterval);
      clearInterval(healthInterval);
      clearInterval(cbInterval);
    };
  }, []);

  // Compute analytics data from real oracle data
  const analyticsData = useMemo(() => {
    const haltedPairs = prices.filter(p => p.circuitBreaker?.isHalted).length;
    const verifiedSigs = prices.filter(p => p.signatureVerified).length;
    const totalTripCount = prices.reduce((sum, p) => sum + (p.circuitBreaker?.tripCount || 0), 0);
    const avgLatency = health?.sources?.healthy ? Math.floor(45 + Math.random() * 20) : 0; // Would be real in production

    return {
      haltedPairs,
      verifiedSigs,
      totalSigs: prices.length,
      totalTripCount,
      avgLatency,
      cbEnabled: circuitBreaker?.config?.enabled ?? true,
      cbThreshold: circuitBreaker?.config?.maxPriceChangePercent ? (circuitBreaker.config.maxPriceChangePercent * 100).toFixed(0) : '10',
      uptime: health?.status === 'healthy' ? '99.9%' : health?.status === 'degraded' ? '95.0%' : 'Offline',
    };
  }, [prices, health, circuitBreaker]);

  // Calculate total market cap from tracked assets (mock calculation for display)
  const totalVolume = prices.reduce((acc, p) => acc + p.price * 1000000, 0);

  return (
    <div className="min-h-screen particles-bg">
      {/* Floating Orbs */}
      <div className="orb orb-1 pointer-events-none" />
      <div className="orb orb-2 pointer-events-none" />
      <div className="orb orb-3 pointer-events-none" />

      {/* Header */}
      <Header health={health} />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-20 text-center animate-fade-in relative">
          {/* Hero glow effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-cyan-500/20 blur-3xl rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass-card mb-8 relative overflow-hidden group hover-lift">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 status-live" />
            <span className="text-sm text-gray-300 relative">Live on Aleo Testnet</span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-sm text-emerald-400 font-semibold relative">{providerCount} Providers Active</span>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight relative">
            <span className="gradient-text text-glow animate-float inline-block">Zero-Knowledge</span>
            <br />
            <span className="text-white drop-shadow-lg">Price Oracle</span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4 relative">
            The first oracle that lets you verify collateral health <span className="text-white font-semibold text-glow-cyan">privately</span>.
          </p>
          <p className="text-sm text-gray-500 max-w-xl mx-auto relative">
            Multi-source price aggregation with cryptographic signatures, circuit breaker protection, and on-chain verification.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 relative">
            <Link href="/borrow" className="group px-8 py-4 rounded-2xl gradient-animated text-white font-bold hover:scale-105 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 flex items-center gap-3 ripple">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              ZK Position Verification
              <svg className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link href="/stake" className="group px-8 py-4 rounded-2xl glass-card glass-card-hover text-white font-semibold flex items-center gap-3 border border-emerald-500/20 hover:border-emerald-500/40">
              <svg className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Stake & Earn
              <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">~8.5% APY</span>
            </Link>
          </div>
        </div>

        {/* Live Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-slide-up">
          {[
            { label: 'Price Sources', value: `${providerCount || 10}+`, icon: '📊', color: 'from-blue-500 to-cyan-500', bgColor: 'from-blue-500/10 to-cyan-500/10' },
            { label: 'Trading Pairs', value: prices.length.toString(), icon: '💱', color: 'from-purple-500 to-pink-500', bgColor: 'from-purple-500/10 to-pink-500/10' },
            { label: 'Update Frequency', value: '10s', icon: '⚡', color: 'from-yellow-500 to-orange-500', bgColor: 'from-yellow-500/10 to-orange-500/10' },
            { label: 'Signatures Verified', value: `${prices.filter(p => p.signatureVerified).length}/${prices.length}`, icon: '🔐', color: 'from-emerald-500 to-teal-500', bgColor: 'from-emerald-500/10 to-teal-500/10' },
          ].map((stat, index) => (
            <div key={index} className="glass-card rounded-2xl p-5 group hover:scale-[1.03] transition-all card-3d relative overflow-hidden" style={{ animationDelay: `${index * 0.1}s` }}>
              {/* Background gradient on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                  <div className={`w-10 h-1.5 rounded-full bg-gradient-to-r ${stat.color} group-hover:w-14 transition-all duration-300`} />
                </div>
                <div className="text-3xl font-bold text-white mb-1 tracking-tight">{stat.value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Status Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 p-5 glass-card rounded-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${!error ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
              {!error ? (
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <span className="text-white font-semibold">{error ? 'Oracle Offline' : 'Oracle Online'}</span>
              <p className="text-sm text-gray-500">
                {health?.sources && `${health.sources.healthy}/${health.sources.total} sources healthy`}
              </p>
            </div>
            {!error && (
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                All Systems Operational
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Auto-refresh</span>
            </div>
            <span className="text-gray-600">|</span>
            <span>Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '--'}</span>
          </div>
        </div>

        {error && (
          <div className="mb-10 p-5 glass-card rounded-2xl border border-red-500/30 animate-scale-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-red-400 font-medium">{error}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Make sure the oracle node is running: <code className="bg-white/5 px-2 py-1 rounded text-gray-400">cd oracle-node && npm run dev</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-8">
          <button
            onClick={() => setActiveTab('prices')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'prices'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Live Prices
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Prices Section */}
        {activeTab === 'prices' && (
          <section className="mb-16 animate-fade-in">
            <PriceDisplay prices={prices} loading={loading} providerCount={providerCount} />
          </section>
        )}

        {/* Analytics Section */}
        {activeTab === 'analytics' && (
          <section className="mb-16 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Circuit Breaker Status */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Circuit Breaker
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${analyticsData.cbEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {analyticsData.cbEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Halted Pairs</span>
                    <span className={`text-sm font-medium ${analyticsData.haltedPairs > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {analyticsData.haltedPairs} / {prices.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Threshold</span>
                    <span className="text-sm font-medium text-white">{analyticsData.cbThreshold}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total Trips</span>
                    <span className="text-sm font-medium text-yellow-400">{analyticsData.totalTripCount}</span>
                  </div>
                </div>
                {analyticsData.haltedPairs > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">
                      {analyticsData.haltedPairs} pair(s) currently halted due to price volatility
                    </p>
                  </div>
                )}
              </div>

              {/* TWAP & Signature Verification */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verification Status
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Signatures</span>
                    <span className={`text-sm font-medium ${analyticsData.verifiedSigs === analyticsData.totalSigs ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {analyticsData.verifiedSigs}/{analyticsData.totalSigs} Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Signature Type</span>
                    <span className="text-sm font-medium text-white">Schnorr</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">TWAP Windows</span>
                    <span className="text-sm font-medium text-white">1h, 24h, 7d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Data Sources</span>
                    <span className="text-sm font-medium text-white">{providerCount} Active</span>
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  System Health
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Oracle Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${health?.status === 'healthy' ? 'bg-green-500/20 text-green-400' : health?.status === 'degraded' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                      {health?.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Healthy Sources</span>
                    <span className="text-sm font-medium text-emerald-400">
                      {health?.sources?.healthy || 0}/{health?.sources?.total || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Update Interval</span>
                    <span className="text-sm font-medium text-white">10s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Uptime</span>
                    <span className="text-sm font-medium text-emerald-400">{analyticsData.uptime}</span>
                  </div>
                </div>
              </div>

              {/* Price Sources Grid */}
              <div className="glass-card rounded-2xl p-6 col-span-1 md:col-span-2 lg:col-span-3">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  TWAP Overview (All Pairs)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {prices.slice(0, 10).map((price) => {
                    const token = price.pair.split('/')[0];
                    const deviation1h = price.twap?.deviation1h || 0;
                    const deviation24h = price.twap?.deviation24h || 0;
                    return (
                      <div key={price.pair} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{token}</span>
                          {price.signatureVerified ? (
                            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">1h TWAP</span>
                            <span className={deviation1h >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {deviation1h >= 0 ? '+' : ''}{deviation1h.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">24h TWAP</span>
                            <span className={deviation24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {deviation24h >= 0 ? '+' : ''}{deviation24h.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Feature Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Link href="/borrow" className="group block">
            <div className="glass-card glass-card-hover rounded-2xl p-8 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-3xl group-hover:opacity-100 opacity-50 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Private Borrowing</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Deposit collateral and borrow stablecoins with privacy-preserving positions. Your data stays private with zero-knowledge proofs.
              </p>
              <div className="flex items-center gap-2 text-indigo-400 font-medium group-hover:gap-3 transition-all">
                Start Borrowing
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>

          <Link href="/stake" className="group block">
            <div className="glass-card glass-card-hover rounded-2xl p-8 h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full blur-3xl group-hover:opacity-100 opacity-50 transition-opacity" />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Stake & Earn</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Become an oracle operator. Stake tokens to submit prices and earn rewards for maintaining accurate data feeds.
              </p>
              <div className="flex items-center gap-2 text-emerald-400 font-medium group-hover:gap-3 transition-all">
                Start Staking
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>
        </section>

        {/* Why Aleo Oracle */}
        <section className="mb-16">
          <h3 className="text-3xl font-bold text-white mb-3 text-center">Why Aleo Oracle?</h3>
          <p className="text-gray-500 text-center mb-10 max-w-2xl mx-auto">
            Built from the ground up for privacy, security, and decentralization
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Privacy First',
                description: 'All positions are stored as private records. Only you can see your collateral and debt data.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                color: 'from-indigo-500 to-purple-500'
              },
              {
                title: 'Cryptographic Security',
                description: 'Every price is cryptographically signed and verified on-chain with Schnorr signatures.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                color: 'from-emerald-500 to-cyan-500'
              },
              {
                title: 'Multi-Source Aggregation',
                description: 'Prices aggregated from 10+ exchanges with outlier detection and TWAP calculations.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
                color: 'from-orange-500 to-pink-500'
              }
            ].map((feature, index) => (
              <div key={index} className="glass-card rounded-2xl p-8 text-center group hover:scale-[1.02] transition-all">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h4 className="text-lg font-bold text-white mb-3">{feature.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security Section */}
        <section className="glass-card rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Built for Security
                </h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Our oracle implements multiple layers of protection: multi-level circuit breakers,
                  staking-based operator incentives, cryptographic signature verification, and
                  price staleness enforcement.
                </p>
                <div className="flex flex-wrap gap-3">
                  {['Circuit Breaker', 'Staking', 'Signatures', 'TWAP'].map((tag) => (
                    <span key={tag} className="px-4 py-2 rounded-full bg-white/5 text-gray-300 text-sm border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center animate-pulse-slow">
                  <div className="w-36 h-36 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* AI Chatbot */}
      <Chatbot prices={prices} />
    </div>
  );
}

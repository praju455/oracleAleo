'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { PriceChart } from '@/components/PriceChart';
import { oracleAPI, AnalysisResponse, PriceData } from '@/services/oracleAPI';

const tokenIcons: { [key: string]: string } = {
  'ETH': '\u27e0',
  'BTC': '\u20bf',
  'ALEO': '\u25c8',
  'SOL': '\u2609',
  'AVAX': '\u25b2',
  'POL': '\u2b21',
  'MATIC': '\u2b21',
  'DOT': '\u2b24',
  'ATOM': '\u269b',
  'LINK': '\u26d3',
  'UNI': '\u2b50'
};

const tokenColors: { [key: string]: { gradient: string; bg: string } } = {
  'ETH': { gradient: 'from-blue-500 to-purple-600', bg: 'bg-blue-500/10' },
  'BTC': { gradient: 'from-orange-500 to-yellow-500', bg: 'bg-orange-500/10' },
  'ALEO': { gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-500/10' },
  'SOL': { gradient: 'from-purple-500 to-pink-500', bg: 'bg-purple-500/10' },
  'AVAX': { gradient: 'from-red-500 to-rose-600', bg: 'bg-red-500/10' },
  'MATIC': { gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-500/10' },
  'DOT': { gradient: 'from-pink-500 to-rose-500', bg: 'bg-pink-500/10' },
  'ATOM': { gradient: 'from-indigo-500 to-blue-600', bg: 'bg-indigo-500/10' },
  'LINK': { gradient: 'from-blue-400 to-cyan-500', bg: 'bg-blue-400/10' },
  'UNI': { gradient: 'from-pink-400 to-purple-500', bg: 'bg-pink-400/10' },
};

export default function TokenAnalysisPage() {
  const params = useParams();
  const pairParam = params.pair as string;
  const pair = pairParam.replace('-', '/').toUpperCase();
  const token = pair.split('/')[0];

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const analysisData = await oracleAPI.getAnalysis(pair);
      setAnalysis(analysisData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
      setError('Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  }, [pair]);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const colors = tokenColors[token] || { gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-500/10' };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
    if (trend === 'down') return <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>;
    return <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>;
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="glass-card rounded-2xl p-16 text-center">
            <p className="text-red-400 mb-4">{error || 'Analysis not available'}</p>
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Token Header */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-3xl shadow-lg`}>
                {tokenIcons[token] || token.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{pair}</h1>
                <p className="text-gray-400">{token} Price Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-4xl font-bold text-white">
                  ${analysis.currentPrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {analysis.stats['24h'] && (
                  <div className={`text-sm font-medium ${analysis.stats['24h'].changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.stats['24h'].changePercent >= 0 ? '+' : ''}{analysis.stats['24h'].changePercent.toFixed(2)}% (24h)
                  </div>
                )}
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-3 rounded-xl transition-all ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400'}`}
              >
                <svg className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Chart */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Price Chart</h2>
                <div className="flex gap-2">
                  {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedTimeframe === tf
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart
                candles={selectedTimeframe === '1m' ? analysis.charts.candles1m : analysis.charts.candles5m}
                pair={pair}
                color={colors.gradient.includes('blue') ? '#3B82F6' : colors.gradient.includes('orange') ? '#F97316' : '#8B5CF6'}
              />
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analysis.stats['24h'] && (
                <>
                  <div className="glass-card rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">24h High</p>
                    <p className="text-xl font-bold text-green-400">${analysis.stats['24h'].high.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="glass-card rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">24h Low</p>
                    <p className="text-xl font-bold text-red-400">${analysis.stats['24h'].low.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="glass-card rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">24h Volume</p>
                    <p className="text-xl font-bold text-white">{analysis.stats['24h'].dataPoints} pts</p>
                  </div>
                  <div className="glass-card rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Volatility</p>
                    <p className="text-xl font-bold text-yellow-400">${analysis.stats['24h'].volatility.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>

            {/* TWAP Analysis */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                TWAP Analysis
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-gray-500 mb-1">1h TWAP</p>
                  <p className="text-lg font-bold text-white">${analysis.twap['1h'].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className={`text-xs ${analysis.twap['1h'].deviation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.twap['1h'].deviation >= 0 ? '+' : ''}{analysis.twap['1h'].deviation.toFixed(2)}% deviation
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-gray-500 mb-1">24h TWAP</p>
                  <p className="text-lg font-bold text-white">${analysis.twap['24h'].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className={`text-xs ${analysis.twap['24h'].deviation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.twap['24h'].deviation >= 0 ? '+' : ''}{analysis.twap['24h'].deviation.toFixed(2)}% deviation
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-gray-500 mb-1">7d TWAP</p>
                  <p className="text-lg font-bold text-white">${analysis.twap['7d'].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-gray-500">Long-term average</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trend Analysis */}
            {analysis.trend && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  {getTrendIcon(analysis.trend.trend)}
                  Trend Analysis
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Trend</span>
                    <span className={`font-bold capitalize ${
                      analysis.trend.trend === 'up' ? 'text-green-400' :
                      analysis.trend.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {analysis.trend.trend}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Strength</span>
                    <span className="text-white font-medium">{analysis.trend.strength.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Support</span>
                    <span className="text-green-400 font-medium">${analysis.trend.support.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Resistance</span>
                    <span className="text-red-400 font-medium">${analysis.trend.resistance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Circuit Breaker Status */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Circuit Breaker
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    analysis.circuitBreaker.isHalted
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {analysis.circuitBreaker.isHalted ? 'HALTED' : 'ACTIVE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Trip Count</span>
                  <span className="text-white">{analysis.circuitBreaker.tripCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Threshold</span>
                  <span className="text-white">{(analysis.circuitBreaker.config.maxPriceChangePercent * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Halt Duration</span>
                  <span className="text-white">{analysis.circuitBreaker.config.haltDurationMs / 1000 / 60} min</span>
                </div>
                {analysis.circuitBreaker.lastTripReason && (
                  <div className="mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">Last trip: {analysis.circuitBreaker.lastTripReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Signature Verification */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Signature
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Verified</span>
                  <span className={`flex items-center gap-1 ${analysis.currentPrice.signatureVerified ? 'text-green-400' : 'text-red-400'}`}>
                    {analysis.currentPrice.signatureVerified ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Yes
                      </>
                    ) : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sources</span>
                  <span className="text-white">{analysis.currentPrice.sourceCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Data Points</span>
                  <span className="text-white">{analysis.historyCount}</span>
                </div>
                {analysis.currentPrice.signature && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Signature</p>
                    <code className="text-xs text-gray-400 bg-white/5 p-2 rounded block break-all">
                      {analysis.currentPrice.signature.slice(0, 32)}...
                    </code>
                  </div>
                )}
              </div>
            </div>

            {/* Data Sources */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">Data Sources</h2>
              <div className="space-y-2">
                {analysis.currentPrice.sources.map((source, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-gray-300">{source}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <Link
                href="/stake"
                className="w-full py-3 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Operator Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

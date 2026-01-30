'use client';

import { FC } from 'react';
import { useRouter } from 'next/navigation';
import { PriceData } from '../services/oracleAPI';

interface PriceDisplayProps {
  prices: PriceData[];
  loading: boolean;
  providerCount?: number;
}

const tokenIcons: { [key: string]: string } = {
  'ETH': '\u27e0',
  'BTC': '\u20bf',
  'ALEO': '\u25c8',
  'SOL': '\u2609',
  'AVAX': '\u25b2',
  'MATIC': '\u2b21',
  'DOT': '\u2b24',
  'ATOM': '\u269b',
  'LINK': '\u26d3',
  'UNI': '\u2b50',
};

const tokenColors: { [key: string]: string } = {
  'ETH': 'from-blue-500 to-purple-600',
  'BTC': 'from-orange-500 to-yellow-500',
  'ALEO': 'from-green-500 to-emerald-600',
  'SOL': 'from-purple-500 to-fuchsia-600',
  'AVAX': 'from-red-500 to-rose-600',
  'MATIC': 'from-violet-500 to-purple-600',
  'DOT': 'from-pink-500 to-rose-500',
  'ATOM': 'from-indigo-500 to-blue-600',
  'LINK': 'from-blue-400 to-cyan-500',
  'UNI': 'from-pink-400 to-purple-500',
};

export const PriceDisplay: FC<PriceDisplayProps> = ({ prices, loading, providerCount }) => {
  const router = useRouter();

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatAge = (ageMs: number): string => {
    const seconds = Math.floor(ageMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  };

  const getToken = (pair: string): string => pair.split('/')[0];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-xl" />
              <div className="space-y-2">
                <div className="h-5 bg-white/10 rounded w-20" />
                <div className="h-3 bg-white/5 rounded w-12" />
              </div>
            </div>
            <div className="h-10 bg-white/10 rounded w-32 mb-4" />
            <div className="h-4 bg-white/5 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <div className="text-4xl mb-4 animate-pulse">📡</div>
        <p className="text-gray-400 font-medium">Connecting to Oracle Infrastructure...</p>
        <p className="text-sm text-gray-500 mt-2">The oracle node on Render may be initializing or waking up from sleep. This usually takes 30-60 seconds.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Provider Count Banner */}
      {providerCount && (
        <div className="mb-6 flex items-center justify-between">
          <div className="glass-card rounded-xl px-4 py-2 inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">
              <span className="font-semibold text-white">{providerCount}</span> price providers active
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prices.map((price) => {
          const token = getToken(price.pair);
          const age = price.age || 0;
          const isStale = age > 60000;
          const isVeryStale = age > 300000;
          const isHalted = price.circuitBreaker?.isHalted;
          const change24h = price.twap?.deviation24h || 0;

          return (
            <div
              key={price.pair}
              className={`glass-card glass-card-hover rounded-2xl p-6 relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isHalted ? 'ring-2 ring-red-500/50' : ''
                }`}
              onClick={() => router.push(`/token/${price.pair.replace('/', '-').toLowerCase()}`)}
            >
              {/* Background glow effect */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${tokenColors[token] || 'from-indigo-500 to-purple-600'} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`} />

              {/* Circuit Breaker Alert */}
              {isHalted && (
                <div className="absolute top-0 left-0 right-0 bg-red-500/20 px-3 py-1 text-center">
                  <span className="text-xs font-medium text-red-400">
                    Circuit Breaker Active
                  </span>
                </div>
              )}

              {/* Header */}
              <div className={`flex items-center justify-between mb-4 relative ${isHalted ? 'mt-4' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tokenColors[token] || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {tokenIcons[token] || token.charAt(0)}
                  </div>
                  <div>
                    <span className="text-lg font-bold text-white">{token}</span>
                    <p className="text-xs text-gray-500">/ USD</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {/* Signature Badge */}
                  {price.signatureVerified !== undefined && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${price.signatureVerified
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-orange-500/20 text-orange-400'
                      }`}>
                      {price.signatureVerified ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isHalted
                      ? 'bg-red-500/20 text-red-400'
                      : isVeryStale
                        ? 'bg-red-500/20 text-red-400'
                        : isStale
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                    }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isHalted ? 'bg-red-400' : isVeryStale ? 'bg-red-400' : isStale ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'
                      }`} />
                    {isHalted ? 'HALTED' : formatAge(age)}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="mb-3 relative">
                <div className="text-3xl font-bold text-white tracking-tight">
                  {formatPrice(price.price)}
                </div>
                {/* 24h Change */}
                <div className={`text-sm font-medium mt-1 ${change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}% <span className="text-gray-500">24h</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between relative pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{price.sourceCount} sources</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>View analysis</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriceDisplay;

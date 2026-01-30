'use client';

import { FC, useEffect } from 'react';
import { PriceData } from '@/services/oracleAPI';

interface PriceModalProps {
  price: PriceData | null;
  onClose: () => void;
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

export const PriceModal: FC<PriceModalProps> = ({ price, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!price) return null;

  const token = price.pair.split('/')[0];
  const age = price.age || 0;
  const isStale = age > 60000;
  const isHalted = price.circuitBreaker?.isHalted;

  const formatPrice = (p: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(p);
  };

  const formatAge = (ageMs: number): string => {
    const seconds = Math.floor(ageMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-card rounded-3xl p-8 max-w-lg w-full animate-scale-in overflow-hidden">
        {/* Background glow */}
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br ${tokenColors[token] || 'from-indigo-500 to-purple-600'} opacity-20 blur-3xl`} />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 relative">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tokenColors[token] || 'from-indigo-500 to-purple-600'} flex items-center justify-center text-3xl shadow-lg`}>
            {tokenIcons[token] || token.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{token}/USD</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isHalted ? 'bg-red-400' : isStale ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
              <span className="text-sm text-gray-400">
                {isHalted ? 'Halted' : `Updated ${formatAge(age)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Circuit Breaker Alert */}
        {isHalted && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-red-400">Circuit Breaker Active</p>
                <p className="text-sm text-red-300/70">{price.circuitBreaker?.lastTripReason || 'Price feed halted due to volatility'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Price */}
        <div className="mb-6 relative">
          <p className="text-sm text-gray-500 mb-1">Current Price</p>
          <div className="text-5xl font-bold text-white tracking-tight">
            {formatPrice(price.price)}
          </div>
        </div>

        {/* TWAP Data */}
        {price.twap && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[
              { label: '1h TWAP', value: price.twap['1h'], deviation: price.twap.deviation1h },
              { label: '24h TWAP', value: price.twap['24h'], deviation: price.twap.deviation24h },
              { label: '7d TWAP', value: price.twap['7d'], deviation: null },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-lg font-bold text-white">{formatPrice(item.value)}</p>
                {item.deviation !== null && (
                  <p className={`text-sm ${item.deviation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {item.deviation >= 0 ? '+' : ''}{item.deviation.toFixed(2)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Sources</p>
            <p className="text-lg font-bold text-white">{price.sourceCount}</p>
            <p className="text-xs text-gray-500 mt-1">{price.sources.slice(0, 3).join(', ')}{price.sources.length > 3 ? '...' : ''}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-1">Signature</p>
            <p className={`text-lg font-bold ${price.signatureVerified ? 'text-emerald-400' : 'text-orange-400'}`}>
              {price.signatureVerified ? 'Verified' : 'Unverified'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{price.signatureR ? 'Schnorr' : 'Legacy'}</p>
          </div>
        </div>

        {/* Operator Info */}
        {price.operatorAddress && (
          <div className="p-4 rounded-xl bg-white/5 mb-6">
            <p className="text-xs text-gray-500 mb-2">Operator</p>
            <p className="text-sm text-blue-400 font-mono break-all">{price.operatorAddress}</p>
          </div>
        )}

        {/* Circuit Breaker Stats */}
        {price.circuitBreaker && (
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500 mb-2">Circuit Breaker Stats</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Trip Count:</span>
              <span className="text-white">{price.circuitBreaker.tripCount}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Status:</span>
              <span className={price.circuitBreaker.isHalted ? 'text-red-400' : 'text-green-400'}>
                {price.circuitBreaker.isHalted ? 'Halted' : 'Active'}
              </span>
            </div>
          </div>
        )}

        {/* Scaled Price */}
        <div className="mt-4 text-xs text-gray-600 font-mono truncate">
          Scaled: {price.scaledPrice}
        </div>
      </div>
    </div>
  );
};

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { BorrowForm } from '@/components/BorrowForm';
import { PriceDisplay } from '@/components/PriceDisplay';
import { Chatbot } from '@/components/Chatbot';
import { oracleAPI, PriceData } from '@/services/oracleAPI';

export default function BorrowPage() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const data = await oracleAPI.getAllPrices();
        setPrices(data.prices);
      } catch (err) {
        console.error('Failed to fetch prices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Borrow Form */}
          <div>
            <BorrowForm prices={prices} />

            {/* Info Box */}
            <div className="mt-6 glass-card rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-white">How it works</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { step: '1', text: 'Deposit collateral (ETH, BTC, or ALEO)' },
                  { step: '2', text: 'Borrow USD against your collateral' },
                  { step: '3', text: 'Maintain at least 150% collateral ratio' },
                  { step: '4', text: 'Repay anytime to withdraw collateral' },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {item.step}
                    </span>
                    <span className="text-sm text-gray-400">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Price Feed */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Live Prices</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Real-time
              </div>
            </div>
            <PriceDisplay prices={prices} loading={loading} />

            {/* Privacy Notice */}
            <div className="mt-6 glass-card rounded-2xl p-6 border-indigo-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-400 mb-2">Privacy-First Design</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Your position details (collateral amount, borrowed amount) are stored
                    as private records on Aleo. Only you can see your position details.
                    The blockchain only sees encrypted proofs.
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            <div className="mt-4 glass-card rounded-2xl p-6 border-yellow-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-400 mb-2">Risk Warning</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    If your collateral ratio falls below 150%, your position may be liquidated.
                    Monitor your positions regularly and add collateral if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* AI Chatbot */}
      <Chatbot prices={prices} />
    </div>
  );
}

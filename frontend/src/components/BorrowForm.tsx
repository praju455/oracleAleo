'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { geminiAI, BorrowAnalysis } from '@/services/geminiAI';
import { PriceData } from '@/services/oracleAPI';
import { aleoContract, MARKET_IDS, TransactionResult, WalletContext } from '@/services/aleoContract';

interface BorrowFormProps {
  prices: PriceData[];
}

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

export const BorrowForm: FC<BorrowFormProps> = ({ prices }) => {
  const { connected, publicKey, wallet, requestTransaction, requestRecordPlaintexts } = useWallet();
  const [selectedToken, setSelectedToken] = useState<string>('ETH/USD');
  const [collateralAmount, setCollateralAmount] = useState<string>('');
  const [borrowAmount, setBorrowAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<BorrowAnalysis | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  // Update Gemini context when prices change
  useEffect(() => {
    geminiAI.updatePriceContext(prices);
  }, [prices]);

  const selectedPrice = prices.find(p => p.pair === selectedToken);
  const token = selectedToken.split('/')[0];

  const calculateCollateralValue = (): number => {
    if (!selectedPrice || !collateralAmount) return 0;
    return parseFloat(collateralAmount) * selectedPrice.price;
  };

  const calculateCollateralRatio = (): number => {
    const collateralValue = calculateCollateralValue();
    const borrow = parseFloat(borrowAmount) || 0;
    if (borrow === 0) return 0;
    return (collateralValue / borrow) * 100;
  };

  const calculateMaxBorrow = (): number => {
    const collateralValue = calculateCollateralValue();
    return collateralValue / 1.5;
  };

  const handleAIAnalysis = async () => {
    if (!collateralAmount || !borrowAmount) return;

    setAnalyzingAI(true);
    try {
      const analysis = await geminiAI.analyzeBorrow(
        token,
        parseFloat(collateralAmount),
        parseFloat(borrowAmount)
      );
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setAnalyzingAI(false);
    }
  };

  const handleBorrow = async () => {
    if (!connected || !publicKey || !requestTransaction || !requestRecordPlaintexts) {
      alert('Please connect your wallet first. Make sure your wallet supports record access.');
      return;
    }

    const ratio = calculateCollateralRatio();
    if (ratio < 150) {
      alert('Collateral ratio must be at least 150%');
      return;
    }

    if (!selectedPrice) {
      alert('Price data not available');
      return;
    }

    setLoading(true);

    try {
      console.log('Initiating borrow transaction:', {
        token: selectedToken,
        collateral: collateralAmount,
        borrow: borrowAmount,
        price: selectedPrice.price,
        publicKey: publicKey
      });

      // Build wallet context with record access for the contract call
      const walletCtx: WalletContext = {
        publicKey: publicKey!,
        requestTransaction: requestTransaction!,
        requestRecordPlaintexts: requestRecordPlaintexts!,
      };

      const result: TransactionResult = await aleoContract.borrow(
        walletCtx,
        selectedToken,
        parseFloat(collateralAmount),
        parseFloat(borrowAmount),
        selectedPrice.price
      );

      if (result.success) {
        alert(`Borrow transaction submitted!\n\nTransaction ID: ${result.transactionId}\n\nYour position has been created. The collateral is locked and you can claim your borrowed funds once the transaction confirms.`);
        setCollateralAmount('');
        setBorrowAmount('');
        setAiAnalysis(null);
      } else {
        alert(`Borrow failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Borrow failed:', error);
      alert(`Borrow failed: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const ratio = calculateCollateralRatio();
  const isValidRatio = ratio >= 150 || ratio === 0;

  const getRatioColor = () => {
    if (ratio === 0) return 'text-gray-500';
    if (ratio >= 200) return 'text-green-400';
    if (ratio >= 150) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRatioGradient = () => {
    if (ratio >= 200) return 'from-green-500 to-emerald-500';
    if (ratio >= 150) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="glass-card rounded-2xl p-8 relative overflow-hidden">
      {/* Verification Pulse Badge */}
      <div className="absolute top-4 right-8 flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-green-400">Live Oracle Verification</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Borrow</h2>
          <p className="text-sm text-gray-500">Create a private collateralized position</p>
        </div>
      </div>

      {/* Token Selection */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-medium">Collateral Token</label>
        <div className="relative">
          <select
            value={selectedToken}
            onChange={(e) => { setSelectedToken(e.target.value); setAiAnalysis(null); }}
            className="w-full glass-input rounded-xl px-4 py-4 text-white appearance-none cursor-pointer pr-12"
          >
            {prices.map((p) => (
              <option key={p.pair} value={p.pair} className="bg-gray-900">
                {p.pair.split('/')[0]}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl pointer-events-none">
            {tokenIcons[token] || token.charAt(0)}
          </div>
        </div>
        {selectedPrice && (
          <p className="text-xs text-gray-500 mt-2">
            Current price: ${selectedPrice.price.toLocaleString()}
          </p>
        )}
      </div>

      {/* Collateral Amount */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-medium">Collateral Amount</label>
        <div className="relative">
          <input
            type="number"
            value={collateralAmount}
            onChange={(e) => { setCollateralAmount(e.target.value); setAiAnalysis(null); }}
            placeholder="0.0"
            className="w-full glass-input rounded-xl px-4 py-4 text-white text-lg font-medium pr-20"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
            {token}
          </span>
        </div>
        {selectedPrice && collateralAmount && (
          <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
            <span className="text-gray-500">Value:</span>
            <span className="text-white font-medium">${calculateCollateralValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        )}
      </div>

      {/* Borrow Amount */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-3 font-medium">Borrow Amount</label>
        <div className="relative">
          <input
            type="number"
            value={borrowAmount}
            onChange={(e) => { setBorrowAmount(e.target.value); setAiAnalysis(null); }}
            placeholder="0.0"
            className="w-full glass-input rounded-xl px-4 py-4 text-white text-lg font-medium pr-20"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
            USD
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Max borrow: <span className="text-indigo-400 font-medium">${calculateMaxBorrow().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
      </div>

      {/* Collateral Ratio */}
      <div className="mb-6 p-5 glass rounded-xl">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-400 font-medium">Collateral Ratio</span>
          <span className={`text-xl font-bold ${getRatioColor()}`}>
            {ratio > 0 ? `${ratio.toFixed(1)}%` : '--'}
          </span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 bg-gradient-to-r ${getRatioGradient()}`}
            style={{ width: `${Math.min(ratio / 3, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-3 text-xs">
          <span className="text-red-400">Liquidation &lt;150%</span>
          <span className="text-gray-500">Safe &gt;200%</span>
        </div>
      </div>

      {/* AI Analysis Button */}
      {collateralAmount && borrowAmount && (
        <button
          onClick={handleAIAnalysis}
          disabled={analyzingAI}
          className="w-full mb-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 hover:border-purple-500/50 hover:text-purple-200"
        >
          {analyzingAI ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Analyzing with AI...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze with AI
            </>
          )}
        </button>
      )}

      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Risk Analysis
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase border ${getRiskColor(aiAnalysis.riskLevel)}`}>
              {aiAnalysis.riskLevel} Risk
            </span>
          </div>

          <p className="text-sm text-gray-400">{aiAnalysis.recommendation}</p>

          {aiAnalysis.insights.length > 0 && (
            <div className="space-y-1">
              {aiAnalysis.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          )}

          {aiAnalysis.warnings.length > 0 && (
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              {aiAnalysis.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-600">
            Suggested ratio: {aiAnalysis.suggestedCollateralRatio}%
          </div>
        </div>
      )}

      {/* Borrow Button */}
      <button
        onClick={handleBorrow}
        disabled={!connected || loading || !isValidRatio || !borrowAmount || !collateralAmount}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${connected && isValidRatio && borrowAmount && collateralAmount && !loading
            ? 'glass-button text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
            : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Processing...
          </span>
        ) : !connected ? (
          'Connect Wallet'
        ) : !isValidRatio && ratio > 0 ? (
          'Ratio Too Low'
        ) : (
          'Create Position'
        )}
      </button>

      {/* Security Notice */}
      <div className="mt-6 flex items-start gap-3 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
        <svg className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-gray-400 leading-relaxed">
          Your position is stored as a private record on Aleo. Only you can view your collateral and borrowed amounts.
        </p>
      </div>
    </div>
  );
};

export default BorrowForm;

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@demox-labs/aleo-wallet-adapter-react';
import { Header } from '@/components/Header';
import { Chatbot } from '@/components/Chatbot';
import { oracleAPI, PriceData } from '@/services/oracleAPI';
import { aleoContract, StakingStats, OperatorInfo as ContractOperatorInfo, TransactionResult, WalletContext } from '@/services/aleoContract';

interface OperatorStats {
  totalOperators: number;
  totalStaked: string;
  averageStake: string;
  totalRewards: string;
  currentEpoch: number;
  minStake: string;
}

interface OperatorInfo {
  address: string;
  stake: string;
  reputation: number;
  submissions: number;
  validSubmissions: number;
  isActive: boolean;
  rewards: string;
}

export default function StakePage() {
  const { connected, publicKey, requestTransaction, requestRecordPlaintexts } = useWallet();
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [stats, setStats] = useState<OperatorStats>({
    totalOperators: 0,
    totalStaked: '0',
    averageStake: '0',
    totalRewards: '0',
    currentEpoch: 0,
    minStake: '1,000'
  });

  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [userStake, setUserStake] = useState<{ staked: string; pendingRewards: string } | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [isClaiming, setIsClaiming] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'operators' | 'rewards'>('overview');
  const [txStatus, setTxStatus] = useState<{ type: string; message: string } | null>(null);

  // Fetch staking stats from contract
  const fetchStakingStats = useCallback(async () => {
    try {
      const stakingStats = await aleoContract.getStakingStats();
      const totalOps = stakingStats.totalOperators || 1;
      setStats({
        totalOperators: stakingStats.totalOperators,
        totalStaked: aleoContract.unscaleCredits(stakingStats.totalStaked).toLocaleString(),
        averageStake: (aleoContract.unscaleCredits(stakingStats.totalStaked) / totalOps).toLocaleString(),
        totalRewards: aleoContract.unscaleCredits(stakingStats.totalRewardsDistributed).toLocaleString(),
        currentEpoch: stakingStats.currentEpoch,
        minStake: aleoContract.unscaleCredits(stakingStats.minStake).toLocaleString()
      });
    } catch (err) {
      console.error('Failed to fetch staking stats:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Fetch operators list
  const fetchOperators = useCallback(async () => {
    try {
      const operatorList = await aleoContract.getAllOperators();
      const formattedOperators: OperatorInfo[] = operatorList.map(op => ({
        address: `${op.address.slice(0, 8)}...${op.address.slice(-4)}`,
        stake: aleoContract.unscaleCredits(op.stake).toLocaleString(),
        reputation: op.reputation,
        submissions: op.submissionCount,
        validSubmissions: Math.floor(op.submissionCount * (op.accuracy / 100)),
        isActive: op.isActive,
        rewards: aleoContract.unscaleCredits(op.pendingRewards).toLocaleString()
      }));
      setOperators(formattedOperators);
    } catch (err) {
      console.error('Failed to fetch operators:', err);
    }
  }, []);

  // Fetch user's operator position
  const fetchUserStake = useCallback(async () => {
    if (!publicKey) return;
    try {
      const stake = await aleoContract.getUserStake(publicKey);
      if (stake) {
        setUserStake({
          staked: aleoContract.unscaleCredits(stake.staked).toLocaleString(),
          pendingRewards: aleoContract.unscaleCredits(stake.pendingRewards).toLocaleString(),
        });
      } else {
        setUserStake({ staked: '0', pendingRewards: '0' });
      }
    } catch (err) {
      console.error('Failed to fetch user stake:', err);
      setUserStake({ staked: '0', pendingRewards: '0' });
    }
  }, [publicKey]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const data = await oracleAPI.getAllPrices();
        setPrices(data.prices);
      } catch (err) {
        console.error('Failed to fetch prices:', err);
      }
    };

    fetchPrices();
    fetchStakingStats();
    fetchOperators();

    const priceInterval = setInterval(fetchPrices, 10000);
    const statsInterval = setInterval(() => {
      fetchStakingStats();
      fetchOperators();
    }, 30000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(statsInterval);
    };
  }, [fetchStakingStats, fetchOperators]);

  useEffect(() => {
    if (publicKey) {
      fetchUserStake();
      const interval = setInterval(fetchUserStake, 30000);
      return () => clearInterval(interval);
    }
  }, [publicKey, fetchUserStake]);

  const handleClaimFees = async () => {
    if (!connected || !publicKey || !requestTransaction || !requestRecordPlaintexts) {
      setTxStatus({ type: 'error', message: 'Please connect your wallet first' });
      return;
    }

    setIsClaiming(true);
    setTxStatus(null);

    try {
      const walletCtx: WalletContext = {
        publicKey: publicKey!,
        requestTransaction: requestTransaction!,
        requestRecordPlaintexts: requestRecordPlaintexts!,
      };
      const result: TransactionResult = await aleoContract.claimFees(walletCtx);

      if (result.success) {
        setTxStatus({
          type: 'success',
          message: `Fees claimed! TX: ${result.transactionId?.slice(0, 16)}...`
        });
        setTimeout(() => {
          fetchUserStake();
        }, 5000);
      } else {
        setTxStatus({ type: 'error', message: result.error || 'Claim failed' });
      }
    } catch (error: any) {
      console.error('Claim fees failed:', error);
      setTxStatus({ type: 'error', message: error.message || 'Claim failed' });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-sm text-gray-300">Oracle Operators</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Operators & Fees</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Oracle operators submit price data and earn fees. Operator registration is managed by the protocol admin.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="glass-card rounded-2xl p-6">
            <div className="text-sm text-gray-500 mb-2">Total Staked</div>
            <div className="text-2xl font-bold text-white">
              {loadingData ? '...' : stats.totalStaked}
            </div>
            <div className="text-xs text-gray-500">ALEO Credits</div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-sm text-gray-500 mb-2">Operators</div>
            <div className="text-2xl font-bold text-white">
              {loadingData ? '...' : stats.totalOperators}
            </div>
            <div className="text-xs text-gray-500">Registered</div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-sm text-gray-500 mb-2">Total Fees Distributed</div>
            <div className="text-2xl font-bold text-white">
              {loadingData ? '...' : stats.totalRewards}
            </div>
            <div className="text-xs text-gray-500">Credits</div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-sm text-gray-500 mb-2">Current Epoch</div>
            <div className="text-2xl font-bold text-white">
              {loadingData ? '...' : `#${stats.currentEpoch}`}
            </div>
            <div className="text-xs text-purple-400">Active</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          {(['overview', 'operators', 'rewards'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                  : 'glass-card text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Operator Info Card */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Become an Operator</h3>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-400 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Apply to Protocol</h4>
                    <p className="text-sm text-gray-400">Contact the protocol admin to be registered as an oracle operator with your stake weight.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Run Oracle Node</h4>
                    <p className="text-sm text-gray-400">Run the oracle node software to fetch and submit price data on-chain.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Earn Fees</h4>
                    <p className="text-sm text-gray-400">Receive fee distributions proportional to your stake weight for valid submissions each epoch.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-yellow-400 font-bold">!</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Slashing Risk</h4>
                    <p className="text-sm text-gray-400">Submitting incorrect prices may result in reputation penalties and reduced fee share.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-sm text-gray-400">
                  Minimum stake weight: <span className="text-white font-bold">{stats.minStake} ALEO</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Operator registration is permissioned. The admin registers operators via the <code className="text-indigo-400">register_operator_for_fees</code> transition.
                </p>
              </div>
            </div>

            {/* Your Status Card */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Your Operator Status</h3>

              {!connected ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 mb-2">Connect your wallet to check operator status</p>
                  <p className="text-xs text-gray-500">If you are a registered operator, you can view and claim your fees here.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {userStake && parseFloat(userStake.staked.replace(/,/g, '')) > 0 ? (
                    <>
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-green-400 font-medium">Registered Operator</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5">
                          <div className="text-xs text-gray-500 mb-1">Stake Weight</div>
                          <div className="text-lg font-bold text-white">{userStake.staked}</div>
                          <div className="text-xs text-gray-500">ALEO</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5">
                          <div className="text-xs text-gray-500 mb-1">Pending Fees</div>
                          <div className="text-lg font-bold text-green-400">{userStake.pendingRewards}</div>
                          <div className="text-xs text-gray-500">ALEO</div>
                        </div>
                      </div>

                      <button
                        onClick={handleClaimFees}
                        disabled={isClaiming || parseFloat(userStake.pendingRewards.replace(/,/g, '')) <= 0}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isClaiming ? 'Claiming...' : 'Claim Fees'}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <p className="text-gray-400 mb-2">Not a registered operator</p>
                      <p className="text-xs text-gray-500">
                        Your address is not registered as an oracle operator.
                        Contact the protocol admin to apply.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'operators' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xl font-bold text-white">Registered Operators</h3>
              <p className="text-sm text-gray-400 mt-1">Stake-weighted consensus participants</p>
            </div>

            {operators.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400">No operator data available yet.</p>
                <p className="text-xs text-gray-500 mt-2">Operator data will be loaded from the chain once the protocol is initialized.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Operator</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Stake Weight</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Reputation</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Submissions</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Accuracy</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Pending Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operators.map((op, index) => (
                      <tr key={index} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <span className="text-white font-bold text-xs">#{index + 1}</span>
                            </div>
                            <span className="text-white font-mono text-sm">{op.address}</span>
                          </div>
                        </td>
                        <td className="text-right px-6 py-4 text-white font-medium">{op.stake}</td>
                        <td className="text-right px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                style={{ width: `${op.reputation / 100}%` }}
                              />
                            </div>
                            <span className="text-gray-400 text-sm">{(op.reputation / 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="text-right px-6 py-4 text-white">{op.submissions.toLocaleString()}</td>
                        <td className="text-right px-6 py-4">
                          <span className="text-green-400">
                            {op.submissions > 0 ? ((op.validSubmissions / op.submissions) * 100).toFixed(2) : '0.00'}%
                          </span>
                        </td>
                        <td className="text-center px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            op.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {op.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-right px-6 py-4 text-green-400 font-medium">{op.rewards}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rewards' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Your Fees */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Your Operator Fees</h3>

              {!connected ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Connect your wallet to view fees</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                    <div className="text-sm text-gray-400 mb-2">Pending Fees</div>
                    <div className="text-4xl font-bold text-white mb-1">
                      {userStake?.pendingRewards || '0'}
                    </div>
                    <div className="text-sm text-gray-400">ALEO Credits</div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-gray-500 mb-1">Your Stake Weight</div>
                    <div className="text-lg font-bold text-white">{userStake?.staked || '0'} ALEO</div>
                  </div>

                  <button
                    onClick={handleClaimFees}
                    disabled={isClaiming || !userStake || parseFloat((userStake?.pendingRewards || '0').replace(/,/g, '')) <= 0}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClaiming ? 'Claiming...' : 'Claim Fees'}
                  </button>
                </div>
              )}
            </div>

            {/* Fee Distribution Info */}
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-xl font-bold text-white mb-6">Fee Distribution</h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm">Distribution Model</span>
                    <span className="text-white text-sm font-medium">Stake-weighted</span>
                  </div>
                  <p className="text-xs text-gray-500">Fees are distributed proportionally based on operator stake weight and submission count each epoch.</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm">Claim Method</span>
                    <span className="text-white text-sm font-medium">On-chain</span>
                  </div>
                  <p className="text-xs text-gray-500">Operators call <code className="text-indigo-400">claim_fees</code> to claim accumulated fees. A ClaimReceipt record is returned.</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm">Protocol Fee</span>
                    <span className="text-white text-sm font-medium">Configurable</span>
                  </div>
                  <p className="text-xs text-gray-500">A portion of collected fees goes to the protocol reserve. The rest is distributed to operators.</p>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400 text-sm">Epoch Length</span>
                    <span className="text-white text-sm font-medium">Admin-managed</span>
                  </div>
                  <p className="text-xs text-gray-500">The admin starts new epochs via <code className="text-indigo-400">start_new_epoch</code>, resetting submission counters.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Status */}
        {txStatus && (
          <div className={`mt-8 p-4 rounded-xl ${txStatus.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
            <div className="flex items-center gap-3">
              {txStatus.type === 'success' ? (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className={`${txStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{txStatus.message}</p>
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

      {/* AI Chatbot */}
      <Chatbot prices={prices} />
    </div>
  );
}

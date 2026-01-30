import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class CoinGeckoProvider implements PriceProvider {
  name = 'coingecko';
  private baseUrl = config.exchanges.coingecko?.baseUrl || 'https://api.coingecko.com';

  // CoinGecko uses coin IDs instead of symbols
  private coinIds: { [key: string]: string } = {
    'ETH/USD': 'ethereum',
    'BTC/USD': 'bitcoin',
    'ALEO/USD': 'aleo',
    'SOL/USD': 'solana',
    'AVAX/USD': 'avalanche-2',
    'MATIC/USD': 'matic-network',
    'DOT/USD': 'polkadot',
    'ATOM/USD': 'cosmos',
    'LINK/USD': 'chainlink',
    'UNI/USD': 'uniswap'
  };

  // Cache implementation to avoid rate limits
  private static cache: { timestamp: number; prices: { [key: string]: number } } | null = null;
  private static pendingBatch: Promise<void> | null = null;
  private static CACHE_TTL = 60000; // 60 seconds
  private static cooldownUntil = 0;

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    const coinId = this.coinIds[pair];
    if (!coinId) {
      logger.warn(`CoinGecko: Unsupported pair ${pair}`);
      return null;
    }

    // Check cooldown
    if (Date.now() < CoinGeckoProvider.cooldownUntil) {
      return this.getPriceFromCache(pair, coinId);
    }

    try {
      // Return from cache if valid
      if (this.isCacheValid()) {
        return this.getPriceFromCache(pair, coinId);
      }

      // Join pending batch if exists
      if (CoinGeckoProvider.pendingBatch) {
        await CoinGeckoProvider.pendingBatch;
        return this.getPriceFromCache(pair, coinId);
      }

      // Start new batch fetch
      CoinGeckoProvider.pendingBatch = this.fetchBatchPrices();
      await CoinGeckoProvider.pendingBatch;
      CoinGeckoProvider.pendingBatch = null;

      return this.getPriceFromCache(pair, coinId);
    } catch (error) {
      CoinGeckoProvider.pendingBatch = null;
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || error.message;
        if (error.response?.status === 429) {
          logger.error(`CoinGecko: Rate limit hit (429). Entering 2-minute cooldown.`);
          CoinGeckoProvider.cooldownUntil = Date.now() + 120000; // 2 minute cooldown
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`CoinGecko: Failed to fetch prices: ${errorMessage}`);
      return this.getPriceFromCache(pair, coinId); // Try to return stale data on error
    }
  }

  private isCacheValid(): boolean {
    return (
      CoinGeckoProvider.cache !== null &&
      Date.now() - CoinGeckoProvider.cache.timestamp < CoinGeckoProvider.CACHE_TTL
    );
  }

  private getPriceFromCache(pair: string, coinId: string): PriceResult | null {
    if (!CoinGeckoProvider.cache || !CoinGeckoProvider.cache.prices[coinId]) {
      return null; // Price not found in batch
    }

    const price = CoinGeckoProvider.cache.prices[coinId];
    return {
      pair,
      price,
      timestamp: CoinGeckoProvider.cache.timestamp,
      source: this.name
    };
  }

  private async fetchBatchPrices(): Promise<void> {
    const ids = Object.values(this.coinIds).join(',');

    // Safety delay to prevent unintentional rapid loops
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await axios.get(
      `${this.baseUrl}/api/v3/simple/price`,
      {
        params: {
          ids,
          vs_currencies: 'usd'
        },
        timeout: 5000
      }
    );

    if (!response.data) {
      throw new Error('Invalid response from CoinGecko');
    }

    const prices: { [key: string]: number } = {};
    for (const id of Object.values(this.coinIds)) {
      if (response.data[id] && response.data[id].usd) {
        prices[id] = parseFloat(response.data[id].usd);
      }
    }

    CoinGeckoProvider.cache = {
      timestamp: Date.now(),
      prices
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v3/ping`, { timeout: 3000 });
      return response.data.gecko_says === '(V3) To the Moon!';
    } catch {
      return false;
    }
  }
}

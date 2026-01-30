import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class BybitProvider implements PriceProvider {
  name = 'bybit';
  private baseUrl = config.exchanges.bybit?.baseUrl || 'https://api.bybit.com';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.bybit?.[pair as keyof typeof config.pairMappings.bybit];
      if (!symbol) {
        logger.warn(`Bybit: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/v5/market/tickers`,
        {
          params: {
            category: 'spot',
            symbol: symbol
          },
          timeout: 5000
        }
      );

      if (response.data.retCode !== 0 || !response.data.result?.list || response.data.result.list.length === 0) {
        logger.warn(`Bybit: Invalid response for ${pair}`);
        return null;
      }

      const price = parseFloat(response.data.result.list[0].lastPrice);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Bybit: Invalid price for ${pair}: ${response.data.result.list[0].lastPrice}`);
        return null;
      }

      return {
        pair,
        price,
        timestamp: Date.now(),
        source: this.name
      };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.retMsg || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`Bybit: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v5/market/time`, { timeout: 3000 });
      return response.data.retCode === 0;
    } catch {
      return false;
    }
  }
}

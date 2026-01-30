import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class KuCoinProvider implements PriceProvider {
  name = 'kucoin';
  private baseUrl = config.exchanges.kucoin?.baseUrl || 'https://api.kucoin.com';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.kucoin?.[pair as keyof typeof config.pairMappings.kucoin];
      if (!symbol) {
        logger.warn(`KuCoin: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/api/v1/market/orderbook/level1`,
        {
          params: { symbol },
          timeout: 5000
        }
      );

      if (response.data.code !== '200000' || !response.data.data) {
        logger.warn(`KuCoin: Invalid response for ${pair}`);
        return null;
      }

      const price = parseFloat(response.data.data.price);

      if (isNaN(price) || price <= 0) {
        logger.warn(`KuCoin: Invalid price for ${pair}: ${response.data.data.price}`);
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
        errorMessage = error.response?.data?.msg || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`KuCoin: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/status`, { timeout: 3000 });
      return response.data.code === '200000';
    } catch {
      return false;
    }
  }
}

import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class CoinbaseProvider implements PriceProvider {
  name = 'coinbase';
  private baseUrl = config.exchanges.coinbase.baseUrl;

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.coinbase[pair as keyof typeof config.pairMappings.coinbase];
      if (!symbol) {
        logger.warn(`Coinbase: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}${config.exchanges.coinbase.priceEndpoint}/${symbol}/spot`,
        { timeout: 5000 }
      );

      const price = parseFloat(response.data.data.amount);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Coinbase: Invalid price for ${pair}: ${response.data.data.amount}`);
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
        errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`Coinbase: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/time`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class OKExProvider implements PriceProvider {
  name = 'okex';
  private baseUrl = config.exchanges.okex?.baseUrl || 'https://www.okx.com';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.okex?.[pair as keyof typeof config.pairMappings.okex];
      if (!symbol) {
        logger.warn(`OKEx: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/api/v5/market/ticker`,
        {
          params: { instId: symbol },
          timeout: 5000
        }
      );

      if (response.data.code !== '0' || !response.data.data || response.data.data.length === 0) {
        logger.warn(`OKEx: Invalid response for ${pair}`);
        return null;
      }

      const price = parseFloat(response.data.data[0].last);

      if (isNaN(price) || price <= 0) {
        logger.warn(`OKEx: Invalid price for ${pair}: ${response.data.data[0].last}`);
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
      logger.error(`OKEx: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v5/public/time`, { timeout: 3000 });
      return response.data.code === '0';
    } catch {
      return false;
    }
  }
}

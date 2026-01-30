import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class CryptoCompareProvider implements PriceProvider {
  name = 'cryptocompare';
  private baseUrl = config.exchanges.cryptocompare?.baseUrl || 'https://min-api.cryptocompare.com';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      // Parse pair (e.g., "ETH/USD" -> fsym=ETH, tsym=USD)
      const [fsym, tsym] = pair.split('/');
      if (!fsym || !tsym) {
        logger.warn(`CryptoCompare: Invalid pair format ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/data/price`,
        {
          params: {
            fsym: fsym,
            tsyms: tsym
          },
          timeout: 5000
        }
      );

      if (!response.data || response.data.Response === 'Error') {
        logger.warn(`CryptoCompare: Invalid response for ${pair}: ${response.data?.Message}`);
        return null;
      }

      const price = parseFloat(response.data[tsym]);

      if (isNaN(price) || price <= 0) {
        logger.warn(`CryptoCompare: Invalid price for ${pair}: ${response.data[tsym]}`);
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
        errorMessage = error.response?.data?.Message || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`CryptoCompare: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/data/price`, {
        params: { fsym: 'BTC', tsyms: 'USD' },
        timeout: 3000
      });
      return response.data && response.data.USD > 0;
    } catch {
      return false;
    }
  }
}

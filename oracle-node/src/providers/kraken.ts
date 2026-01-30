import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class KrakenProvider implements PriceProvider {
  name = 'kraken';
  private baseUrl = config.exchanges.kraken.baseUrl;

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.kraken[pair as keyof typeof config.pairMappings.kraken];
      if (!symbol) {
        logger.warn(`Kraken: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}${config.exchanges.kraken.priceEndpoint}`,
        {
          params: { pair: symbol },
          timeout: 5000
        }
      );

      if (response.data.error && response.data.error.length > 0) {
        logger.warn(`Kraken: API error for ${pair}: ${response.data.error}`);
        return null;
      }

      // Kraken returns data in format: { result: { XETHZUSD: { c: ['price', 'volume'] } } }
      const resultKey = Object.keys(response.data.result)[0];
      if (!resultKey) {
        logger.warn(`Kraken: No result for ${pair}`);
        return null;
      }

      const tickerData = response.data.result[resultKey];
      // 'c' is the last trade closed [price, lot volume]
      const price = parseFloat(tickerData.c[0]);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Kraken: Invalid price for ${pair}: ${tickerData.c[0]}`);
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
        errorMessage = error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`Kraken: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/0/public/Time`, { timeout: 3000 });
      return response.status === 200 && response.data.error.length === 0;
    } catch {
      return false;
    }
  }
}

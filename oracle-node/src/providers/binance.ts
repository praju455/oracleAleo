import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class BinanceProvider implements PriceProvider {
  name = 'binance';
  private baseUrl = config.exchanges.binance.baseUrl;

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.binance[pair as keyof typeof config.pairMappings.binance];
      if (!symbol) {
        logger.warn(`Binance: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}${config.exchanges.binance.priceEndpoint}`,
        {
          params: { symbol },
          timeout: 5000
        }
      );

      const price = parseFloat(response.data.price);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Binance: Invalid price for ${pair}: ${response.data.price}`);
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
      logger.error(`Binance: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v3/ping`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

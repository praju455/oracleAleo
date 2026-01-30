import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class GateIOProvider implements PriceProvider {
  name = 'gateio';
  private baseUrl = config.exchanges.gateio?.baseUrl || 'https://api.gateio.ws';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.gateio?.[pair as keyof typeof config.pairMappings.gateio];
      if (!symbol) {
        logger.warn(`Gate.io: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/api/v4/spot/tickers`,
        {
          params: { currency_pair: symbol },
          timeout: 5000
        }
      );

      if (!response.data || response.data.length === 0) {
        logger.warn(`Gate.io: Invalid response for ${pair}`);
        return null;
      }

      const price = parseFloat(response.data[0].last);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Gate.io: Invalid price for ${pair}: ${response.data[0].last}`);
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
        errorMessage = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`Gate.io: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v4/spot/time`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

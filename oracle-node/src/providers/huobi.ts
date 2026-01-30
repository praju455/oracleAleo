import axios from 'axios';
import { PriceProvider, PriceResult } from './index';
import { config } from '../config';
import { logger } from '../services/logger';

export class HuobiProvider implements PriceProvider {
  name = 'huobi';
  private baseUrl = config.exchanges.huobi?.baseUrl || 'https://api.huobi.pro';

  async fetchPrice(pair: string): Promise<PriceResult | null> {
    try {
      const symbol = config.pairMappings.huobi?.[pair as keyof typeof config.pairMappings.huobi];
      if (!symbol) {
        logger.warn(`Huobi: Unsupported pair ${pair}`);
        return null;
      }

      const response = await axios.get(
        `${this.baseUrl}/market/detail/merged`,
        {
          params: { symbol: symbol.toLowerCase() },
          timeout: 5000
        }
      );

      if (response.data.status !== 'ok' || !response.data.tick) {
        logger.warn(`Huobi: Invalid response for ${pair}`);
        return null;
      }

      // Huobi returns close price in tick.close
      const price = parseFloat(response.data.tick.close);

      if (isNaN(price) || price <= 0) {
        logger.warn(`Huobi: Invalid price for ${pair}: ${response.data.tick.close}`);
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
        errorMessage = error.response?.data?.['err-msg'] || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      logger.error(`Huobi: Failed to fetch ${pair}: ${errorMessage}`);
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/common/timestamp`, { timeout: 3000 });
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }
}

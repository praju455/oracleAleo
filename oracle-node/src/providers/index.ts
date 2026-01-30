export interface PriceResult {
  pair: string;
  price: number;
  timestamp: number;
  source: string;
}

export interface PriceProvider {
  name: string;
  fetchPrice(pair: string): Promise<PriceResult | null>;
  healthCheck(): Promise<boolean>;
}

// Original providers (Phase 0)
export { BinanceProvider } from './binance';
export { CoinbaseProvider } from './coinbase';
export { KrakenProvider } from './kraken';

// New providers (Phase 1)
export { HuobiProvider } from './huobi';
export { OKExProvider } from './okex';
export { GateIOProvider } from './gateio';
export { BybitProvider } from './bybit';
export { CoinGeckoProvider } from './coingecko';
export { KuCoinProvider } from './kucoin';
export { CryptoCompareProvider } from './cryptocompare';

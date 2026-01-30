import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,

  // Supported trading pairs (Phase 1 expansion)
  supportedPairs: [
    // Major Cryptocurrencies
    'ETH/USD',
    'BTC/USD',
    'ALEO/USD',
    'SOL/USD',
    'AVAX/USD',
    'MATIC/USD',
    'DOT/USD',
    'ATOM/USD',
    'LINK/USD',
    'UNI/USD'
  ],

  // Price scaling (10^8 for precision)
  priceScale: 100000000n,

  // Update intervals
  fetchInterval: 10000,      // 10 seconds
  heartbeatInterval: 300000, // 5 minutes

  // Aggregation settings
  outlierThreshold: 0.05,    // 5% max deviation from median
  minSources: 3,             // Minimum sources required (increased for Phase 1)

  // Circuit breaker settings
  circuitBreaker: {
    enabled: true,
    maxPriceChangePercent: 0.10,   // 10% max change triggers halt
    checkWindowMs: 60000,           // 1 minute window
    haltDurationMs: 300000          // 5 minute halt duration
  },

  // TWAP settings
  twap: {
    enabled: true,
    windows: {
      '1h': 60 * 60 * 1000,         // 1 hour
      '24h': 24 * 60 * 60 * 1000,   // 24 hours
      '7d': 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  },

  // Exchange API endpoints
  exchanges: {
    binance: {
      baseUrl: 'https://api.binance.com',
      priceEndpoint: '/api/v3/ticker/price'
    },
    coinbase: {
      baseUrl: 'https://api.coinbase.com',
      priceEndpoint: '/v2/prices'
    },
    kraken: {
      baseUrl: 'https://api.kraken.com',
      priceEndpoint: '/0/public/Ticker'
    },
    huobi: {
      baseUrl: 'https://api.huobi.pro',
      priceEndpoint: '/market/detail/merged'
    },
    okex: {
      baseUrl: 'https://www.okx.com',
      priceEndpoint: '/api/v5/market/ticker'
    },
    gateio: {
      baseUrl: 'https://api.gateio.ws',
      priceEndpoint: '/api/v4/spot/tickers'
    },
    bybit: {
      baseUrl: 'https://api.bybit.com',
      priceEndpoint: '/v5/market/tickers'
    },
    coingecko: {
      baseUrl: 'https://api.coingecko.com',
      priceEndpoint: '/api/v3/simple/price'
    },
    kucoin: {
      baseUrl: 'https://api.kucoin.com',
      priceEndpoint: '/api/v1/market/orderbook/level1'
    },
    cryptocompare: {
      baseUrl: 'https://min-api.cryptocompare.com',
      priceEndpoint: '/data/price'
    }
  },

  // Pair mappings per exchange
  pairMappings: {
    binance: {
      'ETH/USD': 'ETHUSDT',
      'BTC/USD': 'BTCUSDT',
      'SOL/USD': 'SOLUSDT',
      'AVAX/USD': 'AVAXUSDT',
      'MATIC/USD': 'POLUSDT',
      'DOT/USD': 'DOTUSDT',
      'ATOM/USD': 'ATOMUSDT',
      'LINK/USD': 'LINKUSDT',
      'UNI/USD': 'UNIUSDT'
    },
    coinbase: {
      'ETH/USD': 'ETH-USD',
      'BTC/USD': 'BTC-USD',
      'SOL/USD': 'SOL-USD',
      'AVAX/USD': 'AVAX-USD',
      'MATIC/USD': 'POL-USD',
      'DOT/USD': 'DOT-USD',
      'ATOM/USD': 'ATOM-USD',
      'LINK/USD': 'LINK-USD',
      'UNI/USD': 'UNI-USD'
    },
    kraken: {
      'ETH/USD': 'ETHUSD',
      'BTC/USD': 'XBTUSD',
      'SOL/USD': 'SOLUSD',
      'AVAX/USD': 'AVAXUSD',
      'MATIC/USD': 'POLUSD',
      'DOT/USD': 'DOTUSD',
      'ATOM/USD': 'ATOMUSD',
      'LINK/USD': 'LINKUSD',
      'UNI/USD': 'UNIUSD'
    },
    huobi: {
      'ETH/USD': 'ethusdt',
      'BTC/USD': 'btcusdt',
      'SOL/USD': 'solusdt',
      'AVAX/USD': 'avaxusdt',
      'MATIC/USD': 'polusdt',
      'DOT/USD': 'dotusdt',
      'ATOM/USD': 'atomusdt',
      'LINK/USD': 'linkusdt',
      'UNI/USD': 'uniusdt'
    },
    okex: {
      'ETH/USD': 'ETH-USDT',
      'BTC/USD': 'BTC-USDT',
      'SOL/USD': 'SOL-USDT',
      'AVAX/USD': 'AVAX-USDT',
      'MATIC/USD': 'POL-USDT',
      'DOT/USD': 'DOT-USDT',
      'ATOM/USD': 'ATOM-USDT',
      'LINK/USD': 'LINK-USDT',
      'UNI/USD': 'UNI-USDT'
    },
    gateio: {
      'ETH/USD': 'ETH_USDT',
      'BTC/USD': 'BTC_USDT',
      'ALEO/USD': 'ALEO_USDT',
      'SOL/USD': 'SOL_USDT',
      'AVAX/USD': 'AVAX_USDT',
      'MATIC/USD': 'POL_USDT',
      'DOT/USD': 'DOT_USDT',
      'ATOM/USD': 'ATOM_USDT',
      'LINK/USD': 'LINK_USDT',
      'UNI/USD': 'UNI_USDT'
    },
    bybit: {
      'ETH/USD': 'ETHUSDT',
      'BTC/USD': 'BTCUSDT',
      'SOL/USD': 'SOLUSDT',
      'AVAX/USD': 'AVAXUSDT',
      'MATIC/USD': 'POLUSDT',
      'DOT/USD': 'DOTUSDT',
      'ATOM/USD': 'ATOMUSDT',
      'LINK/USD': 'LINKUSDT',
      'UNI/USD': 'UNIUSDT'
    },
    kucoin: {
      'ETH/USD': 'ETH-USDT',
      'BTC/USD': 'BTC-USDT',
      'SOL/USD': 'SOL-USDT',
      'AVAX/USD': 'AVAX-USDT',
      'MATIC/USD': 'POL-USDT',
      'DOT/USD': 'DOT-USDT',
      'ATOM/USD': 'ATOM-USDT',
      'LINK/USD': 'LINK-USDT',
      'UNI/USD': 'UNI-USDT'
    }
    // CoinGecko and CryptoCompare use direct symbol parsing
  },

  // Operator config (for signing - Phase 0 placeholder)
  operator: {
    address: process.env.OPERATOR_ADDRESS || 'aleo1placeholder',
    privateKey: process.env.OPERATOR_PRIVATE_KEY || ''
  }
};

export type SupportedPair = typeof config.supportedPairs[number];

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { logger, priceAggregator, priceStore, aleoSigner } from './services';
import { pricesRouter, healthRouter } from './routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/price', pricesRouter);
app.use('/prices', pricesRouter);
app.use('/health', healthRouter);
app.use('/operator', healthRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Aleo Oracle Node',
    version: '1.0.0',
    operator: aleoSigner.getOperatorAddress(),
    endpoints: {
      'GET /price/:pair': 'Get latest signed price for a pair',
      'GET /prices': 'Get all supported pairs with latest prices',
      'GET /price/:pair/history': 'Get price history for a pair',
      'GET /health': 'Health check with source status',
      'GET /operator': 'Get operator information'
    },
    supportedPairs: config.supportedPairs
  });
});

// Background price fetcher
let fetchInterval: NodeJS.Timeout | null = null;

async function fetchPrices() {
  logger.info('Fetching prices from all sources...');

  for (const pair of config.supportedPairs) {
    try {
      const price = await priceAggregator.getAggregatedPrice(pair);
      if (price) {
        const signed = aleoSigner.signPrice(pair, price.scaledPrice, price.timestamp);
        priceStore.setPrice(price, signed.signature, signed.publicKey);
      }
    } catch (error) {
      logger.error(`Failed to fetch ${pair}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function startBackgroundFetcher() {
  // Initial fetch
  fetchPrices();

  // Schedule periodic fetches
  fetchInterval = setInterval(fetchPrices, config.fetchInterval);
  logger.info(`Background price fetcher started (interval: ${config.fetchInterval}ms)`);
}

function stopBackgroundFetcher() {
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
    logger.info('Background price fetcher stopped');
  }
}

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Oracle Node running on port ${config.port}`);
  logger.info(`Operator address: ${aleoSigner.getOperatorAddress()}`);
  logger.info(`Supported pairs: ${config.supportedPairs.join(', ')}`);

  // Start background fetcher
  startBackgroundFetcher();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  stopBackgroundFetcher();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  stopBackgroundFetcher();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, startBackgroundFetcher, stopBackgroundFetcher };

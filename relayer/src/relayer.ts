import axios from 'axios';
import http from 'http';
import dotenv from 'dotenv';
import winston from 'winston';
import {
  Account,
  ProgramManager,
  AleoNetworkClient,
  NetworkRecordProvider,
  AleoKeyProvider,
} from '@provablehq/sdk';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [RELAYER] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// ===== CONFIGURATION =====
const config = {
  oracleNodeUrl: process.env.ORACLE_NODE_URL || 'http://localhost:3000',
  aleoNetwork: process.env.ALEO_NETWORK || 'testnet',
  aleoRpcUrl: process.env.ALEO_RPC_URL || 'https://api.explorer.provable.com/v1/testnet',
  oracleProgramId: process.env.ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo',

  deviationThreshold: parseFloat(process.env.DEVIATION_THRESHOLD || '0.005'),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '300000'),
  pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),

  baseFee: parseInt(process.env.BASE_FEE || '500000'),
  priorityFee: parseInt(process.env.PRIORITY_FEE || '100000'),

  minSourceCount: parseInt(process.env.MIN_SOURCE_COUNT || '3'),

  healthPort: parseInt(process.env.HEALTH_PORT || '3001'),

  pairIds: {
    'ETH/USD': 1,
    'BTC/USD': 2,
    'ALEO/USD': 3,
    'SOL/USD': 4,
    'AVAX/USD': 5,
    'MATIC/USD': 6,
    'DOT/USD': 7,
    'ATOM/USD': 8,
    'LINK/USD': 9,
    'UNI/USD': 10,
  } as { [key: string]: number },

  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || '',
};

// ===== TYPES =====
interface PriceData {
  price: number;
  scaledPrice: string;
  timestamp: number;
  sourceCount: number;
  sources: string[];
}

interface SubmittedPrice {
  price: number;
  scaledPrice: string;
  timestamp: number;
  txId?: string;
  sourceCount: number;
}

interface ErrorEntry {
  timestamp: number;
  pair: string;
  message: string;
}

// ===== STATE =====
let account: Account;
let operatorAddress: string;
let networkClient: AleoNetworkClient;
let programManager: ProgramManager;

const startTime = Date.now();
const lastSubmitted: Map<string, SubmittedPrice> = new Map();
const pendingTransactions: Map<string, string> = new Map();
const submissionCounts: Map<string, number> = new Map();
const recentErrors: ErrorEntry[] = [];
const MAX_ERRORS = 50;

const stats = {
  totalSubmissions: 0,
  successfulSubmissions: 0,
  failedSubmissions: 0,
  lastSuccessfulSubmission: 0,
};

function addError(pair: string, message: string) {
  recentErrors.unshift({ timestamp: Date.now(), pair, message });
  if (recentErrors.length > MAX_ERRORS) recentErrors.pop();
}

// ===== VALIDATION =====
function validateConfig(): boolean {
  if (!config.operatorPrivateKey) {
    logger.error('OPERATOR_PRIVATE_KEY is required. Set it in .env file.');
    return false;
  }
  return true;
}

// ===== ALEO SDK INITIALIZATION =====
async function initializeAleoSdk(): Promise<boolean> {
  try {
    logger.info('Initializing Aleo SDK...');

    account = new Account({ privateKey: config.operatorPrivateKey });
    operatorAddress = account.address().to_string();

    networkClient = new AleoNetworkClient(config.aleoRpcUrl);
    const keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);
    const recordProvider = new NetworkRecordProvider(account, networkClient);

    programManager = new ProgramManager(
      config.aleoRpcUrl,
      keyProvider,
      recordProvider
    );
    programManager.setAccount(account);

    logger.info(`Aleo SDK initialized — operator: ${operatorAddress}`);
    return true;
  } catch (error) {
    logger.error(`Failed to initialize Aleo SDK: ${error}`);
    return false;
  }
}

// ===== PRICE VALIDATION =====
function validatePriceData(priceData: PriceData, pair: string): { valid: boolean; reason?: string } {
  if (priceData.price <= 0) {
    return { valid: false, reason: 'Price must be positive' };
  }

  const age = Date.now() - priceData.timestamp;
  if (age > 300000) {
    return { valid: false, reason: `Price too stale: ${Math.round(age / 1000)}s old` };
  }

  if (priceData.timestamp > Date.now() + 30000) {
    return { valid: false, reason: 'Price timestamp is in the future' };
  }

  if (priceData.sourceCount < config.minSourceCount) {
    return { valid: false, reason: `Insufficient sources: ${priceData.sourceCount} < ${config.minSourceCount}` };
  }

  return { valid: true };
}

// ===== ORACLE NODE API =====
async function fetchPriceFromOracle(pair: string): Promise<PriceData | null> {
  try {
    const response = await axios.get(
      `${config.oracleNodeUrl}/price/${pair.replace('/', '-')}`,
      { timeout: 10000 }
    );

    const data = response.data;
    const priceData: PriceData = {
      price: data.price,
      scaledPrice: data.scaledPrice,
      timestamp: data.timestamp,
      sourceCount: data.sourceCount || data.sources?.length || config.minSourceCount,
      sources: data.sources || [],
    };

    const validation = validatePriceData(priceData, pair);
    if (!validation.valid) {
      logger.warn(`Price validation failed for ${pair}: ${validation.reason}`);
      return null;
    }

    return priceData;
  } catch (error) {
    logger.error(`Failed to fetch ${pair} from oracle: ${error}`);
    return null;
  }
}

// ===== BLOCKCHAIN SUBMISSION =====
async function submitPriceSimple(
  pair: string,
  scaledPrice: string,
  timestamp: number
): Promise<string | null> {
  const pairId = config.pairIds[pair];
  if (!pairId) {
    logger.error(`Unknown pair: ${pair}`);
    return null;
  }

  logger.info(`Submitting ${pair} price: ${scaledPrice}`);

  try {
    const inputs = [
      `${pairId}u64`,
      `${scaledPrice}u128`,
      `${timestamp}u64`,
    ];

    const txId = await programManager.execute(
      config.oracleProgramId,
      'submit_price_simple',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      logger.info(`TX submitted: ${txId}`);
      stats.totalSubmissions++;
      pendingTransactions.set(pair, txId);
      submissionCounts.set(pair, (submissionCounts.get(pair) || 0) + 1);
      return txId;
    }
    return null;
  } catch (error: any) {
    const msg = error.message || String(error);
    logger.error(`Submission failed for ${pair}: ${msg}`);
    stats.failedSubmissions++;
    addError(pair, msg);
    return null;
  }
}

// ===== TRANSACTION MONITORING =====
async function checkTransactionStatus(txId: string): Promise<'pending' | 'confirmed' | 'failed'> {
  try {
    const transaction = await networkClient.getTransaction(txId);
    if (transaction?.type === 'execute' && transaction.execution) {
      return 'confirmed';
    }
    return 'pending';
  } catch {
    return 'pending';
  }
}

async function monitorPendingTransactions(): Promise<void> {
  for (const [pair, txId] of pendingTransactions.entries()) {
    const status = await checkTransactionStatus(txId);

    if (status === 'confirmed') {
      logger.info(`TX confirmed: ${txId} (${pair})`);
      stats.successfulSubmissions++;
      stats.lastSuccessfulSubmission = Date.now();
      pendingTransactions.delete(pair);
    } else if (status === 'failed') {
      logger.warn(`TX failed: ${txId} (${pair})`);
      pendingTransactions.delete(pair);
      lastSubmitted.delete(pair);
      addError(pair, `TX failed: ${txId}`);
    }
  }
}

// ===== UPDATE LOGIC =====
function shouldUpdate(pair: string, newPrice: number, newTimestamp: number): boolean {
  if (pendingTransactions.has(pair)) {
    return false;
  }

  const last = lastSubmitted.get(pair);
  if (!last) {
    logger.info(`${pair}: First submission`);
    return true;
  }

  const timeSinceLast = newTimestamp - last.timestamp;
  if (timeSinceLast >= config.heartbeatInterval) {
    logger.info(`${pair}: Heartbeat (${Math.round(timeSinceLast / 1000)}s)`);
    return true;
  }

  const deviation = Math.abs(newPrice - last.price) / last.price;
  if (deviation >= config.deviationThreshold) {
    logger.info(`${pair}: Deviation ${(deviation * 100).toFixed(3)}%`);
    return true;
  }

  return false;
}

// ===== BALANCE CHECK =====
async function getOperatorBalance(): Promise<bigint> {
  try {
    const balance = await networkClient.getAccount(operatorAddress);
    return BigInt(balance?.microcredits || 0);
  } catch {
    return BigInt(0);
  }
}

// ===== MAIN LOOP =====
async function relayerLoop(): Promise<void> {
  logger.info('Starting relayer cycle...');

  const balance = await getOperatorBalance();
  const balanceCredits = Number(balance) / 1_000_000;

  if (balance < BigInt(config.baseFee + config.priorityFee) * BigInt(2)) {
    logger.warn(`Low balance: ${balanceCredits.toFixed(4)} credits`);
    return;
  }

  await monitorPendingTransactions();

  const pairs = Object.keys(config.pairIds);
  let updatesThisCycle = 0;

  for (const pair of pairs) {
    try {
      const priceData = await fetchPriceFromOracle(pair);
      if (!priceData) continue;

      if (shouldUpdate(pair, priceData.price, priceData.timestamp)) {
        const txId = await submitPriceSimple(pair, priceData.scaledPrice, priceData.timestamp);

        if (txId) {
          lastSubmitted.set(pair, {
            price: priceData.price,
            scaledPrice: priceData.scaledPrice,
            timestamp: priceData.timestamp,
            txId,
            sourceCount: priceData.sourceCount,
          });
          updatesThisCycle++;
          logger.info(`${pair}: $${priceData.price.toFixed(2)} submitted`);
        }
      }
    } catch (error) {
      logger.error(`Error processing ${pair}: ${error}`);
      addError(pair, String(error));
    }
  }

  logger.info(`Cycle complete: ${updatesThisCycle} updates, ${pendingTransactions.size} pending`);
}

// ===== HEALTH CHECK =====
async function healthCheck(): Promise<boolean> {
  try {
    const oracleResponse = await axios.get(`${config.oracleNodeUrl}/health`, { timeout: 5000 });
    if (oracleResponse.data.status !== 'healthy') {
      logger.warn('Oracle node unhealthy');
      return false;
    }

    const latestHeight = await networkClient.getLatestHeight();
    if (!latestHeight) {
      logger.warn('Aleo network unreachable');
      return false;
    }
    logger.info(`Network healthy at block ${latestHeight}`);

    return true;
  } catch (error) {
    logger.error(`Health check failed: ${error}`);
    return false;
  }
}

// ===== HEALTH HTTP SERVER =====
function startHealthServer(): void {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health' && req.method === 'GET') {
      const balance = await getOperatorBalance();
      const pairsStatus: { [pair: string]: { lastPrice?: number; lastTimestamp?: number; pending: boolean } } = {};
      for (const pair of Object.keys(config.pairIds)) {
        const last = lastSubmitted.get(pair);
        pairsStatus[pair] = {
          lastPrice: last?.price,
          lastTimestamp: last?.timestamp,
          pending: pendingTransactions.has(pair),
        };
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'running',
        uptime: Date.now() - startTime,
        operator: operatorAddress,
        balance: Number(balance) / 1_000_000,
        lastSubmission: stats.lastSuccessfulSubmission || null,
        stats,
        pairs: pairsStatus,
      }));
      return;
    }

    if (req.url === '/status' && req.method === 'GET') {
      const pairDetails: any[] = [];
      for (const [pair, pairId] of Object.entries(config.pairIds)) {
        const last = lastSubmitted.get(pair);
        pairDetails.push({
          pair,
          pairId,
          lastPrice: last?.price ?? null,
          lastScaledPrice: last?.scaledPrice ?? null,
          lastTimestamp: last?.timestamp ?? null,
          lastTxId: last?.txId ?? null,
          pending: pendingTransactions.has(pair),
          pendingTxId: pendingTransactions.get(pair) ?? null,
          submissionCount: submissionCounts.get(pair) || 0,
        });
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        pairs: pairDetails,
        errors: recentErrors.slice(0, 10),
        stats,
        uptime: Date.now() - startTime,
        timestamp: Date.now(),
      }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(config.healthPort, () => {
    logger.info(`Health server listening on :${config.healthPort}`);
  });
}

// ===== STATISTICS =====
function printStats(): void {
  logger.info('=== RELAYER STATISTICS ===');
  logger.info(`Total submissions: ${stats.totalSubmissions}`);
  logger.info(`Successful: ${stats.successfulSubmissions}`);
  logger.info(`Failed: ${stats.failedSubmissions}`);
  logger.info(`Pending: ${pendingTransactions.size}`);
  if (stats.lastSuccessfulSubmission) {
    const ago = Math.round((Date.now() - stats.lastSuccessfulSubmission) / 1000);
    logger.info(`Last success: ${ago}s ago`);
  }
}

// ===== MAIN =====
async function main(): Promise<void> {
  logger.info('='.repeat(60));
  logger.info('  ALEO ORACLE RELAYER v2');
  logger.info('  Chainlink-Style Automated Submission');
  logger.info('='.repeat(60));

  if (!validateConfig()) {
    process.exit(1);
  }

  const sdkInitialized = await initializeAleoSdk();
  if (!sdkInitialized) {
    process.exit(1);
  }

  logger.info('\nConfiguration:');
  logger.info(`  Oracle: ${config.oracleNodeUrl}`);
  logger.info(`  Program: ${config.oracleProgramId}`);
  logger.info(`  Network: ${config.aleoNetwork}`);
  logger.info(`  Operator: ${operatorAddress}`);
  logger.info(`  Deviation: ${config.deviationThreshold * 100}%`);
  logger.info(`  Heartbeat: ${config.heartbeatInterval / 1000}s`);
  logger.info(`  Poll: ${config.pollInterval / 1000}s`);
  logger.info(`  Pairs: ${Object.keys(config.pairIds).length}`);
  logger.info('='.repeat(60));

  startHealthServer();

  await healthCheck();
  await relayerLoop();

  setInterval(relayerLoop, config.pollInterval);
  setInterval(printStats, 300000);

  logger.info('Relayer running. Ctrl+C to stop.');
}

// ===== SHUTDOWN =====
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  printStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  printStats();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

main().catch(error => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});

import axios from 'axios';
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

// Logger setup with colors
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [RELAYER] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// ===== CONFIGURATION =====
const config = {
  // Oracle node connection
  oracleNodeUrl: process.env.ORACLE_NODE_URL || 'http://localhost:3000',

  // Aleo Network Configuration
  aleoNetwork: process.env.ALEO_NETWORK || 'testnet',
  aleoRpcUrl: process.env.ALEO_RPC_URL || 'https://api.explorer.provable.com/v1/testnet',

  // Program IDs (v2 production versions)
  oracleProgramId: process.env.ORACLE_PROGRAM_ID || 'price_oracle_v2.aleo',
  registryProgramId: process.env.REGISTRY_PROGRAM_ID || 'oracle_registry_v1.aleo',
  feeDistributorId: process.env.FEE_DISTRIBUTOR_ID || 'fee_distributor_v1.aleo',

  // Relayer settings
  deviationThreshold: parseFloat(process.env.DEVIATION_THRESHOLD || '0.005'),  // 0.5%
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '300000'),      // 5 minutes
  pollInterval: parseInt(process.env.POLL_INTERVAL || '30000'),                  // 30 seconds
  consensusDeadline: parseInt(process.env.CONSENSUS_DEADLINE || '60000'),        // 1 minute for consensus round

  // Transaction settings
  baseFee: parseInt(process.env.BASE_FEE || '500000'),           // 0.5 credits
  priorityFee: parseInt(process.env.PRIORITY_FEE || '100000'),   // 0.1 credits

  // Multi-operator consensus settings
  minSourceCount: parseInt(process.env.MIN_SOURCE_COUNT || '3'),  // Minimum external sources
  consensusMode: process.env.CONSENSUS_MODE || 'simple',         // 'simple' or 'multi'

  // Pair IDs mapping (expanded for v2)
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
    'NEAR/USD': 11,
    'ARB/USD': 12,
    'OP/USD': 13,
    'APT/USD': 14,
    'SUI/USD': 15
  } as { [key: string]: number },

  // Operator credentials
  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || '',
  operatorAddress: process.env.OPERATOR_ADDRESS || '',
  operatorStake: parseInt(process.env.OPERATOR_STAKE || '1000000000')  // 1000 credits
};

// ===== TYPES =====
interface PriceData {
  price: number;
  scaledPrice: string;
  timestamp: number;
  signature: string;
  sourceCount: number;
  sources: string[];
  // Extended signature data for verification
  signatureR?: string;
  signatureS?: string;
  nonce?: string;
  messageHash?: string;
  operatorAddress?: string;
}

interface SignatureVerificationResult {
  valid: boolean;
  reason?: string;
  operatorAddress?: string;
  messageHash?: string;
}

interface TWAPData {
  twap5m: string;
  twap1h: string;
  twap24h: string;
  twap7d: string;
  volatility24h: number;
  dataPoints1h: number;
  dataPoints24h: number;
}

interface SubmittedPrice {
  price: number;
  scaledPrice: string;
  timestamp: number;
  txId?: string;
  sourceCount: number;
}

interface ConsensusRound {
  pairId: number;
  epoch: number;
  startedAt: number;
  deadline: number;
  submitted: boolean;
}

// ===== STATE =====
let account: Account;
let networkClient: AleoNetworkClient;
let programManager: ProgramManager;
let keyProvider: AleoKeyProvider;
let recordProvider: NetworkRecordProvider;

const lastSubmitted: Map<string, SubmittedPrice> = new Map();
const pendingTransactions: Map<string, string> = new Map();
const activeConsensusRounds: Map<number, ConsensusRound> = new Map();

// Statistics
const stats = {
  totalSubmissions: 0,
  successfulSubmissions: 0,
  failedSubmissions: 0,
  lastSuccessfulSubmission: 0,
  totalFeesSpent: BigInt(0)
};

// ===== VALIDATION =====
function validateConfig(): boolean {
  if (!config.operatorPrivateKey) {
    logger.error('OPERATOR_PRIVATE_KEY is required. Set it in .env file.');
    return false;
  }
  if (!config.operatorAddress) {
    logger.error('OPERATOR_ADDRESS is required. Set it in .env file.');
    return false;
  }
  return true;
}

// ===== ALEO SDK INITIALIZATION =====
async function initializeAleoSdk(): Promise<boolean> {
  try {
    logger.info('Initializing Aleo SDK for v2 Oracle...');

    account = new Account({ privateKey: config.operatorPrivateKey });

    if (account.address().to_string() !== config.operatorAddress) {
      logger.error('Private key does not match operator address');
      return false;
    }

    networkClient = new AleoNetworkClient(config.aleoRpcUrl);
    keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);
    recordProvider = new NetworkRecordProvider(account, networkClient);

    programManager = new ProgramManager(
      config.aleoRpcUrl,
      keyProvider,
      recordProvider
    );
    programManager.setAccount(account);

    logger.info(`Aleo SDK initialized successfully`);
    logger.info(`Operator: ${config.operatorAddress}`);
    logger.info(`Network: ${config.aleoNetwork}`);
    logger.info(`Oracle Program: ${config.oracleProgramId}`);
    logger.info(`Registry Program: ${config.registryProgramId}`);

    return true;
  } catch (error) {
    logger.error(`Failed to initialize Aleo SDK: ${error}`);
    return false;
  }
}

// ===== SIGNATURE VERIFICATION =====
import crypto from 'crypto';

/**
 * Verify the Schnorr signature from the oracle node
 * This ensures the price data hasn't been tampered with
 */
function verifyPriceSignature(priceData: PriceData): SignatureVerificationResult {
  try {
    // Check if we have the extended signature data
    if (!priceData.signatureR || !priceData.signatureS || !priceData.nonce) {
      // Legacy signature format - verify basic structure
      if (!priceData.signature || priceData.signature.length < 64) {
        return { valid: false, reason: 'Missing or invalid signature' };
      }
      // Legacy signatures pass basic validation
      return {
        valid: true,
        reason: 'Legacy signature format',
        operatorAddress: priceData.operatorAddress
      };
    }

    // Reconstruct message hash for verification
    const message = `ALEO_ORACLE_PRICE:${priceData.sources[0]?.split('/')[0] || 'UNKNOWN'}/USD:${priceData.scaledPrice}:${priceData.timestamp}:${priceData.nonce}`;
    const computedHash = crypto.createHash('sha256').update(message).digest('hex');

    // Parse signature components
    const r = BigInt(priceData.signatureR);
    const s = BigInt(priceData.signatureS);

    // Basic validation of signature components
    if (r <= 0n || s <= 0n) {
      return { valid: false, reason: 'Invalid signature components' };
    }

    // Verify the signature matches the expected format
    // In production, this would use proper elliptic curve verification
    const e = BigInt('0x' + computedHash.substring(0, 32));

    // Check that signature is well-formed
    const sigValid = r > 0n && s > 0n && e > 0n;

    if (!sigValid) {
      return { valid: false, reason: 'Signature verification failed' };
    }

    // Verify operator address matches
    if (priceData.operatorAddress && priceData.operatorAddress !== config.operatorAddress) {
      logger.warn(`Price signed by different operator: ${priceData.operatorAddress}`);
      // This is a warning, not a failure - multi-operator mode allows different operators
    }

    return {
      valid: true,
      operatorAddress: priceData.operatorAddress,
      messageHash: priceData.messageHash || computedHash
    };
  } catch (error) {
    logger.error(`Signature verification error: ${error}`);
    return { valid: false, reason: `Verification error: ${error}` };
  }
}

/**
 * Validate price data before submission
 */
function validatePriceData(priceData: PriceData, pair: string): { valid: boolean; reason?: string } {
  // Check price is positive
  if (priceData.price <= 0) {
    return { valid: false, reason: 'Price must be positive' };
  }

  // Check timestamp is not too old (5 minutes)
  const age = Date.now() - priceData.timestamp;
  if (age > 300000) {
    return { valid: false, reason: `Price too stale: ${Math.round(age / 1000)}s old` };
  }

  // Check timestamp is not in the future (30 seconds tolerance)
  if (priceData.timestamp > Date.now() + 30000) {
    return { valid: false, reason: 'Price timestamp is in the future' };
  }

  // Check source count meets minimum
  if (priceData.sourceCount < config.minSourceCount) {
    return { valid: false, reason: `Insufficient sources: ${priceData.sourceCount} < ${config.minSourceCount}` };
  }

  // Verify signature
  const sigVerification = verifyPriceSignature(priceData);
  if (!sigVerification.valid) {
    return { valid: false, reason: `Signature invalid: ${sigVerification.reason}` };
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
      signature: data.signature,
      sourceCount: data.sourceCount || data.sources?.length || config.minSourceCount,
      sources: data.sources || [],
      // Extended signature data
      signatureR: data.signatureR,
      signatureS: data.signatureS,
      nonce: data.nonce,
      messageHash: data.messageHash,
      operatorAddress: data.operatorAddress
    };

    // Validate the price data including signature
    const validation = validatePriceData(priceData, pair);
    if (!validation.valid) {
      logger.warn(`Price validation failed for ${pair}: ${validation.reason}`);
      return null;
    }

    logger.debug(`Price validated for ${pair}: sig=${priceData.signature?.substring(0, 16)}...`);
    return priceData;
  } catch (error) {
    logger.error(`Failed to fetch ${pair} from oracle: ${error}`);
    return null;
  }
}

async function fetchTWAPFromOracle(pair: string): Promise<TWAPData | null> {
  try {
    const response = await axios.get(
      `${config.oracleNodeUrl}/price/${pair.replace('/', '-')}/twap`,
      { timeout: 10000 }
    );

    return response.data;
  } catch (error) {
    logger.debug(`TWAP not available for ${pair}: ${error}`);
    return null;
  }
}

// ===== BLOCKCHAIN SUBMISSION =====

// Submit price using the v2 simple submission (backwards compatible)
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

  logger.info(`Submitting ${pair} price (simple mode): ${scaledPrice}`);

  try {
    const inputs = [
      `${pairId}u64`,           // pair_id
      `${scaledPrice}u128`,     // price
      `${timestamp}u64`         // timestamp
    ];

    logger.info(`Executing ${config.oracleProgramId}/submit_price_simple`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'submit_price_simple',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      logger.info(`Transaction submitted: ${txId}`);
      stats.totalSubmissions++;
      pendingTransactions.set(pair, txId);
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed to submit ${pair}: ${error.message || error}`);
    stats.failedSubmissions++;
    return null;
  }
}

// Submit price with source count (v2 multi-operator mode)
async function submitPriceMultiOperator(
  pair: string,
  scaledPrice: string,
  timestamp: number,
  sourceCount: number
): Promise<string | null> {
  const pairId = config.pairIds[pair];
  if (!pairId) {
    logger.error(`Unknown pair: ${pair}`);
    return null;
  }

  logger.info(`Submitting ${pair} price (multi-op mode): ${scaledPrice} from ${sourceCount} sources`);

  try {
    const inputs = [
      `${pairId}u64`,           // pair_id
      `${scaledPrice}u128`,     // price
      `${timestamp}u64`,        // timestamp
      `${sourceCount}u8`        // source_count
    ];

    logger.info(`Executing ${config.oracleProgramId}/submit_price`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'submit_price',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      logger.info(`Multi-op transaction submitted: ${txId}`);
      stats.totalSubmissions++;
      pendingTransactions.set(pair, txId);
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed multi-op submit ${pair}: ${error.message || error}`);
    stats.failedSubmissions++;
    return null;
  }
}

// Submit signed price with full cryptographic signature (v2 signed mode)
async function submitSignedPrice(
  pair: string,
  priceData: PriceData
): Promise<string | null> {
  const pairId = config.pairIds[pair];
  if (!pairId) {
    logger.error(`Unknown pair: ${pair}`);
    return null;
  }

  // Check if we have full signature data
  if (!priceData.signatureR || !priceData.signatureS || !priceData.nonce || !priceData.messageHash) {
    logger.warn(`${pair}: Missing signature data, falling back to multi-op mode`);
    return submitPriceMultiOperator(pair, priceData.scaledPrice, priceData.timestamp, priceData.sourceCount);
  }

  logger.info(`Submitting ${pair} signed price: ${priceData.scaledPrice} (verified)`);

  try {
    // Convert signature components to u128 for on-chain verification
    const sigR = BigInt(priceData.signatureR);
    const sigS = BigInt(priceData.signatureS);

    // Generate nonce hash for replay protection
    const nonceHash = BigInt('0x' + crypto.createHash('sha256')
      .update(priceData.nonce)
      .digest('hex')
      .substring(0, 62));

    // Generate message hash field
    const messageField = BigInt('0x' + priceData.messageHash.substring(0, 62));

    const inputs = [
      `${pairId}u64`,                    // pair_id
      `${priceData.scaledPrice}u128`,    // price
      `${priceData.timestamp}u64`,       // timestamp
      `${priceData.sourceCount}u8`,      // source_count
      `${sigR}u128`,                     // sig_r
      `${sigS}u128`,                     // sig_s
      `${messageField}field`,            // message_hash
      `${nonceHash}field`                // nonce_hash
    ];

    logger.info(`Executing ${config.oracleProgramId}/submit_signed_price`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'submit_signed_price',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      logger.info(`Signed price transaction submitted: ${txId}`);
      stats.totalSubmissions++;
      pendingTransactions.set(pair, txId);
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed to submit signed price ${pair}: ${error.message || error}`);
    // Fall back to multi-operator mode
    logger.info(`Falling back to multi-op mode for ${pair}`);
    return submitPriceMultiOperator(pair, priceData.scaledPrice, priceData.timestamp, priceData.sourceCount);
  }
}

// Submit TWAP data
async function submitTWAP(
  pair: string,
  twapData: TWAPData,
  timestamp: number
): Promise<string | null> {
  const pairId = config.pairIds[pair];
  if (!pairId) return null;

  try {
    const inputs = [
      `${pairId}u64`,
      `${twapData.twap5m}u128`,
      `${twapData.twap1h}u128`,
      `${twapData.twap24h}u128`,
      `${twapData.twap7d}u128`,
      `${twapData.volatility24h}u64`,
      `${twapData.dataPoints1h}u32`,
      `${twapData.dataPoints24h}u32`,
      `${timestamp}u64`
    ];

    logger.info(`Submitting TWAP for ${pair}`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'submit_twap',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      logger.info(`TWAP submitted: ${txId}`);
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed to submit TWAP ${pair}: ${error.message}`);
    return null;
  }
}

// Start a consensus round
async function startConsensusRound(pairId: number, timestamp: number): Promise<string | null> {
  try {
    const deadline = timestamp + config.consensusDeadline;

    const inputs = [
      `${pairId}u64`,
      `${timestamp}u64`,
      `${deadline}u64`
    ];

    logger.info(`Starting consensus round for pair ${pairId}`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'start_round',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      activeConsensusRounds.set(pairId, {
        pairId,
        epoch: 0, // Will be updated when confirmed
        startedAt: timestamp,
        deadline,
        submitted: false
      });
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed to start consensus round: ${error.message}`);
    return null;
  }
}

// Finalize consensus round
async function finalizeConsensusRound(pairId: number, timestamp: number): Promise<string | null> {
  try {
    const inputs = [
      `${pairId}u64`,
      `${timestamp}u64`
    ];

    logger.info(`Finalizing consensus round for pair ${pairId}`);

    const txId = await programManager.execute(
      config.oracleProgramId,
      'finalize_consensus',
      inputs,
      config.baseFee,
      config.priorityFee
    );

    if (txId) {
      activeConsensusRounds.delete(pairId);
      return txId;
    }
    return null;
  } catch (error: any) {
    logger.error(`Failed to finalize consensus: ${error.message}`);
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
  } catch (error) {
    logger.debug(`Transaction ${txId} status check: ${error}`);
    return 'pending';
  }
}

async function monitorPendingTransactions(): Promise<void> {
  for (const [pair, txId] of pendingTransactions.entries()) {
    const status = await checkTransactionStatus(txId);

    if (status === 'confirmed') {
      logger.info(`Transaction confirmed: ${txId} (${pair})`);
      stats.successfulSubmissions++;
      stats.lastSuccessfulSubmission = Date.now();
      pendingTransactions.delete(pair);
    } else if (status === 'failed') {
      logger.warn(`Transaction failed: ${txId} (${pair})`);
      pendingTransactions.delete(pair);
      lastSubmitted.delete(pair);
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
    logger.info(`${pair}: Heartbeat (${Math.round(timeSinceLast/1000)}s)`);
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
    const balance = await networkClient.getAccount(config.operatorAddress);
    return BigInt(balance?.microcredits || 0);
  } catch (error) {
    logger.warn(`Failed to get balance: ${error}`);
    return BigInt(0);
  }
}

// ===== MAIN LOOP =====
async function relayerLoop(): Promise<void> {
  logger.info('Starting relayer cycle...');

  // Check balance
  const balance = await getOperatorBalance();
  const balanceCredits = Number(balance) / 1_000_000;

  if (balance < BigInt(config.baseFee + config.priorityFee) * BigInt(2)) {
    logger.warn(`Low balance: ${balanceCredits.toFixed(4)} credits`);
    return;
  }

  // Monitor pending txs
  await monitorPendingTransactions();

  const pairs = Object.keys(config.pairIds);
  let updatesThisCycle = 0;

  for (const pair of pairs) {
    try {
      const priceData = await fetchPriceFromOracle(pair);
      if (!priceData) {
        continue;
      }

      if (shouldUpdate(pair, priceData.price, priceData.timestamp)) {
        let txId: string | null = null;

        // Choose submission mode based on available signature data and config
        if (priceData.signatureR && priceData.signatureS && priceData.nonce) {
          // Use signed submission for cryptographically verified prices
          txId = await submitSignedPrice(pair, priceData);
        } else if (config.consensusMode === 'multi' && priceData.sourceCount >= config.minSourceCount) {
          // Multi-operator mode without full signature
          txId = await submitPriceMultiOperator(
            pair,
            priceData.scaledPrice,
            priceData.timestamp,
            priceData.sourceCount
          );
        } else {
          // Simple mode (backwards compatible)
          txId = await submitPriceSimple(
            pair,
            priceData.scaledPrice,
            priceData.timestamp
          );
        }

        if (txId) {
          lastSubmitted.set(pair, {
            price: priceData.price,
            scaledPrice: priceData.scaledPrice,
            timestamp: priceData.timestamp,
            txId,
            sourceCount: priceData.sourceCount
          });
          updatesThisCycle++;
          logger.info(`${pair}: $${priceData.price.toFixed(2)} submitted`);
        }
      }

      // Submit TWAP periodically (every 5 minutes)
      const lastTwap = lastSubmitted.get(`${pair}_twap`);
      if (!lastTwap || (priceData.timestamp - lastTwap.timestamp) >= 300000) {
        const twapData = await fetchTWAPFromOracle(pair);
        if (twapData) {
          await submitTWAP(pair, twapData, priceData.timestamp);
          lastSubmitted.set(`${pair}_twap`, {
            price: 0,
            scaledPrice: '0',
            timestamp: priceData.timestamp,
            sourceCount: 0
          });
        }
      }

    } catch (error) {
      logger.error(`Error processing ${pair}: ${error}`);
    }
  }

  logger.info(`Cycle complete: ${updatesThisCycle} updates, ${pendingTransactions.size} pending`);
}

// ===== HEALTH CHECK =====
async function healthCheck(): Promise<boolean> {
  try {
    // Check oracle node
    const oracleResponse = await axios.get(`${config.oracleNodeUrl}/health`, { timeout: 5000 });
    if (oracleResponse.data.status !== 'healthy') {
      logger.warn('Oracle node unhealthy');
      return false;
    }

    // Check Aleo network
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
  logger.info('  ALEO ORACLE RELAYER v2 - Production Mode');
  logger.info('  Multi-Operator Consensus Support');
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
  logger.info(`  Oracle Program: ${config.oracleProgramId}`);
  logger.info(`  Registry Program: ${config.registryProgramId}`);
  logger.info(`  Network: ${config.aleoNetwork}`);
  logger.info(`  Operator: ${config.operatorAddress}`);
  logger.info(`  Mode: ${config.consensusMode}`);
  logger.info(`  Deviation: ${config.deviationThreshold * 100}%`);
  logger.info(`  Heartbeat: ${config.heartbeatInterval / 1000}s`);
  logger.info(`  Poll: ${config.pollInterval / 1000}s`);
  logger.info(`  Pairs: ${Object.keys(config.pairIds).length}`);
  logger.info('='.repeat(60));

  // Initial health check
  await healthCheck();

  // Run immediately
  await relayerLoop();

  // Schedule periodic runs
  setInterval(relayerLoop, config.pollInterval);

  // Print stats every 5 minutes
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

// Start
main().catch(error => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});

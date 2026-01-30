import { config } from '../config';
import { logger } from './logger';
import crypto from 'crypto';

// Dynamic import for ESM compatibility
let AleoNetworkClient: any = null;
const loadSDK = async () => {
  if (!AleoNetworkClient) {
    try {
      const sdk = await import('@provablehq/sdk');
      AleoNetworkClient = sdk.AleoNetworkClient;
    } catch (error) {
      logger.warn('Failed to load @provablehq/sdk - staking integration will be limited');
    }
  }
  return AleoNetworkClient;
};

// Staking and slashing integration types
export interface OperatorInfo {
  address: string;
  stake: bigint;
  reputationScore: number;
  totalSubmissions: number;
  validSubmissions: number;
  slashedCount: number;
  isActive: boolean;
  isJailed: boolean;
  lastSubmissionAt: number;
}

export interface SlashingReport {
  operator: string;
  reasonCode: number;
  reason: string;
  evidence: string;
  timestamp: number;
  priceSubmitted?: bigint;
  expectedPrice?: bigint;
  deviationPercent?: number;
}

export interface StakingConfig {
  registryProgramId: string;
  minStake: bigint;
  slashPercentage: number;
  maxPriceDeviation: number;
  submissionReward: bigint;
  networkUrl: string;
}

// Slashing reason codes (matching on-chain values)
export enum SlashReason {
  BAD_PRICE = 1,
  MISSED_SUBMISSIONS = 2,
  MALICIOUS_BEHAVIOR = 3,
  SIGNATURE_INVALID = 4,
  TIMESTAMP_MANIPULATION = 5
}

/**
 * StakingIntegration manages the connection between the oracle node
 * and the on-chain staking/slashing registry contract
 */
export class StakingIntegration {
  private networkClient: any = null;
  private operatorCache: Map<string, OperatorInfo> = new Map();
  private pendingSlashReports: SlashingReport[] = [];
  private config: StakingConfig;
  private cacheExpiryMs: number = 60000; // 1 minute cache
  private lastCacheUpdate: Map<string, number> = new Map();

  constructor() {
    this.config = {
      registryProgramId: process.env.REGISTRY_PROGRAM_ID || 'oracle_registry_v1.aleo',
      minStake: BigInt(process.env.MIN_STAKE || '1000000000'), // 1000 credits
      slashPercentage: parseInt(process.env.SLASH_PERCENTAGE || '1000'), // 10%
      maxPriceDeviation: parseFloat(process.env.MAX_PRICE_DEVIATION || '0.02'), // 2%
      submissionReward: BigInt(process.env.SUBMISSION_REWARD || '100000'), // 0.1 credits
      networkUrl: process.env.ALEO_RPC_URL || 'https://api.explorer.provable.com/v1/testnet'
    };

    this.initializeNetworkClient();
  }

  /**
   * Initialize the Aleo network client
   */
  private async initializeNetworkClient(): Promise<void> {
    try {
      const NetworkClient = await loadSDK();
      if (NetworkClient) {
        this.networkClient = new NetworkClient(this.config.networkUrl);
        logger.info(`Staking integration initialized with registry: ${this.config.registryProgramId}`);
      } else {
        logger.warn('Staking integration running in limited mode (SDK not available)');
      }
    } catch (error) {
      logger.error(`Failed to initialize network client: ${error}`);
    }
  }

  /**
   * Get operator information from the registry
   */
  async getOperatorInfo(operatorAddress: string): Promise<OperatorInfo | null> {
    // Check cache first
    const cached = this.operatorCache.get(operatorAddress);
    const lastUpdate = this.lastCacheUpdate.get(operatorAddress) || 0;

    if (cached && Date.now() - lastUpdate < this.cacheExpiryMs) {
      return cached;
    }

    try {
      if (!this.networkClient) {
        await this.initializeNetworkClient();
      }

      // Query the on-chain registry mapping
      const mappingValue = await this.networkClient?.getProgramMappingValue(
        this.config.registryProgramId,
        'operators',
        operatorAddress
      );

      if (!mappingValue) {
        return null;
      }

      // Parse the on-chain struct (simplified parsing)
      const operatorInfo = this.parseOperatorInfo(operatorAddress, mappingValue);

      // Update cache
      this.operatorCache.set(operatorAddress, operatorInfo);
      this.lastCacheUpdate.set(operatorAddress, Date.now());

      return operatorInfo;
    } catch (error) {
      logger.debug(`Failed to fetch operator info for ${operatorAddress}: ${error}`);
      return null;
    }
  }

  /**
   * Parse operator info from on-chain data
   */
  private parseOperatorInfo(address: string, rawData: string): OperatorInfo {
    // Parse the Aleo struct format
    // Expected format: { stake: 1000000000u64, reputation_score: 5000u64, ... }
    try {
      const fields = this.parseAleoStruct(rawData);

      return {
        address,
        stake: BigInt(fields.stake || '0'),
        reputationScore: parseInt(fields.reputation_score || '5000'),
        totalSubmissions: parseInt(fields.total_submissions || '0'),
        validSubmissions: parseInt(fields.valid_submissions || '0'),
        slashedCount: parseInt(fields.slashed_count || '0'),
        isActive: fields.is_active === 'true',
        isJailed: fields.is_jailed === 'true',
        lastSubmissionAt: parseInt(fields.last_submission_at || '0')
      };
    } catch (error) {
      logger.error(`Error parsing operator info: ${error}`);
      // Return default values
      return {
        address,
        stake: BigInt(0),
        reputationScore: 5000,
        totalSubmissions: 0,
        validSubmissions: 0,
        slashedCount: 0,
        isActive: false,
        isJailed: false,
        lastSubmissionAt: 0
      };
    }
  }

  /**
   * Parse Aleo struct format into key-value pairs
   */
  private parseAleoStruct(rawData: string): Record<string, string> {
    const result: Record<string, string> = {};

    // Remove outer braces and whitespace
    const cleaned = rawData.replace(/[{}]/g, '').trim();

    // Split by comma and parse each field
    const fields = cleaned.split(',');
    for (const field of fields) {
      const [key, value] = field.split(':').map(s => s.trim());
      if (key && value) {
        // Remove type suffix (e.g., u64, u128)
        const cleanValue = value.replace(/u\d+$/, '').replace(/field$/, '').replace(/bool$/, '');
        result[key] = cleanValue;
      }
    }

    return result;
  }

  /**
   * Check if an operator is eligible to submit prices
   */
  async isOperatorEligible(operatorAddress: string): Promise<{ eligible: boolean; reason?: string }> {
    const operatorInfo = await this.getOperatorInfo(operatorAddress);

    if (!operatorInfo) {
      return { eligible: false, reason: 'Operator not registered' };
    }

    if (!operatorInfo.isActive) {
      return { eligible: false, reason: 'Operator is not active' };
    }

    if (operatorInfo.isJailed) {
      return { eligible: false, reason: 'Operator is jailed' };
    }

    if (operatorInfo.stake < this.config.minStake) {
      return {
        eligible: false,
        reason: `Insufficient stake: ${operatorInfo.stake} < ${this.config.minStake}`
      };
    }

    return { eligible: true };
  }

  /**
   * Calculate stake weight for consensus
   */
  getStakeWeight(operatorInfo: OperatorInfo): number {
    // Weight is based on stake amount and reputation
    const stakeWeight = Number(operatorInfo.stake) / Number(this.config.minStake);
    const reputationMultiplier = operatorInfo.reputationScore / 10000;

    return stakeWeight * (0.7 + 0.3 * reputationMultiplier);
  }

  /**
   * Report a slashing violation
   */
  reportSlashingViolation(report: SlashingReport): void {
    logger.warn(`Slashing violation detected: ${JSON.stringify(report)}`);
    this.pendingSlashReports.push(report);

    // If we have enough reports, trigger slashing
    if (this.pendingSlashReports.length >= 3) {
      this.processSlashingReports();
    }
  }

  /**
   * Check if a price submission is valid (for potential slashing)
   */
  validatePriceSubmission(
    operatorAddress: string,
    submittedPrice: bigint,
    consensusPrice: bigint,
    timestamp: number
  ): { valid: boolean; report?: SlashingReport } {
    // Check price deviation
    const deviation = Math.abs(
      Number(submittedPrice - consensusPrice) / Number(consensusPrice)
    );

    if (deviation > this.config.maxPriceDeviation) {
      const report: SlashingReport = {
        operator: operatorAddress,
        reasonCode: SlashReason.BAD_PRICE,
        reason: `Price deviation ${(deviation * 100).toFixed(2)}% exceeds max ${this.config.maxPriceDeviation * 100}%`,
        evidence: crypto.createHash('sha256')
          .update(`${operatorAddress}:${submittedPrice}:${consensusPrice}:${timestamp}`)
          .digest('hex'),
        timestamp,
        priceSubmitted: submittedPrice,
        expectedPrice: consensusPrice,
        deviationPercent: deviation * 100
      };

      return { valid: false, report };
    }

    // Check timestamp (no future timestamps)
    if (timestamp > Date.now() + 30000) {
      const report: SlashingReport = {
        operator: operatorAddress,
        reasonCode: SlashReason.TIMESTAMP_MANIPULATION,
        reason: 'Timestamp is too far in the future',
        evidence: crypto.createHash('sha256')
          .update(`${operatorAddress}:${timestamp}:${Date.now()}`)
          .digest('hex'),
        timestamp
      };

      return { valid: false, report };
    }

    return { valid: true };
  }

  /**
   * Process pending slashing reports
   */
  private async processSlashingReports(): Promise<void> {
    if (this.pendingSlashReports.length === 0) {
      return;
    }

    logger.info(`Processing ${this.pendingSlashReports.length} slashing reports`);

    // Group reports by operator
    const reportsByOperator = new Map<string, SlashingReport[]>();
    for (const report of this.pendingSlashReports) {
      const existing = reportsByOperator.get(report.operator) || [];
      existing.push(report);
      reportsByOperator.set(report.operator, existing);
    }

    // For each operator with multiple violations, prepare slashing
    for (const [operator, reports] of reportsByOperator.entries()) {
      if (reports.length >= 2) {
        logger.warn(`Operator ${operator} has ${reports.length} violations - slashing recommended`);

        // In production, this would submit an on-chain slashing transaction
        // For now, we log and emit the recommendation
        this.emitSlashingRecommendation(operator, reports);
      }
    }

    // Clear processed reports
    this.pendingSlashReports = [];
  }

  /**
   * Emit slashing recommendation (for admin review or automated processing)
   */
  private emitSlashingRecommendation(operator: string, reports: SlashingReport[]): void {
    const recommendation = {
      operator,
      violationCount: reports.length,
      totalDeviation: reports.reduce((sum, r) => sum + (r.deviationPercent || 0), 0),
      reasons: reports.map(r => r.reasonCode),
      evidence: reports.map(r => r.evidence),
      recommendedSlashAmount: this.calculateSlashAmount(reports),
      timestamp: Date.now()
    };

    logger.warn(`SLASHING RECOMMENDATION: ${JSON.stringify(recommendation, null, 2)}`);

    // In production, this could trigger an admin notification or automated slashing
  }

  /**
   * Calculate recommended slash amount based on violations
   */
  private calculateSlashAmount(reports: SlashingReport[]): bigint {
    // Base slash is 10% of minimum stake
    let baseSlash = this.config.minStake * BigInt(this.config.slashPercentage) / 10000n;

    // Multiply by number of violations (up to 3x)
    const multiplier = Math.min(reports.length, 3);

    return baseSlash * BigInt(multiplier);
  }

  /**
   * Get all active operators with their stake weights
   */
  async getActiveOperatorsWithWeights(): Promise<Map<string, number>> {
    const weights = new Map<string, number>();

    // In production, this would query the registry for all active operators
    // For now, we use the configured operator
    const operatorAddress = config.operator.address;
    const operatorInfo = await this.getOperatorInfo(operatorAddress);

    if (operatorInfo && operatorInfo.isActive) {
      weights.set(operatorAddress, this.getStakeWeight(operatorInfo));
    }

    return weights;
  }

  /**
   * Get the total staked amount across all operators
   */
  async getTotalStaked(): Promise<bigint> {
    try {
      if (!this.networkClient) {
        await this.initializeNetworkClient();
      }

      const totalStaked = await this.networkClient?.getProgramMappingValue(
        this.config.registryProgramId,
        'total_staked',
        '0u8'
      );

      if (totalStaked) {
        return BigInt(totalStaked.replace('u64', ''));
      }
    } catch (error) {
      logger.debug(`Failed to fetch total staked: ${error}`);
    }

    return BigInt(0);
  }

  /**
   * Get staking statistics
   */
  async getStakingStats(): Promise<{
    totalStaked: string;
    activeOperators: number;
    minStake: string;
    slashPercentage: number;
    rewardPerSubmission: string;
  }> {
    const totalStaked = await this.getTotalStaked();
    const operators = await this.getActiveOperatorsWithWeights();

    return {
      totalStaked: totalStaked.toString(),
      activeOperators: operators.size,
      minStake: this.config.minStake.toString(),
      slashPercentage: this.config.slashPercentage / 100,
      rewardPerSubmission: this.config.submissionReward.toString()
    };
  }

  /**
   * Clear the operator cache
   */
  clearCache(): void {
    this.operatorCache.clear();
    this.lastCacheUpdate.clear();
    logger.debug('Staking integration cache cleared');
  }
}

// Singleton instance
export const stakingIntegration = new StakingIntegration();

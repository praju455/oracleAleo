import { Account } from '@provablehq/sdk';
import { config } from '../config';
import { logger } from './logger';

export interface SignedPriceData {
  pair: string;
  pairId: number;
  price: bigint;
  timestamp: number;
  sourceCount: number;
  signature: string;       // Real Aleo signature string
  operatorAddress: string;
}

// Pair ID mapping (must match relayer and contract)
const PAIR_IDS: { [key: string]: number } = {
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
};

export class AleoSigner {
  private account: Account | null = null;
  private operatorAddress: string;

  constructor() {
    this.operatorAddress = config.operator.address;

    if (config.operator.privateKey) {
      try {
        this.account = new Account({ privateKey: config.operator.privateKey });
        logger.info(`Signer initialized with address: ${this.account.address().to_string()}`);
      } catch (err) {
        logger.warn(`Failed to initialize Aleo account: ${err}. Signing disabled.`);
      }
    } else {
      logger.warn('No private key configured — signing disabled');
    }
  }

  /**
   * Sign price data using real Aleo signatures (BLS12-377).
   * The message format must match the on-chain BHP256::hash_to_field(PriceMessage { ... }).
   *
   * The Aleo SDK Account.sign() accepts a Uint8Array of the message bytes.
   * On-chain, the contract hashes PriceMessage struct via BHP256::hash_to_field,
   * then verifies signature::verify(sig, caller, hash).
   *
   * Off-chain, we construct the same struct literal string that Leo would use
   * and sign it. The SDK handles the BHP256 hashing internally.
   */
  signPrice(pair: string, price: bigint, timestamp: number, sourceCount: number): SignedPriceData {
    const pairId = PAIR_IDS[pair] || 0;

    if (!this.account) {
      // Return unsigned data — relayer will use submit_price_simple fallback
      return {
        pair,
        pairId,
        price,
        timestamp,
        sourceCount,
        signature: '',
        operatorAddress: this.operatorAddress,
      };
    }

    // Build the message string matching the on-chain PriceMessage struct.
    // Account.sign() in the Aleo SDK signs arbitrary bytes.
    // The contract does: BHP256::hash_to_field(PriceMessage { pair_id, price, timestamp, source_count })
    // then: signature::verify(sig, self.caller, hash)
    //
    // We need to produce a signature over the same field value.
    // We encode the struct as a string that the SDK can process.
    const message = `{ pair_id: ${pairId}u64, price: ${price}u128, timestamp: ${timestamp}u64, source_count: ${sourceCount}u8 }`;

    const sig = this.account.sign(message);

    logger.debug(`Signed price for ${pair}: pairId=${pairId}, price=${price}`);

    return {
      pair,
      pairId,
      price,
      timestamp,
      sourceCount,
      signature: sig.to_string(),
      operatorAddress: this.account.address().to_string(),
    };
  }

  getOperatorAddress(): string {
    if (this.account) {
      return this.account.address().to_string();
    }
    return this.operatorAddress;
  }

  isSigningEnabled(): boolean {
    return this.account !== null;
  }
}

// Singleton instance
export const aleoSigner = new AleoSigner();

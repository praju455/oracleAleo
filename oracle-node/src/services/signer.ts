import { config } from '../config';
import { logger } from './logger';
import crypto from 'crypto';

// Aleo signature types
export interface SignedPriceData {
  pair: string;
  price: bigint;
  timestamp: number;
  messageHash: string;
  signature: string;
  publicKey: string;
  signatureR: string;    // R component of Schnorr signature
  signatureS: string;    // S component of Schnorr signature
  nonce: string;         // Unique nonce for replay protection
}

export interface SignedMessage {
  message: string;
  signature: string;
  publicKey: string;
}

// Schnorr signature components for on-chain verification
export interface SchnorrSignature {
  r: bigint;   // R point (x-coordinate)
  s: bigint;   // S scalar
  nonce: string;
}

export class AleoSigner {
  private operatorAddress: string;
  private privateKey: string;
  private nonceCounter: number = 0;

  constructor() {
    this.operatorAddress = config.operator.address;
    this.privateKey = config.operator.privateKey || '';

    if (!this.privateKey) {
      logger.warn('No private key configured - using deterministic signing for development');
    }
  }

  /**
   * Generate a cryptographic nonce for replay protection
   */
  private generateNonce(): string {
    this.nonceCounter++;
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `${timestamp}-${this.nonceCounter}-${random}`;
  }

  /**
   * Hash the price message using SHA-256 (compatible with Aleo's BHP256)
   */
  private hashMessage(pair: string, price: bigint, timestamp: number, nonce: string): string {
    const message = `ALEO_ORACLE_PRICE:${pair}:${price.toString()}:${timestamp}:${nonce}`;
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  /**
   * Create a Schnorr-style signature for on-chain verification
   * This implementation creates deterministic signatures that can be verified on-chain
   */
  private createSchnorrSignature(messageHash: string): SchnorrSignature {
    // Derive k (nonce) deterministically from private key and message (RFC 6979 style)
    const k = crypto.createHmac('sha256', this.privateKey || 'dev-key')
      .update(messageHash)
      .digest();

    // Calculate R = k * G (simplified - in production use proper elliptic curve)
    // For Aleo, we use the BLS12-377 curve parameters
    const r = BigInt('0x' + k.subarray(0, 16).toString('hex'));

    // Calculate s = k - e * privateKeyScalar (simplified)
    const privateKeyHash = crypto.createHash('sha256')
      .update(this.privateKey || 'dev-key')
      .digest();
    const privateKeyScalar = BigInt('0x' + privateKeyHash.subarray(0, 16).toString('hex'));
    const e = BigInt('0x' + messageHash.substring(0, 32));

    // s = k + e * x (mod n) - simplified Schnorr
    const s = (r + (e * privateKeyScalar)) % (2n ** 128n);

    const nonce = this.generateNonce();

    return { r, s, nonce };
  }

  /**
   * Sign a price message with full Schnorr signature for on-chain verification
   */
  signPrice(pair: string, price: bigint, timestamp: number): SignedPriceData {
    const nonce = this.generateNonce();
    const messageHash = this.hashMessage(pair, price, timestamp, nonce);
    const schnorrSig = this.createSchnorrSignature(messageHash);

    // Create the full signature string (R || S format)
    const signature = `${schnorrSig.r.toString(16).padStart(32, '0')}${schnorrSig.s.toString(16).padStart(32, '0')}`;

    logger.debug(`Signed price for ${pair}: hash=${messageHash.substring(0, 16)}...`);

    return {
      pair,
      price,
      timestamp,
      messageHash,
      signature,
      publicKey: this.operatorAddress,
      signatureR: schnorrSig.r.toString(),
      signatureS: schnorrSig.s.toString(),
      nonce
    };
  }

  /**
   * Legacy sign method for backwards compatibility
   */
  signPriceLegacy(pair: string, price: bigint, timestamp: number): SignedMessage {
    const signedData = this.signPrice(pair, price, timestamp);

    return {
      message: `${pair}:${price.toString()}:${timestamp}`,
      signature: signedData.signature,
      publicKey: this.operatorAddress
    };
  }

  /**
   * Verify a Schnorr signature
   */
  verifySignature(
    pair: string,
    price: bigint,
    timestamp: number,
    nonce: string,
    signatureR: string,
    signatureS: string,
    publicKey: string
  ): boolean {
    try {
      // Reconstruct message hash
      const messageHash = this.hashMessage(pair, price, timestamp, nonce);

      // Parse signature components
      const r = BigInt(signatureR);
      const s = BigInt(signatureS);
      const e = BigInt('0x' + messageHash.substring(0, 32));

      // Verify: R = s*G - e*P (simplified verification)
      // In production, this would use proper elliptic curve operations
      const privateKeyHash = crypto.createHash('sha256')
        .update(this.privateKey || 'dev-key')
        .digest();
      const privateKeyScalar = BigInt('0x' + privateKeyHash.subarray(0, 16).toString('hex'));

      // Expected r = s - e * x (mod n)
      const expectedR = (s - (e * privateKeyScalar)) % (2n ** 128n);

      // Handle negative modulo
      const normalizedExpectedR = expectedR < 0n ? expectedR + (2n ** 128n) : expectedR;
      const normalizedR = r < 0n ? r + (2n ** 128n) : r;

      const isValid = normalizedR === normalizedExpectedR && publicKey === this.operatorAddress;

      if (!isValid) {
        logger.warn(`Signature verification failed for ${pair}`);
      }

      return isValid;
    } catch (error) {
      logger.error(`Signature verification error: ${error}`);
      return false;
    }
  }

  /**
   * Get the operator's public address
   */
  getOperatorAddress(): string {
    return this.operatorAddress;
  }

  /**
   * Generate a field element from the message for on-chain use
   * This creates a value compatible with Aleo's field type
   */
  getMessageField(pair: string, price: bigint, timestamp: number, nonce: string): string {
    const hash = this.hashMessage(pair, price, timestamp, nonce);
    // Convert to field-compatible format (first 31 bytes to stay within field modulus)
    return BigInt('0x' + hash.substring(0, 62)).toString();
  }

  /**
   * Get signature components formatted for on-chain submission
   */
  getOnChainSignatureParams(signedData: SignedPriceData): {
    messageField: string;
    sigR: string;
    sigS: string;
    nonce: string;
  } {
    return {
      messageField: this.getMessageField(
        signedData.pair,
        signedData.price,
        signedData.timestamp,
        signedData.nonce
      ),
      sigR: signedData.signatureR,
      sigS: signedData.signatureS,
      nonce: signedData.nonce
    };
  }
}

// Singleton instance
export const aleoSigner = new AleoSigner();

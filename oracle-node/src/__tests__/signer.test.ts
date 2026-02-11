// Mock the config and logger before importing signer
jest.mock('../config', () => ({
  config: {
    operator: {
      address: 'aleo1test',
      privateKey: '',
    },
  },
}));

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock @provablehq/sdk since it may not be available in test env
jest.mock('@provablehq/sdk', () => {
  const mockSign = jest.fn().mockReturnValue({
    to_string: () => 'sign1mock_signature_string_for_testing',
  });
  const mockAddress = jest.fn().mockReturnValue({
    to_string: () => 'aleo1mockaddress123',
  });

  return {
    Account: jest.fn().mockImplementation(() => ({
      sign: mockSign,
      address: mockAddress,
    })),
  };
});

import { AleoSigner } from '../services/signer';

describe('AleoSigner', () => {
  describe('without private key', () => {
    it('returns unsigned data when no private key configured', () => {
      const signer = new AleoSigner();
      const result = signer.signPrice('ETH/USD', 350000000000n, Date.now(), 5);

      expect(result.signature).toBe('');
      expect(result.pair).toBe('ETH/USD');
      expect(result.pairId).toBe(1);
      expect(result.operatorAddress).toBe('aleo1test');
    });

    it('reports signing as disabled', () => {
      const signer = new AleoSigner();
      expect(signer.isSigningEnabled()).toBe(false);
    });
  });

  describe('with mocked private key', () => {
    beforeEach(() => {
      // Override config to have a private key
      const { config } = require('../config');
      config.operator.privateKey = 'APrivateKey1zktest123';
    });

    afterEach(() => {
      const { config } = require('../config');
      config.operator.privateKey = '';
    });

    it('returns signed data with correct pair ID', () => {
      const signer = new AleoSigner();
      const result = signer.signPrice('BTC/USD', 10000000000000n, Date.now(), 5);

      expect(result.pairId).toBe(2);
      expect(result.signature).toContain('sign1');
      expect(result.operatorAddress).toBe('aleo1mockaddress123');
    });

    it('maps pair names to correct IDs', () => {
      const signer = new AleoSigner();

      expect(signer.signPrice('ETH/USD', 1n, 0, 3).pairId).toBe(1);
      expect(signer.signPrice('BTC/USD', 1n, 0, 3).pairId).toBe(2);
      expect(signer.signPrice('ALEO/USD', 1n, 0, 3).pairId).toBe(3);
      expect(signer.signPrice('SOL/USD', 1n, 0, 3).pairId).toBe(4);
      expect(signer.signPrice('UNKNOWN/USD', 1n, 0, 3).pairId).toBe(0);
    });

    it('reports signing as enabled', () => {
      const signer = new AleoSigner();
      expect(signer.isSigningEnabled()).toBe(true);
    });
  });
});

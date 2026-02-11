import { PriceAggregator } from '../services/priceAggregator';

// Test the aggregator's pure functions without needing live API calls
describe('PriceAggregator', () => {
  let aggregator: PriceAggregator;

  beforeEach(() => {
    aggregator = new PriceAggregator();
  });

  describe('calculateMedian', () => {
    it('returns 0 for empty array', () => {
      expect(aggregator.calculateMedian([])).toBe(0);
    });

    it('returns single element for array of one', () => {
      expect(aggregator.calculateMedian([42])).toBe(42);
    });

    it('returns middle element for odd-length array', () => {
      expect(aggregator.calculateMedian([1, 3, 5])).toBe(3);
    });

    it('returns average of two middle elements for even-length array', () => {
      expect(aggregator.calculateMedian([1, 3, 5, 7])).toBe(4);
    });

    it('handles unsorted input correctly', () => {
      expect(aggregator.calculateMedian([5, 1, 3])).toBe(3);
    });

    it('handles duplicate values', () => {
      expect(aggregator.calculateMedian([100, 100, 100, 200])).toBe(100);
    });

    it('handles real-world price data', () => {
      const ethPrices = [3450.12, 3451.50, 3449.80, 3450.90, 3452.00];
      const median = aggregator.calculateMedian(ethPrices);
      expect(median).toBeCloseTo(3450.90, 2);
    });
  });

  describe('removeOutliers', () => {
    it('removes prices deviating more than 5% from median', () => {
      const median = 100;
      const prices = [95, 100, 105, 200]; // 200 is a 100% outlier
      const filtered = aggregator.removeOutliers(prices, median);
      expect(filtered).toEqual([95, 100, 105]);
    });

    it('keeps all prices within threshold', () => {
      const median = 3450;
      const prices = [3440, 3445, 3450, 3455, 3460];
      const filtered = aggregator.removeOutliers(prices, median);
      expect(filtered).toEqual(prices);
    });

    it('returns all prices if median is 0', () => {
      const prices = [1, 2, 3];
      const filtered = aggregator.removeOutliers(prices, 0);
      expect(filtered).toEqual(prices);
    });

    it('handles empty array', () => {
      const filtered = aggregator.removeOutliers([], 100);
      expect(filtered).toEqual([]);
    });

    it('removes both high and low outliers', () => {
      const median = 100;
      const prices = [50, 95, 100, 105, 200]; // 50 and 200 are outliers
      const filtered = aggregator.removeOutliers(prices, median);
      expect(filtered).toEqual([95, 100, 105]);
    });
  });
});

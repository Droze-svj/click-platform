// Cache Service Tests

const { get, set, del, exists, getOrSet, initCache, isEnabled } = require('../../../server/services/cacheService');

describe('Cache Service', () => {
  const testKey = 'test-key';
  const testValue = { test: 'data', number: 123 };

  beforeAll(async () => {
    // Try to initialize cache (will gracefully degrade if Redis not available)
    await initCache();
  });

  beforeEach(async () => {
    await del(testKey);
  });

  // Skip tests if Redis is not available
  const testIfCacheEnabled = isEnabled() ? test : test.skip;

  describe('set and get', () => {
    testIfCacheEnabled('should set and get a value', async () => {
      const setResult = await set(testKey, testValue, 60);
      expect(setResult).toBe(true);

      const value = await get(testKey);
      expect(value).toEqual(testValue);
    });

    testIfCacheEnabled('should return null for non-existent key', async () => {
      const value = await get('non-existent');
      expect(value).toBeNull();
    });

    testIfCacheEnabled('should respect TTL', async () => {
      await set(testKey, testValue, 1); // 1 second TTL
      
      const value1 = await get(testKey);
      expect(value1).toEqual(testValue);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value2 = await get(testKey);
      expect(value2).toBeNull();
    });
  });

  describe('del', () => {
    testIfCacheEnabled('should delete a key', async () => {
      await set(testKey, testValue);
      await del(testKey);

      const value = await get(testKey);
      expect(value).toBeNull();
    });
  });

  describe('exists', () => {
    testIfCacheEnabled('should check if key exists', async () => {
      await set(testKey, testValue);
      
      const exists1 = await exists(testKey);
      expect(exists1).toBe(true);

      await del(testKey);
      
      const exists2 = await exists(testKey);
      expect(exists2).toBe(false);
    });
  });

  describe('getOrSet', () => {
    testIfCacheEnabled('should get cached value', async () => {
      await set(testKey, testValue);
      
      const fetchFn = jest.fn(() => Promise.resolve({ new: 'data' }));
      const value = await getOrSet(testKey, fetchFn);
      
      expect(value).toEqual(testValue);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    testIfCacheEnabled('should fetch and cache if not exists', async () => {
      const fetchFn = jest.fn(() => Promise.resolve(testValue));
      const value = await getOrSet(testKey, fetchFn, 60);
      
      expect(value).toEqual(testValue);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Should be cached now
      const cached = await get(testKey);
      expect(cached).toEqual(testValue);
    });
  });

  // Test graceful degradation when cache is disabled
  describe('graceful degradation', () => {
    it('should return null when cache is disabled', async () => {
      if (!isEnabled()) {
        const value = await get('any-key');
        expect(value).toBeNull();
      }
    });

    it('should return false when setting with cache disabled', async () => {
      if (!isEnabled()) {
        const result = await set('any-key', testValue);
        expect(result).toBe(false);
      }
    });
  });
});







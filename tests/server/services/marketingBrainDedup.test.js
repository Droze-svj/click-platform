// Unit tests for the marketing-brain anti-repetition helpers.
// These guard the dedup contract: only Mongo-native users engage history, the
// avoid-repetition prompt block is built correctly, and an empty history adds
// nothing to the prompt.

const brain = require('../../../server/services/marketingBrainService');

describe('marketingBrain anti-repetition helpers', () => {
  describe('canUseHistory', () => {
    it('is true only for a valid ObjectId-shaped userId', () => {
      expect(brain.canUseHistory('507f1f77bcf86cd799439011')).toBe(true);
    });
    it('is false for UUID / missing / empty userIds (degrades to no dedup)', () => {
      expect(brain.canUseHistory('b9b1f2a4-1111-2222-3333-444455556666')).toBe(false);
      expect(brain.canUseHistory(undefined)).toBe(false);
      expect(brain.canUseHistory(null)).toBe(false);
      expect(brain.canUseHistory('')).toBe(false);
    });
  });

  describe('avoidRepetitionBlock', () => {
    it('returns empty string when there is no history (adds nothing to prompt)', () => {
      expect(brain.avoidRepetitionBlock([], 'content angles')).toBe('');
      expect(brain.avoidRepetitionBlock(undefined, 'content angles')).toBe('');
    });

    it('lists prior items and instructs the model not to repeat them', () => {
      const block = brain.avoidRepetitionBlock(['Hook A', 'Hook B'], 'content angles');
      expect(block).toContain('ALREADY suggested');
      expect(block).toContain('content angles');
      expect(block).toContain('- Hook A');
      expect(block).toContain('- Hook B');
      expect(block).toContain('Do NOT repeat');
    });

    it('caps the listed items at 20', () => {
      const many = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
      const block = brain.avoidRepetitionBlock(many, 'ideas');
      const listed = (block.match(/- Item /g) || []).length;
      expect(listed).toBe(20);
    });
  });

  describe('recentSuggestionLabels / recordSuggestions guards', () => {
    it('returns [] without touching the DB for non-ObjectId users', async () => {
      await expect(brain.recentSuggestionLabels('uuid-not-objectid', 'fresh-angle')).resolves.toEqual([]);
    });
    it('no-ops recordSuggestions for non-ObjectId users (no throw)', async () => {
      await expect(brain.recordSuggestions('uuid-not-objectid', 'fresh-angle', ['x'])).resolves.toBeUndefined();
    });
    it('no-ops recordSuggestions when there are no labels', async () => {
      await expect(brain.recordSuggestions('507f1f77bcf86cd799439011', 'fresh-angle', [])).resolves.toBeUndefined();
    });
  });
});

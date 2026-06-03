/* global jest, describe, it, expect, afterEach */
// Relocated from server/services/SyncEngine.test.js — jest's `roots` only scans
// tests/, so it never ran from the services dir (and broke require-all sweeps).
const SyncEngine = require('../../../server/services/SyncEngine');
const Content = require('../../../server/models/Content');
const ContentTranslation = require('../../../server/models/ContentTranslation');
const { identifyModifiedSegments } = require('../../../server/utils/diffUtils');

// Mock dependencies
jest.mock('../../../server/models/Content');
jest.mock('../../../server/models/ContentTranslation');
jest.mock('../../../server/utils/diffUtils');
jest.mock('../../../server/services/translationService', () => ({
  translateSegments: jest.fn()
}));

describe('SyncEngine', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateHash', () => {
    it('should generate consistent hashes for identical content', () => {
      const content = { title: 'Test', description: 'Desc', transcript: 'Trans' };
      const hash1 = SyncEngine.generateHash(content);
      const hash2 = SyncEngine.generateHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 length
    });

    it('should generate different hashes for different content', () => {
      const hash1 = SyncEngine.generateHash({ title: 'A' });
      const hash2 = SyncEngine.generateHash({ title: 'B' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('syncContent', () => {
    it('should mark translations as outdated if hashes mismatch', async () => {
      const mockContent = { _id: 'c1', syncVersion: 2, title: 'New', description: '', transcript: '' };
      const mockTranslation = {
        contentId: 'c1',
        language: 'ES',
        syncStatus: 'current',
        metadata: { sourceHash: 'old-hash' },
        segments: [{ status: 'synced' }],
        save: jest.fn()
      };

      Content.findById.mockResolvedValue(mockContent);
      ContentTranslation.find.mockResolvedValue([mockTranslation]);
      identifyModifiedSegments.mockReturnValue([]);

      const results = await SyncEngine.syncContent('c1');

      expect(mockTranslation.syncStatus).toBe('outdated');
      expect(mockTranslation.metadata.sourceVersion).toBe(2);
      expect(mockTranslation.segments[0].status).toBe('outdated');
      expect(mockTranslation.save).toHaveBeenCalled();
      // syncContent returns a summary, not the translations array.
      expect(results.translationsCount).toBe(1);
    });
  });
});

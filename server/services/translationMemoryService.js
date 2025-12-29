// Translation Memory Service
// Manages translation memory operations

const TranslationMemory = require('../models/TranslationMemory');
const logger = require('../utils/logger');

/**
 * Add entry to translation memory
 */
async function addToMemory(userId, entry) {
  try {
    const memory = new TranslationMemory({
      userId,
      sourceLanguage: entry.sourceLanguage.toUpperCase(),
      targetLanguage: entry.targetLanguage.toUpperCase(),
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      context: entry.context || '',
      domain: entry.domain || 'general',
      qualityScore: entry.qualityScore || 80,
      metadata: {
        createdBy: entry.createdBy || 'user',
        verified: entry.verified || false
      }
    });

    await memory.save();
    logger.info('Added to translation memory', { userId, memoryId: memory._id });
    return memory;
  } catch (error) {
    logger.error('Error adding to translation memory', { error: error.message, userId });
    throw error;
  }
}

/**
 * Search translation memory
 */
async function searchMemory(userId, sourceLanguage, targetLanguage, query, options = {}) {
  try {
    const {
      limit = 20,
      minQuality = 0,
      domain = null
    } = options;

    const searchQuery = {
      userId,
      sourceLanguage: sourceLanguage.toUpperCase(),
      targetLanguage: targetLanguage.toUpperCase(),
      qualityScore: { $gte: minQuality }
    };

    if (domain) {
      searchQuery.domain = domain;
    }

    // Text search for fuzzy matching
    if (query) {
      searchQuery.$text = { $search: query };
    }

    const results = await TranslationMemory.find(searchQuery)
      .sort({ qualityScore: -1, usageCount: -1, lastUsed: -1 })
      .limit(limit)
      .lean();

    return results;
  } catch (error) {
    logger.error('Error searching translation memory', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update memory entry
 */
async function updateMemory(memoryId, userId, updates) {
  try {
    const memory = await TranslationMemory.findOneAndUpdate(
      { _id: memoryId, userId },
      {
        $set: {
          targetText: updates.targetText || undefined,
          qualityScore: updates.qualityScore || undefined,
          context: updates.context || undefined,
          domain: updates.domain || undefined,
          'metadata.verified': updates.verified !== undefined ? updates.verified : undefined,
          'metadata.verifiedBy': updates.verified ? userId : undefined,
          'metadata.verifiedAt': updates.verified ? new Date() : undefined
        },
        $inc: { usageCount: 1 },
        $set: { lastUsed: new Date() }
      },
      { new: true }
    );

    if (!memory) {
      throw new Error('Translation memory entry not found');
    }

    return memory;
  } catch (error) {
    logger.error('Error updating translation memory', { error: error.message, memoryId });
    throw error;
  }
}

/**
 * Delete memory entry
 */
async function deleteMemory(memoryId, userId) {
  try {
    const memory = await TranslationMemory.findOneAndDelete({
      _id: memoryId,
      userId
    });

    if (!memory) {
      throw new Error('Translation memory entry not found');
    }

    return memory;
  } catch (error) {
    logger.error('Error deleting translation memory', { error: error.message, memoryId });
    throw error;
  }
}

/**
 * Get memory statistics
 */
async function getMemoryStats(userId) {
  try {
    const stats = await TranslationMemory.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: {
            sourceLanguage: '$sourceLanguage',
            targetLanguage: '$targetLanguage'
          },
          count: { $sum: 1 },
          avgQuality: { $avg: '$qualityScore' },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = await TranslationMemory.countDocuments({ userId });
    const verified = await TranslationMemory.countDocuments({
      userId,
      'metadata.verified': true
    });

    return {
      total,
      verified,
      byLanguagePair: stats,
      verificationRate: total > 0 ? (verified / total) * 100 : 0
    };
  } catch (error) {
    logger.error('Error getting memory stats', { error: error.message, userId });
    throw error;
  }
}

/**
 * Export translation memory
 */
async function exportMemory(userId, sourceLanguage, targetLanguage) {
  try {
    const entries = await TranslationMemory.find({
      userId,
      sourceLanguage: sourceLanguage.toUpperCase(),
      targetLanguage: targetLanguage.toUpperCase()
    })
      .sort({ usageCount: -1 })
      .lean();

    return entries.map(e => ({
      source: e.sourceText,
      target: e.targetText,
      context: e.context,
      domain: e.domain,
      quality: e.qualityScore,
      usageCount: e.usageCount,
      verified: e.metadata.verified
    }));
  } catch (error) {
    logger.error('Error exporting translation memory', { error: error.message, userId });
    throw error;
  }
}

/**
 * Import translation memory
 */
async function importMemory(userId, entries) {
  try {
    const results = {
      imported: 0,
      updated: 0,
      failed: 0
    };

    for (const entry of entries) {
      try {
        const existing = await TranslationMemory.findOne({
          userId,
          sourceLanguage: entry.sourceLanguage.toUpperCase(),
          targetLanguage: entry.targetLanguage.toUpperCase(),
          sourceText: entry.source
        });

        if (existing) {
          await TranslationMemory.findByIdAndUpdate(existing._id, {
            $set: {
              targetText: entry.target,
              qualityScore: entry.quality || 80,
              context: entry.context || '',
              domain: entry.domain || 'general'
            }
          });
          results.updated++;
        } else {
          await addToMemory(userId, {
            sourceLanguage: entry.sourceLanguage,
            targetLanguage: entry.targetLanguage,
            sourceText: entry.source,
            targetText: entry.target,
            context: entry.context || '',
            domain: entry.domain || 'general',
            qualityScore: entry.quality || 80
          });
          results.imported++;
        }
      } catch (error) {
        logger.error('Error importing memory entry', { error: error.message });
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    logger.error('Error importing translation memory', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  addToMemory,
  searchMemory,
  updateMemory,
  deleteMemory,
  getMemoryStats,
  exportMemory,
  importMemory
};



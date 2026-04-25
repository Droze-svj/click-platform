const Content = require('../models/Content');
const ContentTranslation = require('../models/ContentTranslation');
const crypto = require('crypto');
const { identifyModifiedSegments } = require('../utils/diffUtils');

const { translateSegments } = require('./translationService');

class SyncEngine {
  /**
   * Generates a hash for content to detect changes
   */
  static generateHash(content) {
    const data = `${content.title || ''}|${content.description || ''}|${content.transcript || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Synchronizes translations when source content changes
   */
  static async syncContent(contentId) {
    const content = await Content.findById(contentId);
    if (!content) throw new Error('Content not found');

    const currentHash = this.generateHash(content);
    
    // Find translations that actually need updating (hash mismatch)
    const translations = await ContentTranslation.find({ 
      contentId,
      'metadata.sourceHash': { $ne: currentHash },
      syncStatus: { $ne: 'syncing' } 
    });

    if (translations.length === 0) return { translationsCount: 0 };

    const updatePromises = translations.map(async (translation) => {
      console.log(`[SyncEngine] Detecting change for ${translation.language} in content ${contentId}`);
      
      // Mark as outdated and flag segments
      translation.syncStatus = 'outdated';
      translation.metadata.sourceVersion = content.syncVersion || 1;
      
      // Map segments to outdated if they don't match (simplified logic for POC)
      translation.segments.forEach(seg => {
        if (seg.status !== 'pending') seg.status = 'outdated';
      });

      await translation.save();
    });

    await Promise.all(updatePromises);
    return { translationsCount: translations.length };
  }

  /**
   * Trigger delta translation for outdated segments
   */
  static async triggerDeltaTranslation(translationId) {
    // 1. Get translation with an atomic lock if possible or simple check
    const translation = await ContentTranslation.findById(translationId);
    if (!translation) throw new Error('Translation not found');
    if (translation.syncStatus === 'syncing') throw new Error('Translation is already syncing');

    // 2. Filter for segments that actually need work
    const outdatedSegments = translation.segments.filter(s => s.status === 'outdated');
    if (outdatedSegments.length === 0) {
      translation.syncStatus = 'current';
      await translation.save();
      return translation;
    }

    // 3. Mark as syncing
    translation.syncStatus = 'syncing';
    await translation.save();

    try {
      console.log(`[SyncEngine] Re-translating ${outdatedSegments.length} segments for ${translation.language}`);
      
      const results = await translateSegments(
        translation.contentId,
        translation.language,
        outdatedSegments,
        translation.segments.filter(s => s.status === 'synced').slice(0, 5)
      );

      // 4. Map results back using segment IDs for precision
      results.forEach(res => {
        const sourceSeg = outdatedSegments[res.idx];
        if (sourceSeg) {
          const targetSeg = translation.segments.id(sourceSeg._id);
          if (targetSeg) {
            targetSeg.translatedText = res.translatedText;
            targetSeg.status = 'synced';
          }
        }
      });

      // 5. Finalize status and update hash from CURRENT content state
      const content = await Content.findById(translation.contentId);
      translation.syncStatus = 'current';
      translation.metadata.sourceHash = this.generateHash(content);
      translation.metadata.sourceVersion = content.syncVersion || 1;
      
      await translation.save();
      return translation;
    } catch (err) {
      translation.syncStatus = 'failed';
      await translation.save();
      throw err;
    }
  }
}

module.exports = SyncEngine;

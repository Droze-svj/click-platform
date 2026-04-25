const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Content = require('../models/Content');
const aiService = require('./aiService');

/**
 * Legacy Ingestion Bridge (Phase 19)
 * Scans for "Dark Assets" and neuralizes them for Sovereign.
 */
class LegacyContentService {
  constructor() {
    this.LEGACY_DIR = path.join(__dirname, '../../uploads/raw_legacy');
    if (!fs.existsSync(this.LEGACY_DIR)) {
      fs.mkdirSync(this.LEGACY_DIR, { recursive: true });
    }
  }

  /**
   * Scan legacy directory and ingest missing assets
   */
  async scanAndIngest(userId) {
    try {
      logger.info('Phase 19: Starting Legacy Dark Asset Scan...', { userId });
      
      const files = fs.readdirSync(this.LEGACY_DIR).filter(f => 
        ['.mp4', '.mov', '.avi', '.mkv'].includes(path.extname(f).toLowerCase())
      );

      const results = {
        found: files.length,
        ingested: 0,
        skipped: 0,
        errors: 0
      };

      for (const file of files) {
        const filePath = path.join(this.LEGACY_DIR, file);
        const fileName = path.basename(file);

        // Check if already in DB
        const existing = await Content.findOne({ 
          userId, 
          'originalFile.name': fileName 
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        try {
          await this.ingestFile(userId, filePath, fileName);
          results.ingested++;
        } catch (err) {
          logger.error(`Failed to ingest legacy file: ${fileName}`, { error: err.message });
          results.errors++;
        }
      }

      logger.info('Legacy Scan Complete', results);
      return results;
    } catch (error) {
      logger.error('Legacy Scan Error', { error: error.message });
      throw error;
    }
  }

  /**
   * Ingest a single file into the Sovereign system
   */
  async ingestFile(userId, filePath, fileName) {
    logger.info(`Neuralizing Legacy Asset: ${fileName}`);

    // 1. Create initial content record
    const content = new Content({
      userId,
      title: fileName.replace(path.extname(fileName), ''),
      status: 'draft',
      type: 'video',
      originalFile: {
        name: fileName,
        url: `/uploads/raw_legacy/${fileName}`,
        size: fs.statSync(filePath).size,
        mimeType: 'video/mp4' // Simplified
      },
      metadata: {
        isLegacy: true,
        ingestedAt: new Date(),
        processingStatus: 'neuralizing'
      }
    });

    await content.save();

    // 2. Trigger async neural analysis
    // We launch this without waiting to prevent scan blocking
    this.neuralizeAsset(content._id);

    return content;
  }

  /**
   * Deep Neural Analysis (Phase 19)
   */
  async neuralizeAsset(contentId) {
    try {
      const content = await Content.findById(contentId);
      if (!content) return;

      logger.info(`Phase 19: Deep Neuralizing ${contentId}...`);

      // Mocking transcription and analysis for now
      // In a real flow, we'd call Speech-To-Text and then aiService
      const mockTranscript = "Legacy content detected. Strategic value high.";
      
      const viralIdeas = await aiService.generateViralIdeas(content.title, 'general', 1);
      const diagnostic = await aiService.generateDiagnosticMatrix({ id: contentId }, 'general');

      await Content.findByIdAndUpdate(contentId, {
        $set: {
          transcription: mockTranscript,
          'metadata.viralIdeas': viralIdeas,
          'metadata.diagnostic': diagnostic,
          'metadata.processingStatus': 'completed',
          'metadata.neuralSignalStrength': diagnostic.potencyScore || 70
        }
      });

      logger.info('Legacy Asset Neuralized Successfully', { contentId });
    } catch (error) {
      logger.error('Neuralization failed', { error: error.message, contentId });
    }
  }
}

module.exports = new LegacyContentService();

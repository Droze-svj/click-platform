const logger = require('../utils/logger');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs').promises;
const Content = require('../models/Content');

/**
 * Sovereign Ingestion Service
 * Handles real-time ingestion from URLs (YouTube, Twitch, Streams)
 */
class SovereignIngestionService {
  /**
   * Ingest content from a URL
   */
  async ingestFromUrl(userId, url, options = {}) {
    try {
      logger.info('Sovereign Ingestion: Starting URL Ingest', { userId, url });
      
      const { 
        title = 'Autonomous Ingest',
        targetNiche = 'General',
        autonomous = true
      } = options;

      // 1. Create a temporary workspace
      const workDir = path.join(process.cwd(), 'temp', `ingest_${Date.now()}`);
      await fs.mkdir(workDir, { recursive: true });

      // 2. Download the video using the unified download utility
      const { classifyUrl, streamDownload, ytDlpDownload } = require('../utils/downloadUtils');
      const classified = classifyUrl(url);
      const outputPath = path.join(workDir, 'source.mp4');

      if (classified.kind === 'direct') {
        logger.info('Sovereign Ingestion: Downloading direct video asset...', { url });
        await streamDownload(url, outputPath);
      } else if (classified.kind === 'platform') {
        logger.info('Sovereign Ingestion: Downloading platform video asset via yt-dlp...', { url, platform: classified.platform });
        await ytDlpDownload(url, outputPath);
      } else {
        throw new Error('UNSUPPORTED_URL_FOR_SOVEREIGN_INGEST');
      }

      // 3. Register as Content in DB
      const content = await Content.create({
        userId,
        title,
        type: 'video',
        status: 'ready',
        originalFile: {
          url: `/api/files/stream?path=${encodeURIComponent(outputPath)}`,
          path: outputPath,
          size: (await fs.stat(outputPath)).size
        },
        metadata: {
          sourceUrl: url,
          ingestedAt: new Date(),
          niche: targetNiche
        }
      });

      // 4. Trigger the Autonomous Pipeline automatically
      const { processContentPipeline } = require('./unifiedContentPipelineService');
      
      // We pass the full options object to ensure editIntensity, voiceover, etc. are respected
      processContentPipeline(userId, content._id, {
        ...options,
        autonomous: autonomous,
        targetNiche: targetNiche,
        platforms: ['tiktok', 'instagram', 'youtube', 'facebook', 'linkedin', 'twitter']
      }).catch(err => {
        logger.error('Sovereign Ingestion: Post-ingest pipeline failed', { error: err.message, contentId: content._id });
      });

      return {
        success: true,
        contentId: content._id,
        status: 'ingesting_pipeline'
      };
    } catch (error) {
      logger.error('Sovereign Ingestion Error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SovereignIngestionService();

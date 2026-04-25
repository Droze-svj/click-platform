const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Social Vault Service
 * Manages the storage and retrieval of platform-ready social media assets.
 */
class SocialVaultService {
  /**
   * Register a rendered asset into the Social Vault
   * @param {string} parentVideoId - The original video ID
   * @param {Object} assetData - { url, platform, format, name, thumbnail }
   */
  async registerAsset(parentVideoId, assetData) {
    try {
      const content = await Content.findById(parentVideoId);
      if (!content) {
        throw new Error('Neural Node Error: Parent Identity Fragment Missing');
      }

      // Initialize structures if they don't exist
      if (!content.generatedContent) content.generatedContent = {};
      if (!content.generatedContent.shortVideos) content.generatedContent.shortVideos = [];

      const newAsset = {
        url: assetData.url,
        thumbnail: assetData.thumbnail || content.originalFile?.thumbnail,
        platform: assetData.platform,
        format: assetData.format,
        name: assetData.name || `Batch Export ${assetData.format}`,
        createdAt: new Date(),
        status: 'ready',
        isVaultItem: true
      };

      content.generatedContent.shortVideos.push(newAsset);
      
      // Also tag the content itself as having vault items
      if (!content.tags.includes('has-vault-assets')) {
        content.tags.push('has-vault-assets');
      }

      await content.save();
      logger.info('Asset successfully registered in Social Vault', { 
        videoId: parentVideoId, 
        format: assetData.format,
        platform: assetData.platform 
      });

      return newAsset;
    } catch (error) {
      logger.error('Failed to register asset in Social Vault', { error: error.message, videoId: parentVideoId });
      throw error;
    }
  }

  /**
   * Get all vault assets for a user or video
   */
  async getVaultAssets(userId, videoId = null) {
    const query = { userId, tags: 'has-vault-assets' };
    if (videoId) query._id = videoId;

    const contents = await Content.find(query).select('generatedContent.shortVideos title originalFile');
    
    // Flatten the shortVideos from all contents
    return contents.reduce((acc, curr) => {
      const vaultItems = (curr.generatedContent?.shortVideos || [])
        .filter(v => v.isVaultItem)
        .map(v => ({ ...v, parentTitle: curr.title, parentId: curr._id }));
      return [...acc, ...vaultItems];
    }, []);
  }
}

module.exports = new SocialVaultService();

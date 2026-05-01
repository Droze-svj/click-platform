const logger = require('../utils/logger');

/**
 * Smart Folder Service
 * Automatically organizes assets into logical groups based on semantic tags and metadata.
 * This enables creators to navigate hundreds of stock or uploaded clips instantly.
 */
async function generateSmartFolders(assets) {
  try {
    if (!Array.isArray(assets)) return {};

    const folders = {
      'B-Roll': [],
      'Cinematic': [],
      'Lifestyle': [],
      'Technology': [],
      'Nature': [],
      'People': [],
      'Uncategorized': []
    };

    assets.forEach(asset => {
      const tags = (asset.metadata?.tags || []).map(t => t.toLowerCase());
      const type = asset.type?.toLowerCase();

      let matched = false;

      if (type === 'broll' || tags.includes('broll')) {
        folders['B-Roll'].push(asset);
        matched = true;
      } 
      
      if (tags.includes('cinematic')) {
        folders['Cinematic'].push(asset);
        matched = true;
      } 
      
      if (tags.includes('lifestyle')) {
        folders['Lifestyle'].push(asset);
        matched = true;
      } 
      
      if (tags.includes('technology') || tags.includes('tech')) {
        folders['Technology'].push(asset);
        matched = true;
      }

      if (tags.includes('nature') || tags.includes('landscape')) {
        folders['Nature'].push(asset);
        matched = true;
      }

      if (tags.includes('people') || tags.includes('person') || tags.includes('face')) {
        folders['People'].push(asset);
        matched = true;
      }

      if (!matched) {
        folders['Uncategorized'].push(asset);
      }
    });

    // Remove empty folders
    const activeFolders = {};
    Object.keys(folders).forEach(key => {
      if (folders[key].length > 0) {
        activeFolders[key] = folders[key];
      }
    });

    return activeFolders;
  } catch (error) {
    logger.error('Failed to generate smart folders', { error: error.message });
    return {};
  }
}

module.exports = {
  generateSmartFolders
};

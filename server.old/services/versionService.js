// Content versioning service

const Content = require('../models/Content');
const ContentVersion = require('../models/ContentVersion');
const logger = require('../utils/logger');

/**
 * Create version snapshot
 */
async function createVersion(contentId, userId, changeSummary = '') {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Get current version number
    const latestVersion = await ContentVersion.findOne({ contentId })
      .sort({ version: -1 })
      .limit(1);

    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    // Mark all previous versions as not current
    await ContentVersion.updateMany(
      { contentId, isCurrent: true },
      { isCurrent: false }
    );

    // Create new version
    const version = new ContentVersion({
      contentId,
      version: newVersionNumber,
      createdBy: userId,
      title: content.title,
      description: content.description,
      transcript: content.transcript,
      generatedContent: content.generatedContent,
      metadata: {
        type: content.type,
        status: content.status,
        tags: content.tags,
        category: content.category
      },
      changeSummary,
      isCurrent: true
    });

    await version.save();
    logger.info('Version created', { contentId, version: newVersionNumber });
    return version;
  } catch (error) {
    logger.error('Error creating version', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get all versions for content
 */
async function getVersions(contentId) {
  try {
    const versions = await ContentVersion.find({ contentId })
      .sort({ version: -1 })
      .populate('createdBy', 'name email');

    return versions;
  } catch (error) {
    logger.error('Error getting versions', { error: error.message, contentId });
    return [];
  }
}

/**
 * Get specific version
 */
async function getVersion(contentId, versionNumber) {
  try {
    const version = await ContentVersion.findOne({
      contentId,
      version: versionNumber
    }).populate('createdBy', 'name email');

    return version;
  } catch (error) {
    logger.error('Error getting version', { error: error.message, contentId, versionNumber });
    return null;
  }
}

/**
 * Restore to version
 */
async function restoreToVersion(contentId, versionNumber, userId) {
  try {
    const version = await ContentVersion.findOne({
      contentId,
      version: versionNumber
    });

    if (!version) {
      throw new Error('Version not found');
    }

    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Create new version before restoring (to preserve current state)
    await createVersion(contentId, userId, `Restored from version ${versionNumber}`);

    // Restore content from version
    content.title = version.title;
    content.description = version.description;
    content.transcript = version.transcript;
    content.generatedContent = version.generatedContent;
    if (version.metadata) {
      content.tags = version.metadata.tags || content.tags;
      content.category = version.metadata.category || content.category;
    }

    await content.save();

    logger.info('Content restored to version', { contentId, versionNumber });
    return content;
  } catch (error) {
    logger.error('Error restoring version', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Compare two versions
 */
async function compareVersions(contentId, version1, version2) {
  try {
    const [v1, v2] = await Promise.all([
      getVersion(contentId, version1),
      getVersion(contentId, version2)
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const changes = [];

    // Compare title
    if (v1.title !== v2.title) {
      changes.push({
        field: 'title',
        oldValue: v1.title,
        newValue: v2.title
      });
    }

    // Compare description
    if (v1.description !== v2.description) {
      changes.push({
        field: 'description',
        oldValue: v1.description,
        newValue: v2.description
      });
    }

    // Compare transcript
    if (v1.transcript !== v2.transcript) {
      changes.push({
        field: 'transcript',
        oldValue: v1.transcript?.substring(0, 100) + '...',
        newValue: v2.transcript?.substring(0, 100) + '...'
      });
    }

    return {
      version1: v1,
      version2: v2,
      changes
    };
  } catch (error) {
    logger.error('Error comparing versions', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Auto-create version on content update
 */
async function autoVersionOnUpdate(contentId, userId, oldContent, newContent) {
  try {
    // Detect changes
    const changes = [];
    if (oldContent.title !== newContent.title) {
      changes.push({ field: 'title', oldValue: oldContent.title, newValue: newContent.title });
    }
    if (oldContent.description !== newContent.description) {
      changes.push({ field: 'description', oldValue: oldContent.description, newValue: newContent.description });
    }
    if (oldContent.transcript !== newContent.transcript) {
      changes.push({ field: 'transcript', oldValue: '...', newValue: '...' });
    }

    if (changes.length > 0) {
      const changeSummary = `Auto-saved: ${changes.map(c => c.field).join(', ')} updated`;
      await createVersion(contentId, userId, changeSummary);
    }
  } catch (error) {
    logger.error('Error auto-versioning', { error: error.message, contentId });
  }
}

module.exports = {
  createVersion,
  getVersions,
  getVersion,
  restoreToVersion,
  compareVersions,
  autoVersionOnUpdate
};








/**
 * Remix Service
 * Handles cloning of templates and community projects into user workspaces
 */

const Content = require('../models/Content');
const Template = require('../models/Template');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Get discoverable templates for Remix Hub
 */
async function getRemixDiscover(userId, query = {}) {
  try {
    const { search, category, platform } = query;
    const filter = { isPublic: true };

    if (category) filter.category = category;
    if (platform) filter.platforms = { $in: [platform] };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Using Template model for structured templates
    const templates = await Template.find(filter)
      .populate('userId', 'name avatar')
      .sort({ downloads: -1, rating: -1 })
      .limit(20)
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error fetching remix discovery data', { error: error.message });
    throw error;
  }
}

/**
 * Clone a template/project into user's personal content library
 */
async function remixProject(userId, sourceId, workspaceId = null) {
  try {
    const source = await Template.findById(sourceId);
    if (!source) throw new Error('Source template not found');

    // Create a new content piece based on the template
    const newContent = new Content({
      userId,
      workspaceId,
      title: `Remix: ${source.name}`,
      type: source.type || 'video',
      status: 'draft',
      settings: source.settings, // Copy the technical JSON
      sourceTemplateId: source._id,
      metadata: {
        remixedFrom: source.name,
        remixedAt: new Date()
      }
    });

    await newContent.save();

    // Increment remix count on source
    await Template.findByIdAndUpdate(sourceId, { $inc: { downloads: 1 } });

    logger.info(`Successfully remixed ${sourceId} for user ${userId}`);
    return newContent;
  } catch (error) {
    logger.error('Error remixing project', { error: error.message, sourceId });
    throw error;
  }
}

module.exports = {
  getRemixDiscover,
  remixProject
};

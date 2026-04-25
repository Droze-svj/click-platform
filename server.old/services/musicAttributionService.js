// Music Attribution Service
// Generates and applies attribution text for tracks

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');

/**
 * Generate attribution text for track
 */
function generateAttributionText(trackInfo) {
  const {
    title,
    artist,
    provider,
    attributionText,
    requiresAttribution
  } = trackInfo;

  if (!requiresAttribution) {
    return null;
  }

  // Use custom attribution text if provided
  if (attributionText) {
    return attributionText;
  }

  // Generate default attribution
  let attribution = '';
  
  if (artist && title) {
    attribution = `Music: "${title}" by ${artist}`;
  } else if (artist) {
    attribution = `Music: ${artist}`;
  } else if (title) {
    attribution = `Music: "${title}"`;
  } else {
    attribution = 'Music licensed';
  }

  // Add provider if relevant
  if (provider && provider !== 'user_upload') {
    const providerNames = {
      soundstripe: 'Soundstripe',
      artlist: 'Artlist',
      hooksounds: 'HookSounds',
      mubert: 'Mubert',
      soundraw: 'Soundraw'
    };
    
    const providerName = providerNames[provider] || provider;
    attribution += ` via ${providerName}`;
  }

  return attribution;
}

/**
 * Get all attributions for a render
 */
async function getRenderAttributions(renderId, userId) {
  try {
    const usageLogs = await MusicLicenseUsage.find({
      renderId,
      userId,
      attributionRequired: true
    }).lean();

    const attributions = usageLogs
      .map(log => {
        const attribution = generateAttributionText({
          title: log.trackTitle || null,
          artist: log.trackArtist || null,
          provider: log.provider,
          attributionText: log.attributionText,
          requiresAttribution: log.attributionRequired
        });
        return attribution;
      })
      .filter(Boolean);

    // Combine attributions
    const combinedAttribution = attributions.length > 0
      ? attributions.join(' | ')
      : null;

    return {
      attributions,
      combinedAttribution,
      count: attributions.length
    };
  } catch (error) {
    logger.error('Error getting render attributions', {
      error: error.message,
      renderId,
      userId
    });
    throw error;
  }
}

/**
 * Generate video description with attributions
 */
async function generateVideoDescriptionWithAttributions(
  originalDescription,
  renderId,
  userId
) {
  try {
    const attributions = await getRenderAttributions(renderId, userId);

    if (!attributions.combinedAttribution) {
      return originalDescription;
    }

    // Append attributions to description
    const separator = '\n\n---\n\n';
    const attributionSection = `Music Attribution:\n${attributions.combinedAttribution}`;

    return originalDescription
      ? `${originalDescription}${separator}${attributionSection}`
      : attributionSection;
  } catch (error) {
    logger.error('Error generating description with attributions', {
      error: error.message,
      renderId,
      userId
    });
    return originalDescription; // Return original on error
  }
}

/**
 * Mark attribution as added
 */
async function markAttributionAdded(usageLogId, location) {
  try {
    const usageLog = await MusicLicenseUsage.findById(usageLogId);
    if (!usageLog) {
      throw new Error('Usage log not found');
    }

    usageLog.attributionAdded = true;
    usageLog.attributionLocation = location;
    await usageLog.save();

    return { usageLog };
  } catch (error) {
    logger.error('Error marking attribution as added', {
      error: error.message,
      usageLogId
    });
    throw error;
  }
}

/**
 * Add attribution to video metadata
 */
function addAttributionToMetadata(videoMetadata, attributions) {
  if (!attributions.combinedAttribution) {
    return videoMetadata;
  }

  // Add to metadata tags/comments
  const metadata = {
    ...videoMetadata,
    comment: videoMetadata.comment
      ? `${videoMetadata.comment}\n\n${attributions.combinedAttribution}`
      : attributions.combinedAttribution
  };

  return metadata;
}

module.exports = {
  generateAttributionText,
  getRenderAttributions,
  generateVideoDescriptionWithAttributions,
  markAttributionAdded,
  addAttributionToMetadata
};








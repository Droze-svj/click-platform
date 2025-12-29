// Music Licensing Comparison Service
// Interactive tools for comparing licenses and checking coverage

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicProviderConfig = require('../models/MusicProviderConfig');

/**
 * Compare license coverage across platforms
 */
async function comparePlatformCoverage(trackIds, source, userId) {
  try {
    const comparisons = [];

    for (const trackId of trackIds) {
      const { getTrackLicenseInfo } = require('./musicLicenseLoggingService');
      const licenseInfo = await getTrackLicenseInfo(trackId, source);

      comparisons.push({
        trackId,
        license: licenseInfo,
        platforms: getPlatformCoverageForLicense(licenseInfo)
      });
    }

    return {
      tracks: comparisons,
      summary: generateCoverageSummary(comparisons)
    };
  } catch (error) {
    logger.error('Error comparing platform coverage', {
      error: error.message,
      trackIds,
      userId
    });
    throw error;
  }
}

/**
 * Get platform coverage for a license
 */
function getPlatformCoverageForLicense(licenseInfo) {
  const allPlatforms = [
    'youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'vimeo', 'twitch'
  ];

  // This would come from license data
  // For now, return default coverage
  return allPlatforms.map(platform => ({
    platform,
    covered: licenseInfo.allowsSocialPlatforms || licenseInfo.platforms?.includes('all') || false,
    monetization: licenseInfo.allowsMonetization || false,
    attribution: licenseInfo.requiresAttribution || false
  }));
}

/**
 * Generate coverage summary
 */
function generateCoverageSummary(comparisons) {
  const allPlatforms = [
    'youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin', 'vimeo', 'twitch'
  ];

  const platformStats = {};

  allPlatforms.forEach(platform => {
    platformStats[platform] = {
      covered: 0,
      monetization: 0,
      attribution: 0,
      total: comparisons.length
    };

    comparisons.forEach(comparison => {
      const platformInfo = comparison.platforms.find(p => p.platform === platform);
      if (platformInfo) {
        if (platformInfo.covered) platformStats[platform].covered++;
        if (platformInfo.monetization) platformStats[platform].monetization++;
        if (platformInfo.attribution) platformStats[platform].attribution++;
      }
    });
  });

  return platformStats;
}

/**
 * Check if track can be used for specific use case
 */
async function checkUseCaseCoverage(trackId, source, useCase, userId) {
  try {
    const { getTrackLicenseInfo } = require('./musicLicenseLoggingService');
    const licenseInfo = await getTrackLicenseInfo(trackId, source);

    const useCases = {
      commercial_video: {
        requires: ['allowsCommercialUse'],
        description: 'Commercial video production'
      },
      monetized_content: {
        requires: ['allowsCommercialUse', 'allowsMonetization'],
        description: 'Monetized content (ads, sponsorships)'
      },
      social_media: {
        requires: ['allowsSocialPlatforms'],
        description: 'Social media posts and ads'
      },
      client_deliverable: {
        requires: ['allowsCommercialUse'],
        description: 'Client projects and deliverables'
      },
      product_demo: {
        requires: ['allowsCommercialUse'],
        description: 'Product demonstrations and marketing'
      }
    };

    const useCaseInfo = useCases[useCase];
    if (!useCaseInfo) {
      throw new Error(`Unknown use case: ${useCase}`);
    }

    const requirements = useCaseInfo.requires;
    const covered = requirements.every(req => licenseInfo[req] || false);

    return {
      trackId,
      useCase,
      covered,
      requirements,
      licenseInfo: {
        allowsCommercialUse: licenseInfo.allowsCommercialUse,
        allowsMonetization: licenseInfo.allowsMonetization,
        allowsSocialPlatforms: licenseInfo.allowsSocialPlatforms,
        requiresAttribution: licenseInfo.requiresAttribution
      },
      message: covered
        ? `Track can be used for ${useCaseInfo.description}`
        : `Track cannot be used for ${useCaseInfo.description} - missing requirements: ${requirements.filter(r => !licenseInfo[r]).join(', ')}`
    };
  } catch (error) {
    logger.error('Error checking use case coverage', {
      error: error.message,
      trackId,
      useCase,
      userId
    });
    throw error;
  }
}

/**
 * Generate license cost breakdown
 */
async function getLicenseCostBreakdown(userId, options = {}) {
  const {
    timeRange = 'month',
    includeAIGenerated = true
  } = options;

  try {
    const MusicLicenseUsage = require('../models/MusicLicenseUsage');
    const { getCostStatistics } = require('./aiMusicCostTracking');

    // Get licensed track usage costs (if any per-track costs)
    const usageLogs = await MusicLicenseUsage.find({
      userId,
      source: 'licensed'
    }).lean();

    // Get AI generation costs
    let aiCosts = null;
    if (includeAIGenerated) {
      aiCosts = await getCostStatistics({
        userId,
        startDate: getTimeRangeStart(timeRange),
        endDate: new Date()
      });
    }

    return {
      licensed: {
        trackCount: usageLogs.length,
        cost: 0, // Platform licenses typically don't have per-track costs
        costType: 'platform_license'
      },
      aiGenerated: aiCosts || {
        totalCost: 0,
        generationCount: 0
      },
      total: {
        cost: aiCosts?.totalCost || 0,
        trackCount: usageLogs.length + (aiCosts?.totalGenerations || 0)
      },
      savings: {
        estimatedIndividualLicenseCost: usageLogs.length * 20, // Estimate $20 per track
        actualCost: aiCosts?.totalCost || 0,
        savings: usageLogs.length * 20 - (aiCosts?.totalCost || 0)
      }
    };
  } catch (error) {
    logger.error('Error getting license cost breakdown', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get time range start date
 */
function getTimeRangeStart(timeRange) {
  const now = new Date();
  switch (timeRange) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(0);
  }
}

module.exports = {
  comparePlatformCoverage,
  checkUseCaseCoverage,
  getLicenseCostBreakdown
};








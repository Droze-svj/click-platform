// Music Licensing Transparency Service
// Provides clear information about music rights and licensing

const logger = require('../utils/logger');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const AIMusicProviderConfig = require('../models/AIMusicProviderConfig');

/**
 * Get licensing transparency information
 */
async function getLicensingTransparencyInfo(userId) {
  try {
    // Get configured providers
    const licensedProviders = await MusicProviderConfig.find({ enabled: true }).lean();
    const aiProviders = await AIMusicProviderConfig.find({ enabled: true }).lean();

    // Build platform coverage
    const platformCoverage = getPlatformCoverage(licensedProviders, aiProviders);

    // Build rights explanation
    const rights = buildRightsExplanation(licensedProviders, aiProviders);

    // Build protection explanation
    const protection = buildProtectionExplanation();

    return {
      overview: {
        title: 'Music Rights & Licensing',
        description: 'Understanding your music rights and how Click protects you from copyright claims',
        lastUpdated: new Date()
      },
      whatYouCanDo: rights,
      platforms: platformCoverage,
      protection: protection,
      providers: {
      licensed: licensedProviders.map(p => ({
        name: p.provider,
        licenseType: p.licenseType || p.settings?.licenseType || 'platform',
        allowsMonetization: true,
        requiresAttribution: p.requiresAttribution || p.settings?.requiresAttribution || false
      })),
        aiGenerated: aiProviders.map(p => ({
          name: p.provider,
          licenseType: 'ai_generated',
          allowsMonetization: true,
          requiresAttribution: false
        }))
      }
    };
  } catch (error) {
    logger.error('Error getting licensing transparency info', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get platform coverage information
 */
function getPlatformCoverage(licensedProviders, aiProviders) {
  // Collect all covered platforms from providers
  const allPlatforms = new Set();

  licensedProviders.forEach(provider => {
    // Check if provider has platform information
    const platforms = provider.settings?.platforms || 
                     provider.licenseInfo?.platforms || 
                     ['all'];
    const platformArray = Array.isArray(platforms) ? platforms : [platforms];
    platformArray.forEach(p => allPlatforms.add(p));
  });

  // Standard platforms
  const standardPlatforms = [
    'youtube',
    'tiktok',
    'instagram',
    'facebook',
    'twitter',
    'linkedin',
    'vimeo',
    'twitch'
  ];

  // If 'all' is in the list, all platforms are covered
  if (allPlatforms.has('all')) {
    return standardPlatforms.map(platform => ({
      name: platform,
      covered: true,
      coverage: 'full',
      description: getPlatformDescription(platform)
    }));
  }

  // Otherwise, mark platforms based on provider coverage
  return standardPlatforms.map(platform => ({
    name: platform,
    covered: allPlatforms.has(platform),
    coverage: allPlatforms.has(platform) ? 'full' : 'partial',
    description: getPlatformDescription(platform)
  }));
}

/**
 * Get platform description
 */
function getPlatformDescription(platform) {
  const descriptions = {
    youtube: 'Full coverage including monetization',
    tiktok: 'Commercial use and monetization allowed',
    instagram: 'Commercial posts, Stories, and Reels',
    facebook: 'Commercial videos and ads',
    twitter: 'Commercial videos and promoted content',
    linkedin: 'Professional content and ads',
    vimeo: 'Commercial videos and portfolios',
    twitch: 'Live streams and VODs'
  };

  return descriptions[platform] || 'Commercial use allowed';
}

/**
 * Build rights explanation
 */
function buildRightsExplanation(licensedProviders, aiProviders) {
  return {
    commercialUse: {
      allowed: true,
      description: 'You can use all music from Click for commercial purposes',
      examples: [
        'Monetized YouTube videos',
        'Paid social media ads',
        'Client projects and deliverables',
        'Product demonstrations and marketing'
      ]
    },
    monetization: {
      allowed: true,
      description: 'You can monetize your content using Click\'s music library',
      examples: [
        'YouTube Partner Program revenue',
        'TikTok Creator Fund',
        'Instagram monetization',
        'Paid sponsorships and partnerships'
      ]
    },
    distribution: {
      allowed: true,
      description: 'You can distribute your videos on covered platforms',
      restrictions: [
        'Music must be used within video content',
        'Cannot distribute raw music files separately',
        'Must comply with platform-specific terms'
      ]
    },
    editing: {
      allowed: true,
      description: 'You can edit, trim, fade, and mix music tracks',
      examples: [
        'Trim tracks to match video length',
        'Adjust volume and apply effects',
        'Mix multiple tracks',
        'Create custom arrangements'
      ]
    },
    attribution: {
      required: 'sometimes',
      description: 'Some tracks require attribution, which Click handles automatically',
      howItWorks: 'When attribution is required, Click automatically adds it to your video description or metadata'
    }
  };
}

/**
 * Build protection explanation
 */
function buildProtectionExplanation() {
  return {
    howItWorks: {
      title: 'How Click Protects You',
      points: [
        {
          title: 'Licensed Catalog',
          description: 'All tracks in Click\'s catalog are properly licensed from reputable providers',
          details: 'We maintain licenses with providers like Soundstripe, Artlist, and others to ensure all music is legally cleared'
        },
        {
          title: 'AI-Generated Music',
          description: 'AI-generated tracks are created uniquely for you, eliminating copyright concerns',
          details: 'Each AI track is generated specifically for your project and doesn\'t exist elsewhere'
        },
        {
          title: 'Usage Tracking',
          description: 'Click tracks all music usage to maintain compliance records',
          details: 'Every track used in a render is logged with timestamps, platforms, and license information for your records'
        },
        {
          title: 'Platform Coverage',
          description: 'All music is licensed for use on major social platforms',
          details: 'Your tracks work on YouTube, TikTok, Instagram, LinkedIn, Facebook, and more'
        },
        {
          title: 'Automatic Attribution',
          description: 'When attribution is required, Click adds it automatically',
          details: 'No need to remember - attribution is handled automatically in video descriptions'
        }
      ]
    },
    whatYouGet: {
      title: 'What This Means for You',
      points: [
        'No copyright strikes or takedowns',
        'No need to negotiate individual licenses',
        'No attribution worries (handled automatically)',
        'Full commercial use rights',
        'Monetization on all covered platforms',
        'Peace of mind knowing you\'re protected'
      ]
    },
    limitations: {
      title: 'Important Limitations',
      points: [
        'Music must be used within video content (not as standalone audio)',
        'Cannot redistribute raw music files',
        'User-uploaded tracks require your own license attestation',
        'Must comply with platform-specific terms of service'
      ]
    },
    compliance: {
      title: 'Maintaining Compliance',
      description: 'Click helps you stay compliant by:',
      points: [
        'Logging all usage for audit trails',
        'Registering licenses with providers when required',
        'Tracking attribution requirements',
        'Providing compliance reports',
        'Monitoring license expiration'
      ]
    }
  };
}

/**
 * Get license summary for user
 */
async function getLicenseSummary(userId) {
  try {
    const info = await getLicensingTransparencyInfo(userId);

    return {
      summary: {
        commercialUse: 'Allowed',
        monetization: 'Allowed',
        platforms: info.platforms.filter(p => p.covered).length,
        attribution: 'Automatic when required'
      },
      quickFacts: [
        'All music is properly licensed',
        'Full commercial use rights',
        'Monetization allowed',
        'Covered on major platforms',
        'Attribution handled automatically'
      ]
    };
  } catch (error) {
    logger.error('Error getting license summary', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  getLicensingTransparencyInfo,
  getLicenseSummary
};


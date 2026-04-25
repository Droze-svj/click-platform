// Pricing Service
// Handle pricing calculations, comparisons, and recommendations

const MembershipPackage = require('../models/MembershipPackage');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get all active pricing tiers
 */
async function getPricingTiers() {
  try {
    const packages = await MembershipPackage.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    return packages.map(pkg => ({
      id: pkg._id,
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description,
      price: pkg.price,
      isCustom: pkg.pricing?.isCustom || false,
      contactSales: pkg.pricing?.contactSales || false,
      features: {
        videoProcessing: pkg.features.videoProcessing,
        contentGeneration: pkg.features.contentGeneration,
        limits: pkg.limits,
        agencyFeatures: pkg.agencyFeatures,
        enterpriseFeatures: pkg.enterpriseFeatures,
        businessIntelligence: pkg.businessIntelligence
      },
      highlights: getPackageHighlights(pkg)
    }));
  } catch (error) {
    logger.error('Error getting pricing tiers', { error: error.message });
    throw error;
  }
}

/**
 * Get package highlights for display
 */
function getPackageHighlights(membershipPackage) {
  const highlights = [];

  if (membershipPackage.limits.maxBrands === 1) {
    highlights.push('Single brand');
  } else if (membershipPackage.limits.maxBrands === 2) {
    highlights.push('2 brands');
  } else if (membershipPackage.limits.maxBrands > 2) {
    highlights.push(`${membershipPackage.limits.maxBrands} brands`);
  }

  if (membershipPackage.agencyFeatures.multiClientWorkspaces) {
    highlights.push('Multi-client workspaces');
  }

  if (membershipPackage.agencyFeatures.whiteLabelPortals) {
    highlights.push('White-label portals');
  }

  if (membershipPackage.enterpriseFeatures.sso) {
    highlights.push('SSO');
  }

  if (membershipPackage.enterpriseFeatures.sla) {
    highlights.push('SLA');
  }

  if (membershipPackage.businessIntelligence.advancedDashboards) {
    highlights.push('BI dashboards');
  }

  if (membershipPackage.features.analytics.apiAccess) {
    highlights.push('API access');
  }

  return highlights;
}

/**
 * Compare packages
 */
async function comparePackages(packageIds) {
  try {
    const packages = await MembershipPackage.find({
      _id: { $in: packageIds },
      isActive: true
    }).lean();

    const comparison = {
      packages: packages.map(pkg => ({
        name: pkg.name,
        price: pkg.price,
        features: pkg.features,
        limits: pkg.limits,
        agencyFeatures: pkg.agencyFeatures,
        enterpriseFeatures: pkg.enterpriseFeatures,
        businessIntelligence: pkg.businessIntelligence
      })),
      differences: findPackageDifferences(packages)
    };

    return comparison;
  } catch (error) {
    logger.error('Error comparing packages', { error: error.message });
    throw error;
  }
}

/**
 * Find differences between packages
 */
function findPackageDifferences(packages) {
  const differences = {
    pricing: [],
    features: [],
    limits: [],
    agencyFeatures: [],
    enterpriseFeatures: []
  };

  if (packages.length < 2) return differences;

  // Compare pricing
  packages.forEach((pkg, index) => {
    if (index === 0) return;
    const prev = packages[index - 1];
    if (pkg.price.monthly > prev.price.monthly) {
      differences.pricing.push({
        feature: 'Monthly price',
        [prev.name]: `$${prev.price.monthly}`,
        [pkg.name]: `$${pkg.price.monthly}`
      });
    }
  });

  // Compare limits
  const limitKeys = ['maxBrands', 'maxClientWorkspaces', 'maxTeamMembers', 'maxApiCallsPerDay'];
  limitKeys.forEach(key => {
    const values = packages.map(pkg => pkg.limits[key]);
    if (new Set(values).size > 1) {
      const diff = { feature: key };
      packages.forEach(pkg => {
        diff[pkg.name] = pkg.limits[key] === -1 ? 'Unlimited' : pkg.limits[key];
      });
      differences.limits.push(diff);
    }
  });

  return differences;
}

/**
 * Get recommended package for user
 */
async function getRecommendedPackage(userId, usageData = {}) {
  try {
    const user = await User.findById(userId).populate('membershipPackage');
    const packages = await MembershipPackage.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    const currentPackage = user.membershipPackage;
    const recommendations = [];

    // Analyze usage
    const {
      videosPerMonth = 0,
      contentGenerationsPerMonth = 0,
      brands = 1,
      teamMembers = 1,
      needsMultiClient = false,
      needsWhiteLabel = false,
      needsSSO = false
    } = usageData;

    // Check if user needs to upgrade
    for (const pkg of packages) {
      if (currentPackage && pkg._id.toString() === currentPackage._id.toString()) {
        continue; // Skip current package
      }

      let score = 0;
      const reasons = [];

      // Check video processing needs
      if (videosPerMonth > 0) {
        if (pkg.features.videoProcessing.maxVideosPerMonth === -1 || 
            pkg.features.videoProcessing.maxVideosPerMonth >= videosPerMonth) {
          score += 10;
        } else {
          continue; // Package doesn't meet needs
        }
      }

      // Check content generation needs
      if (contentGenerationsPerMonth > 0) {
        if (pkg.features.contentGeneration.maxGenerationsPerMonth === -1 ||
            pkg.features.contentGeneration.maxGenerationsPerMonth >= contentGenerationsPerMonth) {
          score += 10;
        } else {
          continue;
        }
      }

      // Check brand needs
      if (brands > 1) {
        if (pkg.limits.maxBrands === -1 || pkg.limits.maxBrands >= brands) {
          score += 20;
          reasons.push(`Supports ${pkg.limits.maxBrands === -1 ? 'unlimited' : pkg.limits.maxBrands} brands`);
        } else {
          continue;
        }
      }

      // Check multi-client needs
      if (needsMultiClient && pkg.agencyFeatures.multiClientWorkspaces) {
        score += 30;
        reasons.push('Multi-client workspace management');
      }

      // Check white-label needs
      if (needsWhiteLabel && pkg.agencyFeatures.whiteLabelPortals) {
        score += 30;
        reasons.push('White-label portals');
      }

      // Check SSO needs
      if (needsSSO && pkg.enterpriseFeatures.sso) {
        score += 30;
        reasons.push('SSO support');
      }

      // Check team size
      if (teamMembers > 1) {
        if (pkg.limits.maxTeamMembers === -1 || pkg.limits.maxTeamMembers >= teamMembers) {
          score += 10;
          reasons.push(`Supports ${pkg.limits.maxTeamMembers === -1 ? 'unlimited' : pkg.limits.maxTeamMembers} team members`);
        }
      }

      if (score > 0) {
        recommendations.push({
          package: pkg,
          score,
          reasons,
          monthlyPrice: pkg.price.monthly,
          yearlyPrice: pkg.price.yearly
        });
      }
    }

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    return {
      currentPackage: currentPackage ? {
        name: currentPackage.name,
        slug: currentPackage.slug,
        price: currentPackage.price
      } : null,
      recommendations: recommendations.slice(0, 3), // Top 3 recommendations
      usageAnalysis: {
        videosPerMonth,
        contentGenerationsPerMonth,
        brands,
        teamMembers
      }
    };
  } catch (error) {
    logger.error('Error getting recommended package', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate savings for yearly plan
 */
function calculateYearlySavings(monthlyPrice, yearlyPrice) {
  if (!monthlyPrice || !yearlyPrice) return null;

  const monthlyTotal = monthlyPrice * 12;
  const savings = monthlyTotal - yearlyPrice;
  const savingsPercent = Math.round((savings / monthlyTotal) * 100);

  return {
    amount: savings,
    percent: savingsPercent,
    monthlyEquivalent: Math.round(yearlyPrice / 12 * 100) / 100
  };
}

/**
 * Get pricing comparison with competitors
 */
function getCompetitorComparison() {
  return {
    creator: {
      click: { price: 19, features: ['2 brands', '100 videos/month', '300 content generations', '20GB storage'] },
      opusclip: { price: 15, features: ['1 brand', '150 credits/month', 'Basic features'] },
      vizard: { price: 30, features: ['300 minutes/month', 'Basic features'] }
    },
    agency: {
      click: { price: 149, features: ['Multi-client', 'White-label', 'BI dashboards', 'Approvals', '10 brands'] },
      competitors: { note: 'Most competitors don\'t offer multi-client management at this price point' }
    },
    enterprise: {
      click: { price: 'Custom', features: ['SSO', 'SLA', 'Advanced integrations', 'Full API', 'Dedicated support'] },
      note: 'Contact sales for custom pricing'
    }
  };
}

module.exports = {
  getPricingTiers,
  comparePackages,
  getRecommendedPackage,
  calculateYearlySavings,
  getCompetitorComparison
};


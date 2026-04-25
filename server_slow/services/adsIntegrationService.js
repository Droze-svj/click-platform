const logger = require('../utils/logger');

/**
 * Task 8.3: Direct-to-Ads Integration
 * Logic for pushing top-performing variants to paid social tests.
 */

async function calculateAdPotential(hookScore, salesScore) {
  // Threshold: Hook > 85 AND Sales > 70
  const isHighPotential = hookScore >= 85 && salesScore >= 70;

  return {
    isHighPotential,
    recommendedBudget: isHighPotential ? 5 : 0,
    platform: 'TikTok Ads',
    reason: isHighPotential
      ? 'Exceptional hook velocity detected. Low-CAC test recommended.'
      : 'Hook or Sales potential below auto-scaling threshold.'
  };
}

async function launchTestAd(videoId, platform = 'tiktok', budget = 5) {
  logger.info('Launching test ad', { videoId, platform, budget });

  // Mock API integration with TikTok Ads / Meta Ads
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        adId: `ad_${Date.now()}`,
        status: 'pending_review',
        dailyBudget: budget,
        currency: 'USD',
        monitoringEnabled: true
      });
    }, 1500);
  });
}

module.exports = {
  calculateAdPotential,
  launchTestAd
};

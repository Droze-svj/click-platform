const logger = require('../utils/logger');
const sovereigntyEngine = require('./sovereigntyEngine2Service');
const contentPerformance = require('./contentPerformanceService');
const videoRender = require('./videoRenderService');

/**
 * Phoenix Protocol Service: Dynamic Asset Re-Rendering
 * Autonomously re-renders underperforming content with fresh hooks.
 */
class PhoenixProtocolService {
  constructor() {
    this.activeRecoveries = [];
    this.performanceThreshold = 0.3; // 30% of predicted reach
  }

  /**
   * Monitor an asset and trigger Phoenix protocol if needed
   * @param {string} userId
   * @param {string} contentId
   * @param {string} assetId
   */
  async monitorAndHeal(userId, contentId, assetId) {
    try {
      const stats = await contentPerformance.getAssetPerformance(assetId);
      const prediction = await contentPerformance.getPredictionForAsset(assetId);

      const actualReach = stats.reach || 0;
      const predictedReach = prediction.predictedReach || 1;
      const performanceRatio = actualReach / predictedReach;

      if (performanceRatio < this.performanceThreshold) {
        logger.info('Phoenix Protocol Triggered: Underperformance Detected', { 
          assetId, 
          performanceRatio, 
          threshold: this.performanceThreshold 
        });

        return await this.initiateRecovery(userId, contentId, assetId);
      }

      return { status: 'healthy', performanceRatio };
    } catch (error) {
      logger.error('Error in monitorAndHeal', { error: error.message });
      throw error;
    }
  }

  /**
   * Initiate the "Phoenix Hook" re-render process
   */
  async initiateRecovery(userId, contentId, assetId) {
    logger.info('Initiating Phoenix Recovery: Generating New Hook');

    // Step 1: Sovereignty Engine generates a "Phoenix Hook" (Hyper-Optimized Revision)
    const originalContent = "Original underperforming hook"; // Mock retrieval
    const debate = await sovereigntyEngine.conductDebate(userId, originalContent, {
      platform: 'social',
      context: 'PHOENIX_RECOVERY_MODE'
    });

    const newHook = debate.finalHook;

    // Step 2: Queue Re-Render
    const renderJob = await videoRender.initiateRender(userId, contentId, {
      injectedHook: newHook,
      priority: 'critical_recovery',
      meta: { phoenixProtocolId: `PHX-${Date.now()}` }
    });

    const recovery = {
      recoveryId: `PHX-${Date.now()}`,
      assetId,
      newHook,
      renderJobId: renderJob.id,
      status: 're-rendering'
    };

    this.activeRecoveries.push(recovery);

    return recovery;
  }
}

module.exports = new PhoenixProtocolService();

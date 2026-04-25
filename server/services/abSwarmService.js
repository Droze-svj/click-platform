const logger = require('../utils/logger');
const Content = require('../models/Content');
const socialMediaService = require('./socialMediaService');
const videoMetricsService = require('./videoMetricsService');

/**
 * Autonomous A/B Swarm Orchestrator (Phase 18)
 * Manages the lifecycle of content variants.
 */
class ABSwarmService {
  /**
   * Initialize an A/B Swarm test for a content piece
   */
  async initializeSwarm(userId, contentId, variants) {
    try {
      logger.info('Phase 18: Initializing A/B Swarm Swarm...', { contentId, variantCount: variants.length });
      
      const testId = `swarm_${Date.now()}`;
      const abTestMeta = {
        testId,
        status: 'active',
        createdAt: new Date(),
        testGroups: variants.map((v, index) => ({
          variantId: `v${index + 1}`,
          hook: v.hook,
          renderUrl: v.url,
          platform: v.platform,
          performance: { views: 0, engagement: 0 }
        }))
      };

      await Content.findByIdAndUpdate(contentId, {
        $set: { 'pipeline.abTests.default': abTestMeta }
      });

      return testId;
    } catch (error) {
      logger.error('AB Swarm initialization failed', { error: error.message, contentId });
      throw error;
    }
  }

  /**
   * Evaluate the Swarm and decide on a Champion (Hybrid Logic)
   * Triggered by a scheduler or metric update
   */
  async evaluateSwarm(contentId) {
    try {
      const content = await Content.findById(contentId);
      if (!content || !content.pipeline?.abTests?.default) return;

      const swarm = content.pipeline.abTests.default;
      if (swarm.status !== 'active') return;

      const HOURS_THRESHOLD = 6;
      const VIEWS_THRESHOLD = 1000;
      
      const startTime = new Date(swarm.createdAt);
      const now = new Date();
      const hoursElapsed = (now - startTime) / (1000 * 60 * 60);

      // Get latest metrics for all variants
      let maxViews = 0;
      let championId = null;
      let totalSwarmViews = 0;

      for (const group of swarm.testGroups) {
        // In a real scenario, this would query platform analytics via socialMediaService
        // For simulation, we'll assume metrics are synced to the group object
        const currentViews = group.performance.views || 0;
        totalSwarmViews += currentViews;
        
        if (currentViews > maxViews) {
          maxViews = currentViews;
          championId = group.variantId;
        }
      }

      const reachedTimeLimit = hoursElapsed >= HOURS_THRESHOLD;
      const reachedDataLimit = totalSwarmViews >= VIEWS_THRESHOLD;

      if (reachedTimeLimit || reachedDataLimit) {
        logger.info('Phase 18 Success: Hybrid victory condition reached!', { 
          contentId, 
          hoursElapsed, 
          totalSwarmViews,
          winningVariant: championId
        });
        
        await this.finalizeChampion(contentId, championId);
      }
    } catch (error) {
      logger.error('AB Swarm evaluation failed', { error: error.message, contentId });
    }
  }

  /**
   * Finalize the Champion and execute 'Auto-Killer' on Challengers
   */
  async finalizeChampion(contentId, winnerId) {
    try {
      const content = await Content.findById(contentId);
      const swarm = content.pipeline.abTests.default;
      
      logger.info(`Finalizing A/B Swarm: Winner is ${winnerId}. Executing Auto-Killer...`);

      const challengers = swarm.testGroups.filter(g => g.variantId !== winnerId);
      const results = {
        champion: winnerId,
        killedCount: 0,
        errors: []
      };

      for (const challenger of challengers) {
        if (challenger.externalId) {
          try {
            await socialMediaService.deleteFromSocial(content.userId, challenger.platform, challenger.externalId);
            results.killedCount++;
          } catch (err) {
            results.errors.push({ variantId: challenger.variantId, error: err.message });
          }
        }
      }

      // Update Swarm status
      await Content.findByIdAndUpdate(contentId, {
        $set: { 
          'pipeline.abTests.default.status': 'completed',
          'pipeline.abTests.default.results': results
        }
      });

      logger.info('Phase 18 Lifecycle Complete: Champion crowned and Challengers neutralized.');
      return results;
    } catch (error) {
      logger.error('AB Swarm finalization failed', { error: error.message, contentId });
      throw error;
    }
  }
}

module.exports = new ABSwarmService();

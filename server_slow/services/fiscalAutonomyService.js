/**
 * FiscalAutonomyService
 * The "Revenue Steering" brain for Phase 25.
 * Manages autonomous monetization pivots and fiscal velocity tracking.
 */

const logger = require('../utils/logger');
const MonetizationPlan = require('../models/MonetizationPlan');
const RevenueAttribution = require('../models/RevenueAttribution');
const arbitrageSteering = require('./arbitrageSteeringService');
const brandedLink = require('./brandedLinkService');
const monetizationService = require('./monetizationService');

class FiscalAutonomyService {
  /**
   * Calculate Fiscal Velocity
   * Measures revenue generation rate from autonomous dispatches
   */
  async calculateFiscalVelocity(userId) {
    try {
      const now = new Date();
      const pulseStart = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      
      const attributions = await RevenueAttribution.find({
        workspaceId: userId, // Assuming userId maps to primary workspace for sovereign
        createdAt: { $gte: pulseStart }
      }).lean();

      const totalRevenue = attributions.reduce((sum, a) => sum + (a.revenue.attributed || 0), 0);
      const totalClicks = attributions.reduce((sum, a) => sum + (a.metrics.clicks || 0), 0);
      
      const rpd = attributions.length > 0 ? totalRevenue / attributions.length : 0; // Revenue Per Dispatch
      const epc = totalClicks > 0 ? totalRevenue / totalClicks : 0; // Earnings Per Click

      return {
        rpd,
        epc,
        pulseRevenue: totalRevenue,
        pulseClicks: totalClicks,
        velocity: totalRevenue / 24, // Revenue per hour
        timestamp: now
      };
    } catch (error) {
      logger.error('Fiscal: Velocity calculation failed', { error: error.message });
      return { velocity: 0, rpd: 0, epc: 0 };
    }
  }

  /**
   * Get Optimal Monetization Node
   * Selects the highest-yield Whop/Shopify link for a post based on niche
   */
  async getOptimalMonetizationNode(userId, niche, contentSummary) {
    try {
      logger.info('Fiscal: Seeking optimal monetization node', { niche });
      
      // 1. Get manifest from Arbitrage Steering
      const steer = await arbitrageSteering.getSteeringManifest();
      
      // 2. Select offer based on niche alignment
      const bestOffer = steer.manifest.find(o => 
        o.tags && o.tags.some(t => t.toLowerCase().includes(niche.toLowerCase()))
      ) || steer.activeSteer;

      // 3. Create a branded tracking link
      // We use a specific campaign name for Phase 25 dispatches
      const link = await brandedLink.createBrandedLink(userId, userId, {
        originalUrl: bestOffer.id.includes('http') ? bestOffer.id : `https://whop.com/checkout/${bestOffer.id}`,
        metadata: {
          title: `Fiscal Autonomous: ${bestOffer.name}`,
          source: 'neural_broadcaster',
          niche: niche
        },
        tracking: { enabled: true, trackClicks: true }
      });

      return {
        offer: bestOffer,
        shortUrl: link.shortUrl,
        cta: `Enroll in ${bestOffer.name} here: ${link.shortUrl}`,
        confidence: bestOffer.cvr
      };
    } catch (error) {
      logger.error('Fiscal: Node selection failed', { error: error.message });
      return null;
    }
  }

  /**
   * Autonomous Fiscal Pivot
   * Triggers a pivot if yield gap exceeds 20% (Aggressive Decision)
   */
  async triggerAutonomousFiscalPivot(userId) {
    const AGGRESSIVE_THRESHOLD = 0.20; 
    
    try {
      const steer = await arbitrageSteering.getSteeringManifest();
      if (steer.autonomyState.superiority > AGGRESSIVE_THRESHOLD) {
        logger.info('Fiscal: High-Yield gap detected. Triggering autonomous monetize pivot.', { 
           delta: steer.autonomyState.superiority 
        });
        
        const governanceLedger = require('./governanceLedgerService');
        await governanceLedger.logAction(userId, 'fiscal_autonomy_pivot', {
          newWinner: steer.activeSteer.name,
          superiority: steer.autonomyState.superiority,
          status: 'executed'
        });

        return { pivoted: true, offer: steer.activeSteer };
      }
      return { pivoted: false };
    } catch (error) {
      logger.error('Fiscal: Pivot failed', { error: error.message });
      return { pivoted: false };
    }
  }
}

module.exports = new FiscalAutonomyService();

const MonetizationPlan = require('../models/MonetizationPlan');
const Conversion = require('../models/Conversion');
const ClickTracking = require('../models/ClickTracking');
const SteeringDecision = require('../models/SteeringDecision');
const logger = require('../utils/logger');

/**
 * ArbitrageSteeringService (Phase 11)
 *
 * Builds the user's REAL monetization offer set from their configured
 * MonetizationPlan triggers and enriches each with REAL performance computed
 * from their actual Conversion / ClickTracking data. Steering decisions are
 * persisted as real records. No hardcoded offers, no fabricated metrics.
 */

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

class ArbitrageSteeringService {
  /**
   * Real offers derived from the user's monetization plans + live performance.
   * Returns [] when the user has configured no monetization products.
   */
  async getActiveOffers(userId) {
    if (!userId) return [];

    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

    const plans = await MonetizationPlan.find({ userId }).lean();

    // Collect distinct products (offers) across all of the user's plans.
    const products = new Map();
    for (const plan of plans) {
      for (const trigger of (plan.triggers || [])) {
        if (!trigger || trigger.isActive === false) continue;
        const key = trigger.productId || trigger.productName;
        if (!key) continue;
        if (!products.has(String(key))) {
          products.set(String(key), {
            id: String(key),
            name: trigger.productName || 'Untitled Offer',
            platform: plan.provider || 'custom',
            category: plan.provider || 'monetization',
            pcv: trigger.productPrice || 0,
            checkoutUrl: trigger.checkoutUrl || null,
            tags: []
          });
        }
      }
    }

    if (products.size === 0) return [];

    // Real denominator for conversion rate: the user's clicks in the window.
    const totalClicks = await ClickTracking.countDocuments({
      userId,
      'click.timestamp': { $gte: since }
    });

    const offers = [];
    for (const [key, offer] of products) {
      const baseFilter = { userId, 'conversionData.productId': key };
      const conversions = await Conversion.countDocuments({
        ...baseFilter,
        'conversionData.timestamp': { $gte: since }
      });
      const recent7 = await Conversion.countDocuments({
        ...baseFilter,
        'conversionData.timestamp': { $gte: sevenDaysAgo }
      });

      const conversionRate = totalClicks > 0 ? conversions / totalClicks : 0;
      const velocity = recent7 >= 10 ? 'High' : recent7 >= 3 ? 'Medium' : recent7 > 0 ? 'Low' : 'Idle';

      offers.push({
        ...offer,
        conversions,
        conversionRate,
        // `cvr` kept as an alias for backward-compatible consumers.
        cvr: conversionRate,
        velocity
      });
    }

    // Highest expected value first (real conversion rate × real payout value).
    offers.sort((a, b) => (b.conversionRate * b.pcv) - (a.conversionRate * a.pcv));
    return offers;
  }

  /**
   * Persist a real steering decision and return a confirmation.
   */
  async steerFunnel(userId, offerId, targetNiche) {
    if (!userId || !offerId) {
      throw new Error('userId and offerId are required to steer the funnel');
    }

    let offerName = '';
    try {
      const offers = await this.getActiveOffers(userId);
      offerName = offers.find(o => o.id === String(offerId))?.name || '';
    } catch (e) {
      // Non-fatal — record the decision regardless.
    }

    const decision = await SteeringDecision.create({
      userId,
      offerId: String(offerId),
      offerName,
      targetNiche: targetNiche || null
    });

    logger.info('Arbitrage funnel steered', { userId, offerId, targetNiche });
    return {
      status: 'steered',
      offerId: decision.offerId,
      offerName: decision.offerName,
      targetNiche: decision.targetNiche,
      steeredAt: decision.createdAt
    };
  }

  /**
   * Steering manifest computed from the user's real offers.
   */
  async getSteeringManifest(userId) {
    const offers = await this.getActiveOffers(userId);
    const prioritized = offers.map(o => ({ ...o, priority: o.conversionRate * o.pcv }));

    const currentWinner = prioritized[0];
    const competitor = prioritized[1];

    if (!currentWinner) {
      return {
        activeSteer: null,
        manifest: [],
        autonomyState: {
          canAutoSteer: false,
          superiority: '0.00',
          recommendation: 'NO_ACTIVE_OFFERS'
        },
        recommendation: 'No active monetization offers to steer toward.',
        timestamp: new Date()
      };
    }

    const superiority = (competitor && competitor.priority > 0)
      ? (currentWinner.priority - competitor.priority) / competitor.priority
      : null;
    const canAutoSteer = superiority !== null && superiority > 0.30;

    return {
      activeSteer: currentWinner,
      manifest: prioritized,
      autonomyState: {
        canAutoSteer,
        superiority: superiority !== null ? superiority.toFixed(2) : null,
        recommendation: canAutoSteer ? 'EXECUTE_AUTO_PIVOT' : 'AWAIT_APPROVAL'
      },
      recommendation: superiority !== null
        ? `High-Confidence pivot toward ${currentWinner.name} (${(superiority * 100).toFixed(0)}% delta).`
        : `Only one active offer (${currentWinner.name}); no competing offer to compare.`,
      timestamp: new Date()
    };
  }
}

module.exports = new ArbitrageSteeringService();

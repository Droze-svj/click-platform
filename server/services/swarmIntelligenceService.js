const logger = require('../utils/logger');
const crypto = require('crypto');
const TrendSnapshot = require('../models/TrendSnapshot');

/**
 * SwarmIntelligenceService
 * Surfaces the "Global Intelligence" pulse from real, ingested trend data.
 *
 * NOTE: A true cross-creator federated "swarm ledger" (active creator nodes,
 * shared breakthrough sync) is not yet implemented — there is no backing store
 * for it. Rather than fabricate node counts and viral scores, this service now
 * reads real trend signals from the TrendSnapshot collection (populated by the
 * trends-ingest job) and returns honest zero/empty values for the aspirational
 * federated-network metrics that have no real data source.
 */

class SwarmIntelligenceService {
  /**
   * Get the current global intelligence snapshot, filtered by content niche.
   * Trending signals are sourced from the most recent real TrendSnapshot.
   */
  async getPulse(niche = 'general') {
    logger.info('Swarm: Fetching Niche-Specific Global Pulse', { niche });

    let trendingSignals = [];
    try {
      // Pull the most recent real trend snapshot across all platforms.
      const snapshot = await TrendSnapshot.findOne({})
        .sort({ capturedAt: -1 })
        .lean();

      if (snapshot && Array.isArray(snapshot.items)) {
        trendingSignals = snapshot.items
          .slice()
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 8)
          .map(item => ({
            tactic: item.label,
            // Real velocity from rank-change vs previous snapshot.
            viralScore: typeof item.velocity === 'number' ? item.velocity : 0,
            description: `${item.kind || 'signal'} trending on ${snapshot.platform || 'all'}`,
            platform: snapshot.platform || 'all',
            // Status derived from real velocity, not random drift.
            status: (item.velocity || 0) > 0.5 ? 'DOMINANT' : (item.velocity || 0) > 0 ? 'RISING' : 'STABLE'
          }));
      }
    } catch (err) {
      logger.error('Swarm: Failed to load trend snapshot, returning empty signals', { error: err.message });
      trendingSignals = [];
    }

    return {
      snapshot: {
        // No federated creator-node network exists yet; report honest zero
        // rather than a fabricated count.
        activeNodes: 0,
        lastSync: new Date(),
        nicheContext: niche.toUpperCase(),
        trendingSignals
      }
    };
  }

  /**
   * Sync a local breakthrough to the global ledger.
   *
   * The federated ledger has no backing store yet, so we acknowledge the
   * request (with a real id) but do NOT fabricate a "network impact" metric.
   */
  async syncLocalBreakthrough(data) {
    const { localVirality, tacticUsed, niche } = data || {};
    logger.info('Swarm: Syncing local breakthrough node', { tacticUsed, localVirality, niche });

    return {
      success: true,
      syncId: `sync_${crypto.randomBytes(4).toString('hex')}`,
      // No real federated network to measure impact against — honest zero.
      networkImpact: 0,
      // Ledger persistence is not yet implemented; report honestly.
      ledgerUpdated: false
    };
  }
}

module.exports = new SwarmIntelligenceService();

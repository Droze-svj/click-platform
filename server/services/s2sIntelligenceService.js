const mongoose = require('mongoose');
const crypto = require('crypto');
const KnowledgeEntry = require('../models/KnowledgeEntry');
const FleetNode = require('../models/FleetNode');
const Conversion = require('../models/Conversion');
const logger = require('../utils/logger');

/**
 * S2SIntelligenceService (Phase 12)
 *
 * Tactical knowledge ledger + network health, backed by real persistence and
 * the user's real fleet/conversion data. Replaces the previous in-memory
 * hardcoded ledger and Math.random()-based "pulse" numbers.
 */

class S2SIntelligenceService {
  /**
   * Broadcast a Knowledge Pulse: persist/reinforce a tactic in the ledger.
   * "nodesInformed" is the user's REAL fleet size (not a random number).
   */
  async broadcastPulse(userId, tacticData = {}) {
    if (!tacticData.tactic) {
      throw new Error('tactic is required to broadcast a pulse');
    }

    const pulseId = `kp_${crypto.randomBytes(4).toString('hex')}`;
    const nodesInformed = userId ? await FleetNode.countDocuments({ userId, status: 'online' }) : 0;
    const confidence = typeof tacticData.confidence === 'number' ? tacticData.confidence : 0.5;

    const existing = await KnowledgeEntry.findOne({ userId: userId || null, tactic: tacticData.tactic });
    let entry;
    if (existing) {
      // Reinforce: rolling average of viral score, real pulse count.
      existing.viralScore = Math.max(0, Math.min(1, (existing.viralScore + confidence) / 2));
      existing.pulseCount += 1;
      existing.lastSource = tacticData.source || 'local';
      entry = await existing.save();
    } else {
      entry = await KnowledgeEntry.create({
        userId: userId || null,
        tactic: tacticData.tactic,
        viralScore: Math.max(0, Math.min(1, confidence)),
        pulseCount: 1,
        lastSource: tacticData.source || 'local'
      });
    }

    logger.info('S2S pulse persisted', { userId, tactic: tacticData.tactic, nodesInformed });

    return {
      pulseId,
      tactic: entry.tactic,
      impact: {
        nodesInformed,
        viralScore: entry.viralScore,
        pulseCount: entry.pulseCount
      },
      timestamp: new Date()
    };
  }

  /**
   * Real knowledge-ledger snapshot from persisted entries.
   */
  async getKnowledgeLedger(userId = null) {
    const entries = await KnowledgeEntry.find({ userId: userId || null })
      .sort({ viralScore: -1 })
      .limit(50)
      .lean();

    const swarmHealth = entries.length
      ? entries.reduce((sum, e) => sum + (e.viralScore || 0), 0) / entries.length
      : 0;

    return {
      ledger: entries.map(e => ({
        tactic: e.tactic,
        viralScore: e.viralScore,
        pulseCount: e.pulseCount,
        lastSource: e.lastSource
      })),
      swarmHealth,
      lastSync: new Date()
    };
  }

  /**
   * Real network health for the overlord encirclement panel:
   *  - health: derived from the user's real FleetNode online ratio + health scores
   *  - overLordStats.totalRevenueAggregated: real attributed revenue
   *  - overLordStats.victoriesToday: real conversions recorded today
   *  - ledger: real recent conversion activity
   */
  async getNetworkHealth(userId) {
    if (!userId) {
      return {
        timestamp: new Date(),
        health: 0,
        overLordStats: { totalRevenueAggregated: 0, victoriesToday: 0, totalNodes: 0, onlineNodes: 0 },
        ledger: []
      };
    }

    const nodes = await FleetNode.find({ userId }).lean();
    const onlineNodes = nodes.filter(n => n.status === 'online').length;
    const avgHealth = nodes.length
      ? nodes.reduce((sum, n) => sum + ((n.metrics?.healthScore || 0) / 100), 0) / nodes.length
      : 0;
    // 0..1 health: half from online ratio, half from average node health.
    const health = nodes.length
      ? ((onlineNodes / nodes.length) * 0.5) + (avgHealth * 0.5)
      : 0;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let userObjectId = null;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (e) {
      userObjectId = null;
    }

    const victoriesToday = await Conversion.countDocuments({
      userId,
      'conversionData.timestamp': { $gte: startOfDay }
    });

    let totalRevenueAggregated = 0;
    if (userObjectId) {
      const agg = await Conversion.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$revenue.attributed', '$conversionValue'] } } } }
      ]);
      totalRevenueAggregated = agg[0]?.total || 0;
    }

    const recent = await Conversion.find({ userId })
      .sort({ 'conversionData.timestamp': -1 })
      .limit(12)
      .lean();

    const ledger = recent.map(c => {
      const ts = c.conversionData?.timestamp || c.createdAt || new Date();
      const value = c.revenue?.attributed || c.conversionValue || 0;
      return {
        timestamp: new Date(ts).toLocaleTimeString(),
        channel: (c.platform || 'system').toUpperCase(),
        message: `${c.conversionType || 'conversion'} • $${Number(value).toFixed(2)}`
      };
    });

    return {
      timestamp: new Date(),
      health,
      overLordStats: {
        totalRevenueAggregated,
        victoriesToday,
        totalNodes: nodes.length,
        onlineNodes
      },
      ledger
    };
  }
}

module.exports = new S2SIntelligenceService();

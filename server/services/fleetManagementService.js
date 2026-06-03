const FleetNode = require('../models/FleetNode');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * FleetManagementService
 * Orchestrates decentralized nodes across the Sovereign Network.
 * Handles node lifecycle, health, and expansion recommendations.
 */

class FleetManagementService {
  /**
   * Register a new node to the fleet with automated credential handshaking
   */
  async registerNode(userId, nodeData) {
    logger.info(`Fleet: Registering new node for user ${userId}`, { name: nodeData.name });
    
    try {
      const node = await FleetNode.findOneAndUpdate(
        { userId, nodeUri: nodeData.nodeUri },
        { 
          ...nodeData, 
          userId, 
          status: nodeData.status || 'calibrating',
          lastPulse: new Date(),
          metadata: {
            ...nodeData.metadata,
            nodeSecret: crypto.randomBytes(32).toString('hex')
          }
        },
        { upsert: true, new: true }
      );
      return node;
    } catch (err) {
      logger.error('Fleet: Registration failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Get all nodes with real-time health aggregation
   */
  async getFleetStatus(userId) {
    const nodes = await FleetNode.find({ userId });
    
    // Perform state cleanup for stale nodes
    const now = new Date();
    const stalenessThreshold = 5 * 60 * 1000; // 5 minutes

    const pulseOf = (n) => n.metrics?.lastPulse ? new Date(n.metrics.lastPulse).getTime() : 0;
    const aggregation = {
      totalNodes: nodes.length,
      onlineNodes: nodes.filter(n => (now - pulseOf(n)) < stalenessThreshold && n.status === 'online').length,
      warningNodes: nodes.filter(n => (now - pulseOf(n)) >= stalenessThreshold && n.status !== 'offline').length,
      totalRevenue: nodes.reduce((sum, n) => sum + (n.metrics?.revenueDay || 0), 0),
      activeGenerations: nodes.reduce((sum, n) => sum + (n.metrics?.activeGenerations || 0), 0),
      // Real integrity = average node health score (0..1); 0 when no nodes.
      networkIntegrity: nodes.length
        ? nodes.reduce((sum, n) => sum + ((n.metrics?.healthScore || 0) / 100), 0) / nodes.length
        : 0
    };

    return {
      nodes,
      aggregation,
      recommendation: this.generateExpansionRecommendation(aggregation),
      timestamp: new Date()
    };
  }

  /**
   * Generate highly targetted expansion recommendations based on ROI
   */
  generateExpansionRecommendation(aggregation) {
    const { totalRevenue, totalNodes, onlineNodes } = aggregation;
    const epn = totalNodes > 0 ? totalRevenue / totalNodes : 0; // Revenue per node

    if (totalRevenue > 1000 && onlineNodes === totalNodes) {
      return {
        type: 'SCALE_UP',
        msg: `High yielding network detected ($${epn.toFixed(2)}/node). Recommend adding 1-2 remote instances to maximize arbitrage capture.`,
        priority: 'high',
        potentialLift: 0.15
      };
    }

    if (onlineNodes < totalNodes * 0.7) {
      return {
        type: 'STABILIZE',
        msg: 'Significant node drift detected. Stabilize existing fleet before further expansion.',
        priority: 'critical'
      };
    }

    return null;
  }

  /**
   * Update node metrics via Pulse handshake
   */
  async updateNodePulse(userId, nodeUri, metrics) {
    return await FleetNode.findOneAndUpdate(
      { userId, nodeUri },
      { 
        $set: { 
          'metrics': metrics,
          'status': 'online',
          'lastPulse': new Date() 
        } 
      },
      { new: true }
    );
  }
}

module.exports = new FleetManagementService();

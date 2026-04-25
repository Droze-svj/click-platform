const logger = require('../utils/logger');
const GovernanceAction = require('../models/GovernanceAction');

/**
 * Phase 22: Autonomous Governance Ledger
 * Recording the "Neural Audit Trail" of the Sovereign Agency.
 */
class GovernanceLedgerService {
  /**
   * Record an immutable agency decision
   */
  async recordAction(userId, data) {
    const { 
      actionType, 
      resourceId, 
      resourceType, 
      justification, 
      severity = 'low',
      metadata = {} 
    } = data;

    try {
      // 1. Calculate Decision Hash (SHA-256) for immutability
      const crypto = require('crypto');
      const hashContent = `${userId}-${actionType}-${resourceId}-${JSON.stringify(metadata)}-${Date.now()}`;
      const decisionHash = crypto.createHash('sha256').update(hashContent).digest('hex');

      const action = new GovernanceAction({
        userId,
        actionType,
        resourceId,
        resourceType,
        justification,
        severity,
        metadata: {
          ...metadata,
          decisionHash,
          immutableAnchor: true
        }
      });

      await action.save();
      
      logger.info(`Governance Ledger [HARDENED]: Action Recorded - ${actionType}`, { 
        userId, 
        actionId: action._id,
        hash: decisionHash.substring(0, 8)
      });

      return action;
    } catch (error) {
      logger.error('Governance Ledger Failure', { error: error.message, actionType });
      return null;
    }
  }

  /**
   * Fetch recent decisions for the dashboard
   */
  async getRecentActions(userId, limit = 20) {
    return GovernanceAction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new GovernanceLedgerService();

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * SovereignLedgerService
 * Implements a "Light Chain" audit trail for autonomous AI decisions.
 * Each decision is hashed and linked to the previous decision, creating an immutable history.
 */

class ClickLedgerService {
  constructor() {
    this.chain = [];
    this.pendingDecisions = [];

    // Initial "Genesis" block
    this.createBlock(0, "0", { event: "LEDGER_INITIALIZED", system: "Click_Agency_v1" });
  }

  /**
   * Calculate SHA-256 hash of a block
   */
  calculateHash(index, previousHash, timestamp, data) {
    const stringToHash = `${index}${previousHash}${timestamp}${JSON.stringify(data)}`;
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
  }

  /**
   * Create a new block in the ledger
   */
  createBlock(index, previousHash, data) {
    const timestamp = Date.now();
    const hash = this.calculateHash(index, previousHash, timestamp, data);

    const block = {
      index,
      timestamp,
      previousHash,
      hash,
      data,
      signature: `SUBSTANCE_${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    };

    this.chain.push(block);
    return block;
  }

  /**
   * Record a new autonomous decision
   */
  async recordDecision(type, agent, decision, fiscalMetadata = null) {
    logger.info('Recording Autonomous Decision in Ledger', { type, agent });

    const lastBlock = this.chain[this.chain.length - 1];
    const newBlock = this.createBlock(
      this.chain.length,
      lastBlock.hash,
      {
        type,
        agent,
        decision,
        fiscal: fiscalMetadata ? {
          revenueImpact: fiscalMetadata.revenue || 0,
          payoutStatus: 'pending_bridge',
          payoutId: fiscalMetadata.payoutId || `payout_${crypto.randomBytes(4).toString('hex')}`
        } : null,
        entropy: crypto.randomBytes(8).toString('hex')
      }
    );

    // In a real production app, we would also pin this hash to IPFS or a side-chain
    return newBlock;
  }

  /**
   * Verify the integrity of the ledger
   */
  verifyChain() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify current block's hash
      const recalculatedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.previousHash,
        currentBlock.timestamp,
        currentBlock.data
      );

      if (currentBlock.hash !== recalculatedHash) return false;
      if (currentBlock.previousHash !== previousBlock.hash) return false;
    }
    return true;
  }

  /**
   * Get recent decision audit trail
   */
  getRecentAudits(limit = 10) {
    return this.chain.slice(-limit).reverse();
  }

  /**
   * Get the full ledger state
   */
  getLedgerState() {
    return {
      height: this.chain.length,
      lastHash: this.chain[this.chain.length - 1].hash,
      isValid: this.verifyChain(),
      transactions: this.chain.length
    };
  }
}

// Singleton instance
const globalClickLedger = new ClickLedgerService();

module.exports = globalClickLedger;

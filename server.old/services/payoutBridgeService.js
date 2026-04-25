const sovereignLedger = require('./sovereignLedgerService');
const logger = require('../utils/logger');

/**
 * PayoutBridgeService
 * Reconciles Sovereign Ledger decisions with actual revenue events from Whop.
 */

class PayoutBridgeService {
  constructor() {
    this.payouts = new Map();
    this.rates = {
      USD: 1,
      ETH: 0.00042,
      SOL: 0.0084,
      BTC: 0.000015
    };
  }

  /**
   * Register a potential revenue event from a ledger decision
   */
  async bridgeDecisionToPayout(blockHash, revenue, preferredCurrency = 'USD') {
    const audits = sovereignLedger.chain;
    const block = audits.find(b => b.hash === blockHash);

    if (!block) {
      throw new Error(`Block ${blockHash} not found in Sovereign Ledger`);
    }

    const payoutId = block.data.fiscal?.payoutId || `bridge_${Date.now()}`;
    const rate = this.rates[preferredCurrency] || 1;
    const cryptoAmount = (revenue * rate).toFixed(preferredCurrency === 'USD' ? 2 : 6);

    const payoutEvent = {
      payoutId,
      ledgerHash: blockHash,
      decisionType: block.data.type,
      estimatedRevenue: revenue,
      preferredCurrency,
      cryptoAmount,
      actualRevenue: 0,
      status: 'bridging',
      verified: false,
      timestamp: Date.now()
    };

    this.payouts.set(payoutId, payoutEvent);
    logger.info('Decision linked to Multi-Currency Payout Bridge', { payoutId, preferredCurrency, cryptoAmount });

    return payoutEvent;
  }

  /**
   * Finalize a payout after Whop/Chain confirmation
   */
  async finalizePayout(payoutId, actualAmount) {
    const payout = this.payouts.get(payoutId);
    if (!payout) return null;

    payout.actualRevenue = actualAmount;
    payout.status = 'settled';
    payout.verified = true;
    payout.settledAt = Date.now();

    // Update the ledger block to reflect settlement
    const audits = sovereignLedger.chain;
    const block = audits.find(b => b.hash === payout.ledgerHash);
    if (block && block.data.fiscal) {
      block.data.fiscal.payoutStatus = 'settled';
      block.data.fiscal.actualRevenue = actualAmount;
      block.data.fiscal.currency = payout.preferredCurrency;
    }

    logger.info('Multi-Currency Payout Bridge Settled', { payoutId, actualAmount, currency: payout.preferredCurrency });
    return payout;
  }

  /**
   * Get all bridge statuses
   */
  getBridgeStatus() {
    return Array.from(this.payouts.values());
  }

  /**
   * Calculate total settled revenue vs bridged estimates across currencies
   */
  getFinancialSummary() {
    const payouts = Array.from(this.payouts.values());
    const settlementByCurrency = {};

    payouts.forEach(p => {
      const cur = p.preferredCurrency;
      if (!settlementByCurrency[cur]) settlementByCurrency[cur] = 0;
      settlementByCurrency[cur] += parseFloat(p.cryptoAmount || 0);
    });

    return {
      totalEstimatedUSD: payouts.reduce((acc, p) => acc + p.estimatedRevenue, 0),
      totalSettledUSD: payouts.reduce((acc, p) => acc + p.actualRevenue, 0),
      settlementByCurrency,
      activeBridges: payouts.filter(p => p.status === 'bridging').length,
      globalConversionRate: 0.84
    };
  }
}

const globalBridge = new PayoutBridgeService();

module.exports = globalBridge;

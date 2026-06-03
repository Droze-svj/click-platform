class ArbitrageSteeringService {
  constructor() {
    this.activeOffers = [
      { id: 'whop_mastermind', name: 'Sovereign Alpha Access', platform: 'Whop', cvr: 0.12, pcv: 299, category: 'High-Ticket', tags: ['#wealth', '#ai', '#growth'] },
      { id: 'saas_automated', name: 'Click Pro (Sovereign)', platform: 'Sovereign', cvr: 0.08, pcv: 49, category: 'Software', tags: ['#productivity', '#automation'] },
      { id: 'affiliate_bio', name: 'Node Hardware (Ref)', platform: 'Vultr', cvr: 0.03, pcv: 200, category: 'Affiliate', tags: ['#hardware', '#crypto'] },
      { id: 'ecom_aurora', name: 'Aurora Ambient Lamp', platform: 'Shopify', cvr: 0.04, pcv: 25, category: 'E-com', tags: ['#aesthetic', '#homestyle'] }
    ];
  }

  async getActiveOffers() {
    return this.activeOffers;
  }

  async steerFunnel(_offerId, _niche) {
    return {
      status: 're-routed',
      nodesAffected: 5
    };
  }

  async scaleNodeBudget(nodeId, roas) {
    if (roas >= 2.0) {
      return {
        scaled: true,
        newBudgetIncrement: 50.0
      };
    }
    return {
      scaled: false,
      newBudgetIncrement: 0
    };
  }

  async getSteeringManifest() {
    const prioritized = this.activeOffers
      .map(o => ({ ...o, priority: o.cvr * o.pcv }))
      .sort((a, b) => b.priority - a.priority);

    const currentWinner = prioritized[0];
    const competitor = prioritized[1];

    // No active offers — nothing to steer toward.
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

    // With only one offer there is no competitor to compute a delta against.
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

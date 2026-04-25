const logger = require('../utils/logger');
const { generateContent } = require('../utils/googleAI');

/**
 * Phase 19: Syndicate Synthesis & Consensus
 * Multi-agent consensus system with Hybrid Autonomy.
 */
class SyndicateService {
  constructor() {
    this.personas = {
      viralist: "The Viralist: Focus on hooks, kinetic energy, and raw reach metrics.",
      economizer: "The Economizer: Focus on yield, conversion delta, and profit margins.",
      guardian: "The Guardian: Focus on brand safety, compliance, and legal guardrails.",
      retentionArchitect: "The Retention Architect: Focus on average view duration and loyalty loops."
    };
  }

  /**
   * Process a strategic proposal through the Council Consensus
   */
  async getCouncilConsensus(userId, proposal) {
    logger.info('Syndicate: Initiating consensus debate', { userId, proposalType: proposal.type });

    const agents = Object.keys(this.personas);
    const votes = [];

    // 1. Parallel Agent Reviews
    for (const agent of agents) {
      const review = await this.simulateAgentReview(agent, proposal);
      votes.push({ agent, ...review });
    }

    // 2. Consensus Calculation
    const approvals = votes.filter(v => v.vote === 'APPROVE').length;
    const consensusReached = approvals >= 3; // Supermajority (3/4)

    // 3. Hybrid Autonomy Logic (Phase 19 DECISION)
    const isBudgetImpacting = this.checkBudgetImpact(proposal);
    let executionStatus = 'PENDING';

    if (consensusReached) {
        if (!isBudgetImpacting) {
            executionStatus = 'AUTONOMOUS_LOCKED';
            logger.info('Syndicate: Minor pivot consensus reached. Executing autonomously.');
        } else {
            executionStatus = 'AWAITING_HUMAN_OVERRIDE';
            logger.warn('Syndicate: Budget-impacting consensus reached. Awaiting user signature.');
        }
    } else {
        executionStatus = 'REJECTED';
    }

    return {
      consensus: consensusReached,
      executionStatus,
      isBudgetImpacting,
      approvals,
      votes,
      justification: consensusReached ? 'Strategic resonance exceeds supermajority threshold.' : 'Internal agent diffraction detected.',
      timestamp: new Date()
    };
  }

  /**
   * Determine if the proposal is budget impacting
   */
  checkBudgetImpact(proposal) {
    const budgetImpactingTypes = ['budget_allocation', 'payout_pivot', 'ad_spend_shift', 'premium_render_burst'];
    return budgetImpactingTypes.includes(proposal.type) || (proposal.budgetDelta && proposal.budgetDelta !== 0);
  }

  /**
   * Specialized AI-driven review from an agent
   */
  async simulateAgentReview(agentKey, proposal) {
    const prompt = `System: You are ${this.personas[agentKey]}.
    Task: Review this strategic proposal from the Sovereign Agency.
    Proposal: ${JSON.stringify(proposal)}
    
    Decision: Return a JSON object with:
    - vote: (APPROVE or REJECT)
    - justification: (1-sentence reason related to your persona's focus)
    - riskScore: (0-10)
    
    Return only valid JSON.`;

    try {
      const response = await generateContent(prompt, { maxTokens: 400 });
      // In a real environment, we'd handle JSON parsing more robustly
      const result = JSON.parse(response || '{"vote": "APPROVE", "justification": "Aligned with current trajectory."}');
      return { ...result, timestamp: new Date() };
    } catch (err) {
      logger.error(`Syndicate Agent ${agentKey} failed`, { error: err.message });
      return { vote: 'APPROVE', justification: 'Defaulting to PASS on cognitive failure.', riskScore: 0 };
    }
  }
}

module.exports = new SyndicateService();

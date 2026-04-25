const logger = require('../utils/logger');
const { generateSocialContent, validateAndRefineOutput } = require('./aiService');
const clickLedger = require('./clickLedgerService');

/**
 * Sovereignty Engine 2.0: Multi-Agent Debate
 * Orchestrates multiple AI agents to critique and optimize content.
 */
class ClickEngine2Service {
  constructor() {
    this.agents = {
      creativeDirector: {
        name: 'Creative Director',
        prompt: 'You are a Creative Director focused on viral hooks, storytelling, and emotional resonance.'
      },
      dataAnalyst: {
        name: 'Data Analyst',
        prompt: 'You are a Data Analyst focused on ROI, engagement metrics, and historical performance data.'
      }
    };
  }

  /**
   * Conduct a Multi-Agent Debate to optimize a hook
   * @param {string} userId
   * @param {string} initialHook
   * @param {Object} context
   */
  async conductDebate(userId, initialHook, context = {}) {
    try {
      logger.info('Starting Multi-Agent Debate', { userId, initialHook });

      // Step 1: Data Analyst Critiques
      const analystCritique = await this.getAgentResponse(
        'dataAnalyst',
        `Critique this viral hook for a ${context.platform || 'social media'} post. 
        Hook: "${initialHook}"
        Focus on: ROI potential, clarity, and platform-specific performance trends.`
      );

      // Step 2: Creative Director Revises
      const revisedHook = await this.getAgentResponse(
        'creativeDirector',
        `The Data Analyst provided this critique: "${analystCritique}"
        Original Hook: "${initialHook}"
        Revise the hook to address the critique while maintaining emotional punch and viral potential.`
      );

      // Step 3: Final Consensus / Sovereignty Validation
      const validation = await validateAndRefineOutput(revisedHook, {
        niche: context.niche || 'general',
        originalityCheck: true
      });

      const finalHook = validation.refinedOutput || revisedHook;

      // Step 4: Record in Ledger
      const decisionLog = {
        interaction: 'multi_agent_debate',
        participants: ['Creative Director', 'Data Analyst'],
        initialInput: initialHook,
        critique: analystCritique,
        revisedOutput: revisedHook,
        finalOutput: finalHook,
        context: context
      };

      const ledgerEntry = await clickLedger.recordDecision(
        userId,
        'ClickEngine2',
        'HOOK_OPTIMIZATION',
        decisionLog,
        {
          predictedROI: context.predictedROI || 'high',
          confidence: validation.score || 0.95
        }
      );

      return {
        finalHook,
        debateLog: decisionLog,
        ledgerId: ledgerEntry.ledgerId
      };
    } catch (error) {
      logger.error('Error in conductDebate', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Helper to get response from a specific agent simulation
   * In a real implementation, this would call different LLM profiles/fine-tunes
   */
  async getAgentResponse(agentKey, prompt) {
    const agent = this.agents[agentKey];
    if (!agent) throw new Error(`Agent ${agentKey} not found`);

    // Simulate agent specific persona by prepending instructions
    const fullPrompt = `${agent.prompt}\n\nTask: ${prompt}`;
    
    // We use aiService's underlying generation logic (simulated here)
    const result = await generateSocialContent(fullPrompt, 'general', ['twitter']);
    return result.twitter?.text || result.text || 'No response generated';
  }
}

module.exports = new ClickEngine2Service();

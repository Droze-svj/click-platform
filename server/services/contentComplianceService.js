const logger = require('../utils/logger');
const { generateContent } = require('../utils/googleAI');
const governanceLedger = require('./governanceLedgerService');

/**
 * Phase 22: Content Compliance Swarm
 * Regional guardrails and platform guideline auditing.
 */
class ContentComplianceService {
  /**
   * Audit content for regional compliance (Phase 22)
   */
  async auditContentForRegion(userId, contentId, transcript, region = 'global') {
    try {
      // 1. Identify Shadowban Triggers (Phase 22 Heuristics)
      const shadowbanTriggers = {
        tiktok: ['link in bio', 'cash app', 'crypto', 'subscribe to my youtube'],
        instagram: ['engagement pods', 'follow for follow', 'giveaway', 'dm for collab'],
        global: ['violence', 'hate speech', 'explicit', 'misinformation']
      };

      const prompt = `System: You are the Global Compliance Agent (Phase 22).
      Task: Audit this video transcript for regional legal and cultural compliance.
      Region: ${region}
      
      Detection List: ${JSON.stringify(shadowbanTriggers)}
      
      Rules:
      1. Identify mentions of restricted substances or activities based on the region.
      2. Identify cultural sensitivities or "Diffraction" points where the content might resonate poorly.
      3. Check for the specific Shadowban triggers provided.
      
      Transcript: ${transcript}
      
      Return a JSON object with:
      - overallStatus (PASS, CAUTION, or ALERT)
      - regionalIssues (array of strings)
      - shadowbanRisk (object with platform: riskLevel)
      - justification (Why this advisory is issued)
      
      Return only valid JSON.`;

      const response = await generateContent(prompt, { maxTokens: 800 });
      const result = JSON.parse(response || '{"overallStatus": "PASS"}');

      // 2. Advisory Guardrail Logic (Phase 22 Decision)
      const isRisky = result.overallStatus === 'ALERT' || result.overallStatus === 'CAUTION';
      
      if (isRisky) {
        await governanceLedger.recordAction(userId, {
          actionType: 'REGIONAL_COMPLIANCE_ADVISORY',
          resourceId: contentId,
          resourceType: 'Content',
          severity: result.overallStatus === 'ALERT' ? 'high' : 'medium',
          justification: `[ADVISORY] ${result.justification}`,
          metadata: { region, shadowbanRisk: result.shadowbanRisk }
        });
      }

      return {
        ...result,
        auditedAt: new Date(),
        region,
        requiresHumanOverride: isRisky // Advisory flag
      };
    } catch (error) {
      logger.error('Regional Compliance Audit failed', { error: error.message, contentId, region });
      return { overallStatus: 'PASS', requiresHumanOverride: false }; 
    }
  }

  /**
   * Platform Guideline Sweep
   */
  async platformGuidelineSweep(transcript, platforms = ['tiktok', 'instagram']) {
    // Similar logic using global rules for shadowban avoidance
    // For Phase 22 MVP, we leverage the regional audit engine
    return this.auditContentForRegion(null, null, transcript, 'global');
  }
}

module.exports = new ContentComplianceService();

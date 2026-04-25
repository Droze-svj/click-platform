const logger = require('../utils/logger');
const enhancedVideoProcessing = require('./enhancedVideoProcessingService');
const videoCommentService = require('./videoCommentService');
const communityAgentService = require('./communityAgentService');
const Content = require('../models/Content');

/**
 * RemediationService
 * Fully Autonomous recursive creative loop.
 * Interprets feedback and executes timeline modifications.
 */

class RemediationService {
  constructor() {
    this.maintenanceWindow = { start: 2, end: 6 }; // 2 AM - 6 AM
    this.remediationLog = [];
  }

  /**
   * Check if we are currently in the Evolution/Maintenance Window
   */
  isWithinEvolutionWindow() {
    const hour = new Date().getHours();
    return hour >= this.maintenanceWindow.start && hour < this.maintenanceWindow.end;
  }

  /**
   * Process and Execute Remediation for a piece of content
   */
  async processAutonomousRemediation(userId, contentId, forceEvolution = false) {
    logger.info(`Remediation: Analyzing recursive potential for ${contentId}`, { forceEvolution });

    // 1. Collect Feedback Consensus
    // In Phase 16, we look for 'high-consensus' community cues or specific review comments
    const comments = await videoCommentService.getCommentsByTimeRange(contentId, 0, 9999);
    const sentiment = await communityAgentService.getStatus(userId); // Simulated community pulse

    // Logic: If 'music is too loud' appears in multiple comments OR sentiment indicates audio issues
    const actionPlan = this.deriveActionPlan(comments, sentiment);

    if (actionPlan.length === 0) {
      return { success: true, message: 'No high-consensus remediation required' };
    }

    // 2. Window Check (Phase 18 logic)
    if (!this.isWithinEvolutionWindow() && !forceEvolution) {
      logger.info('Remediation: Outside evolution window. Scheduling for maintenance cycle.');
      return { success: true, status: 'SCHEDULED', window: this.maintenanceWindow };
    }

    // 3. Execute Fully Autonomous Rendering
    return await this.executeRecursiveRender(userId, contentId, actionPlan);
  }

  /**
   * Map feedback to FFmpeg instructions
   */
  deriveActionPlan(comments, sentiment) {
    const plan = [];
    const text = comments.map(c => c.text.toLowerCase()).join(' ');

    if (text.includes('music too loud') || text.includes('audio too loud')) {
      plan.push({ type: 'ADJUST_VOLUME', value: 30 }); // Lower volume to 30%
    }
    
    if (text.includes('captions too small') || text.includes('text too small')) {
      plan.push({ type: 'ENLARGE_TEXT', value: 1.5 }); // Enlarge by 50%
    }

    if (text.includes('too shaky') || text.includes('stabilize')) {
      plan.push({ type: 'STABILIZE' });
    }

    return plan;
  }

  /**
   * Execute the actual re-render loop
   */
  async executeRecursiveRender(userId, contentId, actionPlan) {
    const content = await Content.findById(contentId);
    let currentPath = content.originalFile.url;

    logger.info(`Remediation: Executing recursive render for ${contentId}`, { actionPlan });

    try {
      for (const action of actionPlan) {
        if (action.type === 'ADJUST_VOLUME') {
          // Note: In a real scenario, we'd need the audioPath separate, 
          // but we'll use placeholder mixing logic here
          const result = await enhancedVideoProcessing.addAudioToVideo(currentPath, 'placeholder_audio.mp3', { 
            volume: action.value,
            userId 
          });
          currentPath = result.resultUrl;
        }

        if (action.type === 'STABILIZE') {
          const result = await enhancedVideoProcessing.stabilizeVideo(currentPath, { userId });
          currentPath = result.resultUrl;
        }
      }

      // Update content record with the new "evolved" version
      content.status = 'evolved';
      content.metadata.evolutionSource = 'recursive_loop';
      content.metadata.remediationActions = actionPlan;
      content.processedFile = { url: currentPath };
      await content.save();

      return { success: true, status: 'EVOLVED', finalUrl: currentPath };
    } catch (err) {
      logger.error('Remediation: Render loop failed', { error: err.message });
      throw err;
    }
  }
}

module.exports = new RemediationService();

const logger = require('../utils/logger');
const enhancedVideoProcessing = require('./enhancedVideoProcessingService');
const videoCommentService = require('./videoCommentService');
const communityAgentService = require('./communityAgentService');
const Content = require('../models/Content');
const Music = require('../models/Music');

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

    // Every response carries the plan it derived, so the UI can show what will
    // (or did) change. It used to be computed and then dropped from SCHEDULED /
    // EVOLVED alike, so "Planned fixes" never showed anything.
    if (actionPlan.length === 0) {
      return { success: true, status: 'CLEAN', actionPlan: [], commentsChecked: comments.length, message: 'No comment asks for a fix' };
    }

    // 2. Window Check (Phase 18 logic)
    if (!this.isWithinEvolutionWindow() && !forceEvolution) {
      logger.info('Remediation: Outside evolution window. Scheduling for maintenance cycle.');
      return { success: true, status: 'SCHEDULED', actionPlan, commentsChecked: comments.length, window: this.maintenanceWindow };
    }

    // 3. Execute Fully Autonomous Rendering
    return await this.executeRecursiveRender(userId, contentId, actionPlan);
  }

  /**
   * Map feedback to FFmpeg instructions
   */
  deriveActionPlan(comments, sentiment) {
    const plan = [];
    const text = comments.map(c => String(c?.text || '').toLowerCase()).join(' ');

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

    const applied = [];
    try {
      for (const action of actionPlan) {
        if (action.type === 'ADJUST_VOLUME') {
          // Resolve the real audio track attached to this content (the
          // music the creator actually mixed in). If none exists there is
          // no audio source to re-mix, so we skip the action honestly
          // rather than mixing a non-existent placeholder file.
          const track = content.musicId ? await Music.findById(content.musicId).lean() : null;
          const audioUrl = track && track.file ? track.file.url : null;

          if (!audioUrl) {
            logger.warn('Remediation: ADJUST_VOLUME requested but no audio track is attached to content; skipping', { contentId });
            continue;
          }

          const result = await enhancedVideoProcessing.addAudioToVideo(currentPath, audioUrl, {
            volume: action.value,
            userId
          });
          currentPath = result.resultUrl;
          applied.push(action.type);
        }

        if (action.type === 'STABILIZE') {
          const result = await enhancedVideoProcessing.stabilizeVideo(currentPath, { userId });
          currentPath = result.resultUrl;
          applied.push(action.type);
        }
        // ENLARGE_TEXT has no renderer step yet — reported as not applied.
      }

      // Record the evolved version. (This used to set status 'evolved', which
      // isn't in Content's status enum — every save threw — and processedFile,
      // which isn't in the schema, so it was silently dropped.)
      content.metadata = {
        ...(content.metadata || {}),
        evolutionSource: 'recursive_loop',
        remediationActions: actionPlan,
        remediation: { finalUrl: currentPath, applied, at: new Date() },
      };
      content.markModified('metadata');
      await content.save();

      return { success: true, status: 'EVOLVED', actionPlan, applied, finalUrl: currentPath };
    } catch (err) {
      logger.error('Remediation: Render loop failed', { error: err.message });
      throw err;
    }
  }
}

module.exports = new RemediationService();

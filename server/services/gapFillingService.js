// Gap Filling Service
// Fill identified content gaps with real content, where that can be done honestly.
//
// Why it is shaped like this: every gap used to "fill" by asking
// contentGenerationService.generateContent for something, then saving the result
// with a hardcoded title ("Content for tiktok"), no userId, and type 'post'.
// Content requires a userId and has no 'post' type, so every item failed
// validation while the route still answered "Gaps filled" with nothing created.
// generateContent was never an adaptation either — it read its argument as
// { category, topic } and produced a content *idea* — so fixing only the
// validation would have started saving, and auto-scheduling, placeholder posts.
//
// What is filled now:
//  - platform gaps ("Not posting on X"): the workspace's newest content that has
//    text is adapted to X by contentAdaptationService, and is saved (and
//    optionally scheduled) only when the model really produced an adaptation.
//  - every other gap is SKIPPED with a reason. A missing video cannot be
//    generated from text, a timing gap is a scheduling problem, and nothing here
//    can write a topical post without inventing it.

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentHealth = require('../models/ContentHealth');
const Workspace = require('../models/Workspace');
const logger = require('../utils/logger');

const SKIP_REASONS = {
  format: 'Format gaps need new media (for example a video) and cannot be generated from existing text',
  timing: 'Timing gaps are fixed by a posting schedule, not by generating content',
  default: 'This kind of gap cannot be filled automatically without inventing content'
};

/**
 * Generate content to fill gaps
 */
async function fillContentGaps(clientWorkspaceId, gapData, options = {}) {
  try {
    const {
      autoSchedule = false,
      maxItems = 5,
      priority = 'high',
      userId
    } = options;

    const generatedContent = [];
    const skipped = [];
    const errors = [];

    // Filter gaps by priority
    const gapsToFill = (Array.isArray(gapData?.gaps) ? gapData.gaps : [])
      .filter(gap => {
        if (priority === 'high') return gap.priority >= 7;
        if (priority === 'medium') return gap.priority >= 5;
        return true;
      })
      .slice(0, maxItems);

    for (const gap of gapsToFill) {
      try {
        if (gap.category !== 'platform') {
          skipped.push({ gap, reason: SKIP_REASONS[gap.category] || SKIP_REASONS.default });
          continue;
        }

        if (!userId) {
          // Content.userId is required: without an owner nothing can be saved.
          errors.push({ gap, error: 'A user is required to create gap-filling content' });
          continue;
        }

        const result = await generateContentForPlatform(clientWorkspaceId, gap.description, userId);
        if (result.skipped) {
          skipped.push({ gap, reason: result.skipped });
          continue;
        }

        const { data } = result;
        const content = new Content({
          ...data,
          userId,
          workspaceId: clientWorkspaceId,
          metadata: {
            ...data.metadata,
            gapFilled: true,
            gapId: gap._id || gap.category,
            gapType: gap.category
          }
        });

        await content.save();

        // Auto-schedule if enabled — only ever real adapted text reaches here.
        if (autoSchedule) {
          const platform = data.platforms[0];
          const scheduledPost = new ScheduledPost({
            contentId: content._id,
            userId,
            workspaceId: clientWorkspaceId,
            platform,
            content: { text: content.content.text, hashtags: content.content.hashtags },
            scheduledTime: options.scheduledTime || calculateOptimalTime(platform),
            status: 'pending',
            metadata: {
              gapFilled: true
            }
          });

          await scheduledPost.save();
          generatedContent.push({ content, scheduledPost, gap });
        } else {
          generatedContent.push({ content, gap });
        }
      } catch (error) {
        errors.push({
          gap,
          error: error.message
        });
        logger.warn('Error filling gap', { gap: gap.category, error: error.message });
      }
    }

    logger.info('Content gaps filled', {
      clientWorkspaceId,
      filled: generatedContent.length,
      skipped: skipped.length,
      errors: errors.length
    });

    return {
      generated: generatedContent,
      skipped,
      errors,
      summary: {
        total: gapsToFill.length,
        successful: generatedContent.length,
        skipped: skipped.length,
        failed: errors.length
      }
    };
  } catch (error) {
    logger.error('Error filling content gaps', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Adapt the workspace's newest text content to the platform a gap names.
 * Returns { data } ready to save, or { skipped: reason } when that can't be done
 * honestly (no platform named, nothing to adapt, or the model didn't adapt it).
 */
async function generateContentForPlatform(clientWorkspaceId, description, userId) {
  const platformMatch = String(description || '').match(/not posting on (\w+)/i);
  const platform = platformMatch ? platformMatch[1].toLowerCase() : null;
  if (!platform) return { skipped: 'Could not tell which platform this gap is about' };

  const source = await Content.findOne({
    workspaceId: clientWorkspaceId,
    $or: [
      { 'content.text': { $exists: true, $nin: [null, ''] } },
      { transcript: { $exists: true, $nin: [null, ''] } }
    ]
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!source) return { skipped: 'This workspace has no text content to adapt yet' };

  const sourceText = String(source.content?.text || source.transcript || '').trim();
  const { adaptContentForPlatform } = require('./contentAdaptationService');
  const adapted = await adaptContentForPlatform(
    userId,
    { ...source, content: { ...source.content, text: sourceText } },
    platform
  );

  // contentAdaptationService hands the ORIGINAL text back, marked degraded, when
  // the model can't adapt it. Saving that would publish a copy as a new post.
  const text = typeof adapted?.content === 'string' ? adapted.content.trim() : '';
  if (!adapted || adapted.degraded || !adapted.optimized || !text || text === sourceText) {
    return { skipped: `AI adaptation for ${platform} is unavailable right now` };
  }

  return {
    data: {
      type: 'article',
      status: 'completed',
      title: source.title ? `${source.title} (${platform})` : `Post for ${platform}`,
      content: {
        text,
        hashtags: Array.isArray(adapted.hashtags) ? adapted.hashtags : []
      },
      platforms: [platform],
      metadata: {
        sourceContentId: source._id,
        adaptedFor: platform
      }
    }
  };
}

/**
 * Calculate optimal posting time
 */
function calculateOptimalTime(platform) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

/**
 * Bulk fill gaps across clients
 */
async function bulkFillGaps(agencyWorkspaceId, filters = {}) {
  try {
    const {
      clientWorkspaceIds = [],
      priority = 'high',
      maxItemsPerClient = 5,
      userId
    } = filters;

    // A client belongs to an agency through metadata.agencyWorkspaceId or by
    // sharing its owner — the rule verifyClientWorkspaceAccess applies. This used
    // to query a top-level `agencyWorkspaceId`, which Workspace does not have, so
    // it matched nothing and every bulk run processed zero clients.
    const agency = await Workspace.findById(agencyWorkspaceId).select('ownerId').lean();
    if (!agency) {
      throw new Error('Agency workspace not found');
    }

    const query = {
      type: 'client',
      $or: [
        { 'metadata.agencyWorkspaceId': agencyWorkspaceId },
        { ownerId: agency.ownerId }
      ]
    };
    if (Array.isArray(clientWorkspaceIds) && clientWorkspaceIds.length > 0) {
      // Only narrows the agency's own clients; ids outside it simply don't match.
      query._id = { $in: clientWorkspaceIds };
    }

    const clients = await Workspace.find(query).lean();

    const results = {
      total: clients.length,
      successful: 0,
      failed: 0,
      totalGenerated: 0,
      totalSkipped: 0,
      errors: []
    };

    for (const client of clients) {
      try {
        // Get latest health analysis
        const health = await ContentHealth.findOne({ clientWorkspaceId: client._id })
          .sort({ analysisDate: -1 })
          .lean();

        if (!health || !health.gaps || health.gaps.length === 0) {
          continue;
        }

        const result = await fillContentGaps(client._id, health, {
          autoSchedule: true,
          maxItems: maxItemsPerClient,
          priority,
          userId
        });

        results.successful++;
        results.totalGenerated += result.summary.successful;
        results.totalSkipped += result.summary.skipped;
      } catch (error) {
        results.failed++;
        results.errors.push({
          clientWorkspaceId: client._id,
          error: error.message
        });
      }
    }

    logger.info('Bulk gap filling completed', results);
    return results;
  } catch (error) {
    logger.error('Error in bulk gap filling', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  fillContentGaps,
  bulkFillGaps
};

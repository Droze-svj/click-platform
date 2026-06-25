// Growth Brief — the closed loop. vidIQ ends at "here's your data"; this turns
// every Growth signal (SEO scorecard + retention edit-cuts) into ONE prioritized
// "do this next" action list for a piece of content, consumable by the editor,
// Autopilot, and the white-label agency reports.

const logger = require('../utils/logger');

const PRIO = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * PURE: merge a scorecard + retention analysis into a sorted, deduped action
 * list. Each action: { source, priority, area, action, second? }.
 */
function buildGrowthActions(scorecard = {}, retention = {}) {
  const actions = [];

  for (const qw of (scorecard.quickWins || [])) {
    actions.push({ source: 'seo', priority: qw.severity === 'critical' ? 'high' : (qw.severity || 'high'), area: qw.field, action: qw.fix });
  }
  // Any high/medium SEO issues not already in quickWins.
  for (const iss of (scorecard.issues || [])) {
    if ((iss.severity === 'high' || iss.severity === 'medium') && !actions.some((a) => a.area === iss.field && a.action === iss.fix)) {
      actions.push({ source: 'seo', priority: iss.severity, area: iss.field, action: iss.fix });
    }
  }
  if (retention && retention.available !== false) {
    for (const rec of (retention.recommendations || [])) {
      actions.push({ source: 'retention', priority: rec.priority || 'medium', area: rec.type, action: rec.message, second: rec.second });
    }
  }

  // dedupe by (area, action) then sort by priority
  const seen = new Set();
  const deduped = actions.filter((a) => {
    const k = `${a.area}|${a.action}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  deduped.sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9));
  return deduped;
}

/**
 * Orchestrator: assemble the brief for an owned content — SEO scorecard (always)
 * + retention edit insights (when metrics exist). Ownership-checked.
 */
async function getContentGrowthBrief(contentId, userId, options = {}) {
  const Content = require('../models/Content');
  const { scoreVideoSeo } = require('./seoScorecardService');
  const { getRetentionInsights } = require('./retentionAnalysisService');

  const content = await Content.findById(contentId)
    .select('userId title description tags metadata thumbnailUrl platform')
    .lean();
  if (!content || String(content.userId) !== String(userId)) {
    const e = new Error('Content not found'); e.statusCode = 404; throw e;
  }

  const platform = options.platform || content.platform || 'youtube';
  const keyword = options.targetKeyword ? String(options.targetKeyword).trim() : null;

  const scorecard = scoreVideoSeo({
    title: content.title,
    description: content.description,
    tags: content.tags,
    thumbnail: (content.metadata && content.metadata.thumbnail) || content.thumbnailUrl || null,
  }, { targetKeyword: keyword, platform });

  let retention = { available: false };
  try {
    retention = await getRetentionInsights(contentId, userId, { accountId: options.accountId || null });
  } catch (err) {
    logger.warn('[growthBrief] retention lookup failed', { error: err.message });
  }

  const actions = buildGrowthActions(scorecard, retention);

  return {
    contentId,
    title: content.title || null,
    platform,
    targetKeyword: keyword,
    seoScore: scorecard.score,
    seoGrade: scorecard.grade,
    retention: retention.available ? { hookScore: retention.hookScore, avgViewPercent: retention.avgViewPercent } : null,
    actions,
    scorecard,
    retentionDetail: retention.available ? retention : null,
  };
}

module.exports = { buildGrowthActions, getContentGrowthBrief };

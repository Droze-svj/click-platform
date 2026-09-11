// Content moderation routes

const express = require('express');
const auth = require('../middleware/auth');
const { moderateContent, flagForReview } = require('../services/contentModerationService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/moderation/check:
 *   post:
 *     summary: Moderate content
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 */
router.post('/check', auth, asyncHandler(async (req, res) => {
  const { text, title, description, options } = req.body;

  if (!text && !title && !description) {
    return sendError(res, 'Content text, title, or description is required', 400);
  }

  try {
    const result = await moderateContent(null, {
      text,
      title,
      description,
      ...options,
    });

    sendSuccess(res, 'Content moderation complete', 200, result);
  } catch (error) {
    logger.error('Content moderation error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/moderation/flag/:contentId:
 *   post:
 *     summary: Flag content for manual review
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 */
router.post('/flag/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  try {
    const result = await flagForReview(contentId, reason, userId);
    sendSuccess(res, 'Content flagged for review', 200, result);
  } catch (error) {
    logger.error('Flag content error', { error: error.message, contentId });
    sendError(res, error.message, 500);
  }
}));

// ─────────────────────────────────────────────────────────────────────────────
// Compliance rules, platform policies and the compliance checker.
//
// ComplianceDashboard (mounted on /dashboard/compliance) has always called these
// six endpoints, and none of them existed. Every call sat behind
// `if (res.ok)` / `catch { /* silent */ }`, so the page rendered with an empty
// rule list and no error — a compliance surface that silently reported nothing.
// The ComplianceRule model was fully built and referenced by nothing.
//
// Everything below is computed from real data: the workspace's own rules and
// objective, published platform limits. Nothing is inferred or estimated.
// ─────────────────────────────────────────────────────────────────────────────

const ComplianceRule = require('../models/ComplianceRule');
const Workspace = require('../models/Workspace');
const { checkProfanity, checkSpam } = require('../services/contentModerationService');

// Published platform limits. Objective, externally-verifiable facts — not
// estimates — so they are served as a static reference rather than invented per
// request. Keep in step with the caps enforced at publish time
// (instagramOAuthService, TikTokSocialService, scriptService.platformLimits).
const PLATFORM_POLICIES = {
  tiktok:    { maxCharacters: 2200, maxHashtags: 30, recommendedHashtags: 5, noExternalLinks: true,  notes: 'Links in captions are not clickable; bio link only.' },
  instagram: { maxCharacters: 2200, maxHashtags: 30, recommendedHashtags: 8, noExternalLinks: true,  notes: 'Caption links are not clickable; bio or story link only.' },
  twitter:   { maxCharacters: 280,  maxHashtags: 10, recommendedHashtags: 2, noExternalLinks: false, notes: 'Links consume 23 characters regardless of length.' },
  youtube:   { maxCharacters: 5000, maxHashtags: 15, recommendedHashtags: 3, noExternalLinks: false, notes: 'Only the first 3 hashtags render above the title.' },
  linkedin:  { maxCharacters: 3000, maxHashtags: 10, recommendedHashtags: 3, noExternalLinks: false, notes: 'Posts over ~1300 characters are collapsed behind "see more".' },
  facebook:  { maxCharacters: 5000, maxHashtags: 10, recommendedHashtags: 2, noExternalLinks: false, notes: 'Engagement drops sharply past ~500 characters.' },
};

const URL_RE = /https?:\/\/[^\s]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

/** The caller's workspace. Rules are per-workspace; a user without one has none. */
async function resolveWorkspaceId(req) {
  const userId = req.user._id || req.user.id;
  const ws = await Workspace.findOne({ ownerId: String(userId) }).select('_id').lean();
  return ws ? ws._id : null;
}

/**
 * GET /api/moderation/platform-policies
 * Published per-platform limits used by the checker and shown in the UI.
 */
router.get('/platform-policies', auth, asyncHandler(async (req, res) => {
  sendSuccess(res, 'Platform policies retrieved', 200, PLATFORM_POLICIES);
}));

/**
 * GET /api/moderation/rules
 * The caller's workspace compliance rules, newest first.
 */
router.get('/rules', auth, asyncHandler(async (req, res) => {
  const workspaceId = await resolveWorkspaceId(req);
  if (!workspaceId) return sendSuccess(res, 'Rules retrieved', 200, []);

  const rules = await ComplianceRule.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  sendSuccess(res, 'Rules retrieved', 200, rules);
}));

/**
 * POST /api/moderation/rules
 * Create a compliance rule for the caller's workspace.
 */
router.post('/rules', auth, asyncHandler(async (req, res) => {
  const workspaceId = await resolveWorkspaceId(req);
  if (!workspaceId) {
    return sendError(res, 'A workspace is required before compliance rules can be created', 409);
  }

  const { name, description, category, ruleType, keywords, blockedDomains, pattern, severity, action, platformConstraints } = req.body || {};

  if (!name || !category || !ruleType) {
    return sendError(res, 'name, category and ruleType are required', 400);
  }
  // A regex rule whose pattern does not compile would throw on every check.
  if (ruleType === 'regex') {
    if (!pattern) return sendError(res, 'A regex rule needs a pattern', 400);
    try { new RegExp(pattern); } catch (e) { return sendError(res, `Invalid regex pattern: ${e.message}`, 400); }
  }

  try {
    const rule = await new ComplianceRule({
      workspaceId,
      createdBy: String(req.user._id || req.user.id),
      name, description, category, ruleType,
      keywords: Array.isArray(keywords) ? keywords : [],
      blockedDomains: Array.isArray(blockedDomains) ? blockedDomains : [],
      pattern,
      severity: severity || 'warning',
      action: action || 'warn',
      platformConstraints,
    }).save();

    sendSuccess(res, 'Rule created', 201, rule.toObject());
  } catch (err) {
    if (err.name === 'ValidationError') return sendError(res, err.message, 400);
    throw err;
  }
}));

/**
 * DELETE /api/moderation/rules/:ruleId
 * Scoped by workspace — never a bare findByIdAndDelete.
 */
router.delete('/rules/:ruleId', auth, asyncHandler(async (req, res) => {
  const workspaceId = await resolveWorkspaceId(req);
  if (!workspaceId) return sendError(res, 'Rule not found', 404);

  const deleted = await ComplianceRule.findOneAndDelete({ _id: req.params.ruleId, workspaceId });
  if (!deleted) return sendError(res, 'Rule not found', 404);

  sendSuccess(res, 'Rule deleted', 200, { deleted: true });
}));

/** Apply one stored rule to the text. Returns issues, never throws. */
function applyRule(rule, text) {
  const issues = [];
  const lower = text.toLowerCase();
  const add = (message) => issues.push({ type: rule.category, severity: rule.severity || 'warning', message });

  if (rule.ruleType === 'keyword_block') {
    for (const kw of rule.keywords || []) {
      if (kw && lower.includes(String(kw).toLowerCase())) add(`"${rule.name}": blocked term "${kw}" found`);
    }
  } else if (rule.ruleType === 'keyword_require') {
    const missing = (rule.keywords || []).filter((kw) => kw && !lower.includes(String(kw).toLowerCase()));
    if (missing.length) add(`"${rule.name}": required term(s) missing — ${missing.join(', ')}`);
  } else if (rule.ruleType === 'url_block') {
    for (const url of text.match(URL_RE) || []) {
      const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
      if (host && (rule.blockedDomains || []).some((d) => host === d || host.endsWith('.' + d))) {
        add(`"${rule.name}": blocked domain ${host}`);
      }
    }
  } else if (rule.ruleType === 'regex' && rule.pattern) {
    // Patterns are validated on create, but a rule stored before that guard
    // existed could still be bad — never let it break the whole check.
    try {
      if (new RegExp(rule.pattern, 'i').test(text)) add(`"${rule.name}": pattern matched`);
    } catch { /* unusable pattern — skip this rule */ }
  }
  return issues;
}

/**
 * POST /api/moderation/compliance-check
 * Check text against the workspace's rules and the target platforms' limits.
 */
router.post('/compliance-check', auth, asyncHandler(async (req, res) => {
  const { text, platforms } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return sendError(res, 'text is required', 400);
  }

  const targets = (Array.isArray(platforms) && platforms.length ? platforms : Object.keys(PLATFORM_POLICIES))
    .filter((p) => PLATFORM_POLICIES[p]);

  const workspaceId = await resolveWorkspaceId(req);
  const rules = workspaceId
    ? await ComplianceRule.find({ workspaceId, isActive: true }).lean()
    : [];

  const profanity = checkProfanity(text);
  const spam = checkSpam(text);

  const profanityIssues = (profanity.issues || []).map(() => ({
    type: 'profanity', severity: 'error', message: 'Explicit language detected',
  }));
  const spamIssues = (spam.issues || []).map(() => ({
    type: 'spam', severity: 'warning', message: 'Spam-like phrasing detected',
  }));

  // Stored rules, split into the sections the dashboard renders. Partition the
  // rules first so an issue never has to carry a marker key that is then peeled
  // back off.
  const linkIssues = rules.filter((r) => r.ruleType === 'url_block').flatMap((r) => applyRule(r, text));
  const brandIssues = rules.filter((r) => r.ruleType !== 'url_block').flatMap((r) => applyRule(r, text));

  const hashtagCount = (text.match(HASHTAG_RE) || []).length;
  const urls = text.match(URL_RE) || [];

  const platformPolicy = {};
  const platformIssues = [];
  for (const p of targets) {
    const policy = PLATFORM_POLICIES[p];
    const issues = [];
    if (policy.maxCharacters && text.length > policy.maxCharacters) {
      issues.push({ type: 'platform_policy', severity: 'error', message: `${p}: ${text.length} characters exceeds the ${policy.maxCharacters} limit` });
    }
    if (policy.maxHashtags && hashtagCount > policy.maxHashtags) {
      issues.push({ type: 'platform_policy', severity: 'error', message: `${p}: ${hashtagCount} hashtags exceeds the ${policy.maxHashtags} limit` });
    } else if (policy.recommendedHashtags && hashtagCount > policy.recommendedHashtags) {
      issues.push({ type: 'platform_policy', severity: 'info', message: `${p}: ${hashtagCount} hashtags — ${policy.recommendedHashtags} performs best` });
    }
    if (policy.noExternalLinks && urls.length) {
      issues.push({ type: 'platform_policy', severity: 'warning', message: `${p}: links in captions are not clickable` });
    }
    platformIssues.push(...issues);
    platformPolicy[p] = {
      passed: !issues.some((i) => i.severity === 'error'),
      issues,
      platformRules: { platform: p, ...policy, characterUsage: text.length, hashtagCount },
    };
  }

  const all = [...profanityIssues, ...spamIssues, ...brandIssues, ...linkIssues, ...platformIssues];
  const errors = all.filter((i) => i.severity === 'error').length;
  const warnings = all.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 10);
  const status = errors ? 'failed' : (warnings ? 'warning' : 'passed');

  const recommendations = [];
  if (errors) recommendations.push('Resolve the blocking issues before publishing.');
  if (!rules.length) recommendations.push('No compliance rules are defined yet — add rules to check brand-specific terms.');
  if (warnings && !errors) recommendations.push('Review the warnings; publishing is allowed but not ideal.');

  sendSuccess(res, 'Compliance check complete', 200, {
    status,
    score,
    checkedAt: new Date().toISOString(),
    issueCount: all.length,
    issues: all,
    platforms: targets,
    breakdown: {
      profanity:   { passed: !profanityIssues.length, issues: profanityIssues },
      spam:        { passed: !spamIssues.length, issues: spamIssues, spamScore: spam.spamScore || 0 },
      brandSafety: { passed: !brandIssues.length, issues: brandIssues },
      linkSafety:  { passed: !linkIssues.length, issues: linkIssues, checkedUrls: urls.length },
      platformPolicy,
      // No AI moderation pass runs here; the dashboard renders this section only
      // when it is non-null, so null is the honest value rather than a fake pass.
      ai: null,
    },
    recommendations,
  });
}));

/**
 * GET /api/moderation/report/workspace
 * Rule inventory and trigger counts for the caller's workspace.
 */
router.get('/report/workspace', auth, asyncHandler(async (req, res) => {
  const workspaceId = await resolveWorkspaceId(req);
  if (!workspaceId) {
    return sendSuccess(res, 'Workspace compliance report', 200, {
      totalRules: 0, activeRules: 0, totalTriggers: 0, byCategory: {}, recentTriggers: [],
    });
  }

  const rules = await ComplianceRule.find({ workspaceId }).lean();
  const byCategory = {};
  for (const r of rules) {
    byCategory[r.category] = byCategory[r.category] || { rules: 0, triggers: 0 };
    byCategory[r.category].rules += 1;
    byCategory[r.category].triggers += r.triggerCount || 0;
  }

  sendSuccess(res, 'Workspace compliance report', 200, {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.isActive).length,
    totalTriggers: rules.reduce((n, r) => n + (r.triggerCount || 0), 0),
    byCategory,
    recentTriggers: rules
      .filter((r) => r.lastTriggeredAt)
      .sort((a, b) => new Date(b.lastTriggeredAt) - new Date(a.lastTriggeredAt))
      .slice(0, 10)
      .map((r) => ({ ruleId: r._id, name: r.name, category: r.category, triggerCount: r.triggerCount, lastTriggeredAt: r.lastTriggeredAt })),
  });
}));

module.exports = router;

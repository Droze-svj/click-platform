// Client Guidelines Routes
// Manage brand guidelines and content rules per client

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess, requireAgencyClientAccess } = require('../middleware/workspaceIsolation');
const ClientGuidelines = require('../models/ClientGuidelines');
const Workspace = require('../models/Workspace');
const router = express.Router();

/**
 * POST /api/workspaces/:workspaceId/guidelines
 * Create or update client guidelines
 */
router.post('/:workspaceId/guidelines', auth, requireWorkspaceAccess('canManageSettings'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return sendError(res, 'Workspace not found', 404);
  }

  // Get agency workspace if this is a client workspace
  let agencyWorkspaceId = null;
  if (workspace.type === 'client') {
    agencyWorkspaceId = workspace.metadata?.agencyWorkspaceId || null;
  }

  const guidelines = await ClientGuidelines.findOneAndUpdate(
    { workspaceId },
    {
      workspaceId,
      agencyWorkspaceId,
      ...req.body
    },
    { upsert: true, new: true }
  );

  sendSuccess(res, 'Guidelines saved', 200, guidelines);
}));

/**
 * GET /api/workspaces/:workspaceId/guidelines
 * Get client guidelines
 */
router.get('/:workspaceId/guidelines', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const guidelines = await ClientGuidelines.findOne({ workspaceId }).lean();

  if (!guidelines) {
    return sendError(res, 'Guidelines not found', 404);
  }

  sendSuccess(res, 'Guidelines retrieved', 200, guidelines);
}));

/**
 * PUT /api/workspaces/:workspaceId/guidelines
 * Update client guidelines
 */
router.put('/:workspaceId/guidelines', auth, requireWorkspaceAccess('canManageSettings'), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const guidelines = await ClientGuidelines.findOne({ workspaceId });

  if (!guidelines) {
    return sendError(res, 'Guidelines not found', 404);
  }

  Object.assign(guidelines, req.body);
  await guidelines.save();

  sendSuccess(res, 'Guidelines updated', 200, guidelines);
}));

/**
 * POST /api/workspaces/:workspaceId/guidelines/validate
 * Validate content against guidelines
 */
router.post('/:workspaceId/guidelines/validate', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { content } = req.body;

  if (!content) {
    return sendError(res, 'Content is required', 400);
  }

  const guidelines = await ClientGuidelines.findOne({ workspaceId });
  if (!guidelines) {
    return sendError(res, 'Guidelines not found', 404);
  }

  const validation = validateContentAgainstGuidelines(content, guidelines);
  sendSuccess(res, 'Content validated', 200, validation);
}));

function validateContentAgainstGuidelines(content, guidelines) {
  const issues = [];
  const warnings = [];

  // Check do not use words
  if (guidelines.contentRules?.doNotUse && content.text) {
    guidelines.contentRules.doNotUse.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(content.text)) {
        issues.push({
          type: 'forbidden_word',
          word,
          message: `Content contains forbidden word: "${word}"`
        });
      }
    });
  }

  // Check must include words
  if (guidelines.contentRules?.mustInclude && content.text) {
    guidelines.contentRules.mustInclude.forEach(phrase => {
      if (!content.text.toLowerCase().includes(phrase.toLowerCase())) {
        warnings.push({
          type: 'missing_phrase',
          phrase,
          message: `Content should include: "${phrase}"`
        });
      }
    });
  }

  // Check caption length
  if (guidelines.contentRules?.captionLength && content.text) {
    const length = content.text.length;
    if (length < guidelines.contentRules.captionLength.min) {
      warnings.push({
        type: 'caption_too_short',
        current: length,
        minimum: guidelines.contentRules.captionLength.min,
        message: `Caption is too short (${length} chars, minimum ${guidelines.contentRules.captionLength.min})`
      });
    }
    if (length > guidelines.contentRules.captionLength.max) {
      warnings.push({
        type: 'caption_too_long',
        current: length,
        maximum: guidelines.contentRules.captionLength.max,
        message: `Caption is too long (${length} chars, maximum ${guidelines.contentRules.captionLength.max})`
      });
    }
  }

  // Check hashtags
  if (guidelines.contentRules?.preferredHashtags && content.hashtags) {
    const missingHashtags = guidelines.contentRules.preferredHashtags.filter(
      tag => !content.hashtags.includes(tag)
    );
    if (missingHashtags.length > 0) {
      warnings.push({
        type: 'missing_hashtags',
        missing: missingHashtags,
        message: `Consider adding preferred hashtags: ${missingHashtags.join(', ')}`
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    score: calculateComplianceScore(issues, warnings)
  };
}

function calculateComplianceScore(issues, warnings) {
  let score = 100;
  score -= issues.length * 20; // -20 points per issue
  score -= warnings.length * 5; // -5 points per warning
  return Math.max(0, score);
}

module.exports = router;



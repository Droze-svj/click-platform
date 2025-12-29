// Recycling Template Routes

const express = require('express');
const auth = require('../../middleware/auth');
const RecyclingTemplate = require('../../models/RecyclingTemplate');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * POST /api/recycling/templates
 * Create recycling template
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const template = new RecyclingTemplate({
    ...req.body,
    userId: req.user._id
  });

  // If set as default, unset other defaults
  if (req.body.isDefault) {
    await RecyclingTemplate.updateMany(
      { userId: req.user._id, isDefault: true },
      { isDefault: false }
    );
  }

  await template.save();
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * GET /api/recycling/templates
 * Get recycling templates
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { teamId } = req.query;
  const query = {
    $or: [
      { userId: req.user._id },
      ...(teamId ? [{ teamId }] : [])
    ]
  };

  const templates = await RecyclingTemplate.find(query)
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * GET /api/recycling/templates/:templateId
 * Get template details
 */
router.get('/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await RecyclingTemplate.findOne({
    _id: templateId,
    $or: [
      { userId: req.user._id },
      { teamId: { $exists: true } }
    ]
  }).lean();

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  sendSuccess(res, 'Template retrieved', 200, template);
}));

/**
 * PUT /api/recycling/templates/:templateId
 * Update template
 */
router.put('/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await RecyclingTemplate.findOne({
    _id: templateId,
    userId: req.user._id
  });

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  // If setting as default, unset other defaults
  if (req.body.isDefault && !template.isDefault) {
    await RecyclingTemplate.updateMany(
      { userId: req.user._id, isDefault: true },
      { isDefault: false }
    );
  }

  Object.assign(template, req.body);
  await template.save();

  sendSuccess(res, 'Template updated', 200, template);
}));

/**
 * DELETE /api/recycling/templates/:templateId
 * Delete template
 */
router.delete('/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await RecyclingTemplate.findOneAndDelete({
    _id: templateId,
    userId: req.user._id
  });

  if (!template) {
    return sendError(res, 'Template not found', 404);
  }

  sendSuccess(res, 'Template deleted', 200);
}));

module.exports = router;



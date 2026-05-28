// Recurring post template routes.
//
// CRUD endpoints for managing "post on a cadence" rules. The cron at
// services/recurringPostCron.js reads these every 5 minutes and spawns
// the actual ScheduledPosts.

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const RecurringPostTemplate = require('../models/RecurringPostTemplate');
const { computeNextFireAt } = require('../services/recurringPostCron');

const router = express.Router();

/** GET /api/recurring — list every template for the current user. */
router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const templates = await RecurringPostTemplate.find({ userId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, templates });
}));

/** POST /api/recurring — create a new template. */
router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { platform, accountId, content, contentPool, cadence, active } = req.body || {};

  if (!platform) {
    return res.status(400).json({ success: false, error: 'platform is required', code: 'PLATFORM_REQUIRED' });
  }
  if (!cadence || !Array.isArray(cadence.daysOfWeek) || cadence.daysOfWeek.length === 0) {
    return res.status(400).json({ success: false, error: 'cadence.daysOfWeek must be a non-empty array', code: 'CADENCE_INVALID' });
  }
  const hasContent = !!(content?.text || content?.mediaUrl) || (Array.isArray(contentPool) && contentPool.length > 0);
  if (!hasContent) {
    return res.status(400).json({ success: false, error: 'Provide content.text/mediaUrl or a contentPool with at least one entry', code: 'CONTENT_REQUIRED' });
  }

  const tpl = new RecurringPostTemplate({
    userId,
    platform,
    accountId: accountId || null,
    content: content || { text: '', mediaUrl: '', hashtags: [] },
    contentPool: Array.isArray(contentPool) ? contentPool : [],
    cadence: {
      daysOfWeek: cadence.daysOfWeek,
      timeOfDay: cadence.timeOfDay || '09:00',
      timezone: cadence.timezone || 'UTC',
      maxFires: cadence.maxFires ?? null,
      endsAt: cadence.endsAt ? new Date(cadence.endsAt) : null,
    },
    active: active !== false,
  });
  tpl.nextFireAt = computeNextFireAt(tpl);
  await tpl.save();
  res.status(201).json({ success: true, template: tpl });
}));

/** PUT /api/recurring/:id — update a template. */
router.put('/:id', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const tpl = await RecurringPostTemplate.findOne({ _id: req.params.id, userId });
  if (!tpl) return res.status(404).json({ success: false, error: 'Template not found' });

  const { platform, accountId, content, contentPool, cadence, active } = req.body || {};
  if (platform) tpl.platform = platform;
  if (typeof accountId !== 'undefined') tpl.accountId = accountId || null;
  if (content) tpl.content = { text: content.text || '', mediaUrl: content.mediaUrl || '', hashtags: content.hashtags || [] };
  if (Array.isArray(contentPool)) {
    tpl.contentPool = contentPool;
    tpl.poolCursor = 0; // reset rotation when the pool changes
  }
  if (cadence) {
    tpl.cadence = {
      daysOfWeek: Array.isArray(cadence.daysOfWeek) ? cadence.daysOfWeek : tpl.cadence.daysOfWeek,
      timeOfDay: cadence.timeOfDay || tpl.cadence.timeOfDay,
      timezone: cadence.timezone || tpl.cadence.timezone,
      maxFires: cadence.maxFires ?? tpl.cadence.maxFires,
      endsAt: cadence.endsAt ? new Date(cadence.endsAt) : tpl.cadence.endsAt,
    };
  }
  if (typeof active === 'boolean') tpl.active = active;
  // Re-project next fire when cadence or active state changed.
  tpl.nextFireAt = tpl.active ? computeNextFireAt(tpl) : null;
  await tpl.save();
  res.json({ success: true, template: tpl });
}));

/** DELETE /api/recurring/:id — remove a template. */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const result = await RecurringPostTemplate.deleteOne({ _id: req.params.id, userId });
  if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true });
}));

/** POST /api/recurring/:id/pause — convenience: flip active=false. */
router.post('/:id/pause', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const tpl = await RecurringPostTemplate.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: { active: false, nextFireAt: null } },
    { new: true },
  );
  if (!tpl) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true, template: tpl });
}));

/** POST /api/recurring/:id/resume — convenience: flip active=true + reproject. */
router.post('/:id/resume', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const tpl = await RecurringPostTemplate.findOne({ _id: req.params.id, userId });
  if (!tpl) return res.status(404).json({ success: false, error: 'Template not found' });
  tpl.active = true;
  tpl.nextFireAt = computeNextFireAt(tpl);
  if (!tpl.nextFireAt) {
    return res.status(400).json({ success: false, error: 'Cadence has ended; nothing to resume.', code: 'CADENCE_ENDED' });
  }
  await tpl.save();
  res.json({ success: true, template: tpl });
}));

module.exports = router;

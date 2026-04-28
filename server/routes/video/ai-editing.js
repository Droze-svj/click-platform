// AI Video Editing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  analyzeVideoForEditing,
  autoEditVideo,
  computeVideoScore,
  detectScenes,
  detectSmartCuts,
  getEditPreset,
  listEditPresets,
  applyPresetToOptions,
  generateEditPreview,
  createComparisonVideo,
  saveEditVersion,
  restoreEditVersion,
  batchAutoEdit,
  getEditPerformanceAnalytics,
  exportMultipleFormats,
  getInteractiveSuggestions,
} = require('../../services/aiVideoEditingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const User = require('../../models/User');
const Content = require('../../models/Content');
const ClientGuidelines = require('../../models/ClientGuidelines');
const { resolveContent } = require('../../utils/devStore');
const { isDevUser } = require('../../utils/devUser');
const { guardOwnership } = require('../../utils/ownership');
const router = express.Router();

/**
 * Dev-mode short-circuit for AI editing routes.
 *
 * Two reasons this exists:
 *   1. The Gemini free tier is at 0 quota in development — `/analyze` would
 *      return a 503 every time and block the editor's onboarding flow.
 *   2. The ffmpeg build on dev machines often lacks the advanced filters
 *      (`boxblur`, `setpts`, custom complex chains) that `autoEditVideo`
 *      composes — the route would return 500 "Filter not found".
 *
 * For dev users we return realistic mock results so the editor UI flows
 * end-to-end without burning AI quota or hitting ffmpeg edge cases.
 */
async function devEditingMock(kind, videoId, req) {
  const base = {
    videoId: videoId || 'dev-video',
    generatedAt: new Date().toISOString(),
    devMock: true,
  };
  // Convert any /uploads/... path to an absolute URL pointing at THIS server.
  // Without this, the response's editedVideoUrl is relative and the browser
  // resolves it against the Next.js dev origin (:3010), where uploads aren't
  // served → 404. Using the request's host keeps it correct in any env.
  const toAbsolute = (relOrAbs) => {
    if (!relOrAbs) return null;
    if (/^https?:\/\//i.test(relOrAbs)) return relOrAbs;
    if (!req) return relOrAbs;
    const host = req.get('host');
    return `${req.protocol}://${host}${relOrAbs.startsWith('/') ? '' : '/'}${relOrAbs}`;
  };
  if (kind === 'analyze') {
    return {
      ...base,
      score: 78,
      insights: [
        { type: 'pacing', severity: 'medium', note: 'Cuts every ~2.4s — good for short-form.' },
        { type: 'hook', severity: 'high', note: 'First 1.2s lacks a strong hook frame.' },
        { type: 'audio', severity: 'low', note: 'Loudness consistent across clips.' },
      ],
      suggestedCuts: [
        { startTime: 0.0, endTime: 1.2, reason: 'Replace with a tighter hook.' },
        { startTime: 8.5, endTime: 9.1, reason: 'Trim mid-sentence pause.' },
      ],
      hookSuggestions: [
        'Open on the result, then rewind to the setup.',
        'Lead with a specific number from the script.',
      ],
      retentionEstimate: 0.62,
    };
  }
  if (kind === 'auto-edit') {
    // Echo the original video URL so the client's editedVideoUrl check
    // succeeds — dev mode doesn't actually re-encode, but the UI flow
    // expects a playable URL on the success path.
    let originalUrl = null;
    try {
      const content = await resolveContent(videoId);
      originalUrl = content?.originalFile?.url || content?.url || null;
    } catch { /* fall through to null */ }
    // editsApplied is rendered as strings by the client (page.tsx:1602
    // does `<span>{edit}</span>` directly) — returning objects crashes React
    // with "Objects are not valid as a React child". Keep as plain strings.
    return {
      ...base,
      success: true,
      editedVideoUrl: toAbsolute(originalUrl),
      editsApplied: [
        'Removed 0.6s of dead air at the start',
        'Generated 12 burned-in captions',
        'Applied warm-cinematic colour grade',
      ],
      message: 'Auto-edit simulated (dev mode — no ffmpeg processing).',
    };
  }
  return { ...base, kind };
}

/**
 * Resolve editing options with user style (brand/preferences), optional preset, and client guidelines
 */
async function resolveEditingOptions(editingOptions, userId, videoId = null) {
  let options = { ...editingOptions };
  const presetName = options.preset || options.editPreset;
  if (presetName) {
    try {
      const preset = getEditPreset(presetName);
      if (preset) {
        options = applyPresetToOptions(presetName, options);
      }
    } catch (e) {
      logger.warn('Apply preset failed', { presetName, error: e.message });
    }
  }
  if (userId) {
    try {
      const user = await User.findById(userId).lean();
      if (user?.brandSettings?.font && !options.captionFontFamily) {
        options.captionFontFamily = user.brandSettings.font;
      }
    } catch (e) {
      // ignore
    }
  }
  if (videoId) {
    try {
      const content = await resolveContent(videoId, { select: 'workspaceId', lean: true });
      const workspaceId = content?.workspaceId;
      if (workspaceId) {
        const guidelines = await ClientGuidelines.findOne({ workspaceId, isActive: true }).lean();
        if (guidelines?.branding) {
          const brandFont = guidelines.branding.font || guidelines.branding.fontFamily;
          if (brandFont && !options.captionFontFamily) {
            options.captionFontFamily = brandFont;
          }
        }
        const platform = options.platform || 'general';
        if (guidelines?.platformSpecific && platform !== 'all' && platform !== 'general') {
          const platformKey = platform.replace(/\s/g, '').toLowerCase();
          const platformGuidelines = guidelines.platformSpecific[platformKey] || guidelines.platformSpecific.instagram;
          if (platformGuidelines?.captionStyle && !options.captionStyle) {
            options.captionStyle = platformGuidelines.captionStyle;
          }
        }
      }
    } catch (e) {
      logger.warn('Client guidelines resolution failed', { videoId, error: e.message });
    }
  }
  return options;
}

/**
 * @swagger
 * /api/video/ai-editing/analyze:
 *   post:
 *     summary: Analyze video for editing
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  const { videoMetadata, videoId } = req.body;
  const payload = { ...(videoMetadata || {}), ...(videoId ? { videoId } : {}) };

  if (!videoId && !(payload.duration != null || payload.url)) {
    return sendError(res, 'Video metadata or videoId is required', 400);
  }

  // Ownership gate when a videoId is supplied — refuses analysis of content
  // the requester doesn't own. videoMetadata-only payloads (no id) skip the
  // gate because nothing user-scoped is being touched.
  if (videoId) {
    const owned = await guardOwnership(req, res, videoId);
    if (!owned) return;
  }

  // Hydrate niche/platform/language/styleProfile from the user record + the
  // request so the AI service can build a niche-aware prompt. Body wins over
  // user defaults so the editor can override per-request.
  try {
    const userId = req.user?._id || req.user?.id;
    let niche = req.body.niche || payload.niche || null;
    let platform = req.body.platform || payload.platform || null;
    if (userId && (!niche || !platform)) {
      const u = await User.findById(userId).select('niche brandSettings').lean().catch(() => null);
      if (u) {
        niche = niche || u.niche || null;
        platform = platform || u.brandSettings?.defaultPlatform || null;
      }
    }
    let styleProfile = null;
    if (userId) {
      try {
        const UserStyleProfile = require('../../models/UserStyleProfile');
        styleProfile = await UserStyleProfile.findOne({ userId }).lean();
      } catch { /* model unavailable in dev — fine */ }
    }
    payload.niche = niche;
    payload.platform = platform;
    payload.language = payload.language || req.language || 'en';
    payload.styleProfile = styleProfile;
  } catch (e) {
    logger.warn('Niche/style hydration failed for /analyze', { error: e.message });
  }

  // Dev users short-circuit — see devEditingMock() comment above.
  if (isDevUser(req.user)) {
    return sendSuccess(res, 'Video analyzed (dev mode)', 200, await devEditingMock('analyze', videoId, req));
  }

  try {
    const analysis = await analyzeVideoForEditing(payload);
    sendSuccess(res, 'Video analyzed for editing', 200, analysis);
  } catch (error) {
    const msg = error?.message || '';
    const isQuotaError =
      /429|too many requests|resource_exhausted|quota exceeded|rate limit/i.test(msg);
    if (isQuotaError) {
      logger.warn('AI provider quota exceeded for /analyze', { videoId, snippet: msg.slice(0, 200) });
      // Return 503 with a friendly message — the editor will surface this via analysisError
      // and the user can still proceed with manual edit / preset-based AI auto-edit.
      return sendError(
        res,
        'AI analysis is temporarily unavailable (provider quota exceeded). You can still run AI auto-edit with preset options or use the manual editor.',
        503
      );
    }
    logger.error('Analyze video for editing error', { error: msg });
    sendError(res, msg || 'Analysis failed', 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/score:
 *   post:
 *     summary: Get video score (potential or after edit)
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/score', auth, asyncHandler(async (req, res) => {
  const { videoId, editedVideoUrl } = req.body;

  if (!videoId) {
    return sendError(res, 'videoId is required', 400);
  }

  try {
    const result = await computeVideoScore(videoId, { editedVideoUrl });
    sendSuccess(res, 'Video score computed', 200, result);
  } catch (error) {
    logger.error('Video score error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/auto-edit:
 *   post:
 *     summary: Auto-edit video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
// ── GET /api/video/ai-editing/suggestions ─────────────────────────────────
// Niche/platform-aware playbook suggestions for the AiAssistant. Hydrates the
// creator's niche/platform from User if not in the query so the editor can
// call this with just `?videoId=...` and still get personalised output.
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const videoId = req.query.videoId;
  if (!videoId) return sendError(res, 'videoId is required', 400);
  // Ownership gate — suggestions reveal the project's structure, niche, and
  // hook framework calls; refuse for content the requester doesn't own.
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;
  try {
    const userId = req.user?._id || req.user?.id;
    let niche = req.query.niche || null;
    let platform = req.query.platform || null;
    if (userId && (!niche || !platform)) {
      const u = await User.findById(userId).select('niche brandSettings').lean().catch(() => null);
      if (u) {
        niche = niche || u.niche || null;
        platform = platform || u.brandSettings?.defaultPlatform || null;
      }
    }
    const result = await getInteractiveSuggestions(videoId, {
      niche, platform, language: req.language || 'en',
    });
    return sendSuccess(res, 'Suggestions ready', 200, result);
  } catch (e) {
    logger.error('/suggestions failed', { error: e.message });
    return sendError(res, e.message || 'Failed to compute suggestions', 500);
  }
}));

router.post('/auto-edit', auth, asyncHandler(async (req, res) => {
  const { videoId, editingOptions } = req.body;
  const userId = req.user?.id || req.user?._id;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  // Ownership gate — auto-edit mutates the source content (replaces the
  // edited video URL on the record); refuse for content the requester
  // doesn't own.
  const owned = await guardOwnership(req, res, videoId);
  if (!owned) return;

  // Dev users skip ffmpeg + AI calls entirely (advanced filters often aren't
  // compiled in the local ffmpeg build → "Filter not found"). Real users
  // continue to the full pipeline below.
  if (isDevUser(req.user)) {
    return sendSuccess(res, 'Auto-edit simulated (dev mode)', 200, await devEditingMock('auto-edit', videoId, req));
  }

  try {
    const resolvedOptions = await resolveEditingOptions(editingOptions || {}, userId, videoId);
    // Niche/platform/language + style profile context — same hydration path
    // as /analyze so the auto-edit pipeline's downstream AI calls (caption
    // generation, hook rewriting, etc.) get the same playbook injection.
    try {
      let niche = req.body.niche || null;
      let platform = req.body.platform || null;
      if (!niche || !platform) {
        const u = await User.findById(userId).select('niche brandSettings').lean().catch(() => null);
        if (u) {
          niche = niche || u.niche || null;
          platform = platform || u.brandSettings?.defaultPlatform || null;
        }
      }
      let styleProfile = null;
      try {
        const UserStyleProfile = require('../../models/UserStyleProfile');
        styleProfile = await UserStyleProfile.findOne({ userId }).lean();
      } catch { /* fine */ }
      resolvedOptions.niche = niche;
      resolvedOptions.platform = platform;
      resolvedOptions.language = req.language || 'en';
      resolvedOptions.styleProfile = styleProfile;
    } catch (e) {
      logger.warn('Niche/style hydration failed for /auto-edit', { error: e.message });
    }
    logger.info('Starting auto-edit video processing', { videoId, userId });

    // This function AUTOMATICALLY applies all edits and saves the edited video
    // Pass userId for real-time progress updates via WebSocket
    const result = await autoEditVideo(videoId, resolvedOptions, userId);

    if (result.success) {
      logger.info('Auto-edit completed successfully', {
        videoId,
        editedUrl: result.editedVideoUrl,
        editsCount: result.editsApplied?.length || 0
      });
      sendSuccess(res, 'Video automatically edited and saved successfully', 200, {
        ...result,
        message: `Video has been automatically edited with ${result.editsApplied?.length || 0} improvements applied. The edited video has replaced the original.`,
      });
    } else {
      sendError(res, 'Auto-edit completed but may have issues', 200, result);
    }
  } catch (error) {
    logger.error('Auto-edit video error', { error: error.message, videoId, stack: error.stack });
    sendError(res, `Video editing failed: ${error.message}`, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/scenes:
 *   post:
 *     summary: Detect scenes
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/scenes', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectScenes(videoId, videoMetadata || {});
    sendSuccess(res, 'Scenes detected', 200, result);
  } catch (error) {
    logger.error('Detect scenes error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/smart-cuts:
 *   post:
 *     summary: Detect smart cuts
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/smart-cuts', auth, asyncHandler(async (req, res) => {
  const { videoId, videoMetadata } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await detectSmartCuts(videoId, videoMetadata || {});
    sendSuccess(res, 'Smart cuts detected', 200, result);
  } catch (error) {
    logger.error('Detect smart cuts error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/presets:
 *   get:
 *     summary: List all edit presets
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/presets', auth, asyncHandler(async (req, res) => {
  try {
    const presets = listEditPresets();
    sendSuccess(res, 'Edit presets retrieved', 200, { presets });
  } catch (error) {
    logger.error('List presets error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/presets/:presetName:
 *   get:
 *     summary: Get preset details
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/presets/:presetName', auth, asyncHandler(async (req, res) => {
  const { presetName } = req.params;
  try {
    const preset = getEditPreset(presetName);
    if (!preset) {
      return sendError(res, `Preset "${presetName}" not found`, 404);
    }
    sendSuccess(res, 'Preset retrieved', 200, { preset });
  } catch (error) {
    logger.error('Get preset error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/preview:
 *   post:
 *     summary: Generate edit preview before applying
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/preview', auth, asyncHandler(async (req, res) => {
  const { videoId, editingOptions } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const preview = await generateEditPreview(videoId, editingOptions || {});
    sendSuccess(res, 'Edit preview generated', 200, preview);
  } catch (error) {
    logger.error('Generate preview error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/compare:
 *   post:
 *     summary: Create before/after comparison video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const comparison = await createComparisonVideo(videoId);
    sendSuccess(res, 'Comparison video created', 200, comparison);
  } catch (error) {
    logger.error('Create comparison error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/versions:
 *   post:
 *     summary: Save current edit version
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/versions', auth, asyncHandler(async (req, res) => {
  const { videoId, versionName } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const version = await saveEditVersion(videoId, versionName);
    sendSuccess(res, 'Edit version saved', 200, { version });
  } catch (error) {
    logger.error('Save version error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/versions/:versionId/restore:
 *   post:
 *     summary: Restore a previous edit version
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/versions/:versionId/restore', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.body;
  const { versionId } = req.params;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  try {
    const result = await restoreEditVersion(videoId, versionId);
    sendSuccess(res, 'Version restored', 200, result);
  } catch (error) {
    logger.error('Restore version error', { error: error.message, videoId, versionId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/batch:
 *   post:
 *     summary: Batch auto-edit multiple videos
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/batch', auth, asyncHandler(async (req, res) => {
  const { videoIds, editingOptions } = req.body;

  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return sendError(res, 'Video IDs array is required', 400);
  }

  if (videoIds.length > 50) {
    return sendError(res, 'Maximum 50 videos per batch', 400);
  }

  try {
    logger.info('Starting batch auto-edit', { count: videoIds.length, userId: req.user?.id || req.user?._id });
    const results = await batchAutoEdit(videoIds, editingOptions || {});
    sendSuccess(res, 'Batch auto-edit completed', 200, results);
  } catch (error) {
    logger.error('Batch auto-edit error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/analytics/:videoId:
 *   get:
 *     summary: Get edit performance analytics
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics/:videoId', auth, asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  try {
    const analytics = await getEditPerformanceAnalytics(videoId);
    sendSuccess(res, 'Edit analytics retrieved', 200, analytics);
  } catch (error) {
    logger.error('Get analytics error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/ai-editing/export:
 *   post:
 *     summary: Export video to multiple formats
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/export', auth, asyncHandler(async (req, res) => {
  const { videoId, formats = ['mp4', 'webm'] } = req.body;

  if (!videoId) {
    return sendError(res, 'Video ID is required', 400);
  }

  if (!Array.isArray(formats) || formats.length === 0) {
    return sendError(res, 'Formats array is required', 400);
  }

  try {
    const exports = await exportMultipleFormats(videoId, formats);
    sendSuccess(res, 'Multi-format export completed', 200, exports);
  } catch (error) {
    logger.error('Multi-format export error', { error: error.message, videoId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;







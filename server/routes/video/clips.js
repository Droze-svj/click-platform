/**
 * /api/video/clips — clip hub endpoints.
 *
 *   GET  /api/video/clips/hub                  Recent AI clips for current user
 *   GET  /api/video/clips/hub/:contentId       Clips for a specific source video
 *   POST /api/video/clips/:contentId/:clipId/rate   User rating (1..5)
 *   DELETE /api/video/clips/:contentId/:clipId      Soft-delete a single clip
 */

const express = require('express');
const auth = require('../../middleware/auth');
const Content = require('../../models/Content');
const logger = require('../../utils/logger');
const { sendSuccess, sendError } = require('../../utils/response');
const { getLimits } = require('../../services/planLimitsService');
const { getUserIdFromReq } = require('../../utils/userId');
const { allowDevMode } = require('../../utils/devUser');

const router = express.Router();

function pickClipShape(parentId, clip) {
  return {
    id: clip._id || clip.id || `${parentId}-${clip.url || ''}`,
    contentId: parentId,
    url: clip.url,
    thumbnail: clip.thumbnail || null,
    duration: clip.duration || 0,
    caption: clip.caption || '',
    platform: clip.platform || 'auto',
    highlight: clip.highlight || null,
    style: clip.style || clip.template || 'modern',
    viralScore: typeof clip.viralScore === 'number' ? clip.viralScore : (clip.score || null),
    hookScore: typeof clip.hookScore === 'number' ? clip.hookScore : null,
    // Score-breakdown inputs that ClipLightbox renders as MetricRow bars.
    // Stored by aiVideoEditingService.js when each clip lands in
    // shortVideos[]. Without these, the lightbox shows empty bars.
    sentimentEnergy: typeof clip.sentimentEnergy === 'number' ? clip.sentimentEnergy : null,
    viralMomentCount: typeof clip.viralMomentCount === 'number' ? clip.viralMomentCount : null,
    hookText: clip.hookText || null,
    // Style attribution — preset + variation tags drive the badge in
    // ClipCard ("Angle 2/3", preset · variation labels) and feed pick-and-learn.
    stylePresetId: clip.stylePresetId || null,
    stylePresetLabel: clip.stylePresetLabel || null,
    variationId: clip.variationId || null,
    variationLabel: clip.variationLabel || null,
    variationIndex: typeof clip.variationIndex === 'number' ? clip.variationIndex : null,
    variationsInPreset: typeof clip.variationsInPreset === 'number' ? clip.variationsInPreset : null,
    rating: typeof clip.rating === 'number' ? clip.rating : null,
    editsApplied: Array.isArray(clip.editsApplied) ? clip.editsApplied : [],
    expiresAt: clip.expiresAt || null,
    createdAt: clip.createdAt || clip.generatedAt || clip.timestamp || null,
    aiGenerated: clip.aiGenerated === true || clip.source === 'ai-auto-edit',
    // Smart Publish defaults — written by smartPublishService after each
    // auto-edit. The drawer renders these as editable defaults; capturing
    // any user edit feeds the learning loop on publish.
    recommendedCaptions: clip.recommendedCaptions || null,
    recommendedHashtags: clip.recommendedHashtags || null,
    recommendedSlots: Array.isArray(clip.recommendedSlots) ? clip.recommendedSlots : [],
    publishRationale: clip.publishRationale || null,
    // Slim caption track for the client-side overlay layer. Pulled from the
    // saved keyMoments so the lightbox can show captions even when the
    // exported MP4 doesn't have them baked in (older clips rendered before
    // libfreetype was available, or in-app preview before download).
    captions: (() => {
      const km = clip.keyMoments || {};
      const out = [];
      const push = (t) => {
        if (!t || typeof t.text !== 'string' || !t.text.trim()) return;
        const s = Number(t.startTime ?? t.start ?? 0);
        const e = Number(t.endTime ?? t.end ?? s + 2);
        if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
        // Pass through word-level timings when present so the client can
        // render kinetic / per-word captions. Falls back to deriving
        // even spacing from the caption span if the source has only
        // the text string — degraded but still animatable.
        const sourceWords = Array.isArray(t.words) ? t.words : null;
        let words;
        if (sourceWords && sourceWords.length > 0) {
          words = sourceWords
            .filter((w) => w && (w.word || w.text))
            .map((w) => ({
              word: String(w.word || w.text).trim(),
              start: Number(w.start ?? s),
              end: Number(w.end ?? w.start ?? s),
            }))
            .filter((w) => w.word.length > 0 && Number.isFinite(w.start) && Number.isFinite(w.end));
        } else {
          const tokens = t.text.trim().split(/\s+/);
          const span = (e - s) / Math.max(1, tokens.length);
          words = tokens.map((tok, i) => ({
            word: tok,
            start: s + i * span,
            end: s + (i + 1) * span,
          }));
        }
        // Emphasis hints: caps-locked, long, or marked with ! capture
        // the "punch" word styles competitors animate the loudest.
        const emphasize = (w) => /^[A-Z]{2,}$/.test(w.word) || w.word.length >= 8 || /[!?]$/.test(w.word);
        out.push({
          start: s,
          end: e,
          text: t.text.trim(),
          style: t.style || null,
          words: words.map((w) => ({ ...w, emphasis: emphasize(w) ? 'pop' : null })),
        });
      };
      if (Array.isArray(km.suggestedCaptions)) km.suggestedCaptions.forEach(push);
      if (Array.isArray(km.viralMoments)) km.viralMoments.forEach((m) => push({ ...m, text: m.text || m.label }));
      if (km.hook && (km.hook.text || km.hookText)) push({ ...km.hook, text: km.hook.text || km.hookText });
      return out.sort((a, b) => a.start - b.start).slice(0, 60);
    })(),
  };
}

// ── GET /hub ────────────────────────────────────────────────────────────────
// Returns the user's most recent AI-generated clips across ALL their videos.
// Sort: newest first. Excludes soft-expired clips. Paginated.
router.get('/hub', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(60, Math.max(1, parseInt(req.query.pageSize, 10) || 24));

    const docs = await Content.find({
      userId,
      'generatedContent.shortVideos.0': { $exists: true },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .select('_id title thumbnail generatedContent.shortVideos updatedAt folderId')
      .populate('folderId', 'name color')
      .lean();

    const flat = [];
    for (const doc of docs) {
      const list = doc.generatedContent?.shortVideos || [];
      for (const clip of list) {
        if (clip.expired) continue;
        flat.push({
          ...pickClipShape(String(doc._id), clip),
          parentTitle: doc.title || 'Untitled',
          parentThumbnail: doc.thumbnail || null,
          folder: doc.folderId ? {
            id: doc.folderId._id,
            name: doc.folderId.name,
            color: doc.folderId.color
          } : null,
        });
      }
    }
    flat.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const total = flat.length;
    const start = (page - 1) * pageSize;
    const items = flat.slice(start, start + pageSize);

    return sendSuccess(res, 'Clip hub', 200, {
      items,
      page,
      pageSize,
      total,
      planLimits: getLimits(req.user || {}),
    });
  } catch (err) {
    logger.error('clip hub failed', { error: err.message });
    return sendError(res, 'Failed to load clip hub', 500);
  }
});

// ── GET /hub/:contentId ──────────────────────────────────────────────────────
// Clips generated for a specific source video. Used when the AI auto-edit
// finishes and we redirect the user straight to "their" clips.
router.get('/hub/:contentId', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { contentId } = req.params;

    // Handle dev contentIds. The previous version unconditionally
    // returned a hardcoded pair of mock clips (BBB cartoon + Sintel
    // trailer) — so EVERY dev auto-edit looked identical regardless of
    // what the user actually uploaded or what the pipeline rendered.
    // Now we first try to read the user's real auto-edited clips from
    // devVideoStore.generatedContent.shortVideos. We only fall back to
    // the enriched mocks when the dev video genuinely has no real clips
    // yet (e.g. before auto-edit has run).
    if (
      allowDevMode(req) &&
      (contentId.toString().startsWith('dev-content-') || contentId.toString().startsWith('dev-'))
    ) {
      const { devVideoStore } = require('../../utils/devStore');
      const dev = devVideoStore.get(contentId.toString());
      const realClips = Array.isArray(dev?.generatedContent?.shortVideos)
        ? dev.generatedContent.shortVideos
        : [];

      if (realClips.length > 0) {
        logger.info('Serving real auto-edited clips for dev content', {
          contentId, count: realClips.length,
        });
        // Resolve relative `/uploads/...` paths to absolute backend URLs
        // so the browser hits :5001 (where the files actually live)
        // instead of :3010 (the Next origin, which doesn't proxy
        // /uploads). Without this the lightbox video tag 404s on the
        // client even though the file exists on disk.
        const backendBase = `${req.protocol}://${req.get('host')}`;
        const toAbsolute = (u) => {
          if (!u) return u;
          if (/^https?:\/\//i.test(u)) return u;
          if (u.startsWith('/')) return `${backendBase}${u}`;
          return `${backendBase}/${u}`;
        };
        const items = realClips.map((c, i) => ({
          id: c._id || c.id || `${contentId}-clip-${i}`,
          contentId,
          url: toAbsolute(c.url),
          thumbnail: toAbsolute(c.thumbnail) || null,
          duration: c.duration ?? null,
          caption: c.caption || c.recommendedCaptions?.tiktok || c.recommendedCaptions?.shorts || 'AI Auto-Edited Clip',
          hookText: c.hookText || null,
          platform: c.platform || 'shorts',
          highlight: !!c.highlight,
          style: c.style || null,
          stylePresetId: c.stylePresetId || null,
          stylePresetLabel: c.stylePresetLabel || null,
          variationId: c.variationId || null,
          variationLabel: c.variationLabel || null,
          variationIndex: typeof c.variationIndex === 'number' ? c.variationIndex : null,
          variationsInPreset: c.variationsInPreset || null,
          viralScore: typeof c.viralScore === 'number' ? c.viralScore : null,
          hookScore: typeof c.hookScore === 'number' ? c.hookScore : null,
          sentimentEnergy: typeof c.sentimentEnergy === 'number' ? c.sentimentEnergy : null,
          viralMomentCount: typeof c.viralMomentCount === 'number' ? c.viralMomentCount : null,
          // Pass-through editor option metadata so the lightbox's
          // "AI edits applied" panel and "Why this score" reasons can
          // render the user's actual choices, not generic defaults.
          // Earlier these were dropped during the hub map even though
          // autoEditVideo persisted them.
          colorGrade: c.colorGrade || null,
          hookStyle: c.hookStyle || null,
          pacingIntensity: c.pacingIntensity || null,
          transitionStyle: c.transitionStyle || null,
          musicGenre: c.musicGenre || null,
          ctaStyle: c.ctaStyle || null,
          voiceTone: c.voiceTone || null,
          niche: c.niche || null,
          editsApplied: Array.isArray(c.editsApplied) ? c.editsApplied : (c.applied || []),
          rating: c.rating ?? null,
          published: !!c.published,
          aiGenerated: true,
          createdAt: c.createdAt || dev.updatedAt || new Date().toISOString(),
          recommendedCaptions: c.recommendedCaptions || null,
          recommendedCaptionVariants: c.recommendedCaptionVariants || null,
          recommendedHashtags: c.recommendedHashtags || null,
          recommendedSlots: c.recommendedSlots || [],
          publishRationale: c.publishRationale || null,
        }));
        return sendSuccess(res, 'Real auto-edited clips', 200, {
          contentId: String(contentId),
          title: dev?.title || 'Untitled',
          thumbnail: dev?.thumbnail || null,
          items,
        });
      }

      logger.info('Serving mock clips for dev content (no real clips yet)', { contentId });
      const now = new Date().toISOString();
      return sendSuccess(res, 'Dev clips', 200, {
        items: [
          {
            id: 'dev-clip-1',
            contentId,
            // Note: Google's gtv-videos-bucket public samples now return 403,
            // so we use w3schools' BBB mirror which still serves with proper
            // CORS headers + range requests for the lightbox player.
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            // Thumbnail set to null — the ClipCard placeholder renders
            // cleanly instead of waiting on a maybe-broken poster URL.
            thumbnail: null,
            duration: 15,
            caption: 'Wait until you see what happens at 0:08 — total game-changer.',
            hookText: 'Wait until you see what happens at 0:08',
            platform: 'shorts',
            highlight: true,
            style: 'bold-kinetic',
            stylePresetId: 'mrbeast-energy',
            stylePresetLabel: 'MrBeast Energy',
            variationId: 'big-stakes',
            variationLabel: 'Big Stakes Hook',
            variationIndex: 0,
            variationsInPreset: 3,
            viralScore: 95,
            hookScore: 92,
            sentimentEnergy: 8.6,
            viralMomentCount: 4,
            hookStyle: 'bold-claim',
            musicGenre: 'energetic',
            pacingIntensity: 'intense',
            transitionStyle: 'whip',
            colorGrade: 'vivid',
            ctaStyle: 'subscribe',
            voiceTone: 'inspirational',
            hookDuration: 1,
            editsApplied: ['Remove silence', 'Optimize pacing', 'Enhance audio', 'Hook detection'],
            rating: null,
            published: false,
            aiGenerated: true,
            createdAt: now,
          },
          {
            id: 'dev-clip-2',
            contentId,
            // w3.org's Sintel trailer is the canonical open-source cinematic
            // sample — fits the "Cinematic Doc · Slow Burn" preset perfectly.
            url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
            thumbnail: null,
            duration: 28,
            caption: 'The one trick most creators miss in their first 3 seconds.',
            hookText: 'The one trick most creators miss',
            platform: 'reels',
            highlight: false,
            style: 'minimal',
            stylePresetId: 'cinematic-doc',
            stylePresetLabel: 'Cinematic Doc',
            variationId: 'slow-burn',
            variationLabel: 'Slow Burn',
            variationIndex: 0,
            variationsInPreset: 3,
            viralScore: 78,
            hookScore: 71,
            sentimentEnergy: 6.4,
            viralMomentCount: 2,
            hookStyle: 'story',
            musicGenre: 'dramatic',
            pacingIntensity: 'chill',
            transitionStyle: 'crossfade',
            colorGrade: 'cinematic',
            ctaStyle: 'share',
            voiceTone: 'inspirational',
            hookDuration: 3,
            editsApplied: ['Optimize pacing', 'Enhance audio', 'Color grade'],
            rating: null,
            published: false,
            aiGenerated: true,
            createdAt: now,
          }
        ],
        parentTitle: 'Dev Video ' + contentId,
        parentThumbnail: null
      });
    }

    const doc = await Content.findOne({ _id: contentId, userId })
      .select('_id title thumbnail generatedContent.shortVideos folderId')
      .populate('folderId', 'name color')
      .lean();
    if (!doc) return sendError(res, 'Content not found', 404);
    const items = (doc.generatedContent?.shortVideos || [])
      .filter(c => !c.expired)
      .map(c => ({
        ...pickClipShape(String(doc._id), c),
        parentTitle: doc.title || 'Untitled',
        parentThumbnail: doc.thumbnail || null,
        folder: doc.folderId ? {
          id: doc.folderId._id,
          name: doc.folderId.name,
          color: doc.folderId.color
        } : null,
      }));
    return sendSuccess(res, 'Clips for content', 200, {
      contentId: String(doc._id),
      title: doc.title,
      thumbnail: doc.thumbnail,
      items,
    });
  } catch (err) {
    logger.error('clip hub by content failed', { error: err.message });
    return sendError(res, 'Failed to load clips', 500);
  }
});

// ── POST /:contentId/:clipId/rate ────────────────────────────────────────────
router.post('/:contentId/:clipId/rate', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { contentId, clipId } = req.params;
    const raw = Number(req.body?.rating);
    if (!Number.isFinite(raw) || raw < 1 || raw > 5) {
      return sendError(res, 'rating must be an integer 1..5', 400);
    }
    const rating = Math.round(raw);

    const doc = await Content.findOne({ _id: contentId, userId });
    if (!doc) return sendError(res, 'Content not found', 404);

    const list = doc.generatedContent?.shortVideos || [];
    const clip = list.find(c => String(c._id || c.id) === String(clipId));
    if (!clip) return sendError(res, 'Clip not found', 404);

    clip.rating = rating;
    doc.markModified('generatedContent');
    await doc.save();
    return sendSuccess(res, 'Rating saved', 200, { contentId, clipId, rating });
  } catch (err) {
    logger.error('clip rate failed', { error: err.message });
    return sendError(res, 'Failed to save rating', 500);
  }
});

// ── DELETE /:contentId/:clipId ───────────────────────────────────────────────
// Soft-delete a single clip (sets expired/expiredAt). Hard-delete is owned by
// the retention cron after the grace window.
router.delete('/:contentId/:clipId', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { contentId, clipId } = req.params;
    const doc = await Content.findOne({ _id: contentId, userId });
    if (!doc) return sendError(res, 'Content not found', 404);
    const list = doc.generatedContent?.shortVideos || [];
    const clip = list.find(c => String(c._id || c.id) === String(clipId));
    if (!clip) return sendError(res, 'Clip not found', 404);
    clip.expired = true;
    clip.expiredAt = new Date();
    doc.markModified('generatedContent');
    await doc.save();
    return sendSuccess(res, 'Clip removed', 200, { contentId, clipId });
  } catch (err) {
    logger.error('clip delete failed', { error: err.message });
    return sendError(res, 'Failed to remove clip', 500);
  }
});

// ── POST /:contentId/:clipId/publish ────────────────────────────────────────
// Pick-and-learn: the user marks a clip as "published" (their pick from the
// AI-generated batch). We persist the publish flag on the clip AND feed the
// clip's metadata into styleLearningService so future auto-edits re-rank
// toward the style the user actually picks.
//
// Optional body: { platform: 'tiktok'|'shorts'|... } so the frontend can
// later wire a one-click publish-to-platform flow without a schema change.
router.post('/:contentId/:clipId/publish', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { contentId, clipId } = req.params;
    const platform = (req.body?.platform || '').toString().toLowerCase() || null;
    // Optional Smart Publish payload from the SchedulePublishDrawer. When
    // present, we record the deltas (caption / time) so the learning loop
    // captures user disagreement with the AI suggestion as a signal.
    const userCaption = typeof req.body?.caption === 'string' ? req.body.caption : null;
    const originalCaption = typeof req.body?.originalCaption === 'string' ? req.body.originalCaption : null;
    const scheduledTime = req.body?.scheduledTime ? new Date(req.body.scheduledTime) : null;
    const originalTime  = req.body?.originalTime  ? new Date(req.body.originalTime)  : null;

    // Dev-content shortcut so the publish loop is testable without a Mongo
    // record. Gated behind allowDevMode so a real prod user can't publish
    // someone else's dev fixture by passing a `dev-content-*` id.
    if (
      allowDevMode(req) &&
      (String(contentId).startsWith('dev-content-') || String(contentId).startsWith('dev-'))
    ) {
      return sendSuccess(res, 'Published (dev)', 200, {
        contentId, clipId, published: true, publishedAt: new Date(), learned: true,
      });
    }

    const doc = await Content.findOne({ _id: contentId, userId });
    if (!doc) return sendError(res, 'Content not found', 404);

    const list = doc.generatedContent?.shortVideos || [];
    const clip = list.find(c => String(c._id || c.id) === String(clipId));
    if (!clip) return sendError(res, 'Clip not found', 404);

    clip.published = true;
    // Persist the user's chosen schedule. If they didn't pass one, fall
    // back to "now" — that's the previous behaviour.
    clip.publishedAt = scheduledTime && Number.isFinite(scheduledTime.getTime()) ? scheduledTime : new Date();
    if (platform) clip.publishedPlatform = platform;
    if (userCaption) clip.publishedCaption = userCaption;
    // Capture the deltas so future analytics can correlate "kept AI
    // suggestion" vs "user rewrote it" with engagement outcomes.
    if (originalCaption !== null && userCaption && originalCaption !== userCaption) {
      clip.captionDelta = {
        original: originalCaption,
        final: userCaption,
        editedAt: new Date(),
      };
    }
    if (originalTime && scheduledTime && Math.abs(originalTime.getTime() - scheduledTime.getTime()) > 60_000) {
      clip.timeDelta = {
        original: originalTime,
        final: scheduledTime,
        editedAt: new Date(),
      };
    }
    doc.markModified('generatedContent');
    await doc.save();

    // Feed the pick back into the user's style fingerprint. Best-effort —
    // a learning failure must NOT block the publish action itself.
    //
    // The captionDelta/timeDelta magnitudes feed the engagement-weighted
    // learning side of styleLearningService: small/no edits → user kept
    // the AI suggestion → +retention on the weighted facets; large edits
    // → suggestion was rejected → -retention. This is the cheap
    // engagement-proxy until real analytics land.
    const captionDeltaChars = (originalCaption !== null && userCaption)
      ? Math.abs((userCaption || '').length - (originalCaption || '').length)
      : 0;
    const timeDeltaMs = (originalTime && scheduledTime)
      ? Math.abs(originalTime.getTime() - scheduledTime.getTime())
      : 0;
    const keptSuggestion = !clip.captionDelta && !clip.timeDelta;

    // Per-variant accept tracking — when the clip has a recommendedCaptionVariants
    // map for the published platform, figure out which variant the user
    // actually shipped (if any) and bump a `captionVariantsAccepted`
    // counter on the profile keyed by the variant's framework angle.
    // Cheap heuristic: longest matching prefix.
    let acceptedVariantAngle = null;
    try {
      const platformKey = (platform || clip.publishedPlatform || '').toLowerCase();
      const variants = clip.recommendedCaptionVariants?.[platformKey] || [];
      if (Array.isArray(variants) && variants.length > 0 && (userCaption || clip.caption)) {
        const final = String(userCaption || clip.caption).trim().toLowerCase();
        let bestMatch = -1;
        let bestScore = 0;
        for (let i = 0; i < variants.length; i++) {
          const candidate = String(variants[i] || '').trim().toLowerCase();
          if (!candidate) continue;
          // Match score = chars in common at the start. Anything ≥ 60% of
          // the candidate length counts as "accepted variant i".
          let prefix = 0;
          const n = Math.min(final.length, candidate.length);
          while (prefix < n && final[prefix] === candidate[prefix]) prefix++;
          const score = prefix / Math.max(1, candidate.length);
          if (score > bestScore && score >= 0.6) {
            bestScore = score;
            bestMatch = i;
          }
        }
        if (bestMatch >= 0) {
          const angles = ['curiosity-gap', 'value-led', 'contrarian'];
          acceptedVariantAngle = angles[bestMatch] || `variant-${bestMatch}`;
          try {
            const UserStyleProfile = require('../../models/UserStyleProfile');
            await UserStyleProfile.recordPick(userId, 'captionVariantsAccepted', acceptedVariantAngle);
          } catch (e) {
            logger.warn('captionVariantsAccepted recordPick failed', { error: e.message, userId });
          }
        }
      }
    } catch (e) {
      logger.warn('per-variant accept detection failed', { error: e.message });
    }

    let learnResult = null;
    try {
      const { learnFromPublishedClip } = require('../../services/styleLearningService');
      learnResult = await learnFromPublishedClip(userId, {
        contentId,
        stylePresetId: clip.stylePresetId,
        stylePresetLabel: clip.stylePresetLabel,
        style: clip.style,
        captionStyle: clip.captionStyle,
        hookStyle: clip.hookStyle,
        transitionStyle: clip.transitionStyle,
        colorGrade: clip.colorGrade,
        pacingIntensity: clip.pacingIntensity,
        musicGenre: clip.musicGenre,
        platform: platform || clip.publishedPlatform,
        // Final values that the user actually shipped — these drive the
        // publishHours / publishDays / avgCaptionLength updates inside
        // styleLearningService.
        caption: userCaption || clip.caption,
        publishedAt: clip.publishedAt,
        // Engagement-proxy signal so the weighted-performance facets
        // climb for picks the user kept and fade for picks they rejected.
        keptSuggestion,
        captionDelta: captionDeltaChars,
        timeDelta: timeDeltaMs,
      });
    } catch (e) {
      logger.warn('learnFromPublishedClip failed; publish still succeeded', { error: e.message });
    }

    return sendSuccess(res, 'Clip published', 200, {
      contentId,
      clipId,
      published: true,
      publishedAt: clip.publishedAt,
      captionEdited: !!clip.captionDelta,
      timeEdited: !!clip.timeDelta,
      learned: !!learnResult?.success,
      preferredPresetId: learnResult?.preferredPresetId || null,
    });
  } catch (err) {
    logger.error('clip publish failed', { error: err.message });
    return sendError(res, 'Failed to publish clip', 500);
  }
});

// ── GET /style-insight ──────────────────────────────────────────────────────
// Rich per-option insight derived from the user's published clip history.
// Blends in team-level fingerprint when the user is part of a team, so a
// new team member inherits "the team's style" until they build their own.
router.get('/style-insight', auth, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const teamId = req.user?.teamId || req.query?.teamId || null;
    const { getResolvedStyleInsight } = require('../../services/styleLearningService');
    const insight = await getResolvedStyleInsight(userId, teamId);
    return sendSuccess(res, 'Style insight', 200, insight);
  } catch (err) {
    logger.error('clip style-insight failed', { error: err.message });
    return sendError(res, 'Failed to load style insight', 500);
  }
});

module.exports = router;

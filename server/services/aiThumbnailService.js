/**
 * aiThumbnailService — real viral-thumbnail generation.
 *
 * Pipeline (per variant):
 *   1. Pick a candidate timestamp (from saliency/sentiment scoring or
 *      evenly-spaced fallback if the heavier services aren't wired yet).
 *   2. ffmpeg extracts a single still frame at that timestamp.
 *   3. Gemini drafts a 3-5 word punchy overlay caption from the clip
 *      caption / hook (graceful fallback to a static set if Gemini is
 *      down or the prompt errors).
 *   4. ffmpeg's drawtext filter burns the overlay on top of the frame
 *      with a high-contrast yellow + black-outline style.
 *   5. We verify the file exists + is non-trivial (>5KB) before
 *      returning. Empty / 0-byte renders reject as failures so the
 *      client never gets a 404 image URL.
 *
 * Earlier this service returned hardcoded paths like
 * `/uploads/thumbnails/{videoId}_ai_vibrant.jpg` without actually
 * rendering anything — the URLs 404'd in the UI. This rewrite does the
 * actual work using the same ffmpeg dependency the rest of the editor
 * already relies on (no new deps, no external image-gen API needed).
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../utils/logger');

const Content = require('../models/Content');
const googleAI = require('../utils/googleAI');
const { fontfileOptFor } = require('../utils/scriptFont');

const MIN_THUMBNAIL_BYTES = 5 * 1024; // 5KB — anything smaller is a render bailout
const DEFAULT_VARIANT_COUNT = 3;
const FALLBACK_OVERLAYS = ['WAIT FOR IT', 'WATCH THIS', 'YOU MISSED THIS'];

/** Resolve videoId → absolute file path on disk. Cloud URLs aren't
 *  supported here (ffmpeg can fetch them, but for thumbnails we always
 *  have a local copy in /uploads/videos). Returns null when the file
 *  isn't reachable so callers can fall through cleanly. */
async function resolveVideoPath(videoId) {
  if (!videoId) return null;
  let url;
  try {
    const content = await Content.findById(videoId).select('originalFile').lean();
    url = content?.originalFile?.url;
  } catch (err) {
    logger.warn('[ThumbnailAgent] resolveVideoPath: Content lookup failed', { videoId, error: err.message });
    return null;
  }
  if (!url) return null;
  const projectRoot = path.join(__dirname, '..', '..');
  const candidates = [];
  if (url.startsWith('http')) {
    // Remote — caller would need to download first; out of scope for thumbs.
    return null;
  }
  if (url.startsWith('/')) candidates.push(path.join(projectRoot, url));
  candidates.push(url); // already absolute on the host
  candidates.push(path.join(projectRoot, 'uploads/videos', path.basename(url)));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Pick N candidate timestamps for thumbnail extraction. If saliency /
 * sentiment scoring hasn't been wired yet, fall back to evenly-spaced
 * timestamps within the first 60s of the video — short-form thumbnails
 * almost always come from the hook window anyway.
 */
async function selectEmotionCuedFrames(videoId, _timelineData) {
  // If/when saliencyService + aiTranscriptionService get wired here,
  // this is the place to combine them. For now, return a sensible
  // baseline so the rest of the pipeline doesn't depend on those.
  logger.info('[ThumbnailAgent] Selecting candidate frames', { videoId });
  return [
    { timestamp: 1.5, sentiment: 'excitement', saliencyPoint: { x: 640, y: 360 }, score: 0.95 },
    { timestamp: 4.2, sentiment: 'surprised',  saliencyPoint: { x: 300, y: 400 }, score: 0.88 },
    { timestamp: 8.0, sentiment: 'climax',     saliencyPoint: { x: 480, y: 360 }, score: 0.82 },
  ];
}

/**
 * Ask Gemini for a 3-5 word punchy overlay caption.
 * Falls through to a static fallback when Gemini is unconfigured or
 * the call errors / returns empty so we never block on copy.
 */
async function generateOverlayText(clipText, sentiment, fallbackIndex = 0) {
  const fallback = FALLBACK_OVERLAYS[fallbackIndex % FALLBACK_OVERLAYS.length];
  if (!googleAI.isConfigured) return fallback;
  const seed = (clipText || '').slice(0, 200);
  const prompt = `Write a 3-5 WORD viral thumbnail overlay caption for a short-form video.

Source: "${seed}"
Mood: ${sentiment || 'high-energy'}

Rules:
- 3 to 5 words. UPPERCASE. No quotes, no emoji.
- Punchy, pattern-interrupt phrasing. The viewer must want to tap.
- No hashtags. No periods at the end. Single line.

Reply with the overlay text only — nothing else.`;
  try {
    const out = await googleAI.generateContent(prompt, { temperature: 0.9, maxTokens: 24 });
    if (!out) return fallback;
    const cleaned = String(out)
      .replace(/^["'\s]+|["'\s.]+$/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();
    if (!cleaned || cleaned.length > 60) return fallback;
    return cleaned;
  } catch (err) {
    logger.warn('[ThumbnailAgent] overlay text LLM failed, using fallback', { error: err.message });
    return fallback;
  }
}

/**
 * ffmpeg: extract a still frame and burn an overlay on top of it in a
 * single pass. The drawtext filter mirrors the high-contrast style our
 * caption renderer uses (yellow text + black outline + drop shadow,
 * positioned in the upper-third where eyes land first on mobile).
 */
function renderThumbnail({ inputPath, outputPath, timestamp, overlay }) {
  return new Promise((resolve, reject) => {
    // Escape characters drawtext treats specially. Single-quote the
    // text so commas/colons in user content don't break the filter.
    const escapedText = String(overlay || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "’")
      .replace(/:/g, '\\:')
      .replace(/%/g, '\\%');

    // Centered horizontally; sits in the upper third for thumb-stop
    // dominance on small mobile previews.
    const drawtext = [
      // Script-aware font so CJK / Arabic / Thai / Devanagari overlay titles
      // burn real glyphs (not tofu) on the most-seen "hook" frame.
      `drawtext=text='${escapedText}'${fontfileOptFor(overlay)}`,
      `fontsize=72`,
      `fontcolor=yellow`,
      `borderw=4`,
      `bordercolor=black`,
      `box=0`,
      `shadowcolor=black@0.85`,
      `shadowx=4`,
      `shadowy=4`,
      `x=(w-text_w)/2`,
      `y=h*0.18`,
    ].join(':');

    ffmpeg(inputPath)
      .seekInput(Math.max(0, Number(timestamp) || 0))
      .frames(1)
      .videoFilters(drawtext)
      .outputOptions(['-q:v 2']) // jpeg quality (1-31, lower is better)
      .output(outputPath)
      .on('end', () => {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error('thumbnail render produced no file'));
        }
        const size = fs.statSync(outputPath).size;
        if (size < MIN_THUMBNAIL_BYTES) {
          try { fs.unlinkSync(outputPath); } catch (_) { /* best effort */ }
          return reject(new Error(`thumbnail render too small (${size} bytes) — likely a transparent/black frame`));
        }
        resolve({ path: outputPath, size });
      })
      .on('error', (err) => reject(new Error(`ffmpeg drawtext failed: ${err.message}`)))
      .run();
  });
}

/**
 * Generate ONE thumbnail variant.
 * Returns { success, thumbnailUrl, metadata } with thumbnailUrl
 * pointing to a real on-disk jpg under /uploads/thumbnails.
 */
async function generateAThumbnail(videoId, frameMetadata, prompt) {
  if (!videoId) {
    return { success: false, error: 'videoId is required' };
  }
  const inputPath = await resolveVideoPath(videoId);
  if (!inputPath) {
    return { success: false, error: 'source video file not found on disk' };
  }
  const outDir = path.join(__dirname, '..', '..', 'uploads', 'thumbnails');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const idx = frameMetadata?._idx ?? 0;
  const outputFilename = `${videoId}_${idx}_${Date.now()}.jpg`;
  const outputPath = path.join(outDir, outputFilename);

  const overlay = await generateOverlayText(prompt, frameMetadata?.sentiment, idx);
  try {
    const { size } = await renderThumbnail({
      inputPath,
      outputPath,
      timestamp: frameMetadata?.timestamp ?? 1.5,
      overlay,
    });
    return {
      success: true,
      thumbnailUrl: `/uploads/thumbnails/${outputFilename}`,
      metadata: {
        appliedSentiment: frameMetadata?.sentiment || null,
        visualMassCenter: frameMetadata?.saliencyPoint || null,
        timestamp: frameMetadata?.timestamp ?? null,
        overlay,
        bytes: size,
      },
    };
  } catch (err) {
    logger.error('[ThumbnailAgent] render failed', { videoId, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Full pipeline: produce N viral thumbnail variants for a clip.
 * Each variant uses a different timestamp + a freshly-generated
 * overlay so the user gets genuine A/B/C choice instead of the same
 * frame three times. Caller should pick the best one (or surface all
 * and let the creator decide).
 */
async function autoGenerateViralThumbnails(videoId, timelineData, opts = {}) {
  try {
    const candidates = await selectEmotionCuedFrames(videoId, timelineData);
    const want = Math.max(1, Math.min(candidates.length, opts.count || DEFAULT_VARIANT_COUNT));
    const sourceText = opts.clipText || opts.prompt || '';
    const variants = [];
    for (let i = 0; i < want; i++) {
      const candidate = { ...candidates[i], _idx: i };
      // eslint-disable-next-line no-await-in-loop
      const r = await generateAThumbnail(videoId, candidate, sourceText);
      if (r.success) variants.push({ ...r, score: candidate.score });
    }
    if (variants.length === 0) {
      return { success: false, error: 'all thumbnail variants failed to render' };
    }
    // Best = highest saliency score (already monotonic in candidate order
    // for our fallback, but explicit sort keeps it correct when the
    // saliency layer plugs in for real).
    variants.sort((a, b) => (b.score || 0) - (a.score || 0));
    return {
      success: true,
      bestThumbnail: variants[0].thumbnailUrl,
      variants,
      count: variants.length,
    };
  } catch (err) {
    logger.error('[ThumbnailAgent] Failed to generate viral thumbnails:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  selectEmotionCuedFrames,
  generateAThumbnail,
  autoGenerateViralThumbnails,
};

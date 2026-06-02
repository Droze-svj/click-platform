const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { run: ffmpegRun } = require('../utils/ffmpegRunner');

/**
 * Generative Outpainting & Context-Aware Inpainting Service.
 *
 * `outpaintToVertical` is REAL: it converts a horizontal video to a 9:16
 * vertical using the blur-pad technique (centered source over a zoomed,
 * blurred copy of itself) — the same fill approach Opus Clip / Submagic use.
 * No generative model needed, runs entirely on FFmpeg.
 *
 * The other two (temporal object removal, generative background replacement)
 * genuinely need SAM 2 + a diffusion model, so they return honest
 * not-implemented responses rather than fake-success URLs.
 */

const PROCESSED_DIR = path.join(__dirname, '..', '..', 'uploads', 'processed');

/**
 * Resolve a playable on-disk path for a Content video id. Mirrors the
 * resolution aiThumbnailService uses (Content.originalFile.url + candidate
 * locations). Returns null when the source can't be located locally.
 */
async function resolveVideoPath(videoId) {
  if (!videoId) return null;
  let url;
  try {
    const Content = require('../models/Content');
    const content = await Content.findById(videoId).select('originalFile').lean();
    url = content?.originalFile?.url;
  } catch (err) {
    logger.warn('[Outpainting] resolveVideoPath: Content lookup failed', { videoId, error: err.message });
    return null;
  }
  if (!url || url.startsWith('http')) return null; // remote download is out of scope here
  const projectRoot = path.join(__dirname, '..', '..');
  const candidates = [];
  if (url.startsWith('/')) candidates.push(path.join(projectRoot, url));
  candidates.push(url);
  candidates.push(path.join(projectRoot, 'uploads/videos', path.basename(url)));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Aspect Ratio Outpainting (horizontal → 9:16 vertical).
 * Real FFmpeg blur-pad: the source is scaled to fit inside 1080x1920 and
 * centered over a zoomed, Gaussian-blurred copy that fills the frame, so the
 * top/bottom bars are filled with context-aware blur instead of black.
 */
async function outpaintToVertical(videoId) {
  const inputPath = await resolveVideoPath(videoId);
  if (!inputPath) {
    return {
      success: false,
      notImplemented: false,
      error: 'Source video not found on disk. Re-upload the clip and try again.',
    };
  }

  if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  const outputPath = path.join(PROCESSED_DIR, `${videoId}_vertical_outpainted.mp4`);
  const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

  logger.info('[Outpainting] Converting to 9:16 via FFmpeg blur-pad', { videoId, inputPath });

  const filters = [
    'split=2[bg][fg]',
    '[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=20[bgblur]',
    '[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fgs]',
    '[bgblur][fgs]overlay=(W-w)/2:(H-h)/2[out]',
  ];

  await ffmpegRun(
    (ffmpeg) => ffmpeg(inputPath)
      .complexFilter(filters, 'out')
      .outputOptions([
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'veryfast',
        '-c:a', 'aac',
        '-movflags', '+faststart',
      ]),
    { label: `outpaint-vertical-${videoId}`, output: outputPath }
  );

  return {
    success: true,
    outputUrl: publicUrl,
    width: 1080,
    height: 1920,
    technique: 'blur-pad',
  };
}

/**
 * Submit a job to an external SAM2/inpainting provider. Real, provider-agnostic
 * POST gated on the given env vars; returns null when not configured so callers
 * can degrade to an honest not-implemented response.
 */
async function submitToProvider(urlEnv, keyEnv, payload) {
  const apiUrl = process.env[urlEnv];
  const apiKey = process.env[keyEnv];
  if (!apiUrl || !apiKey) return null;
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`provider returned ${resp.status}`);
  return resp.json().catch(() => ({}));
}

/**
 * Context-Aware Inpainting (Object Removal) — needs SAM 2 + diffusion fill.
 * Real integration gated on OBJECT_REMOVAL_API_URL + OBJECT_REMOVAL_API_KEY;
 * honest not-implemented until configured.
 */
async function removeObjectTemporally(videoId, opts = {}) {
  try {
    const job = await submitToProvider('OBJECT_REMOVAL_API_URL', 'OBJECT_REMOVAL_API_KEY', { videoId, mask: opts.mask });
    if (!job) {
      return {
        success: false,
        notImplemented: true,
        videoId,
        message: 'Temporal object removal needs a SAM 2 + inpainting provider. Set OBJECT_REMOVAL_API_URL + OBJECT_REMOVAL_API_KEY to enable it.',
      };
    }
    return { success: true, videoId, provider: 'external', job };
  } catch (err) {
    logger.error('[Inpainting] removeObjectTemporally failed', { error: err.message, videoId });
    return { success: false, error: err.message };
  }
}

/**
 * Generative Background Replacement — needs a segmentation + diffusion model.
 * Real integration gated on BG_REPLACE_API_URL + BG_REPLACE_API_KEY; honest
 * not-implemented until configured. (For green-screen, use the chroma-key path
 * in creativeToolsService.swapBackground.)
 */
async function replaceBackground(videoId, prompt) {
  try {
    const job = await submitToProvider('BG_REPLACE_API_URL', 'BG_REPLACE_API_KEY', { videoId, prompt });
    if (!job) {
      return {
        success: false,
        notImplemented: true,
        videoId,
        message: 'Generative background replacement needs a segmentation + diffusion provider (set BG_REPLACE_API_URL + BG_REPLACE_API_KEY). For green-screen footage, use the chroma-key background swap instead.',
      };
    }
    return { success: true, videoId, provider: 'external', job };
  } catch (err) {
    logger.error('[Outpainting] replaceBackground failed', { error: err.message, videoId });
    return { success: false, error: err.message };
  }
}

module.exports = {
  outpaintToVertical,
  removeObjectTemporally,
  replaceBackground,
  resolveVideoPath,
};

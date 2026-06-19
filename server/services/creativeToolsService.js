/**
 * server/services/creativeToolsService.js
 * AI Creative Tools Service — backend logic for all 6 creative pipeline tools.
 *
 * Three of the original six were TODO stubs that returned fake-success
 * responses. This file ships real working implementations for the four
 * highest-leverage tools (magicBRoll, autoReframe, applySpeedRamp, and
 * the new patternInterruptDetector) and keeps the remaining two
 * (fixEyeContact, generateAiAvatar, swapBackground) behind clear
 * "coming-soon" messaging so the UI doesn't promise something the
 * backend can't deliver.
 *
 * Real integrations:
 *   magicBRoll              → stockFootageService (Pexels) + aiRouter for niche-aware keyword extraction
 *   autoReframe             → deterministic crop plan per aspect ratio
 *   applySpeedRamp          → musicBeatSyncService for beat-onset cuts
 *   patternInterruptDetector → audio energy variance + scene-change rate scoring
 */

const logger = require('../utils/logger');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');
const stockFootage = require('./stockFootageService');

// ── Auto-Reframe ──────────────────────────────────────────────────────────────
// Generates a concrete crop plan per aspect ratio. The actual FFmpeg
// pipeline lives in the renderer; this function returns the plan that
// the renderer executes. Without a face-detect dep installed, we
// center-crop deterministically — good enough for v1 since most creators
// frame themselves centered. When a face-api dep lands later, swap in
// the subject-tracked offset without touching callers.
const ASPECT_RATIOS = {
  '9:16': { w: 9, h: 16, label: 'Vertical (TikTok / Reels / Shorts)' },
  '1:1':  { w: 1, h: 1,  label: 'Square (Instagram feed)' },
  '16:9': { w: 16, h: 9, label: 'Horizontal (YouTube / X)' },
  '4:5':  { w: 4, h: 5,  label: 'Portrait (Instagram feed)' },
};

async function autoReframe(videoId, aspectRatio, userId) {
  try {
    logger.info('[CreativeTools] autoReframe', { videoId, aspectRatio, userId });
    const target = ASPECT_RATIOS[aspectRatio];
    if (!target) {
      throw new Error(`Unsupported aspect ratio: ${aspectRatio}. Use one of ${Object.keys(ASPECT_RATIOS).join(', ')}`);
    }

    // Crop plan: assume source 16:9 and center-crop to target. If source
    // metadata is available later, the renderer adjusts. We hand back a
    // declarative plan, not a video URL — the editor's renderer runs it
    // when the user exports.
    const plan = {
      mode: 'center-crop',
      target: aspectRatio,
      targetWidth: target.w,
      targetHeight: target.h,
      // Renderer interprets these as % of source frame, applied as
      // FFmpeg crop=W:H:X:Y after scaling source to fit one axis.
      keepHorizontalCenter: true,
      keepVerticalCenter: true,
      label: target.label,
    };

    return {
      success: true,
      videoId,
      aspectRatio,
      plan,
      message: `Auto-reframe plan ready for ${target.label}. Hits the renderer at export time.`,
    };
  } catch (err) {
    logger.error('[CreativeTools] autoReframe failed', { error: err.message, videoId });
    throw err;
  }
}

// ── Magic B-Roll ──────────────────────────────────────────────────────────────
// Real flow: extract niche-aware keywords from transcript via aiCallJson,
// then search Pexels for each keyword and return overlay segments with
// real clip URLs the editor can drop into V3.
async function magicBRoll(videoId, transcript, userId, opts = {}) {
  try {
    const segs = Array.isArray(transcript) ? transcript : [];
    logger.info('[CreativeTools] magicBRoll', { videoId, transcriptSegs: segs.length, userId });

    if (segs.length === 0) {
      return { success: true, videoId, overlays: [], message: 'No transcript segments to analyse' };
    }

    // Pull a window of transcript text so the model can pick concrete
    // visualisable nouns. Limit to 2k chars — keywords land fine on less.
    const transcriptText = segs.map(s => s.text || '').join(' ').slice(0, 2000);

    const niche = opts.niche || 'business';
    const platform = opts.platform || 'tiktok';
    const targetCount = Math.min(opts.targetCount || 4, 8);

    const systemPrompt = buildSystemPrompt({
      persona: 'edit-suggester',
      niche,
      platform,
      stage: 'broll',
      extra: 'Return strict JSON only. Pick concrete, visualisable nouns/concepts that a stock-footage search would actually find — not abstract ideas.',
    });
    const userPrompt = [
      `── Task ──`,
      `Pick ${targetCount} B-roll moments for this transcript on ${platform}.`,
      `For each, output a 1-3 word search keyword (concrete, visualisable) and the timestamp in the transcript where it should overlay.`,
      ``,
      `Transcript:`,
      transcriptText,
      ``,
      `Return JSON:`,
      `{ "moments": [`,
      `  { "keyword": "city skyline", "startTime": 4.2, "duration": 2.5, "reason": "creator says metropolis" }`,
      `] }`,
    ].join('\n');

    const fallback = {
      moments: segs.slice(0, 3).map((seg, i) => ({
        keyword: (seg.text || '').split(/\s+/).slice(0, 2).join(' ') || `b-roll-${i + 1}`,
        startTime: seg.startTime || i * 5,
        duration: 2.5,
        reason: 'fallback (AI unavailable)',
      })),
    };

    const result = await aiCallJson(userPrompt, fallback, {
      systemPrompt,
      taskType: 'magic-broll-keywords',
      maxTokens: 800,
      temperature: 0.6,
    });
    const moments = Array.isArray(result?.moments) ? result.moments : fallback.moments;

    // For each moment, hit Pexels in parallel. searchVideos already falls
    // back to a Coverr placeholder when PEXELS_API_KEY is unset, so the
    // editor sees usable URLs in dev too.
    const overlays = await Promise.all(moments.map(async (m, i) => {
      let clipUrl = null;
      let thumbnail = null;
      try {
        const hits = await stockFootage.searchVideos(m.keyword, {
          perPage: 1,
          orientation: platform === 'youtube' ? 'horizontal' : 'vertical',
        });
        if (hits && hits.length > 0) {
          clipUrl = hits[0].url;
          thumbnail = hits[0].thumbnail;
        }
      } catch (err) {
        logger.warn('[CreativeTools] magicBRoll Pexels lookup failed', { keyword: m.keyword, error: err.message });
      }
      return {
        id: `broll-${Date.now()}-${i}`,
        startTime: Math.max(0, Number(m.startTime) || 0),
        endTime: Math.max(0, (Number(m.startTime) || 0) + (Number(m.duration) || 2)),
        duration: Number(m.duration) || 2,
        clipUrl,
        thumbnail,
        keyword: m.keyword,
        reason: m.reason,
        provider: clipUrl ? 'pexels' : 'placeholder',
      };
    }));

    const realCount = overlays.filter(o => !!o.clipUrl).length;
    return {
      success: true,
      videoId,
      overlays,
      message: realCount === overlays.length
        ? `${overlays.length} B-roll clips matched on Pexels — drag to V3 in the editor.`
        : `${realCount}/${overlays.length} clips matched (others returned placeholder URLs — set PEXELS_API_KEY for full library).`,
    };
  } catch (err) {
    logger.error('[CreativeTools] magicBRoll failed', { error: err.message, videoId });
    throw err;
  }
}

// ── Eye Contact Fix ───────────────────────────────────────────────────────────
// Gaze redirection needs a specialized neural provider (e.g. Sieve eye-contact,
// NVIDIA Maxine). Real, provider-agnostic integration gated on
// EYE_CONTACT_API_URL + EYE_CONTACT_API_KEY; honest not-implemented until set.
async function fixEyeContact(videoId, userId) {
  const apiUrl = process.env.EYE_CONTACT_API_URL;
  const apiKey = process.env.EYE_CONTACT_API_KEY;
  if (!apiUrl || !apiKey) {
    logger.info('[CreativeTools] fixEyeContact: no provider configured', { videoId, userId });
    return {
      success: false,
      notImplemented: true,
      videoId,
      message: 'Eye-contact correction needs a gaze-redirection provider. Set EYE_CONTACT_API_URL + EYE_CONTACT_API_KEY (e.g. Sieve eye-contact or NVIDIA Maxine) to enable it.',
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ videoId }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`provider returned ${resp.status}`);
    const job = await resp.json().catch(() => ({}));
    return { success: true, videoId, provider: 'external', job };
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'eye-contact provider timed out' : err.message;
    logger.error('[CreativeTools] fixEyeContact provider call failed', { error: msg, videoId });
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// ── Background Swap ──────────────────────────────────────────────────────────
// Real green-screen compositing via FFmpeg chromakey when the source is a
// green/blue screen and a background asset is supplied. General (non-greenscreen)
// background removal needs a segmentation model (rembg/MediaPipe) that isn't
// installed here, so that path returns an honest not-implemented response.
async function swapBackground(videoId, backgroundUrl, blurAmount, userId, opts = {}) {
  try {
    const greenScreen = opts.greenScreen || opts.chromaKey || false;

    if (!backgroundUrl || !greenScreen) {
      logger.info('[CreativeTools] swapBackground: no green-screen background supplied', { videoId, userId });
      return {
        success: false,
        notImplemented: true,
        videoId,
        backgroundUrl: backgroundUrl || null,
        blurAmount,
        message: 'General background removal needs a segmentation model (rembg/MediaPipe), which isn\'t installed. Green-screen swap is supported: send a backgroundUrl plus greenScreen:true with green/blue-screen footage.',
      };
    }

    const fs = require('fs');
    const path = require('path');
    const { resolveVideoPath } = require('./aiOutpaintingService');
    const { run: ffmpegRun } = require('../utils/ffmpegRunner');

    const inputPath = await resolveVideoPath(videoId);
    if (!inputPath) {
      return { success: false, error: 'Source video not found on disk. Re-upload the clip and try again.' };
    }

    // Resolve the background: remote URLs pass straight to FFmpeg; local
    // /uploads paths resolve against the project root.
    const projectRoot = path.join(__dirname, '..', '..');
    const bgIsRemote = /^https?:\/\//i.test(backgroundUrl);
    const bgInput = bgIsRemote
      ? backgroundUrl
      : (backgroundUrl.startsWith('/') ? path.join(projectRoot, backgroundUrl) : backgroundUrl);
    if (!bgIsRemote && !fs.existsSync(bgInput)) {
      return { success: false, error: 'Background asset not found.' };
    }
    const bgIsImage = /\.(png|jpe?g|webp|bmp)$/i.test(bgInput);

    const outDir = path.join(projectRoot, 'uploads', 'processed');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outputPath = path.join(outDir, `${videoId}_bg_swapped_${Date.now()}.mp4`);
    const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

    const keyColor = opts.keyColor || '0x00FF00';
    const similarity = opts.similarity ?? 0.30;
    const blend = opts.blend ?? 0.10;

    logger.info('[CreativeTools] swapBackground: chromakey composite', { videoId, bgIsImage, userId });

    await ffmpegRun(
      (ffmpeg) => {
        // Background is input 0, source video is input 1. scale2ref scales the
        // background to the source frame size; the source is chromakeyed and
        // overlaid on top.
        const cmd = ffmpeg();
        if (bgIsImage) cmd.input(bgInput).inputOptions(['-loop', '1']);
        else cmd.input(bgInput);
        cmd.input(inputPath);
        return cmd
          .complexFilter([
            '[0:v][1:v]scale2ref[bg][src]',
            `[src]chromakey=${keyColor}:${similarity}:${blend}[keyed]`,
            '[bg][keyed]overlay=shortest=1[out]',
          ], 'out')
          .outputOptions([
            '-map', '1:a?',
            '-c:v', 'libx264',
            '-crf', '23',
            '-preset', 'veryfast',
            '-c:a', 'aac',
            '-shortest',
            '-movflags', '+faststart',
          ]);
      },
      { label: `bg-swap-${videoId}`, output: outputPath }
    );

    return { success: true, videoId, outputUrl: publicUrl, technique: 'chromakey', keyColor };
  } catch (err) {
    logger.error('[CreativeTools] swapBackground failed', { error: err.message, videoId });
    throw err;
  }
}

// ── Speed Ramp (beat-synced) ─────────────────────────────────────────────────
// Uses musicBeatSyncService.getTrackBPM to find a track tempo, then
// generates ramp markers at beat intervals matching the requested
// intensity. The editor's renderer applies setpts speed ramps to the
// timeline at these markers.
async function applySpeedRamp(videoId, options, userId) {
  const { intensity = 'medium', preserveAudio = true, trackId, trackSource } = options;
  try {
    logger.info('[CreativeTools] applySpeedRamp', { videoId, intensity, preserveAudio, trackId, userId });

    const intensityMap = {
      light:  { rampCount: 2, peakSpeed: 1.4 },
      medium: { rampCount: 5, peakSpeed: 1.8 },
      heavy:  { rampCount: 9, peakSpeed: 2.6 },
    };
    const cfg = intensityMap[intensity] || intensityMap.medium;

    // Try to get a real BPM if a music track is provided. Falls back to
    // 100 BPM otherwise — typical "casual upbeat" pace.
    let bpm = 100;
    if (trackId) {
      try {
        const beat = require('./musicBeatSyncService');
        if (typeof beat.getTrackBPM === 'function') {
          const result = await beat.getTrackBPM(trackId, trackSource || 'click');
          bpm = result?.bpm || bpm;
        }
      } catch (err) {
        logger.warn('[CreativeTools] applySpeedRamp BPM lookup failed', { error: err.message });
      }
    }

    const beatIntervalSec = 60 / bpm;
    const rampPoints = [];
    for (let i = 0; i < cfg.rampCount; i++) {
      const at = beatIntervalSec * (i + 1) * 4; // every 4 beats
      rampPoints.push({
        atTime: Number(at.toFixed(2)),
        speed: i % 2 === 0 ? cfg.peakSpeed : 1.0,
        durationSec: 0.6,
      });
    }

    return {
      success: true,
      videoId,
      bpm,
      rampPoints,
      rampCount: cfg.rampCount,
      intensity,
      preserveAudio,
      message: `${cfg.rampCount} beat-synced speed ramps planned at ${bpm} BPM`,
    };
  } catch (err) {
    logger.error('[CreativeTools] applySpeedRamp failed', { error: err.message, videoId });
    throw err;
  }
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────
// Delegates to the real (HeyGen/Sora-gated) digitalTwinService. When no provider
// key is configured the underlying job comes back as `unavailable` /
// notImplemented — no fabricated video.
async function generateAiAvatar(videoId, options = {}, userId) {
  const { referenceClipUrl = null, voiceId } = options;
  try {
    const digitalTwinService = require('./digitalTwinService');
    const job = await digitalTwinService.createAvatarVideo(userId, referenceClipUrl, {
      ...options,
      voiceId,
    });
    if (job?.notImplemented || job?.status === 'unavailable') {
      return { success: false, notImplemented: true, videoId, jobId: job.id, message: job.message };
    }
    return { success: true, videoId, jobId: job.id, status: job.status, provider: job.provider };
  } catch (err) {
    logger.error('[CreativeTools] generateAiAvatar failed', { error: err.message, videoId });
    return { success: false, error: err.message };
  }
}

// ── Pattern Interrupt Detector (NEW) ─────────────────────────────────────────
// Scores every 5s window of a video on (1) visual scene-change rate from
// the transcript scenes array, and (2) caption-density variance as a
// proxy for audio energy variance. Flags windows below the median as
// "dead spots" with concrete fix suggestions (zoom, cut, b-roll).
//
// This is the "your AI shouldn't do basic things" upgrade — instead of a
// generic "engagement score", the creator gets specific timestamps with
// reasons + fixes mapped to the existing applySuggestion dispatchers.
async function patternInterruptDetector(videoId, transcript, opts = {}) {
  try {
    const segs = Array.isArray(transcript) ? transcript : transcript?.words || [];
    logger.info('[CreativeTools] patternInterruptDetector', { videoId, segCount: segs.length });

    if (segs.length === 0) {
      return { success: true, videoId, deadSpots: [], score: 100, message: 'No transcript — cannot detect pattern interrupts' };
    }

    const scenes = transcript?.scenes || [];
    const totalDuration = (segs[segs.length - 1]?.end ?? segs[segs.length - 1]?.endTime ?? 0) || 60;
    const windowSec = 5;
    const windows = [];

    for (let t = 0; t < totalDuration; t += windowSec) {
      const windowEnd = t + windowSec;
      const wordsInWindow = segs.filter(w => {
        const wt = w.start ?? w.startTime ?? 0;
        return wt >= t && wt < windowEnd;
      });
      const captionDensity = wordsInWindow.length;

      const sceneChangesInWindow = scenes.filter(s => {
        const st = s.startTime ?? 0;
        return st >= t && st < windowEnd;
      }).length;

      // Pattern-interrupt score: high caption density × scene change > 0
      // is "alive". Low caption density + zero scene changes is a dead
      // spot — exactly the ~3-5s holes that kill retention.
      const interruptScore = (captionDensity * 2) + (sceneChangesInWindow * 5);
      windows.push({ t, windowEnd, captionDensity, sceneChangesInWindow, interruptScore });
    }

    if (windows.length === 0) {
      return { success: true, videoId, deadSpots: [], score: 100, message: 'Empty timeline' };
    }

    const scores = windows.map(w => w.interruptScore).sort((a, b) => a - b);
    const median = scores[Math.floor(scores.length / 2)];
    const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const overallScore = Math.min(100, Math.round((meanScore / Math.max(1, Math.max(...scores))) * 100));

    const fixOptions = ['zoom', 'cut', 'broll', 'effect'];
    const deadSpots = windows
      .filter(w => w.interruptScore <= median && w.interruptScore < 6)
      .map((w, idx) => ({
        id: `dead-${Date.now()}-${idx}`,
        startTime: w.t,
        endTime: w.windowEnd,
        duration: windowSec,
        reason: w.captionDensity < 3
          ? 'Low caption density — viewer ear is silent for too long'
          : 'No scene change in 5s — visual fatigue territory',
        suggestedFix: fixOptions[idx % fixOptions.length],
        confidence: w.captionDensity === 0 && w.sceneChangesInWindow === 0 ? 0.95 : 0.7,
      }));

    return {
      success: true,
      videoId,
      score: overallScore,
      deadSpots,
      message: deadSpots.length > 0
        ? `Found ${deadSpots.length} dead spot${deadSpots.length === 1 ? '' : 's'} — apply suggested fixes from the editor.`
        : 'No dead spots — pacing is tight.',
    };
  } catch (err) {
    logger.error('[CreativeTools] patternInterruptDetector failed', { error: err.message, videoId });
    throw err;
  }
}

module.exports = {
  autoReframe,
  magicBRoll,
  fixEyeContact,
  swapBackground,
  applySpeedRamp,
  generateAiAvatar,
  patternInterruptDetector,
};

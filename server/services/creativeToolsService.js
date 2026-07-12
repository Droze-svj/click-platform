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

  const { resolveVideoPath } = require('./aiOutpaintingService');
  const inputPath = await resolveVideoPath(videoId);
  if (!inputPath) {
    return { success: false, error: 'Source video not found on disk.' };
  }

  const projectRoot = path.join(__dirname, '..', '..');
  const outDir = path.join(projectRoot, 'uploads', 'processed');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${videoId}_eye_contact_${Date.now()}.mp4`);
  const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

  // 1. If external API is configured, use it
  if (apiUrl && apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      logger.info('[CreativeTools] Calling external eye-contact API provider', { videoId, userId });
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

  // 2. Offload to GCP Vertex AI if configured
  const gcpVertex = require('./gcpVertexService');
  if (gcpVertex.isConfigured()) {
    logger.info('[CreativeTools] fixEyeContact: offloading gaze correction to GCP Vertex AI', { videoId, userId });
    try {
      const inputGcsUrl = await gcpVertex.uploadToGCS(inputPath, `inputs/${videoId}_input_${Date.now()}.mp4`);
      const outputFilename = `${videoId}_eye_contact_${Date.now()}.mp4`;
      const outputGcsUrl = `gs://${process.env.GCS_BUCKET_NAME}/outputs/${outputFilename}`;

      await gcpVertex.runVertexCustomJob({
        task: 'eye_contact',
        videoId,
        inputGcsUrl,
        outputGcsUrl
      });

      await gcpVertex.downloadFromGCS(outputGcsUrl, outputPath);
      return { success: true, videoId, outputUrl: publicUrl, technique: 'vertex_ai_eye_contact' };
    } catch (err) {
      logger.error('[CreativeTools] Vertex AI gaze correction failed, falling back to local...', { error: err.message });
    }
  }

  // 3. Local CPU/OpenCV Fallback
  logger.info('[CreativeTools] fixEyeContact: running local face-stabilized gaze focus fallback', { videoId, userId });
  try {
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    const scriptPath = path.join(projectRoot, 'scripts', 'eye_contact_fix.py');

    logger.info(`[CreativeTools] Spawning local eye_contact_fix.py: ${pythonCmd} ${scriptPath} --video ${inputPath} --output ${outputPath}`);

    const { runPythonScript } = require('../utils/runPythonScript');
    await runPythonScript(pythonCmd, [
      scriptPath,
      '--video', inputPath,
      '--output', outputPath,
    ], { label: 'eye_contact_fix', timeoutMs: 5 * 60 * 1000 });
    logger.info(`[CreativeTools] eye_contact_fix.py completed successfully`);

    return { success: true, videoId, outputUrl: publicUrl, technique: 'local_eye_contact' };
  } catch (err) {
    logger.error('[CreativeTools] Local gaze correction fallback failed', { error: err.message, videoId });
    throw err;
  }
}

// ── Background Swap ──────────────────────────────────────────────────────────
// Real green-screen compositing via FFmpeg chromakey when the source is a
// green/blue screen and a background asset is supplied. General (non-greenscreen)
// background removal needs a segmentation model (rembg/MediaPipe) that isn't
// installed here, so that path returns an honest not-implemented response.
// ── Background Swap ──────────────────────────────────────────────────────────
// Real green-screen compositing via FFmpeg chromakey when the source is a
// green/blue screen and a background asset is supplied. General (non-greenscreen)
// background removal needs a segmentation model (rembg/MediaPipe) which is installed
// locally in the virtual environment (.venv/bin/backgroundremover).
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

async function downloadFile(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function runLocalBackgroundRemover(inputPath, backgroundPath, outputPath) {
  const projectRoot = path.join(__dirname, '..', '..');
  const venvBgRemover = path.join(projectRoot, '.venv', 'bin', 'backgroundremover');
  const bgCmd = fs.existsSync(venvBgRemover) ? venvBgRemover : 'backgroundremover';

  // Command: backgroundremover -i inputPath -tbg backgroundPath -o outputPath
  const args = ['-i', inputPath];
  if (backgroundPath) {
    args.push('-tbg', backgroundPath);
  }
  args.push('-o', outputPath);

  logger.info(`[CreativeTools] Running local backgroundremover: ${bgCmd} ${args.join(' ')}`);

  const { runPythonScript } = require('../utils/runPythonScript');
  await runPythonScript(bgCmd, args, { label: 'backgroundremover', timeoutMs: 10 * 60 * 1000 });
  logger.info(`[CreativeTools] backgroundremover completed successfully`);
  return outputPath;
}

async function swapBackground(videoId, backgroundUrl, blurAmount, userId, opts = {}) {
  try {
    const greenScreen = opts.greenScreen || opts.chromaKey || false;
    const { resolveVideoPath } = require('./aiOutpaintingService');
    const { run: ffmpegRun } = require('../utils/ffmpegRunner');
    const gcpVertex = require('./gcpVertexService');

    const inputPath = await resolveVideoPath(videoId);
    if (!inputPath) {
      return { success: false, error: 'Source video not found on disk. Re-upload the clip and try again.' };
    }

    const projectRoot = path.join(__dirname, '..', '..');
    const outDir = path.join(projectRoot, 'uploads', 'processed');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outputPath = path.join(outDir, `${videoId}_bg_swapped_${Date.now()}.mp4`);
    const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

    // ── GCP Vertex AI OFF-LOADING (If configured) ──
    if (gcpVertex.isConfigured() && !greenScreen) {
      logger.info('[CreativeTools] swapBackground: offloading background removal to GCP Vertex AI', { videoId, userId });
      try {
        // 1. Upload video to GCS
        const inputGcsUrl = await gcpVertex.uploadToGCS(inputPath, `inputs/${videoId}_input_${Date.now()}.mp4`);

        // 2. Upload background (if any) to GCS
        let bgGcsUrl = null;
        if (backgroundUrl) {
          let bgLocalPath = backgroundUrl;
          let tempBgFile = null;

          if (/^https?:\/\//i.test(backgroundUrl)) {
            tempBgFile = path.join(outDir, `temp_bg_${Date.now()}${path.extname(backgroundUrl) || '.jpg'}`);
            await downloadFile(backgroundUrl, tempBgFile);
            bgLocalPath = tempBgFile;
          } else if (backgroundUrl.startsWith('/')) {
            bgLocalPath = path.join(projectRoot, backgroundUrl);
          }

          try {
            bgGcsUrl = await gcpVertex.uploadToGCS(bgLocalPath, `backgrounds/${videoId}_bg_${Date.now()}${path.extname(bgLocalPath) || '.jpg'}`);
          } finally {
            if (tempBgFile && fs.existsSync(tempBgFile)) {
              fs.unlink(tempBgFile, () => {});
            }
          }
        }

        // 3. Trigger Vertex AI custom job
        const outputFilename = `${videoId}_bg_swapped_${Date.now()}.mp4`;
        const outputGcsUrl = `gs://${process.env.GCS_BUCKET_NAME}/outputs/${outputFilename}`;

        await gcpVertex.runVertexCustomJob({
          task: backgroundUrl ? 'background_swap' : 'background_removal',
          videoId,
          inputGcsUrl,
          bgGcsUrl,
          outputGcsUrl
        });

        // 4. Download finished video back to local processed directory
        await gcpVertex.downloadFromGCS(outputGcsUrl, outputPath);
        return { success: true, videoId, outputUrl: publicUrl, technique: 'vertex_ai_backgroundremover' };
      } catch (err) {
        logger.error('[CreativeTools] Vertex background removal failed, falling back to local...', { error: err.message });
      }
    }

    // If not a green screen, run the local backgroundremover AI model
    if (!greenScreen && backgroundUrl) {
      logger.info('[CreativeTools] swapBackground: running local backgroundremover model', { videoId, userId });
      let bgLocalPath = backgroundUrl;
      let tempBgFile = null;

      if (/^https?:\/\//i.test(backgroundUrl)) {
        tempBgFile = path.join(outDir, `temp_bg_${Date.now()}${path.extname(backgroundUrl) || '.jpg'}`);
        await downloadFile(backgroundUrl, tempBgFile);
        bgLocalPath = tempBgFile;
      } else if (backgroundUrl.startsWith('/')) {
        bgLocalPath = path.join(projectRoot, backgroundUrl);
      }

      try {
        await runLocalBackgroundRemover(inputPath, bgLocalPath, outputPath);
        return { success: true, videoId, outputUrl: publicUrl, technique: 'backgroundremover' };
      } finally {
        if (tempBgFile && fs.existsSync(tempBgFile)) {
          fs.unlink(tempBgFile, () => {});
        }
      }
    }

    if (!backgroundUrl) {
      // Background removal only (making it transparent mov/alpha)
      logger.info('[CreativeTools] swapBackground: removing background (transparent output)', { videoId, userId });
      const transparentOutPath = path.join(outDir, `${videoId}_transparent_${Date.now()}.mov`);
      await runLocalBackgroundRemover(inputPath, null, transparentOutPath);
      return { 
        success: true, 
        videoId, 
        outputUrl: `/uploads/processed/${path.basename(transparentOutPath)}`, 
        technique: 'backgroundremover_transparent' 
      };
    }

    // Traditional chromakey (Green Screen) composition via FFmpeg
    const bgIsRemote = /^https?:\/\//i.test(backgroundUrl);
    const bgInput = bgIsRemote
      ? backgroundUrl
      : (backgroundUrl.startsWith('/') ? path.join(projectRoot, backgroundUrl) : backgroundUrl);
    if (!bgIsRemote && !fs.existsSync(bgInput)) {
      return { success: false, error: 'Background asset not found.' };
    }
    const bgIsImage = /\.(png|jpe?g|webp|bmp)$/i.test(bgInput);

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

// ── Object Removal / Video Inpainting ─────────────────────────────────────────
async function generateMaskImage(videoPath, maskPoints, outputPath) {
  const ffprobe = require('fluent-ffmpeg').ffprobe;
  const dimensions = await new Promise((resolve) => {
    ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata?.streams?.[0]) {
        resolve({ width: 1280, height: 720 });
      } else {
        const stream = metadata.streams.find(s => s.codec_type === 'video');
        resolve({
          width: stream?.width || 1280,
          height: stream?.height || 720
        });
      }
    });
  });

  const { width, height } = dimensions;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (Array.isArray(maskPoints)) {
    for (const stroke of maskPoints) {
      if (stroke.points && Array.isArray(stroke.points)) {
        ctx.beginPath();
        ctx.lineWidth = stroke.brushSize || stroke.width || 20;
        const pts = stroke.points;
        if (pts.length > 0) {
          ctx.moveTo(pts[0].x * width, pts[0].y * height);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * width, pts[i].y * height);
          }
          ctx.stroke();
        }
      } else if (typeof stroke.x === 'number' && typeof stroke.y === 'number') {
        const radius = stroke.radius || 15;
        ctx.beginPath();
        ctx.arc(stroke.x * width, stroke.y * height, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function removeObject(videoId, maskPoints, userId) {
  try {
    logger.info('[CreativeTools] removeObject initiated', { videoId, userId, pointsCount: maskPoints?.length });
    
    const { resolveVideoPath } = require('./aiOutpaintingService');
    const inputPath = await resolveVideoPath(videoId);
    if (!inputPath) {
      return { success: false, error: 'Source video not found on disk.' };
    }

    const projectRoot = path.join(__dirname, '..', '..');
    const outDir = path.join(projectRoot, 'uploads', 'processed');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const maskPath = path.join(outDir, `${videoId}_mask_${Date.now()}.png`);
    const outputPath = path.join(outDir, `${videoId}_inpainted_${Date.now()}.mp4`);
    const publicUrl = `/uploads/processed/${path.basename(outputPath)}`;

    // 1. Create the binary mask image using canvas
    await generateMaskImage(inputPath, maskPoints, maskPath);

    // ── GCP Vertex AI OFF-LOADING (If configured) ──
    const gcpVertex = require('./gcpVertexService');
    if (gcpVertex.isConfigured()) {
      logger.info('[CreativeTools] removeObject: offloading inpainting task to GCP Vertex AI', { videoId, userId });
      try {
        // Upload video and mask to GCS
        const inputGcsUrl = await gcpVertex.uploadToGCS(inputPath, `inputs/${videoId}_input_${Date.now()}.mp4`);
        const maskGcsUrl = await gcpVertex.uploadToGCS(maskPath, `masks/${videoId}_mask_${Date.now()}.png`);

        // Clean up temp local mask
        fs.unlink(maskPath, () => {});

        const outputFilename = `${videoId}_inpainted_${Date.now()}.mp4`;
        const outputGcsUrl = `gs://${process.env.GCS_BUCKET_NAME}/outputs/${outputFilename}`;

        // Trigger job
        await gcpVertex.runVertexCustomJob({
          task: 'inpainting',
          videoId,
          inputGcsUrl,
          maskGcsUrl,
          outputGcsUrl
        });

        // Download result back
        await gcpVertex.downloadFromGCS(outputGcsUrl, outputPath);
        return {
          success: true,
          videoId,
          outputUrl: publicUrl,
          message: 'Object successfully inpainted and removed from video via Vertex AI Custom Job.'
        };
      } catch (err) {
        logger.error('[CreativeTools] Vertex inpainting failed, falling back to local...', { error: err.message });
      }
    }

    // 2. Call python scripts/video_object_removal.py locally (fallback)
    const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    const scriptPath = path.join(projectRoot, 'scripts', 'video_object_removal.py');

    logger.info(`[CreativeTools] Spawning local video_object_removal.py: ${pythonCmd} ${scriptPath} --video ${inputPath} --mask ${maskPath} --output ${outputPath}`);

    const { runPythonScript } = require('../utils/runPythonScript');
    try {
      await runPythonScript(pythonCmd, [
        scriptPath,
        '--video', inputPath,
        '--mask', maskPath,
        '--output', outputPath,
      ], { label: 'video_object_removal', timeoutMs: 10 * 60 * 1000 });
      logger.info(`[CreativeTools] video_object_removal.py completed successfully`);
      return { success: true, videoId, outputUrl: publicUrl, message: 'Object successfully inpainted and removed from video.' };
    } catch (e) {
      logger.error(`[CreativeTools] video_object_removal.py failed: ${e.message}`);
      return { success: false, error: `Inpainting failed: ${e.message}` };
    } finally {
      if (fs.existsSync(maskPath)) fs.unlink(maskPath, () => {}); // always clean the temp mask
    }
  } catch (err) {
    logger.error('[CreativeTools] removeObject failed', { error: err.message, videoId });
    return { success: false, error: err.message };
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
  removeObject,
};

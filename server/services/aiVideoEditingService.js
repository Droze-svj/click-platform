// AI-Powered Video Editing Service
// Enhanced: accurate silence detection, real scene detection, transcript analysis, edit tracking, intelligent pacing.
// Creative & Quality: auto-zoom, text overlays, hook optimization, color grading, stabilization, audio ducking, best moments.
// Advanced: sentiment analysis, beat sync, quality scoring, platform optimization, parallel processing, error recovery, smart cropping.

const logger = require('../utils/logger');
const Content = require('../models/Content');
const { uploadFile } = require('./storageService');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Ensure logs/ directory exists and configure FFmpeg to redirect reports
try {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  process.env.FFREPORT = 'file=' + path.join(logsDir, 'ffmpeg-%p-%t.log') + ':level=32';
} catch (err) {
  logger.error('Failed to configure FFmpeg reports logging redirection:', err);
}

// Import services for integration
let videoCaptionService = null;
let audioService = null;
let socketService = null;
let Music = null;
const saliencyService = require('./saliencyService');
const { devVideoStore, resolveContent } = require('../utils/devStore');
const { getActiveBlueprint } = require('./continuousLearningService');
const videoRenderService = require('./videoRenderService');
const {
  buildSystemPrompt,
  buildCompactGuidance,
  getKnowledgeSlice,
  HOOK_FRAMEWORKS,
} = require('./marketingKnowledge');

/**
 * True when the path is a remote http(s) URL. FFmpeg can read such URLs
 * directly, so a missing-file (fs.existsSync) check must NOT be applied to
 * them — doing so would silently drop valid remote inputs (e.g. the Pixabay
 * "premium-fallback" music URL returned by autoSelectMusic).
 */
function isRemoteUrl(p) {
  return typeof p === 'string' && /^https?:\/\//i.test(p);
}

/**
 * Compose an additional context block that biases AI prompts toward the
 * creator's niche, target platform, language, and recent style picks. Returns
 * an empty string when no usable context is provided so callers can safely
 * concatenate without conditionals.
 */
function nicheStyleContext({ niche, platform, language, styleProfile, topPerformers } = {}) {
  if (!niche && !platform && !styleProfile && !topPerformers) return '';
  const slice = getKnowledgeSlice({ niche, platform, language, stage: 'edit' });
  const np = slice.nichePlaybook;
  const pp = slice.platformPlaybook;
  const lines = [
    '── Creator context ──',
    `Niche: ${slice.niche.toUpperCase()}. Platform: ${slice.platform.toUpperCase()}. Language: ${slice.languageProfile?.name || 'English'}.`,
    `Voice: ${np.voice}`,
    `Top angles for this niche: ${np.angles.slice(0, 3).join(' · ')}`,
    `Triggers that lift retention: ${np.triggers.slice(0, 3).join(' · ')}`,
    `Avoid: ${np.avoid.slice(0, 2).join(' · ')}`,
    `Platform brief: ${pp.idealLength} · hook window ${pp.hookWindow} · captions ${pp.captionStyle}`,
  ];
  if (styleProfile) {
    const top = (arr) =>
      Array.isArray(arr) && arr.length
        ? arr.slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 3).map(c => c.key).join(', ')
        : '';
    const fonts   = top(styleProfile.fonts);
    const styles  = top(styleProfile.captionStyles);
    const motions = top(styleProfile.motions);
    if (fonts || styles || motions) lines.push('Creator picks (bias toward these):');
    if (fonts)   lines.push(`  · Top fonts: ${fonts}`);
    if (styles)  lines.push(`  · Top caption styles: ${styles}`);
    if (motions) lines.push(`  · Top motions: ${motions}`);
  }
  // Performance-weighted signals — when the creator has 3+ posts with
  // synced analytics, the edit-suggestion AI gets explicit "this hook
  // angle landed N times for THIS creator" bias on top of niche playbook.
  if (topPerformers && topPerformers.sampleSize) {
    lines.push(`Proven-for-this-creator (sample ${topPerformers.sampleSize}):`);
    if (topPerformers.topHookAngles?.length) lines.push(`  · Hook angles that landed: ${topPerformers.topHookAngles.join(', ')}`);
    if (topPerformers.topCtaCategories?.length) lines.push(`  · CTA categories with hit rate: ${topPerformers.topCtaCategories.join(', ')}`);
    if (topPerformers.topColorGrades?.length) lines.push(`  · Color grades that performed: ${topPerformers.topColorGrades.join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Unified save helper for both Mongoose models and DevStore objects.
 *
 * VersionError handling: when the upload route's background processing
 * (caption transcription, scene detection, etc.) is writing to the same
 * Content document AT THE SAME TIME as the auto-edit handler, Mongoose's
 * optimistic-concurrency check rejects the second save with:
 *   "No matching document found for id ... version 0 modifiedPaths ..."
 *
 * Without a fix the user clicks Forge and gets a 500. Honest UX fix: when
 * we hit a VersionError, re-fetch the document, copy our modifications
 * onto the fresh copy, and retry once. This loses no data because the
 * "modifications" we care about are additive (appending to arrays, setting
 * nested fields) and the auto-edit's writes are the canonical truth for
 * those paths.
 */
async function commitContent(content) {
  if (!content) return;

  // If it's a Mongoose model instance, it has a .save() function
  if (typeof content.save === 'function') {
    try {
      return await content.save();
    } catch (err) {
      // Only retry on VersionError; rethrow anything else so we don't
      // mask real validation failures.
      const isVersionError = err?.name === 'VersionError' || /No matching document found.*version/.test(err?.message || '');
      if (!isVersionError) throw err;

      const id = content._id || content.id;
      logger.warn('[commitContent] VersionError — retrying with overwrite', { id: id?.toString() });
      try {
        const Model = content.constructor;
        // Pull our in-memory edits out (everything except _id/__v).
        const patch = content.toObject({ depopulate: true });
        delete patch._id;
        delete patch.__v;
        // Overwrite by id; ignore the version mismatch. This is the
        // canonical "merge" because the auto-edit's view of the document
        // IS the latest state we want to persist.
        return await Model.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
      } catch (retryErr) {
        logger.error('[commitContent] retry failed', { id: id?.toString(), error: retryErr.message });
        throw retryErr;
      }
    }
  }

  // If it's a plain object from DevStore, we update it in the Map
  // (The Map.set is intercepted in devStore.js to persist to disk)
  const videoId = content._id || content.id;
  if (videoId && (videoId.toString().startsWith('dev-content-') || videoId.toString().startsWith('dev-'))) {
    devVideoStore.set(videoId.toString(), content);
    return content;
  }

  logger.warn('⚠️ commitContent: Object is neither a Mongoose model nor a dev content', { id: content._id || content.id });
}
const bRollIntelligenceService = require('./bRollIntelligenceService');

function getVideoCaptionService() {
  if (!videoCaptionService) {
    try {
      videoCaptionService = require('./videoCaptionService');
    } catch (error) {
      logger.warn('Video caption service not available', { error: error.message });
    }
  }
  return videoCaptionService;
}

function getAudioService() {
  if (!audioService) {
    try {
      audioService = require('./audioService');
    } catch (error) {
      logger.warn('Audio service not available', { error: error.message });
    }
  }
  return audioService;
}

function getSocketService() {
  if (!socketService) {
    try {
      socketService = require('./socketService').getIO();
    } catch (error) {
      logger.warn('Socket service not available', { error: error.message });
      return null;
    }
  }
  return socketService;
}

function getMusicModel() {
  if (!Music) {
    try {
      Music = require('../models/Music');
    } catch (error) {
      // Try alternative path
      try {
        Music = require('../models/music');
      } catch (err2) {
        logger.warn('Music model not available', { error: error.message });
        return null;
      }
    }
  }
  return Music;
}

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const editCache = new Map(); // Cache for edit analysis results

const { safeJsonParse: parseGeminiJson } = require('../utils/aiHelper');

/**
 * Analysis result cache — 10-minute TTL per videoId
 * Prevents redundant Gemini calls when re-triggering edits on the same video
 */
const ANALYSIS_CACHE = new Map();
const ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Per-user analysis cache. The previous cache keyed entries by `videoId`
 * alone — ObjectIds are unique across users in practice, but the moment
 * a caller passes the wrong userId (e.g. an admin-impersonation route,
 * or a future shared-clip feature) the cached Gemini analysis from
 * user A leaks to user B. Keying by `${userId}:${videoId}` makes that
 * leak structurally impossible.
 */
function cacheKey(userId, videoId) {
  if (!userId) throw new Error('cacheKey requires a userId to prevent cross-user leak');
  return `${userId}:${videoId}`;
}

function getCachedAnalysis(userId, videoId) {
  const entry = ANALYSIS_CACHE.get(cacheKey(userId, videoId));
  if (!entry) return null;
  if (Date.now() - entry.ts > ANALYSIS_CACHE_TTL_MS) {
    ANALYSIS_CACHE.delete(cacheKey(userId, videoId));
    return null;
  }
  return entry.data;
}

function setCachedAnalysis(userId, videoId, data) {
  ANALYSIS_CACHE.set(cacheKey(userId, videoId), { data, ts: Date.now() });
  if (ANALYSIS_CACHE.size > 50) {
    const oldest = ANALYSIS_CACHE.keys().next().value;
    ANALYSIS_CACHE.delete(oldest);
  }
}

/**
 * Analyze sentiment and emotions from transcript
 */
async function analyzeSentimentAndEmotions(transcript) {
  if (!transcript) return null;

  try {
    if (!geminiConfigured) return null;

    const fullPrompt = `Analyze the sentiment and emotions in this transcript. Return valid JSON only with: sentiment (positive/neutral/negative), emotions (array), energyLevel (1-10).\n\nTranscript:\n${transcript.substring(0, 2000)}`;
    const raw = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 200 });
    const analysis = parseGeminiJson(raw) || {};
    return {
      sentiment: analysis.sentiment || 'neutral',
      emotions: analysis.emotions || [],
      energyLevel: analysis.energyLevel || 5,
    };
  } catch (error) {
    logger.warn('Sentiment analysis failed', { error: error.message });
    return null;
  }
}

/**
 * Detect audio beats for music sync
 */
async function detectBeats(inputPath) {
  // Use ebur128 momentary loudness peaks as beat proxies.
  // 'beatdetect' does not exist in stock FFmpeg; this approach works universally.
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const proc = spawn('ffmpeg', [
      '-i', inputPath,
      '-af', 'ebur128=peak=true',
      '-f', 'null', '-',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const rawBeats = [];
    let buffer = '';

    proc.stderr.on('data', chunk => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(line => {
        // Match lines like: [Parsed_ebur128_0 @ ...] t: 1.234  ... M: -9.5 ...
        const m = line.match(/t:\s*([\d.]+).*\bM:\s*([-\d.]+)/);
        if (m) {
          const time = parseFloat(m[1]);
          const loudness = parseFloat(m[2]);
          if (!isNaN(time) && loudness > -20) rawBeats.push({ time, loudness });
        }
      });
    });

    proc.on('close', () => {
      // Find local maxima (peaks where loudness exceeds both neighbours)
      const sorted = rawBeats.sort((a, b) => a.time - b.time);
      const peaks = sorted.filter((b, i) => {
        const prev = sorted[i - 1]?.loudness ?? -Infinity;
        const next = sorted[i + 1]?.loudness ?? -Infinity;
        return b.loudness > prev && b.loudness > next;
      });
      resolve(peaks.map(p => p.time));
    });

    proc.on('error', () => resolve([]));
    // Hard timeout so a massive file doesn't stall the pipeline
    setTimeout(() => { proc.kill(); resolve([]); }, 30000);
  });
}

/**
 * Calculate video quality score
 */
function calculateQualityScore(metadata, transcript, audioLevels, duration) {
  let score = 50; // Base score

  // Duration score (optimal 30-60 seconds for social)
  if (duration >= 30 && duration <= 60) score += 15;
  else if (duration >= 15 && duration <= 120) score += 10;
  else if (duration < 15) score -= 10;

  // Audio quality
  if (audioLevels.length > 0) {
    const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
    if (avgLevel > 0.3 && avgLevel < 0.9) score += 10;
    else if (avgLevel < 0.1) score -= 15;
  }

  // Transcript quality
  if (transcript) {
    const wordCount = transcript.split(/\s+/).length;
    const wordsPerSecond = wordCount / duration;
    if (wordsPerSecond >= 2 && wordsPerSecond <= 4) score += 10; // Good pacing
    if (transcript.length > 50) score += 5; // Has content
  }

  // Video resolution
  const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
  if (videoStream) {
    if (videoStream.width >= 1920 && videoStream.height >= 1080) score += 10;
    else if (videoStream.width >= 1280 && videoStream.height >= 720) score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Get platform-specific optimizations
 */
function getPlatformOptimizations(platform = 'all') {
  const optimizations = {
    tiktok: {
      aspectRatio: '9:16',
      maxDuration: 60,
      recommendedDuration: 15,
      frameRate: 30,
      resolution: '1080x1920',
    },
    instagram: {
      aspectRatio: '1:1',
      maxDuration: 60,
      recommendedDuration: 30,
      frameRate: 30,
      resolution: '1080x1080',
    },
    youtube: {
      aspectRatio: '16:9',
      maxDuration: 600,
      recommendedDuration: 180,
      frameRate: 30,
      resolution: '1920x1080',
    },
    all: {
      aspectRatio: '16:9',
      maxDuration: 300,
      recommendedDuration: 60,
      frameRate: 30,
      resolution: '1920x1080',
    },
  };

  return optimizations[platform.toLowerCase()] || optimizations.all;
}

/**
 * Smart cropping with rule of thirds
 */
function applySmartCropping(aspectRatio) {
  const ratios = {
    '9:16': 'crop=ih*9/16:ih:(iw-ow)/2:0', // Vertical
    '1:1': 'crop=ih:ih:(iw-ow)/2:(ih-oh)/2', // Square, centered
    '16:9': 'crop=iw:iw*9/16:0:(ih-oh)/2', // Horizontal, centered
  };

  return ratios[aspectRatio] || ratios['16:9'];
}

/**
 * Parallel processing helper
 */
async function processInParallel(tasks, maxConcurrent = 3) {
  const results = [];
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map(task => task().catch(err => {
      logger.warn('Parallel task failed', { error: err.message });
      return null;
    })));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = initialDelay * Math.pow(2, i);
      logger.warn(`Retry attempt ${i + 1} after ${delay}ms`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Detect silence periods with precise timestamps
 */
async function detectSilencePeriods(inputPath, threshold = -30, minDuration = 0.5) {
  return new Promise((resolve, reject) => {
    const silenceData = [];
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-af', `silencedetect=noise=${threshold}dB:d=${minDuration}`,
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        const silenceMatch = stderrLine.match(/silence_start: ([\d.]+)/);
        const endMatch = stderrLine.match(/silence_end: ([\d.]+)/);
        if (silenceMatch) {
          silenceData.push({ start: parseFloat(silenceMatch[1]), end: null });
        }
        if (endMatch && silenceData.length > 0) {
          const last = silenceData[silenceData.length - 1];
          if (last && !last.end) {
            last.end = parseFloat(endMatch[1]);
            last.duration = last.end - last.start;
          }
        }
      })
      .on('end', () => {
        resolve(silenceData.filter(s => s.end !== null && s.duration >= minDuration));
      })
      .on('error', (err) => {
        logger.warn('Silence detection error, using fallback', { error: err.message });
        resolve([]);
      });

    command.output('/dev/null').run();
  });
}

/**
 * Detect real scene changes using FFmpeg
 */
async function detectSceneChanges(inputPath, threshold = 0.3) {
  return new Promise((resolve, reject) => {
    const scenes = [];
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-vf', `select='gt(scene,${threshold})',showinfo`,
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        const sceneMatch = stderrLine.match(/pts_time:([\d.]+)/);
        if (sceneMatch) {
          scenes.push(parseFloat(sceneMatch[1]));
        }
      })
      .on('end', () => {
        resolve(scenes.sort((a, b) => a - b));
      })
      .on('error', (err) => {
        logger.warn('Scene detection error, using fallback', { error: err.message });
        resolve([]);
      });

    command.output('/dev/null').run();
  });
}

/**
 * Analyze transcript for repetitive phrases and filler words
 */
function analyzeTranscriptForRepetition(transcript) {
  if (!transcript || typeof transcript !== 'string') return [];

  const words = transcript.toLowerCase().split(/\s+/);
  const wordCounts = {};
  const phraseCounts = {};
  const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'literally'];

  words.forEach((word, i) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
    if (i < words.length - 1) {
      const phrase = `${word} ${words[i + 1]}`;
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
    }
  });

  const repetitivePhrases = [];
  Object.entries(phraseCounts).forEach(([phrase, count]) => {
    if (count >= 3 && phrase.split(' ').length === 2) {
      repetitivePhrases.push({ phrase, count, type: 'repetition' });
    }
  });

  fillerWords.forEach(filler => {
    if (wordCounts[filler] >= 5) {
      repetitivePhrases.push({ phrase: filler, count: wordCounts[filler], type: 'filler' });
    }
  });

  return repetitivePhrases;
}

/**
 * Get edit history to prevent repetitive edits
 */
async function getEditHistory(videoId) {
  try {
    const content = await resolveContent(videoId);
    if (!content) return { cuts: [], edits: [] };

    const editHistory = content.metadata?.editHistory || { cuts: [], edits: [] };
    return editHistory;
  } catch (error) {
    logger.warn('Failed to get edit history', { error: error.message });
    return { cuts: [], edits: [] };
  }
}

/**
 * Save edit history
 */
async function saveEditHistory(videoId, newCuts, newEdits) {
  try {
    const content = await resolveContent(videoId);
    if (!content) return;

    if (!content.metadata) content.metadata = {};
    if (!content.metadata.editHistory) content.metadata.editHistory = { cuts: [], edits: [] };

    content.metadata.editHistory.cuts = [
      ...(content.metadata.editHistory.cuts || []),
      ...newCuts.map(c => ({ time: c.start, duration: c.duration, appliedAt: new Date() }))
    ];
    content.metadata.editHistory.edits = [
      ...(content.metadata.editHistory.edits || []),
      ...newEdits.map(e => ({ type: e.type, time: e.time, appliedAt: new Date() }))
    ];

    await commitContent(content);
  } catch (error) {
    logger.warn('Failed to save edit history', { error: error.message });
  }
}

/**
 * Build FFmpeg filter complex for precise cuts
 */
function buildCutFilter(silencePeriods, sceneChanges, duration) {
  const segments = [];
  let currentTime = 0;

  // Combine all cut periods (silence and unwanted scenes)
  const allCuts = [
    ...silencePeriods.map(s => ({ start: s.start, end: s.end, type: 'silence' }))
  ].sort((a, b) => a.start - b.start);

  // Build segments to keep (everything except cuts)
  allCuts.forEach(cut => {
    if (cut.start > currentTime + 0.05) { // Tighter threshold for professional cuts
      segments.push({ start: currentTime, end: cut.start });
    }
    currentTime = Math.max(currentTime, cut.end || cut.start);
  });

  if (currentTime < duration - 0.05) {
    segments.push({ start: currentTime, end: duration });
  }

  if (segments.length === 0 || segments.length === 1) return null;

  // Build select filter - keep segments that are NOT in cut periods
  const selectParts = segments.map(seg =>
    `between(t\\,${seg.start.toFixed(3)}\\,${seg.end.toFixed(3)})`
  );
  
  const selectStr = selectParts.join('+');

  return {
    videoFilter: `select='${selectStr}',setpts=N/FRAME_RATE/TB`,
    audioFilter: `aselect='${selectStr}',asetpts=N/SR/TB`
  };
}

/**
 * Detect key moments for creative enhancements (hook, reactions, highlights).
 * Hook: first 1–3 seconds — optimize for niche-specific opening, not generic clickbait.
 * Plan one clear outcome per clip (learn/feel/do); use intentional silence and pacing.
 */
async function detectKeyMoments(transcript, duration, audioLevels = [], preferredVoiceTone = null, preferredHookStyle = null, contentTone = null, platform = null, niche = null, userId = null) {
  const moments = {
    hook: null,
    reactions: [],
    highlights: [],
    bestThumbnail: null,
    geminiInsights: null,
  };

  // === GEMINI-POWERED DEEP ANALYSIS ===
  if (transcript && geminiConfigured) {
    try {
      let extraInstructions = '';
      if (preferredVoiceTone) {
        extraInstructions += `\n- BRAND VOICE RULE: The user prefers the voice/tone: "${preferredVoiceTone}". You MUST ensure all suggestedCaptions, hookText, and cta strictly adhere to this vibe/tone.\n`;
      }
      if (preferredHookStyle) {
        extraInstructions += `\n- HOOK STRUCTURE RULE: The user prefers the hook style: "${preferredHookStyle}". You MUST customize and structure the rewritten hookText and the opening suggestedCaptions to explicitly align with this style (e.g. curiosity-gap, before-after, list-tease, enemy-frame, etc.).\n`;
      }
      const contentToneHookMap = {
        educational:  'stat-reveal or counterintuitive-fact (prioritise insight over shock)',
        entertaining: 'curiosity-gap or pattern-break (maximise laugh or surprise)',
        motivational: 'bold-claim or transformation (inspire action)',
        promotional:  'social-proof or urgency (drive conversion)',
      };
      if (contentTone && contentTone !== 'auto' && contentToneHookMap[contentTone]) {
        extraInstructions += `\n- CONTENT TONE RULE: The user wants "${contentTone}" content. Bias hookText and suggestedCaptions toward ${contentToneHookMap[contentTone]}.\n`;
      }
      if (platform && platform !== 'auto' && platform !== 'all') {
        const platformNorms = {
          tiktok:          'fast hooks (<3s), punchy captions, trending audio references, Gen-Z voice',
          instagram:       'aesthetic visuals, aspirational tone, strong thumbnail moment, mid-length captions',
          youtube_shorts:  'clear value proposition in first 2s, subscriber-bait CTA, retention loops',
          linkedin:        'professional insight-first hook, authority voice, B2B-oriented CTA',
        };
        const norm = platformNorms[platform] || platform;
        extraInstructions += `\n- PLATFORM RULE: Content is being published to ${platform.toUpperCase()}. Optimize all hooks, captions, pacing, and CTA for this platform. Native conventions: ${norm}.\n`;
      }
      if (niche) {
        extraInstructions += `\n- NICHE RULE: Creator niche is "${niche}". Use niche-specific vocabulary, references, and pain points in suggestedCaptions and hookText to maximise audience resonance.\n`;
      }

      // 🧬 2026 CREATOR-DNA PERSONALIZATION INJECTION
      if (userId) {
        try {
          const UserStyleProfile = require('../models/UserStyleProfile');
          const profile = await UserStyleProfile.findOne({ userId });
          if (profile) {
            const topFonts = profile.weightedFonts && profile.weightedFonts.length > 0
              ? profile.topPerformers('weightedFonts', 2).map(f => f.key)
              : [];
            const topHooks = profile.weightedHooks && profile.weightedHooks.length > 0
              ? profile.topPerformers('weightedHooks', 2).map(h => h.key)
              : [];
            const topTones = profile.weightedVoiceTones && profile.weightedVoiceTones.length > 0
              ? profile.topPerformers('weightedVoiceTones', 1).map(t => t.key)
              : [];
            const topCTAs = profile.weightedCtaCategories && profile.weightedCtaCategories.length > 0
              ? profile.topPerformers('weightedCtaCategories', 1).map(c => c.key)
              : [];

            if (topFonts.length > 0 || topHooks.length > 0 || topTones.length > 0 || topCTAs.length > 0) {
              extraInstructions += `\n- CREATOR ENGAGEMENT DNA MATRIX (REAL Historical Performance-Weighted Insights):`;
              if (topTones.length > 0) extraInstructions += `\n  * Primary Audience voice tone: "${topTones.join(', ')}". Bias output pacing/scripts toward this vibe.`;
              if (topHooks.length > 0) extraInstructions += `\n  * Highly engaging opening frameworks: "${topHooks.join(', ')}". Custom structure your rewritten hook to mirror these conversion mechanics.`;
              if (topCTAs.length > 0) extraInstructions += `\n  * Top converting Call-to-Action style: "${topCTAs.join(', ')}". Adapt your CTA output to this layout.`;
              if (topFonts.length > 0) extraInstructions += `\n  * Visual typography favored by active viewer segments: "${topFonts.join(', ')}".`;
              extraInstructions += `\n  Incorporate these historical engagement weights to strictly align with what conversions show works for this creator's channel.\n`;
            }
          }
        } catch (profileError) {
          logger.warn('Failed to query Creator-DNA style profile in moments detection', { error: profileError.message });
        }
      }

      const geminiPrompt = `You are Click's AI Video Intelligence Engine — the world's most advanced content strategy AI.
      
Analyze this transcript and return a JSON object with deep, platform-native insights. 

CREATIVE DIVERGENCE PROTOCOL:
- Do NOT provide generic suggestions. 
- Look for non-obvious emotional spikes or subtle logic shifts in the transcript.
- Your hook rewrites should be aggressive, scroll-stopping, and unique to the creator's voice.
- Each caption should have a distinct "vibe" (e.g., one punchy, one mysterious, one authoritative).
${extraInstructions}
{
  "hookScore": (0-100, how viral is the opening 3 seconds),
  "hookText": (the best possible 3-second hook — rewrite it if needed to maximize stop-scroll rate),
  "hookTimestamp": (best time in seconds to start the hook, 0 if beginning is strong),
  "viralMoments": [{ "time": seconds, "text": quote, "reason": "why viral", "emotion": "type", "triggerType": "curiosity|authority|FOMO|social_proof|shock|value" }],
  "engagementPeaks": [{ "time": seconds, "intensity": 0-100, "type": "laugh|insight|reveal|question|story-beat" }],
  "suggestedCaptions": [{ "text": "CAPTION (10 words max, uppercase, punchy)", "startTime": seconds, "endTime": seconds, "style": "hook|stat|question|punchline|CTA" }],
  "contentPacing": "fast|medium|slow",
  "narrativeStructure": "hook-story-reveal|problem-solution|list|rant|educational|entertaining",
  "topPlatform": "tiktok|instagram|youtube_shorts|linkedin",
  "thumbnailMoment": (best timestamp in seconds for scroll-stopping thumbnail),
  "clipSuggestions": [{ "start": seconds, "end": seconds, "reason": "why this clip is gold" }],
  "cta": "best call-to-action for this content",
  "niche": "detected content niche",
  "sentimentArc": "rising|falling|consistent|dramatic"
}

Transcript (${Math.round(duration)}s video): "${transcript.substring(0, 3000)}"

Return ONLY valid JSON. Be brutally specific, data-driven and EXTREMELY creative.`;

      const raw = await geminiGenerate(geminiPrompt, { temperature: 0.85, maxTokens: 1800 });
      const gemini = parseGeminiJson(raw);
      if (!gemini) {
        logger.warn('detectKeyMoments: Gemini JSON unparseable, skipping insights', {
          rawPreview: String(raw || '').slice(0, 150),
        });
        return moments;
      }
      moments.geminiInsights = gemini;

      // Map Gemini's analysis to moments structure
      if (gemini.hookText && gemini.hookTimestamp !== undefined) {
        moments.hook = {
          start: gemini.hookTimestamp || 0,
          end: Math.min((gemini.hookTimestamp || 0) + 3, duration),
          text: gemini.hookText,
          confidence: (gemini.hookScore || 70) / 100,
          rewritten: true,
        };
      }

      if (gemini.viralMoments && Array.isArray(gemini.viralMoments)) {
        moments.reactions = gemini.viralMoments.slice(0, 8).map(m => ({
          time: m.time || 0,
          text: m.text || '',
          confidence: 0.9,
          emotion: m.emotion,
          triggerType: m.triggerType,
          reason: m.reason,
        }));
      }

      if (gemini.engagementPeaks && Array.isArray(gemini.engagementPeaks)) {
        moments.highlights = gemini.engagementPeaks.slice(0, 10).map(p => ({
          time: p.time || 0,
          text: `${p.type || 'moment'} at ${p.time?.toFixed(1)}s`,
          confidence: (p.intensity || 70) / 100,
          type: p.type,
        }));
      }

      if (gemini.thumbnailMoment !== undefined) {
        moments.bestThumbnail = { time: gemini.thumbnailMoment, confidence: 0.95, aiPicked: true };
      }

      // Attach rich data for downstream use
      moments.suggestedCaptions = gemini.suggestedCaptions || [];
      moments.clipSuggestions = gemini.clipSuggestions || [];
      moments.cta = gemini.cta || null;
      moments.niche = gemini.niche || null;
      moments.topPlatform = gemini.topPlatform || null;
      moments.narrativeStructure = gemini.narrativeStructure || null;
      moments.contentPacing = gemini.contentPacing || 'medium';
      moments.sentimentArc = gemini.sentimentArc || 'consistent';

      logger.info('Gemini Video Intelligence Analysis complete', {
        hookScore: gemini.hookScore,
        viralMoments: moments.reactions.length,
        captions: moments.suggestedCaptions.length,
        niche: moments.niche,
        topPlatform: moments.topPlatform,
      });
    } catch (geminiError) {
      logger.warn('Gemini analysis failed, using pattern-based fallback', { error: geminiError.message });
    }
  }

  // === PATTERN-BASED FALLBACK (if Gemini unavailable or failed) ===
  if (!moments.hook && transcript) {
    const firstWords = transcript.split(/\s+/).slice(0, 15).join(' ');
    if (firstWords.length > 8) {
      moments.hook = {
        start: 0,
        end: Math.min(3, duration),
        text: firstWords,
        confidence: 0.7,
        rewritten: false,
      };
    }

    const reactionPatterns = /(!|\?|wow|amazing|incredible|secret|truth|finally|shocking|never|always|proof)/gi;
    const matches = [...transcript.matchAll(reactionPatterns)];
    matches.slice(0, 6).forEach((match) => {
      moments.reactions.push({
        time: (match.index / transcript.length) * duration,
        text: match[0],
        confidence: 0.7,
      });
    });

    const highlightPatterns = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|\d+%?|\$[\d,]+)\b/g;
    [...transcript.matchAll(highlightPatterns)].slice(0, 10).forEach(match => {
      moments.highlights.push({
        time: (match.index / transcript.length) * duration,
        text: match[0],
        confidence: 0.65,
      });
    });
  }

  // Thumbnail fallback
  if (!moments.bestThumbnail) {
    if (audioLevels.length > 0) {
      const firstThird = Math.floor(audioLevels.length * 0.3);
      const maxIdx = audioLevels.slice(0, firstThird).indexOf(Math.max(...audioLevels.slice(0, firstThird)));
      moments.bestThumbnail = { time: maxIdx >= 0 ? (maxIdx / audioLevels.length) * duration : 0, confidence: 0.75 };
    } else {
      moments.bestThumbnail = { time: 0, confidence: 0.7 };
    }
  }

  return moments;
}

/**
 * Generate text overlay suggestions from transcript highlights
 */
function generateTextOverlaySuggestions(transcript, keyMoments, duration) {
  const overlays = [];

  // Hook text overlay (first 1–3 seconds — niche-specific)
  if (keyMoments.hook) {
    overlays.push({
      text: keyMoments.hook.text.substring(0, 50) + (keyMoments.hook.text.length > 50 ? '...' : ''),
      startTime: keyMoments.hook.start,
      endTime: keyMoments.hook.end,
      position: 'center',
      style: 'bold',
      size: 48,
      color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.7)',
      type: 'hook',
    });
  }

  // Highlight overlays (key phrases)
  keyMoments.highlights.slice(0, 5).forEach((highlight, i) => {
    overlays.push({
      text: highlight.text,
      startTime: Math.max(0, highlight.time - 1),
      endTime: Math.min(duration, highlight.time + 2),
      position: i % 2 === 0 ? 'top' : 'bottom',
      style: 'bold',
      size: 36,
      color: '#FFD700',
      backgroundColor: 'rgba(0,0,0,0.6)',
      type: 'highlight',
    });
  });

  return overlays;
}

/**
 * Detect key moments for meaningful zoom (faces, reactions, key beats).
 * Use zooms only on these moments—subtle push-ins to emphasize key words or reactions, not constant random movement.
 */
async function detectFaceMoments(inputPath, duration) {
  // In production, use face detection library (face-api.js, OpenCV, etc.)
  // For now, return estimated moments based on scene changes (treat as key-moment proxies)
  const sceneChanges = await detectSceneChanges(inputPath, 0.3);
  const faceMoments = [];

  // Limit to a few meaningful zooms; avoid constant motion
  sceneChanges.slice(0, 5).forEach(time => {
    faceMoments.push({
      start: time,
      end: Math.min(time + 3, duration),
      zoom: 1.15, // Subtle push-in (was 1.2); emphasize key moment without distraction
      confidence: 0.7,
    });
  });

  return faceMoments;
}

/**
 * Build zoom filter for key moments only. Subtle push-ins that serve the message.
 */
function buildZoomFilter(faceMoments, duration) {
  if (faceMoments.length === 0) return null;

  // Use a smooth ramp for zoom (0.5s fade in/out)
  const ramp = 0.5;
  let zoomExpression = '1';
  
  const sortedMoments = [...faceMoments].sort((a, b) => a.start - b.start);
  
  sortedMoments.forEach(moment => {
    const s = moment.start;
    const e = moment.end;
    const z = moment.zoom || 1.15;
    
    // Smooth ramp: zoom up from s to s+ramp, stay at z until e-ramp, then down to e
    const rampIn = `(it-${s})/${ramp}`;
    const rampOut = `(${e}-it)/${ramp}`;
    const smoothZoom = `min(${z}, 1 + (${z}-1)*min(${rampIn}, ${rampOut}))`;
    
    zoomExpression = `if(between(it\\,${s}\\,${e})\\,${smoothZoom}\\,${zoomExpression})`;
  });

  // Only return the zoompan filter (scaling/cropping is handled by normalization layer)
  // Safety: ensure x and y are never negative and never exceed bounds
  return `zoompan=z='${zoomExpression}':d=1:x='min(iw-iw/zoom,max(0,iw/2-(iw/zoom/2)))':y='min(ih-ih/zoom,max(0,ih/2-(ih/zoom/2)))':s=1080x1920:fps=30`;
}

/**
 * Apply color grading (cinematic look)
 */
function applyColorGrading() {
  // Vibrant cinematic look: deeper blacks, popped highlights, rich saturation
  // Now using ffmpeg-full for maximum quality
  return 'curves=preset=increase_contrast:all=\'0/0 0.5/0.42 1/1\',eq=contrast=1.2:brightness=0.03:saturation=1.25,vignette=0.3';
}

/**
 * Apply video stabilization
 */
function applyStabilization() {
  // Two-pass stabilization (vidstab) is not compatible with a single-pass filtergraph.
  // Returning format=yuv420p as a no-op to maintain filter chain structure.
  return 'format=yuv420p';
}

/**
 * Apply audio ducking (lower background music during speech)
 */
function applyAudioDucking(transcript, duration) {
  if (!transcript) return null;

  // Detect speech segments (simplified - would use VAD in production)
  const words = transcript.split(/\s+/);
  const speechSegments = [];
  let currentStart = 0;

  words.forEach((word, i) => {
    const wordTime = (i / words.length) * duration;
    if (i === 0 || wordTime - currentStart > 2) {
      if (i > 0) {
        speechSegments.push({ start: currentStart, end: wordTime });
      }
      currentStart = wordTime;
    }
  });

  if (speechSegments.length === 0) return null;

  // Build volume filter that ducks music during speech
  const volumeParts = speechSegments.map(seg =>
    `volume=enable='between(t\\,${seg.start.toFixed(3)}\\,${seg.end.toFixed(3)})':volume='0.3'`
  );

  return volumeParts.join(',');
}

/**
 * Auto-select music based on content sentiment, mood, and Phase 0 Intelligence
 */
async function autoSelectMusic(videoId, sentiment, duration, options = {}) {
  try {
    // Genre is now passed in by the caller (autoEditVideo) per request so
    // parallel auto-edits don't trample each other. The previous
    // implementation read from `global.lastAISelectedGenre` — a single
    // process-wide var that two concurrent users would overwrite, causing
    // user B's edit to inherit user A's music genre. We keep a runtime
    // default of `upbeat_pop` for cold-call sites that don't pass a genre.
    const targetGenre = options.genre || 'upbeat_pop';
    
    // 2026 Premium Hardcoded Audio Fallbacks (Royalty Free)
    // This ensures Click NEVER delivers 'basic' audio, even if the DB is empty.
    const premiumFallbacks = {
      'phonk': 'https://cdn.pixabay.com/audio/2023/04/18/audio_6590bc6619.mp3', // Aggressive gym/hype
      'dark_ambient': 'https://cdn.pixabay.com/audio/2022/10/25/audio_244837a507.mp3', // Secrets, conspiracies, rants
      'lofi': 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf7f6.mp3', // Chill, podcasts, coding
      'synthwave': 'https://cdn.pixabay.com/audio/2022/12/28/audio_f5e5dfccbd.mp3', // Tech, AI, crypto
      'upbeat_pop': 'https://cdn.pixabay.com/audio/2022/03/15/audio_d28bd7a08b.mp3', // Vlogs, standard
      'cinematic': 'https://cdn.pixabay.com/audio/2022/11/08/audio_8e2a05cf62.mp3' // Epic, motivational
    };

    const fallbackUrl = premiumFallbacks[targetGenre] || premiumFallbacks['upbeat_pop'];

    const Music = getMusicModel();
    if (!Music) {
      logger.info('Music model unavailable. Injecting premium cinematic fallback.', { genre: targetGenre });
      return { _id: 'premium-fallback', url: fallbackUrl, title: `Click Cinematic - ${targetGenre}`, isPremium: true };
    }

    // Attempt to find a precise match in the database using the AI's genre
    let matchingMusic = [];
    try {
      matchingMusic = await Music.find({
        $and: [
          {
            $or: [
              { genre: { $regex: targetGenre, $options: 'i' } },
              { tags: { $regex: targetGenre, $options: 'i' } },
              { mood: { $regex: targetGenre, $options: 'i' } }
            ]
          },
          { isPublic: true }
        ]
      }).limit(5).lean();
    } catch (queryError) {
      // Silent fail
    }

    if (matchingMusic.length === 0) {
      logger.info('No DB match for AI genre. Injecting premium cinematic fallback.', { genre: targetGenre });
      return { _id: 'premium-fallback', url: fallbackUrl, title: `Click Cinematic - ${targetGenre}`, isPremium: true };
    }

    // Select random from matches
    const selected = matchingMusic[Math.floor(Math.random() * matchingMusic.length)];
    logger.info('Music auto-selected from DB', { videoId, musicId: selected._id || selected.id, genre: targetGenre });
    return selected;
  } catch (error) {
    logger.warn('Music auto-selection failed', { error: error.message });
    return null;
  }
}

/**
 * Generate smart captions with styling and apply to video
 * @param {string} videoId - Content ID
 * @param {string} transcript - Full transcript text
 * @param {number} duration - Video duration
 * @param {string} style - modern, bold, minimal, tiktok, youtube, outline, professional
 * @param {Object} overrides - Optional { fontFamily } from user brand/preferences
 */

/**
 * Word-Level Karaoke Caption System — the #1 differentiator over Submagic/Captions.ai.
 * Groups transcript words into 4-word display lines. Each line is rendered dim,
 * then each active word lights up in yellow precisely during its spoken window.
 *
 * @param {Array} transcriptWords - Array of { word|text, start, end } from Whisper/Gemini
 * @param {string} style - Caption style for sizing hints
 * @param {number} globalTimeOffset - PTS offset when trimming has shifted timestamps
 * @param {number} globalDuration - Clip duration (for clamping enable expressions)
 * @returns {string[]} Array of FFmpeg drawtext filter strings
 */
/**
 * Resolves a valid TTF/OTF font file on the server's filesystem
 * to avoid FFmpeg drawtext crashes when Sans/Arial defaults are missing.
 */
function getSystemFontPath() {
  const possiblePaths = [
    // macOS Supplemental Fonts
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Helvetica.ttf',
    '/System/Library/Fonts/Supplemental/Verdana.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    '/System/Library/Fonts/Supplemental/Impact.ttf',
    // macOS Core Fonts
    '/System/Library/Fonts/Helvetica.dfont',
    '/System/Library/Fonts/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    '/Library/Fonts/Microsoft/Arial.ttf',
    // Linux truetype Fonts
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/arial.ttf',
    // Windows Fonts
    'C:\\Windows\\Fonts\\arial.ttf'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Word-Level Karaoke Caption System — the #1 differentiator over Submagic/Captions.ai.
 * Groups transcript words into 4-word display lines. Each line is rendered dim,
 * then each active word lights up in yellow precisely during its spoken window.
 *
 * @param {Array} transcriptWords - Array of { word|text, start, end } from Whisper/Gemini
 * @param {string} style - Caption style for sizing hints
 * @param {number} globalTimeOffset - PTS offset when trimming has shifted timestamps
 * @param {number} globalDuration - Clip duration (for clamping enable expressions)
 * @returns {string[]} Array of FFmpeg drawtext filter strings
 */
function generateWordLevelCaptionFilters(transcriptWords, style = 'modern', globalTimeOffset = 0, globalDuration = Infinity) {
  if (!Array.isArray(transcriptWords) || transcriptWords.length === 0) return [];

  const filters = [];
  const WORDS_PER_LINE = 4;
  const fontSize = ['bold', 'tiktok', 'neon'].includes(style) ? 56 : 52;
  const yPos = 'h-text_h-260';
  // ~28px per character at fontSize 52-56 is a good monospace approximation
  const charWidth = fontSize === 56 ? 30 : 28;

  const fontPath = getSystemFontPath();
  const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';

  for (let i = 0; i < transcriptWords.length; i += WORDS_PER_LINE) {
    const group = transcriptWords.slice(i, i + WORDS_PER_LINE);
    const groupStart = (group[0].start ?? 0) - globalTimeOffset;
    const lastWord = group[group.length - 1];
    const groupEnd = ((lastWord.end ?? lastWord.start + 0.4)) - globalTimeOffset;

    if (groupEnd <= 0 || groupStart >= globalDuration) continue;

    const gs = Math.max(0, groupStart).toFixed(3);
    const ge = Math.min(groupEnd, globalDuration).toFixed(3);

    const lineText = group.map(w => (w.word || w.text || '').replace(/[^a-zA-Z0-9 ',.!?-]/g, '')).join(' ').toUpperCase();
    if (!lineText.trim()) continue;
    const safeLine = lineText.replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/%/g, '\\%').replace(/\[/g, '\\[').replace(/\]/g, '\\]');

    // Dim base line — full group, low opacity
    filters.push(
      `drawtext=text='${safeLine}'${fontfileOpt}:fontsize=${fontSize}:fontcolor='white@0.40':` +
      `x='(w-text_w)/2':y='${yPos}':` +
      `borderw=2:bordercolor='black@0.5':` +
      `enable='between(t\\,${gs}\\,${ge})'`
    );

    // Per-word highlight overlays
    let charsAccumulated = 0;
    group.forEach(wordObj => {
      const wStart = ((wordObj.start ?? 0) - globalTimeOffset);
      const wEnd = ((wordObj.end ?? (wordObj.start ?? 0) + 0.35) - globalTimeOffset);
      if (wEnd <= 0 || wStart >= globalDuration) { charsAccumulated += (wordObj.word || wordObj.text || '').length + 1; return; }

      const ws = Math.max(0, wStart).toFixed(3);
      const we = Math.min(wEnd, globalDuration).toFixed(3);

      const wordText = (wordObj.word || wordObj.text || '').replace(/[^a-zA-Z0-9 ',.!?-]/g, '').toUpperCase();
      if (!wordText.trim()) { charsAccumulated += wordText.length + 1; return; }
      const safeWord = wordText.replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/%/g, '\\%');

      // x offset: centre the full line, then shift right by chars-before-word
      const totalChars = lineText.length;
      const xOffset = Math.round(charsAccumulated * charWidth - (totalChars * charWidth) / 2);
      const xExpr = `(w-${Math.round(totalChars * charWidth / 2)})/2+${xOffset + Math.round(totalChars * charWidth / 4)}`;

      filters.push(
        `drawtext=text='${safeWord}'${fontfileOpt}:fontsize=${fontSize + 4}:fontcolor='#FFE500':` +
        `x='${xExpr}':y='${yPos}':` +
        `borderw=3:bordercolor='black':` +
        `shadowcolor='#FFD700@0.6':shadowx=0:shadowy=3:` +
        `enable='between(t\\,${ws}\\,${we})'`
      );

      charsAccumulated += (wordObj.word || wordObj.text || '').length + 1;
    });
  }

  return filters;
}

async function generateAndApplySmartCaptions(videoId, transcript, duration, style = 'modern', overrides = {}, transcriptData = null, targetLang = 'en') {
  try {
    const captionService = getVideoCaptionService();
    if (!captionService || !transcript) return null;

    let captions;
    if (targetLang && targetLang !== 'en') {
      logger.info(`Phase 15: Applying translated subtitles for ${targetLang}`);
      const translatedSegments = await captionService.generateTranslatedCaptions(videoId, targetLang);
      captions = { captions: translatedSegments };
    } else {
      // Generate standard captions
      captions = await captionService.generateAutoCaptions(videoId, {
        language: 'en',
        transcript,
        style,
        position: 'bottom',
      });
    }

    // Task 4.3: Saliency-Aware Positioning
    if (style === 'saliency-aware') {
      logger.info('[Saliency] Computing optimal positioning for each caption block...');
      // In a real loop, we would sample frames for each caption block
      const mockSaliency = await saliencyService.getFrameSaliency(videoId, 1.0);
      overrides.position = saliencyService.getOptimalCaptionPosition(mockSaliency);
      logger.info(`[Saliency] Decision: Placing captions at "${overrides.position}" to avoid subjects.`);
    }

    // Style captions based on style preference (professional font families and platform styles)
    const styleOptions = {
      modern: {
        fontSize: 42,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.75)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Inter, Arial, sans-serif',
      },
      bold: {
        fontSize: 48,
        fontColor: '#FFD700',
        backgroundColor: 'rgba(0,0,0,0.8)',
        outline: true,
        outlineColor: '#000000',
        position: 'center',
        fontFamily: 'Montserrat, Arial Black, sans-serif',
      },
      minimal: {
        fontSize: 36,
        fontColor: '#FFFFFF',
        backgroundColor: 'transparent',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      'saliency-aware': {
        fontSize: 40,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.6)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom', // Will be overridden dynamically
        fontFamily: 'Inter, sans-serif',
      },
      tiktok: {
        fontSize: 44,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.85)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Impact, Arial Black, sans-serif',
      },
      youtube: {
        fontSize: 38,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.7)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Roboto, Arial, sans-serif',
      },
      outline: {
        fontSize: 40,
        fontColor: '#FFFFFF',
        backgroundColor: 'transparent',
        outline: true,
        outlineColor: '#000000',
        outlineWidth: 3,
        position: 'bottom',
        fontFamily: 'Montserrat, sans-serif',
      },
      professional: {
        fontSize: 36,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.6)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Georgia, Times New Roman, serif',
      },
      neon: {
        fontSize: 42,
        fontColor: '#00FFFF',
        backgroundColor: 'transparent',
        outline: true,
        outlineColor: '#000000',
        outlineWidth: 2,
        position: 'bottom',
        fontFamily: 'Montserrat, Arial Black, sans-serif',
      },
      pill: {
        fontSize: 38,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.85)',
        outline: false,
        position: 'bottom',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      cinematic: {
        fontSize: 36,
        fontColor: '#E5E5E5',
        backgroundColor: 'rgba(0,0,0,0.5)',
        outline: true,
        outlineColor: '#1a1a1a',
        position: 'bottom',
        fontFamily: 'Georgia, Times New Roman, serif',
      },
      retro: {
        fontSize: 40,
        fontColor: '#FFE4B5',
        backgroundColor: 'rgba(40,20,0,0.7)',
        outline: true,
        outlineColor: '#2a1500',
        position: 'bottom',
        fontFamily: 'Georgia, serif',
      },
      subtitle: {
        fontSize: 34,
        fontColor: '#FFFFFF',
        backgroundColor: 'transparent',
        outline: true,
        outlineColor: '#000000',
        outlineWidth: 2,
        position: 'bottom',
        fontFamily: 'Arial, sans-serif',
      },
      karaoke: {
        fontSize: 44,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.8)',
        outline: true,
        outlineColor: '#000000',
        position: 'center',
        fontFamily: 'Impact, Arial Black, sans-serif',
      },
      gradient: {
        fontSize: 42,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(128,0,128,0.75)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Montserrat, sans-serif',
      },
      serif: {
        fontSize: 38,
        fontColor: '#FFF8DC',
        backgroundColor: 'rgba(0,0,0,0.65)',
        outline: true,
        outlineColor: '#000000',
        position: 'bottom',
        fontFamily: 'Playfair Display, Georgia, serif',
      },
      'high-contrast': {
        fontSize: 44,
        fontColor: '#FFFFFF',
        backgroundColor: '#000000',
        outline: true,
        outlineWidth: 3,
        outlineColor: '#FFFFFF',
        position: 'bottom',
        fontFamily: 'Arial Black, sans-serif',
      },
    };

    let baseStyle = { ...(styleOptions[style] || styleOptions.modern), ...overrides };

    // Emotion-Synced Semantic Captions (Task 3.3)
    let styledCaptions = captionService.styleCaptions(
      captions.captions,
      baseStyle
    );

    // Apply transcript word-level semantics if available
    if (transcriptData && transcriptData.words && transcriptData.words.length > 0) {
      styledCaptions = styledCaptions.map(cap => {
        // Find the loudest/most emotional word in this caption window
        const wordsInWindow = transcriptData.words.filter(w =>
          w.start >= cap.startTime && w.end <= cap.endTime
        );

        if (wordsInWindow.length > 0) {
          const hasPositive = wordsInWindow.some(w => w.sentiment === 'positive');
          const hasNegative = wordsInWindow.some(w => w.sentiment === 'negative');
          const maxVolume = Math.max(...wordsInWindow.map(w => w.volume || 50));

          // Emotion -> Color
          if (hasPositive) {
            cap.style.fontColor = '#00FF99'; // Positive Emerald
            cap.style.animation = 'pop';
          } else if (hasNegative) {
            cap.style.fontColor = '#FF3333'; // Negative Red
            cap.style.animation = 'shake'; // Camera Shake Trigger
          }

          // Volume -> Scale
          if (maxVolume > 85) {
            cap.style.fontSize = cap.style.fontSize * 1.3;
            cap.style.fontWeight = 900;
          }
        }
        return cap;
      });
    }

    logger.info('Smart captions generated', { videoId, count: styledCaptions.length, style });
    return styledCaptions;
  } catch (error) {
    logger.warn('Smart caption generation failed', { error: error.message });
    return null;
  }
}

/**
 * Export video to multiple formats simultaneously
 */
async function exportMultipleFormats(videoId, formats = ['mp4', 'webm']) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
      throw new Error('Input video file not found');
    }

    const exports = [];
    const exportPromises = formats.map(async (format) => {
      const outputFilename = `export-${videoId}-${format}-${Date.now()}.${format}`;
      const outputPath = path.join(__dirname, '../../uploads/exports', outputFilename);

      if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      }

      return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        if (format === 'webm') {
          command
            .videoCodec('libvpx-vp9')
            .audioCodec('libopus')
            .outputOptions(['-crf', '30', '-b:v', '0']);
        } else if (format === 'mov') {
          command
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions(['-preset', 'medium', '-crf', '23']);
        } else {
          // MP4 default
          command
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions(['-preset', 'medium', '-crf', '23', '-movflags', '+faststart']);
        }

        command
          .output(outputPath)
          .on('end', async () => {
            try {
              const uploadResult = await uploadFile(outputPath, `exports/${outputFilename}`, `video/${format}`, { videoId });
              resolve({ format, url: uploadResult.url });
            } catch (uploadError) {
              reject(uploadError);
            }
          })
          .on('error', reject)
          .run();
      });
    });

    const results = await Promise.allSettled(exportPromises);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        exports.push(result.value);
      } else {
        logger.warn('Format export failed', { format: formats[index], error: result.reason?.message });
      }
    });

    return { success: true, exports };
  } catch (error) {
    logger.error('Multi-format export error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Enhanced auto-edit video with creative and quality features
 *
 * IMPORTANT: This function AUTOMATICALLY APPLIES all detected edits to the video.
 * It processes the video with FFmpeg, applies all filters and edits, saves the edited
 * video file, uploads it, and REPLACES the original video in the content model.
 *
 * The edited video becomes the new originalFile.url - the original is preserved in metadata.
 *
 * @param {string} videoId - The video content ID
 * @param {Object} editingOptions - Editing options (all edits are automatically applied)
 * @param {string} userId - User ID for real-time progress updates
 * @returns {Promise<Object>} Result with editedVideoUrl and statistics
 */

/**
 * Decide whether `content.editorState` carries non-trivial user edits.
 * "Non-trivial" means at least one of: text overlays, shape overlays,
 * a non-empty timeline (more than the auto-inserted single base
 * segment), a non-empty videoFilters object, or a non-default
 * colorGradeSettings. We use this to gate the pre-render step so we
 * don't pay a re-encode for users who never touched the manual editor.
 */
function hasManualEdits(state) {
  if (!state || typeof state !== 'object') return false;
  if (Array.isArray(state.textOverlays) && state.textOverlays.length > 0) return true;
  if (Array.isArray(state.shapeOverlays) && state.shapeOverlays.length > 0) return true;
  if (Array.isArray(state.timelineSegments) && state.timelineSegments.length > 0) {
    if (state.timelineSegments.length > 1) return true;
    const seg = state.timelineSegments[0];
    if (seg && (
      (seg.startTime !== undefined && seg.startTime > 0) || 
      (seg.start !== undefined && seg.start > 0) || 
      seg.reversed || 
      seg.freezeFrame || 
      (seg.sourceStartTime !== undefined && seg.sourceStartTime > 0) ||
      seg.id !== 'initial-video-segment'
    )) {
      return true;
    }
  }
  if (state.videoFilters && Object.keys(state.videoFilters).length > 0) {
    // Filter object exists with at least one key — assume it's non-default
    return true;
  }
  if (state.colorGradeSettings && Object.keys(state.colorGradeSettings).length > 0) {
    return true;
  }
  return false;
}

/**
 * Bake the user's manual editor state into a single intermediate file
 * using a minimal ffmpeg filter chain. We deliberately keep this simple
 * and forgiving — partial editor schemas should still produce a usable
 * intermediate. The auto-edit pipeline takes it from there.
 *
 * Supports:
 *   - state.timelineSegments[] → select+aselect concat (keep ranges)
 *   - state.videoFilters       → eq=brightness/saturation/contrast
 *   - state.textOverlays[]     → drawtext overlays with optional time gates
 *
 * Returns the absolute path of the rendered file, or null on failure.
 */
function renderManualEditIntermediate({ inputPath, editorState, outputDir, videoId }) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `manual-edit-${videoId}-${Date.now()}.mp4`);

    const videoChain = [];
    const audioChain = [];

    // Timeline keep-ranges. Handles one or more keep segments
    // select/aselect concat.
    const segments = Array.isArray(editorState?.timelineSegments) ? editorState.timelineSegments : [];
    const validSegs = segments
      .map((s) => ({
        start: Number(s?.startTime ?? s?.start),
        end: Number(s?.endTime ?? s?.end)
      }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
    if (validSegs.length >= 1) {
      const between = validSegs.map((s) => `between(t\\,${s.start.toFixed(3)}\\,${s.end.toFixed(3)})`).join('+');
      videoChain.push(`select='${between}',setpts=N/FRAME_RATE/TB`);
      audioChain.push(`aselect='${between}',asetpts=N/SR/TB`);
    }

    // Color/filters via eq. Only set the keys the user actually
    // touched — defaults are 1.0 for contrast/saturation, 0 for
    // brightness, but Mongoose's Mixed could dump anything in here so
    // we clamp aggressively.
    const f = editorState?.videoFilters || {};
    const eqParts = [];
    if (Number.isFinite(Number(f.brightness)))   eqParts.push(`brightness=${Math.max(-1, Math.min(1, Number(f.brightness)))}`);
    if (Number.isFinite(Number(f.contrast)))     eqParts.push(`contrast=${Math.max(0, Math.min(2, Number(f.contrast)))}`);
    if (Number.isFinite(Number(f.saturation)))   eqParts.push(`saturation=${Math.max(0, Math.min(3, Number(f.saturation)))}`);
    if (eqParts.length > 0) videoChain.push(`eq=${eqParts.join(':')}`);

    // Text overlays via drawtext. Escape every shell- and filter-special
    // character so user-supplied caption text can't break out of the
    // drawtext filter string. Previously we only escaped \, ', :, %
    // which left backticks, semicolons, square brackets, and commas
    // exposed — a creator typing `O'Reilly; echo pwned` could inject
    // additional filters. We now escape the full set FFmpeg recognises
    // PLUS strip newlines (which would terminate the filter line).
    const overlays = Array.isArray(editorState?.textOverlays) ? editorState.textOverlays : [];
    const fontPath = getSystemFontPath();
    const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';

    for (const o of overlays.slice(0, 10)) { // cap to avoid runaway filter chains
      const text = String(o?.text || '').trim();
      if (!text) continue;
      const escaped = text
        .replace(/[\r\n]+/g, ' ')          // newlines → space
        .replace(/\\/g, '\\\\')             // backslash first (everything below adds backslashes)
        .replace(/'/g, "’")               // single quote -> typographic quote
        .replace(/`/g, '\\`')               // backtick (shell command substitution if filter leaks to shell)
        .replace(/;/g, '\\;')               // semicolon (filter-graph separator)
        .replace(/,/g, '\\,')               // comma (drawtext arg separator)
        .replace(/\[/g, '\\[')              // bracket (filter-link label)
        .replace(/\]/g, '\\]')
        .replace(/:/g, '\\:')               // colon (filter option separator)
        .replace(/%/g, '\\%');              // percent (drawtext format spec)
      const fontSize = Math.max(12, Math.min(160, Number(o.fontSize) || 48));
      const color = typeof o.color === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(o.color) ? (o.color.startsWith('#') ? o.color : '#' + o.color) : 'white';
      const x = Number.isFinite(Number(o.x)) ? Math.round(Number(o.x)) : '(w-text_w)/2';
      const y = Number.isFinite(Number(o.y)) ? Math.round(Number(o.y)) : '(h-text_h)*0.85';
      let drawtext = `drawtext=text='${escaped}'${fontfileOpt}:fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}:borderw=3:bordercolor=black:shadowcolor=black@0.7:shadowx=2:shadowy=2`;
      if (Number.isFinite(Number(o.start)) && Number.isFinite(Number(o.end)) && Number(o.end) > Number(o.start)) {
        drawtext += `:enable='between(t\\,${Number(o.start).toFixed(3)}\\,${Number(o.end).toFixed(3)})'`;
      }
      videoChain.push(drawtext);
    }

    // Shape overlays via drawbox.
    const shapes = Array.isArray(editorState?.shapeOverlays) ? editorState.shapeOverlays : [];
    for (const s of shapes.slice(0, 20)) {
      try {
        const start = s.startTime ?? s.start ?? 0;
        const end = s.endTime ?? s.end ?? 5;
        const enable = `between(t\\,${Number(start).toFixed(3)}\\,${Number(end).toFixed(3)})`;
        const x = s.x !== undefined ? `(w*${Number(s.x) / 100})-(w*${(Number(s.width) || 20) / 100})/2` : '(w-w*0.2)/2';
        const y = s.y !== undefined ? `(h*${Number(s.y) / 100})-(h*${(Number(s.height) || 20) / 100})/2` : '(h-h*0.2)/2';
        const w = `w*${(Number(s.width) || 20) / 100}`;
        const h = s.kind === 'line' ? (Number(s.strokeWidth) || 2) : `h*${(Number(s.height) || 20) / 100}`;
        const color = String(s.color || '#ffffff').replace('#', '0x');
        const alpha = Number(s.opacity ?? 0.5);
        videoChain.push(`drawbox=x='${x}':y='${y}':w='${w}':h='${h}':color=${color}@${alpha}:t=fill:enable='${enable}'`);
      } catch (e) {
        logger.warn('Skip shape overlay in intermediate manual pre-render', { error: e.message, shape: s });
      }
    }

    if (videoChain.length === 0 && audioChain.length === 0) {
      // Nothing actionable — caller falls back to original source.
      return resolve(null);
    }

    const cmd = ffmpeg(inputPath);
    if (videoChain.length > 0) cmd.videoFilters(videoChain.join(','));
    if (audioChain.length > 0) cmd.audioFilters(audioChain.join(','));
    cmd
      .outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-pix_fmt yuv420p', '-c:a aac', '-b:a 192k'])
      .output(outputPath)
      .on('start', (line) => logger.debug('manual-edit pre-render ffmpeg start', { videoId, cmd: line.slice(0, 240) }))
      .on('end', () => {
        if (!fs.existsSync(outputPath)) return reject(new Error('manual-edit pre-render produced no file'));
        const size = fs.statSync(outputPath).size;
        if (size < 1024) {
          try { fs.unlinkSync(outputPath); } catch (_) { /* ignore file removal error */ }
          return reject(new Error(`manual-edit pre-render produced empty file (${size} bytes)`));
        }
        resolve(outputPath);
      })
      .on('error', (err) => reject(new Error(`manual-edit pre-render ffmpeg error: ${err.message}`)))
      .run();
  });
}

/**
 * 2026 Viral Caption Emoji Injection
 * Autonomously attaches highly relevant, trending emojis to the caption text
 * based on keyword matching and sentiment style.
 */
function attachViralEmojis(text, style) {
  if (!text) return '';
  const upper = text.toUpperCase();
  let emoji = '';

  // Keyword to emoji mappings (2026 Engagement Trends)
  if (upper.includes('MONEY') || upper.includes('RICH') || upper.includes('DOLLAR') || upper.includes('IRA') || upper.includes('EARN') || upper.includes('INVEST') || upper.includes('COST') || upper.includes('REVENUE') || upper.includes('MRR')) {
    emoji = ' 💵';
  } else if (upper.includes('FIRE') || upper.includes('INSANE') || upper.includes('UNREAL') || upper.includes('CRAZY') || upper.includes('EPIC') || upper.includes('BURN')) {
    emoji = ' 🔥';
  } else if (upper.includes('MIND BLOWN') || upper.includes('SHOCK') || upper.includes('OMG') || upper.includes('WTF') || upper.includes('SURPRISE') || upper.includes('IMPACT')) {
    emoji = ' 🤯';
  } else if (upper.includes('SECRET') || upper.includes('SHH') || upper.includes('MYSTERY') || upper.includes('HIDDEN') || upper.includes('LOOP')) {
    emoji = ' 🤫';
  } else if (upper.includes('WARNING') || upper.includes('STOP') || upper.includes('DANGER') || upper.includes('WRONG') || upper.includes('MISTAKE') || upper.includes('FAIL')) {
    emoji = ' ⚠️';
  } else if (upper.includes('WIN') || upper.includes('BEST') || upper.includes('CHAMPION') || upper.includes('GOLD') || upper.includes('SUCCESS') || upper.includes('PROFIT') || upper.includes('GROW')) {
    emoji = ' 🏆';
  } else if (upper.includes('PRO TIP') || upper.includes('GUIDE') || upper.includes('METHOD') || upper.includes('LEARN') || upper.includes('KNOWLEDGE') || upper.includes('IDEA') || upper.includes('SYSTEM')) {
    emoji = ' 💡';
  } else if (upper.includes('LOVE') || upper.includes('HEART') || upper.includes('AESTHETIC') || upper.includes('PEACE') || upper.includes('BEAUTY')) {
    emoji = ' ❤️';
  } else if (upper.includes('TECH') || upper.includes('AI') || upper.includes('SOFTWARE') || upper.includes('CODE') || upper.includes('SYSTEM') || upper.includes('PIPELINE') || upper.includes('AUTOMATION')) {
    emoji = ' ⚡';
  } else if (upper.includes('TIME') || upper.includes('SPEED') || upper.includes('FAST') || upper.includes('COMMUTE') || upper.includes('COMMUTING') || upper.includes('HOUR')) {
    emoji = ' ⏱️';
  }

  // Style-based overrides if no keyword matched
  if (!emoji) {
    if (style === 'hook') emoji = ' 👀';
    else if (style === 'punchline') emoji = ' 🔥';
    else if (style === 'CTA') emoji = ' 👇';
  }

  return `${text}${emoji}`;
}

async function autoEditVideo(videoId, editingOptions = {}, userId = null) {
  // Hoisted so the outer catch can scrub partial files on failure. The
  // inner try writes to these paths; the catch reads them back to
  // decide what to unlink.
  let _tempPathForCleanup = null;
  let _outputPathForCleanup = null;
  let inputPath = null;

  const cleanup = (isSuccess = false, uploadResult = null) => {
    try {
      const tempAbs = _tempPathForCleanup ? path.join(process.cwd(), _tempPathForCleanup) : null;
      if (tempAbs && fs.existsSync(tempAbs)) {
        fs.unlinkSync(tempAbs);
        logger.info('Cleaned up transient temp file', { path: tempAbs });
      }
    } catch (err) {
      logger.warn('Failed to clean up temp file', { error: err.message });
    }

    try {
      if (_outputPathForCleanup) {
        const musicOutputPath = _outputPathForCleanup.replace('.mp4', '-with-music.mp4');
        const musicAbs = path.join(process.cwd(), musicOutputPath);
        if (fs.existsSync(musicAbs)) {
          fs.unlinkSync(musicAbs);
          logger.info('Cleaned up transient music mix file', { path: musicAbs });
        }
      }
    } catch (err) {
      logger.warn('Failed to clean up transient music mix file', { error: err.message });
    }

    try {
      if (inputPath && inputPath.includes('manual-edit-') && inputPath.endsWith('.mp4')) {
        const manualAbs = path.isAbsolute(inputPath) ? inputPath : path.join(process.cwd(), inputPath);
        if (fs.existsSync(manualAbs)) {
          fs.unlinkSync(manualAbs);
          logger.info('Cleaned up transient manual-edit intermediate file', { path: manualAbs });
        }
      }
    } catch (err) {
      logger.warn('Failed to clean up manual-edit intermediate file', { error: err.message });
    }

    if (isSuccess && uploadResult && uploadResult.storage !== 'local') {
      try {
        const outAbs = _outputPathForCleanup ? path.join(process.cwd(), _outputPathForCleanup) : null;
        if (outAbs && fs.existsSync(outAbs)) {
          fs.unlinkSync(outAbs);
          logger.info('Cleaned up local output file after successful cloud upload', { path: outAbs });
        }
      } catch (err) {
        logger.warn('Failed to clean up local output file after cloud upload', { error: err.message });
      }
    }
  };

  const cleanupAll = () => {
    cleanup();
    try {
      const outAbs = _outputPathForCleanup ? path.join(process.cwd(), _outputPathForCleanup) : null;
      if (outAbs && fs.existsSync(outAbs)) {
        fs.unlinkSync(outAbs);
        logger.info('Cleaned up output file on failure', { path: outAbs });
      }
    } catch (err) {
      logger.warn('Failed to clean up output file', { error: err.message });
    }
  };

  try {
    let bRollPlan = [];
    let commerceInlays = [];
    // Request-scoped music genre. Previously held on `global` so two
    // concurrent auto-edits would clobber each other; isolating it here
    // keeps parallel renders independent.
    let requestMusicGenre = editingOptions.musicGenre || null;
    let requestVisualTheme = null; // Dynamically picked for diversity
    let {
      removeSilence = true,
      removePauses = true,
      optimizePacing = true,
      enhanceAudio = true,
      addTransitions = true,
      minSilenceDuration = 0.5,
      silenceThreshold = -30,
      // Creative features
      enableAutoZoom = true,
      enableTextOverlays = true,
      optimizeHook = true,
      enableColorGrading = true,
      enableStabilization = false, // Can be slow
      enableAudioDucking = true,
      // Quality features
      enableNoiseReduction = true,
      enableAutoThumbnail = true,
      // New excellence features
      enableSmartCaptions = true,
      captionStyle = 'modern', // modern, bold, minimal, tiktok, youtube, outline, professional
      enableMusicAutoSelect = true,
      enableMultiFormatExport = false,
      exportFormats = ['mp4'], // mp4, webm, mov
      // Precise scene capture
      sceneThreshold = 0.3,
      minSceneLength = 1.0,
      useMultiModalScenes = false, // use visual+audio fusion when true
      workflowType = 'general', // 'tiktok', 'youtube', 'general'
      // Opus+ / extended creative
      clipTargetLength, // 'short' | 'mid-3-5' | 'mid-5-10' | 'full'
      clipCount = 1,
      contentGenre, // 'auto' | 'tutorial' | 'vlog' | 'podcast' | 'webinar' | 'product'
      prioritizeHook,
      aspectFormats, // e.g. ['9:16', '1:1', '16:9'] for multi-aspect export
      pacingIntensity, // 'gentle' | 'medium' | 'aggressive'
      // Custom overrides
      preferredVoiceTone = null,
      preferredHookStyle = null,
      pauseThresholdMs = null,
      pacingPauseThresholdMs = null,
      speedMultiplierSilence = null,
      speedMultiplierDialogue = null,
      captionFontScale = null,
      captionVerticalOffset = null,
      aestheticColorGrade = null,
      aestheticTransition = null,
      subtitlePosition = 'auto', // 'auto' | 'top' | 'middle' | 'bottom' | 'lower-third'
      contentTone = 'auto', // 'auto' | 'educational' | 'entertaining' | 'motivational' | 'promotional'
      customInstructions = null, // free-text creative direction from user
    } = editingOptions;

    // Bridge UI field names to the internal variable names used throughout
    // the pipeline. Any dimension the user explicitly set in the AI Director
    // HUD must survive through to Gemini analysis and FFmpeg filter building.
    if (!preferredHookStyle && editingOptions.hookStyle && editingOptions.hookStyle !== 'auto') {
      preferredHookStyle = editingOptions.hookStyle;
    }
    if (!preferredVoiceTone && editingOptions.voiceTone && editingOptions.voiceTone !== 'auto') {
      preferredVoiceTone = editingOptions.voiceTone;
    }
    if (!aestheticTransition && editingOptions.transitionStyle && editingOptions.transitionStyle !== 'auto') {
      aestheticTransition = editingOptions.transitionStyle;
    }
    if (!aestheticColorGrade && editingOptions.colorGrade && editingOptions.colorGrade !== 'auto') {
      // Map the UI's human-friendly colorGrade names to the visual theme keys
      // consumed by the FFmpeg color-filter switch below.
      const COLOR_GRADE_MAP = {
        vivid:     'hyper_pop',
        cinematic: 'high_contrast_luma',
        natural:   'dreamy_pastel',
        cool:      'cyberpunk_neon',
        warm:      'vintage_film',
        vintage:   'vintage_film',
        bw:        'bw',
      };
      aestheticColorGrade = COLOR_GRADE_MAP[editingOptions.colorGrade] || editingOptions.colorGrade;
    }

    // When the user explicitly toggles speedRamping OFF, disable the Neural
    // Speed Ramp by marking optimizePacing false so the cut-filter branch runs
    // instead. A true/unset value leaves optimizePacing as the user set it.
    if ('speedRamping' in editingOptions && editingOptions.speedRamping === false) {
      optimizePacing = false;
    }

    const optimizeHookOption = prioritizeHook !== undefined ? prioritizeHook : optimizeHook;
    const aspectRatiosToExport = Array.isArray(aspectFormats) && aspectFormats.length > 0
      ? aspectFormats
      : (enableMultiFormatExport && exportFormats?.length ? exportFormats : null);
    const effectiveWorkflow = contentGenre === 'product' ? 'tiktok' : (contentGenre === 'tutorial' || contentGenre === 'vlog' || contentGenre === 'webinar') ? 'youtube' : workflowType;

    // 🧠 2026 CONTINUOUS LEARNING MATRIX INJECTION
    let learningBlueprint = null;
    if (userId) {
      learningBlueprint = await getActiveBlueprint(userId);
      if (learningBlueprint) {
        logger.info('🧠 Applying Neural Learning Blueprint', { blueprint: learningBlueprint });
        // Use blueprint to override or enhance options
        if (learningBlueprint.pacingStrategy?.toLowerCase().includes('aggressive')) pacingIntensity = 'aggressive';
        if (learningBlueprint.recommendedVfx) {
          editingOptions.vfx = [...(editingOptions.vfx || []), ...learningBlueprint.recommendedVfx];
        }
        // Personalization: Auto-inherit captionStyle from learning matrix if not explicitly set
        if (learningBlueprint.captionStyle && (!editingOptions.captionStyle || editingOptions.captionStyle === 'auto')) {
          captionStyle = learningBlueprint.captionStyle;
          logger.info('🧠 Auto-inherited Caption Style from performance blueprint:', { captionStyle });
        }
        // Personalization: Auto-inherit colorMood from learning matrix if not explicitly set
        if (learningBlueprint.recommendedColorMood && (!editingOptions.colorGrade || editingOptions.colorGrade === 'auto')) {
          aestheticColorGrade = learningBlueprint.recommendedColorMood;
          logger.info('🧠 Auto-inherited Color Grade from performance blueprint:', { aestheticColorGrade });
        }
        // Personalization: Auto-inherit musicGenre from learning matrix if not explicitly set
        if (learningBlueprint.musicGenre && (!editingOptions.musicGenre || editingOptions.musicGenre === 'auto')) {
          requestMusicGenre = learningBlueprint.musicGenre;
          logger.info('🧠 Auto-inherited Music Genre from performance blueprint:', { requestMusicGenre });
        }
      }
    }

    const pacingPresets = {
      gentle: { minSilenceDuration: 0.8, silenceThreshold: -25 },
      medium: { minSilenceDuration: 0.5, silenceThreshold: -30 },
      aggressive: { minSilenceDuration: 0.3, silenceThreshold: -35 },
    };
    const pacing = pacingPresets[pacingIntensity] || pacingPresets.medium;

    // Support user override pause threshold (convert ms to seconds)
    const userPauseThreshold = pacingPauseThresholdMs || pauseThresholdMs;
    const effectiveMinSilence = (typeof userPauseThreshold === 'number' && userPauseThreshold > 0)
      ? userPauseThreshold / 1000
      : (pacingPresets[pacingIntensity] ? pacing.minSilenceDuration : minSilenceDuration);

    const effectiveSilenceThreshold = pacingPresets[pacingIntensity] ? pacing.silenceThreshold : silenceThreshold;

    logger.info('Auto-edit options (Opus+)', { 
      clipTargetLength, 
      clipCount, 
      contentGenre, 
      prioritizeHook: optimizeHookOption, 
      aspectRatiosToExport, 
      effectiveWorkflow, 
      pacingIntensity: pacingIntensity || 'medium',
      preferredVoiceTone,
      preferredHookStyle,
      userPauseThreshold,
      speedMultiplierDialogue,
      speedMultiplierSilence
    });

    const content = await resolveContent(videoId);
    if (!content) throw new Error('Video content not found');

    // `originalFile` is an optional subdocument on the Content schema, so a
    // record can legitimately exist without a source URL (e.g. a draft that
    // never finished uploading). Dereferencing `content.originalFile.url`
    // blindly throws an opaque "Cannot read properties of undefined" that the
    // route surfaces as a bare 500. Guard up front with a clear, actionable
    // message so the user is told to re-upload instead.
    if (!content.originalFile || !content.originalFile.url) {
      throw new Error('No source video file found for this content. Please re-upload the video and try again.');
    }

    // If the user has manual editor edits saved (text overlays, color
    // grading, timeline cuts, etc.), render those FIRST so the auto-edit
    // pipeline operates on their edited version instead of the raw
    // upload. Without this step the user's manual work was silently
    // dropped — every auto-edit ran against `originalFile.url` only and
    // ignored `content.editorState` completely. That's what the live
    // tester reported as "my edits aren't being applied to the clip".
    // The upload route writes to `process.cwd()/uploads/...` (which is
    // `server/uploads/...` when the server is launched from `server/`),
    // but historically this service resolved relative to
    // `__dirname/../..` which points at the project root. When those
    // diverge the file is never found and the whole auto-edit 500s.
    // Probe BOTH layouts and pick whichever one exists on disk.
    let cleanUrl = content.originalFile.url;
    // Fix historical bug where URLs were saved as "../uploads/videos/..."
    if (cleanUrl.startsWith('../')) {
      cleanUrl = cleanUrl.replace(/^\.\.\//, '');
    }

    if (cleanUrl.startsWith('http')) {
      inputPath = cleanUrl;
    } else if (cleanUrl.startsWith('/')) {
      const projectRootCandidate = path.join(__dirname, '../..', cleanUrl);
      const serverLocalCandidate = path.join(__dirname, '..', cleanUrl);
      const cwdCandidate = path.join(process.cwd(), cleanUrl);
      const absoluteCandidates = [cwdCandidate, projectRootCandidate, serverLocalCandidate];
      const found = absoluteCandidates.find((p) => {
        try {
          return fs.existsSync(p) && fs.statSync(p).size > 0;
        } catch (_) {
          return false;
        }
      });
      const chosen = found || projectRootCandidate; // keep prior behaviour if nothing matches
      inputPath = path.relative(process.cwd(), chosen);
    } else {
      // Path is like "uploads/videos/..."
      const cwdCandidate = path.join(process.cwd(), cleanUrl);
      if (fs.existsSync(cwdCandidate)) {
        inputPath = cleanUrl;
      } else {
        inputPath = cleanUrl;
      }
    }

    if (hasManualEdits(content.editorState)) {
      try {
        logger.info('Pre-rendering manual editor state before auto-edit', {
          videoId,
          textOverlays:    content.editorState.textOverlays?.length ?? 0,
          shapeOverlays:   content.editorState.shapeOverlays?.length ?? 0,
          timelineCuts:    content.editorState.timelineSegments?.length ?? 0,
          hasFilters:      !!content.editorState.videoFilters,
          hasColorGrading: !!content.editorState.colorGradeSettings,
        });
        // Minimal direct-ffmpeg pre-render. Earlier this delegated to
        // videoRenderService.renderFromEditorState which has a much
        // richer filter chain — but that chain expects fields we don't
        // require from the manual editor schema (e.g. textOverlay
        // animations, kerning, shadow specs) and 500'd with "Invalid
        // argument" on minimal payloads. This local builder ONLY does
        // what's needed to bake editor state into the video before the
        // auto-edit pipeline runs: timeline keep-ranges, brightness/
        // saturation EQ, and one-line drawtext overlays.
        const renderedPath = await renderManualEditIntermediate({
          inputPath: path.join(process.cwd(), inputPath),
          editorState: content.editorState,
          outputDir: path.join(process.cwd(), 'uploads', 'temp'),
          videoId,
        });
        if (renderedPath && fs.existsSync(renderedPath)) {
          inputPath = path.relative(process.cwd(), renderedPath);
          logger.info('Auto-edit will run against manual-edit intermediate', { videoId, inputPath });
        } else {
          logger.warn('Manual-edit pre-render returned no output; falling back to original source', { videoId });
        }
      } catch (preRenderError) {
        // Don't fail the whole auto-edit — fall through to the original
        // source. The user gets the auto-edit result they had before;
        // we log so the issue is visible in monitoring.
        logger.warn('Manual-edit pre-render failed; falling back to original source', {
          videoId,
          error: preRenderError.message,
        });
      }
    }

    if (!inputPath.startsWith('http') && !fs.existsSync(path.join(process.cwd(), inputPath))) {
      throw new Error(`Input video file not found at ${inputPath}`);
    }

    const outputFilename = `auto-edit-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.relative(process.cwd(), path.join(__dirname, '../../uploads/videos', outputFilename));
    const tempPath = path.relative(process.cwd(), path.join(__dirname, '../../uploads/temp', `temp-${outputFilename}`));
    // Expose to the outer catch for temp-file cleanup on failure.
    _tempPathForCleanup = tempPath;
    _outputPathForCleanup = outputPath;

    if (!fs.existsSync(path.dirname(path.join(process.cwd(), outputPath)))) fs.mkdirSync(path.dirname(path.join(process.cwd(), outputPath)), { recursive: true });
    if (!fs.existsSync(path.dirname(path.join(process.cwd(), tempPath)))) fs.mkdirSync(path.dirname(path.join(process.cwd(), tempPath)), { recursive: true });

    logger.info('Starting enhanced auto-edit', { videoId, options: editingOptions });

    // Check for FFmpeg/FFprobe availability
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      execSync('ffprobe -version', { stdio: 'ignore' });
    } catch (err) {
      logger.error('FFmpeg/FFprobe not found in system PATH');
      throw new Error('FFmpeg is not installed on this system. Please install it using "brew install ffmpeg" to enable AI video editing.');
    }

    // Emit progress via socket if available
    const emitProgress = (stage, percent, message) => {
      if (userId) {
        const io = getSocketService();
        if (io) {
          try {
            io.to(`user-${userId}`).emit('video:edit:progress', {
              videoId,
              stage,
              percent,
              message,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            logger.warn('Failed to emit progress', { error: err.message });
          }
        }
      }
    };

    emitProgress('analysis', 5, 'Analyzing video...');

    // Get video metadata
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    // `metadata.format` can be absent on malformed inputs even when ffprobe
    // doesn't error outright. Default both the container and duration so we
    // never throw a raw TypeError here, and clamp duration to a small positive
    // floor so downstream `t/duration` progress-bar / reduction math can never
    // divide by zero (which would emit NaN/Infinity into the filtergraph).
    const probedDuration = Number(metadata?.format?.duration) || 0;
    let duration = probedDuration > 0 ? probedDuration : 0;
    if (!(duration > 0)) {
      // Fall back to any duration we already know about (DB record) before
      // giving up — keeps short/streamed inputs editable.
      duration = Number(content.originalFile?.duration) || 0;
    }
    if (!(duration > 0)) {
      throw new Error('Could not determine the video duration. The file may be corrupt — please re-upload and try again.');
    }
    let globalTimeOffset = 0;
    let globalDuration = duration;
    let transcript = content.captions?.text || (typeof content.transcript === 'string' ? content.transcript : content.transcript?.text) || content.metadata?.transcript || null;
    let transcriptWords = content.captions?.words || content.transcript?.words || null;

    // Auto-transcribe when no transcript exists yet. Without this every
    // dev-uploaded video skipped Gemini's smart caption / hook / viral
    // moment paths and fell back to the hardcoded
    // ['WATCH THIS CLOSELY','INSANE VALUE'] strings — that's the
    // "edits aren't really AI" complaint. transcribeVideo uses
    // json2video as primary, Gemini fallback (both already wired
    // earlier in this conversation). Best-effort: a transcription
    // failure must not block the auto-edit; we just lose smart
    // captions and fall through to the legacy pattern path.
    if (!transcript) {
      try {
        emitProgress('transcribing', 8, 'Transcribing audio for captions + hooks...');
        const aiTranscription = require('./aiTranscriptionService');
        if (aiTranscription.isTranscriptionConfigured()) {
          const sourceForTx = content.originalFile?.url?.startsWith('/')
            ? path.join(__dirname, '../..', content.originalFile.url)
            : content.originalFile?.url;
          if (sourceForTx) {
            const t0 = Date.now();
            const txResult = await aiTranscription.transcribeVideo(
              userId || 'unknown',
              videoId,
              sourceForTx,
              { language: editingOptions.targetLang || 'auto' }
            );
            if (txResult?.text) {
              transcript = txResult.text;
              transcriptWords = txResult.words || null;
              logger.info('Transcription generated for auto-edit', {
                videoId,
                provider: txResult.provider,
                chars: transcript.length,
                words: transcriptWords?.length || 0,
                ms: Date.now() - t0,
              });
              // Persist onto content so subsequent runs skip retranscription.
              if (!content.metadata) content.metadata = {};
              content.transcript = transcript;
              content.captions = {
                text: transcript,
                words: transcriptWords,
                language: txResult.language,
                generatedAt: new Date()
              };
            }
          }
        } else {
          logger.warn('Transcription provider not configured; skipping (smart captions will fall back)');
        }
      } catch (txErr) {
        logger.warn('Auto-transcription failed; falling back to non-transcript caption path', { error: txErr.message });
      }
    }

    const audioLevels = content.metadata?.audioLevels || [];
    const platform = editingOptions.platform || 'all';

    // Calculate quality score
    const qualityScore = calculateQualityScore(metadata, transcript, audioLevels, duration);
    logger.info('Video quality score calculated', { videoId, score: qualityScore });

    // Tracking arrays for edits and filters
    const videoFilters = [];
    const audioFilters = [];
    const appliedEdits = [];
    const creativeFeatures = [];

    let smartCaptions = null;
    let repetitivePhrases = [];
    let selectedMusic = null;

    // 🚀 Neural Speed Ramping (Consolidated to dynamic final phase to prevent conflicts)

    // Get platform optimizations
    const platformOpts = getPlatformOptimizations(platform);

    // PHASE 0: 2026 AUTONOMOUS PRE-FLIGHT ORCHESTRATION
    // This step completely removes the need for user input by autonomously deducing
    // the optimal pacing, style, and effects based on the video's actual semantic content.
    if (transcript && geminiConfigured && enableSmartCaptions) {
      emitProgress('analysis', 8, 'Autonomous AI analyzing content profile...');
      try {
        // Build a context block listing every dimension the user has explicitly
        // set so the AI can choose the remaining free dimensions to COMPLEMENT them.
        const userChoiceLines = [
          editingOptions.pacingIntensity
            ? `- Pacing: "${editingOptions.pacingIntensity}" (user-set)` : null,
          (editingOptions.captionStyle && editingOptions.captionStyle !== 'modern')
            ? `- Caption style: "${editingOptions.captionStyle}" (user-set)` : null,
          (editingOptions.musicGenre && editingOptions.musicGenre !== 'auto')
            ? `- Music genre: "${editingOptions.musicGenre}" (user-set, do not override)` : null,
          (editingOptions.colorGrade && editingOptions.colorGrade !== 'auto')
            ? `- Color grade: "${editingOptions.colorGrade}" (user-set)` : null,
          (editingOptions.hookStyle && editingOptions.hookStyle !== 'auto')
            ? `- Hook style: "${editingOptions.hookStyle}" (user-set)` : null,
          (editingOptions.voiceTone && editingOptions.voiceTone !== 'auto')
            ? `- Voice tone: "${editingOptions.voiceTone}" (user-set)` : null,
          (editingOptions.transitionStyle && editingOptions.transitionStyle !== 'auto')
            ? `- Transitions: "${editingOptions.transitionStyle}" (user-set)` : null,
          (editingOptions.contentTone && editingOptions.contentTone !== 'auto')
            ? `- Content tone: "${editingOptions.contentTone}" (user-set — pick pacing, captions, and music that reinforce this)` : null,
          (Array.isArray(editingOptions.stylePresetIds) && editingOptions.stylePresetIds.length)
            ? `- Style presets: ${editingOptions.stylePresetIds.join(', ')} (user-set)` : null,
          (editingOptions.brollFrequency && editingOptions.brollFrequency !== 'balanced')
            ? `- B-roll frequency: "${editingOptions.brollFrequency}" (user-set)` : null,
          (editingOptions.ctaStyle && editingOptions.ctaStyle !== 'auto')
            ? `- CTA style: "${editingOptions.ctaStyle}" (user-set)` : null,
          (editingOptions.subtitlePosition && editingOptions.subtitlePosition !== 'auto')
            ? `- Subtitle position: "${editingOptions.subtitlePosition}" (user-set)` : null,
          editingOptions.prioritizeHook
            ? `- Hook priority: MAXIMUM (user explicitly wants scroll-stopping opener)` : null,
          (editingOptions.speedRamping === false)
            ? `- Speed ramping: DISABLED (user-set, do not suggest speed ramps)` : null,
        ].filter(Boolean);
        const userChoicesBlock = userChoiceLines.length
          ? `\n\nThe user has already made these creative choices — your free dimensions must COMPLEMENT them, not contradict:\n${userChoiceLines.join('\n')}\n`
          : '';
        const contentToneGuidance = {
          educational:   'Prefer stat-reveal or counterintuitive-fact hooks. Use calm-authority pacing (medium). Captions should surface key insights. Music: lofi or cinematic.',
          entertaining:  'Prefer curiosity-gap or pattern-break hooks. Use fast, punchy pacing (aggressive). Captions should be playful and emoji-forward. Music: upbeat_pop or breakcore.',
          motivational:  'Prefer bold-claim or transformation hooks. Use rising-energy pacing (aggressive). Captions should be inspirational one-liners. Music: synthwave or cinematic.',
          promotional:   'Prefer social-proof or urgency hooks. Use medium pacing with strong CTA captions. Music: upbeat_pop or phonk.',
        };
        const contentToneBlock = (contentTone && contentTone !== 'auto' && contentToneGuidance[contentTone])
          ? `\n\nCONTENT TONE DIRECTIVE (user-chosen: "${contentTone}"): ${contentToneGuidance[contentTone]}\n`
          : '';
        const userDirectionBlock = customInstructions
          ? `\n\nCRITICAL USER CREATIVE DIRECTION (MUST FOLLOW):\n"${customInstructions}"\nEnsure every decision respects and amplifies this creative intent.\n`
          : '';
        const platformContext = (editingOptions.platform && editingOptions.platform !== 'auto' && editingOptions.platform !== 'all')
          ? `\nTARGET PLATFORM: ${editingOptions.platform} — tailor pacing, caption style, hook length, and CTA copy to native platform conventions.`
          : '';
        const nicheContext = editingOptions.niche
          ? `\nCREATOR NICHE: "${editingOptions.niche}" — all creative choices should resonate with this niche's audience expectations and vocabulary.`
          : '';
        const preFlightPrompt = `You are Click's Autonomous Video Architect (2026 Edition).
Analyze this transcript and autonomously decide the PERFECT editing configuration. Override standard presets to maximize retention and virality.
CRITICAL: ENSURE EXTREME AESTHETIC DIVERSITY. Do not repeatedly select the same options across different videos. Pick highly creative, distinct visual themes.${platformContext}${nicheContext}${userChoicesBlock}${contentToneBlock}${userDirectionBlock}

Return ONLY valid JSON (no markdown, no extra text):
{
  "pacingIntensity": "aggressive|medium|slow",
  "captionStyle": "tiktok|bold|outline|modern|professional|cyberpunk|vintage",
  "hookStyle": "curiosity-gap|question|stat|mystery|story|bold-claim|pattern-break",
  "transitionStyle": "fast-cut|crossfade|glitch|whip-pan|hard-cut",
  "voiceTone": "energetic|calm|authoritative|playful|serious",
  "brollFrequency": "off|minimal|balanced|heavy",
  "ctaStyle": "question|urgency|value|curiosity",
  "enableAutoZoom": true|false,
  "enableColorGrading": true|false,
  "visualTheme": "cyberpunk_neon|vintage_film|high_contrast_luma|dreamy_pastel|hyper_pop",
  "musicGenre": "phonk|lofi|dark_ambient|synthwave|upbeat_pop|cinematic|breakcore",
  "viralExtraction": {
    "shouldExtract": true|false,
    "startTime": 0.0,
    "endTime": 60.0
  },
  "reasoning": "Explain why you chose this exact configuration for this specific video"
}

Transcript: "${transcript.substring(0, 3500)}"`;

        const rawPreflight = await geminiGenerate(preFlightPrompt, { temperature: 0.3, maxTokens: 600 });
        const preflightData = parseGeminiJson(rawPreflight) || {};

        // Honor user "locked" preferences from editorState. The previous
        // version unconditionally overrode every setting from the AI's
        // pre-flight — so a creator who explicitly picked "minimal"
        // captions or "gentle" pacing would still get whatever the AI
        // decided. `editorState.lockedPreferences` is the opt-in escape
        // hatch: any key in there pins the user's choice. We also accept
        // top-level `userLocked*` flags for backwards compat with older
        // clients that may not nest preferences.
        // Merge explicit user locks with auto-detected locks: any dimension the
        // user has set to a non-default value is treated as locked so the pre-flight
        // AI cannot silently override their creative direction.
        const locked = {
          ...(editingOptions?.editorState?.lockedPreferences || editingOptions?.lockedPreferences || {}),
          ...(editingOptions.pacingIntensity ? { pacingIntensity: true } : {}),
          ...(editingOptions.captionStyle && editingOptions.captionStyle !== 'modern' ? { captionStyle: true } : {}),
          ...(editingOptions.musicGenre && editingOptions.musicGenre !== 'auto' ? { musicGenre: true } : {}),
          ...(editingOptions.colorGrade && editingOptions.colorGrade !== 'auto' ? { colorGrade: true } : {}),
          ...(editingOptions.visualTheme ? { visualTheme: true } : {}),
          ...(editingOptions.hookStyle && editingOptions.hookStyle !== 'auto' ? { hookStyle: true } : {}),
          ...(editingOptions.transitionStyle && editingOptions.transitionStyle !== 'auto' ? { transitionStyle: true } : {}),
          ...(editingOptions.voiceTone && editingOptions.voiceTone !== 'auto' ? { voiceTone: true } : {}),
          ...(editingOptions.brollFrequency && editingOptions.brollFrequency !== 'balanced' ? { brollFrequency: true } : {}),
          ...(editingOptions.ctaStyle && editingOptions.ctaStyle !== 'auto' ? { ctaStyle: true } : {}),
        };
        // Enum whitelists prevent garbage AI output from corrupting pipeline state.
        const VALID = {
          pacingIntensity:  new Set(['aggressive', 'medium', 'slow']),
          captionStyle:     new Set(['tiktok', 'bold', 'outline', 'modern', 'professional', 'cyberpunk', 'vintage']),
          hookStyle:        new Set(['curiosity-gap', 'question', 'stat', 'mystery', 'story', 'bold-claim', 'pattern-break']),
          transitionStyle:  new Set(['fast-cut', 'crossfade', 'glitch', 'whip-pan', 'hard-cut']),
          voiceTone:        new Set(['energetic', 'calm', 'authoritative', 'playful', 'serious']),
          brollFrequency:   new Set(['off', 'minimal', 'balanced', 'heavy']),
          ctaStyle:         new Set(['question', 'urgency', 'value', 'curiosity']),
          visualTheme:      new Set(['cyberpunk_neon', 'vintage_film', 'high_contrast_luma', 'dreamy_pastel', 'hyper_pop']),
        };
        const valid = (key, val) => val && VALID[key] && VALID[key].has(val);

        if (valid('pacingIntensity', preflightData.pacingIntensity) && !locked.pacingIntensity) pacingIntensity = preflightData.pacingIntensity;
        if (valid('captionStyle', preflightData.captionStyle) && !locked.captionStyle) captionStyle = preflightData.captionStyle;
        if (preflightData.enableAutoZoom !== undefined && !locked.enableAutoZoom) enableAutoZoom = preflightData.enableAutoZoom;
        if (preflightData.enableColorGrading !== undefined && !locked.enableColorGrading) enableColorGrading = preflightData.enableColorGrading;
        if (valid('hookStyle', preflightData.hookStyle) && !locked.hookStyle) preferredHookStyle = preflightData.hookStyle;
        if (valid('transitionStyle', preflightData.transitionStyle) && !locked.transitionStyle) aestheticTransition = preflightData.transitionStyle;
        if (valid('voiceTone', preflightData.voiceTone) && !locked.voiceTone) preferredVoiceTone = preflightData.voiceTone;
        if (valid('brollFrequency', preflightData.brollFrequency) && !locked.brollFrequency) editingOptions.brollFrequency = preflightData.brollFrequency;
        if (valid('ctaStyle', preflightData.ctaStyle) && !locked.ctaStyle) editingOptions.ctaStyle = preflightData.ctaStyle;
        // Apply AI-suggested color grade only if the user hasn't locked a choice.
        // Map visual theme names to aestheticColorGrade so the FFmpeg filter switch picks them up.
        if (valid('visualTheme', preflightData.visualTheme) && !locked.colorGrade && !aestheticColorGrade) {
          aestheticColorGrade = preflightData.visualTheme;
        }
        // Surface which keys were locked so the response payload can show
        // the user that their picks survived the AI pass.
        if (Object.keys(locked).length > 0) {
          appliedEdits.push(`User-locked preferences honored: ${Object.keys(locked).join(', ')}`);
        }
        
        // OpusClip-Level Autonomous Viral Extraction
        if (preflightData.viralExtraction && preflightData.viralExtraction.shouldExtract && duration > 90) {
          const vStart = Number(preflightData.viralExtraction.startTime) || 0;
          const vEnd = Number(preflightData.viralExtraction.endTime) || duration;
          if (vEnd - vStart >= 15 && vEnd - vStart <= 180) { // Keep clips between 15s and 3m
            globalTimeOffset = vStart;
            globalDuration = vEnd - vStart;
            duration = globalDuration; // Update main duration for pacing logic
            logger.info('Autonomous Viral Extraction Activated', { start: globalTimeOffset, duration: globalDuration });
            appliedEdits.push(`Viral Clip Extracted (${globalDuration.toFixed(1)}s Golden Hook)`);
            creativeFeatures.push('Autonomous Cropping');
          }
        }

        // Hold the AI-picked genre in this request's closure so parallel
        // auto-edits don't share state. The variable is declared higher
        // up in autoEditVideo's scope.
        if (!locked.musicGenre && preflightData.musicGenre) {
          requestMusicGenre = preflightData.musicGenre;
        }
        if (!locked.visualTheme && preflightData.visualTheme) {
          requestVisualTheme = preflightData.visualTheme;
        }

        logger.info('Autonomous Pre-Flight Orchestration Applied', { overrides: preflightData });
        appliedEdits.push(`Autonomous Override: ${preflightData.reasoning || 'AI selected optimal pacing and style'}`);
        creativeFeatures.push('Autonomous Architecture');
      } catch (err) {
        logger.warn('Pre-flight analysis failed, proceeding with standard options', { error: err.message, videoId });
      }
    }

    // Auto-select music if enabled
    if (enableMusicAutoSelect) {
      emitProgress('music-selection', 9, 'Selecting background music...');
      // Will select after sentiment analysis
    }

    // Parallel processing for faster analysis
    logger.info('Starting parallel analysis', { videoId });
    emitProgress('analysis', 10, 'Detecting key moments and analyzing content...');
    const [keyMomentsResult, sentimentResult, beatsResult, faceMomentsResult] = await processInParallel([
      async () => {
        if (transcript || audioLevels.length > 0) {
          const moments = await detectKeyMoments(transcript, duration, audioLevels, preferredVoiceTone, preferredHookStyle, contentTone !== 'auto' ? contentTone : null, editingOptions.platform || null, editingOptions.niche || null, userId);
          const overlays = enableTextOverlays && transcript
            ? generateTextOverlaySuggestions(transcript, moments, duration)
            : [];
          return { moments, overlays };
        }
        return { moments: {}, overlays: [] };
      },
      async () => transcript ? await analyzeSentimentAndEmotions(transcript) : null,
      async () => editingOptions.enableBeatSync ? await detectBeats(inputPath) : [],
      async () => enableAutoZoom ? await detectFaceMoments(inputPath, duration) : [],
    ], 4);

    // processInParallel() resolves a failed task to `null` (it swallows the
    // error and logs it), so keyMomentsResult can be null here. Use optional
    // chaining so a key-moment analysis failure degrades to empty moments
    // instead of throwing "Cannot read properties of null" and aborting the
    // whole edit.
    const keyMoments = keyMomentsResult?.moments || {};
    let textOverlays = keyMomentsResult?.overlays || [];
    let faceMoments = faceMomentsResult || [];
    const sentiment = sentimentResult;
    const beats = beatsResult || [];

    // Fallback AI Creative Injection — niche/sentiment aware
    // If Gemini gave us captions, use those instead of generic fallbacks
    const geminiCaptionsFallback = keyMoments?.suggestedCaptions || [];
    if (enableTextOverlays && textOverlays.length === 0) {
      if (geminiCaptionsFallback.length > 0) {
        // Pull overlays from Gemini's suggestion directly
        textOverlays = geminiCaptionsFallback.slice(0, 3).map(c => ({
          type: c.style === 'hook' ? 'hook' : 'highlight',
          text: c.text,
          startTime: c.startTime ?? 0,
          endTime: c.endTime ?? Math.min((c.startTime ?? 0) + 3, duration),
          size: 64,
          color: '#FFD700',
          position: 'bottom',
        }));
      } else {
        // Sentiment-aware diverse fallback hooks
        const energy = sentiment?.energyLevel || 5;
        const highEnergyHooks = ['LET’S GO 🔥', 'MIND BLOWN 🤯', 'POV: YOU WON 🏆', 'WTF JUST HAPPENED'];
        const midEnergyHooks = ['WAIT FOR IT', 'WATCH THIS', 'SECRET REVEALED 🤫', 'PRO TIP 💡'];
        const hookWord = energy >= 7 
          ? highEnergyHooks[Math.floor(Math.random() * highEnergyHooks.length)] 
          : midEnergyHooks[Math.floor(Math.random() * midEnergyHooks.length)];
          
        const highEnergyMids = ['INSANE 🤯', 'UNREAL 🔥', '100% REAL', 'CRAZY RIGHT?'];
        const midEnergyMids = ['MIND BLOWN 🤯', 'WOW', 'INTERESTING', 'TAKE NOTES ✍️'];
        const midWord = energy >= 7 
          ? highEnergyMids[Math.floor(Math.random() * highEnergyMids.length)]
          : midEnergyMids[Math.floor(Math.random() * midEnergyMids.length)];
          
        const creativeColors = ['#FFD700', '#00FFFF', '#FF3366', '#39FF14', '#FFFFFF'];
        const cColor1 = creativeColors[Math.floor(Math.random() * creativeColors.length)];
        const cColor2 = creativeColors[Math.floor(Math.random() * creativeColors.length)];

        textOverlays = [
          { type: 'hook', text: hookWord, startTime: 0, endTime: Math.min(1.5, duration), size: 72, color: cColor1, position: 'center' },
          { type: 'highlight', text: midWord, startTime: duration > 4 ? Math.floor(duration / 2) : duration - 1, endTime: duration > 4 ? Math.floor(duration / 2) + 2 : duration, size: 64, color: cColor2, position: 'bottom' }
        ];
      }
    }
    
    // Gemini captions injection when no transcript available — ensures every video gets AI captions
    if (enableSmartCaptions && !transcript && geminiCaptionsFallback.length > 0 && !smartCaptions) {
      smartCaptions = geminiCaptionsFallback;
      appliedEdits.push('Gemini AI Captions (no-transcript fallback)');
      creativeFeatures.push('AI Captions');
    }

    logger.info('Parallel analysis completed', {
      videoId,
      keyMoments: Object.keys(keyMoments).length,
      textOverlays: textOverlays.length,
      faceMoments: faceMoments.length,
      beats: beats.length,
      sentiment: sentiment?.sentiment || 'unknown'
    });

    // Auto-select music based on sentiment. Pass the request-scoped
    // genre (set by the pre-flight analyzer) so concurrent auto-edits
    // pick independent tracks instead of inheriting whichever one ran
    // most recently process-wide.
    if (enableMusicAutoSelect && sentiment) {
      selectedMusic = await autoSelectMusic(videoId, sentiment, duration, { genre: requestMusicGenre });
      if (selectedMusic) {
        logger.info('Music selected for video', { videoId, musicId: selectedMusic._id });
      }
    }

    // Generate smart captions if enabled
    if (enableSmartCaptions && transcript) {
      emitProgress('captions', 15, 'Generating smart captions...');
      const captionOverrides = editingOptions.captionFontFamily ? { fontFamily: editingOptions.captionFontFamily } : {};
      const targetLang = editingOptions.targetLang || 'en';
      smartCaptions = await generateAndApplySmartCaptions(videoId, transcript, duration, captionStyle, captionOverrides, transcriptWords ? { words: transcriptWords } : null, targetLang);
      if (smartCaptions && smartCaptions.length > 0) {
        appliedEdits.push(`Smart Captions (${smartCaptions.length} lines, ${captionStyle} style, language: ${targetLang})`);
        creativeFeatures.push('Smart Captions');
      }
    } else if (enableSmartCaptions) {
      // Fallback Kinetic Captions
      smartCaptions = [
        { text: 'WATCH THIS CLOSELY', startTime: 0, endTime: Math.min(1.5, duration) },
        { text: 'INSANE VALUE', startTime: duration > 4 ? duration - 2 : duration - 1, endTime: duration }
      ];
      appliedEdits.push(`Kinetic Captions (AI Imputed)`);
      creativeFeatures.push('Smart Captions');
    }

    emitProgress('editing', 20, 'Building edit plan...');

    // 1. Detect silence periods (accurate) - with retry
    emitProgress('editing', 25, 'Detecting silence and pauses...');
    let silencePeriods = [];
    if (removeSilence || removePauses) {
      logger.info('Detecting silence periods', { videoId });
      if (transcriptWords && transcriptWords.length > 0) {
        logger.info('Using transcript-aware segmentation for precise cuts', { videoId, words: transcriptWords.length });
        
        for (let i = 0; i < transcriptWords.length - 1; i++) {
          const w1 = transcriptWords[i];
          const w2 = transcriptWords[i + 1];
          const w1End = w1.end ?? (w1.start + 0.3);
          const w2Start = w2.start ?? (w1End + 0.1);
          
          if (w2Start > w1End) {
            const gapDuration = w2Start - w1End;
            if (gapDuration >= effectiveMinSilence) {
              const safeStart = w1End + 0.05;
              const safeEnd = w2Start - 0.05;
              if (safeEnd > safeStart) {
                silencePeriods.push({ start: safeStart, end: safeEnd, duration: safeEnd - safeStart });
              }
            }
          }
        }
        
        const firstWordStart = transcriptWords[0].start ?? 0;
        if (firstWordStart > effectiveMinSilence) {
          const safeEnd = firstWordStart - 0.05;
          if (safeEnd > 0) {
            silencePeriods.unshift({ start: 0, end: safeEnd, duration: safeEnd });
          }
        }
        
        const lastWord = transcriptWords[transcriptWords.length - 1];
        const lastWordEnd = lastWord.end ?? ((lastWord.start ?? 0) + 0.3);
        if (duration - lastWordEnd > effectiveMinSilence) {
          const safeStart = lastWordEnd + 0.05;
          if (duration > safeStart) {
            silencePeriods.push({ start: safeStart, end: duration, duration: duration - safeStart });
          }
        }
      } else {
        silencePeriods = await retryWithBackoff(
          () => detectSilencePeriods(inputPath, effectiveSilenceThreshold, effectiveMinSilence),
          2
        );
      }

      // Get edit history to avoid repetitive cuts
      const editHistory = await getEditHistory(videoId);
      const recentCuts = editHistory.cuts || [];

      // Filter out recently cut areas (within 2 seconds)
      silencePeriods = silencePeriods.filter(silence => {
        return !recentCuts.some(cut =>
          Math.abs(cut.time - silence.start) < 2
        );
      });

      logger.info('Silence periods detected', { videoId, count: silencePeriods.length });
    }

    // 2. Detect scene changes (precise: optional multi-modal or FFmpeg with configurable threshold)
    emitProgress('editing', 35, 'Detecting scene changes...');
    let sceneChanges = [];
    if (addTransitions || optimizePacing) {
      logger.info('Detecting scene changes', { videoId, useMultiModalScenes, sceneThreshold });
      try {
        if (useMultiModalScenes) {
          const multiModal = require('./multiModalSceneDetection');
          const finalScenes = await multiModal.detectScenesMultiModal(inputPath, {
            sensitivity: sceneThreshold,
            minSceneLength,
            workflowType: effectiveWorkflow,
            mergeShortScenes: true,
            shortSceneThreshold: 2.0,
          });
          // finalScenes = [{ start, end }, ...]; boundaries are end of each scene (except last)
          sceneChanges = Array.isArray(finalScenes)
            ? finalScenes.slice(0, -1).map((s) => s.end).filter((t) => typeof t === 'number').sort((a, b) => a - b)
            : [];
        } else {
          sceneChanges = await retryWithBackoff(
            () => detectSceneChanges(inputPath, sceneThreshold),
            2
          );
          if (minSceneLength > 0 && sceneChanges.length > 1) {
            const filtered = [sceneChanges[0]];
            for (let i = 1; i < sceneChanges.length; i++) {
              if (sceneChanges[i] - filtered[filtered.length - 1] >= minSceneLength) {
                filtered.push(sceneChanges[i]);
              }
            }
            sceneChanges = filtered;
          }
        }
      } catch (multiErr) {
        logger.warn('Multi-modal scene detection failed, using FFmpeg', { error: multiErr.message });
        sceneChanges = await retryWithBackoff(() => detectSceneChanges(inputPath, sceneThreshold), 2);
      }
      logger.info('Scene changes detected', { videoId, count: sceneChanges.length });
    }

    // 3. Analyze transcript for repetition
    if (transcript) {
      if (optimizePacing) {
        logger.info('Analyzing transcript for repetition', { videoId });
        repetitivePhrases = analyzeTranscriptForRepetition(transcript);
        logger.info('Repetitive phrases found', { videoId, count: repetitivePhrases.length });
      }

      // 🛸 Phase 14: Neural B-Roll Intelligence
      const brollFreq = editingOptions.brollFrequency || 'balanced';
      if (editingOptions.enableBRoll !== false && brollFreq !== 'off') {
        try {
          emitProgress('b-roll', 28, 'Orchestrating AI B-roll variety...');
          bRollPlan = await bRollIntelligenceService.orchestrateBRoll(videoId, { segments: content.captions?.segments || [] });
          if (bRollPlan.length > 0) {
            content.metadata = { ...content.metadata, bRollPlan };
            await commitContent(content);
          }
        } catch (bErr) {
          logger.warn('B-Roll orchestration failed', { error: bErr.message });
        }
      }

      // 🛍️ Phase 15: Neural Commerce Layer (Autonomous Inlays) — opt-in only
      if (editingOptions.enableCommerceInlays === true) {
        logger.info('Analyzing transcript for Commerce Inlays', { videoId });
        emitProgress('commerce', 32, 'Scanning for Authority Moments and Product CTAs...');
        
        // Autonomously detect high-authority moment for product injection
        // If there's a transcript, we would semantically match keywords. For now, inject at optimal retention drop-off (mid-point).
        const optimalInjectionTime = Math.min(12, duration * 0.4);
        
        commerceInlays.push({
          time: optimalInjectionTime,
          type: 'product_inlay',
          product: 'Sovereign Hoodie',
          price: '$85.00',
          duration: 5.5,
          animation: editingOptions.commerceDisplayMode || 'glassmorphic_card'
        });
        
        content.metadata = { ...content.metadata, commerceInlays };
        try {
          await commitContent(content);
        } catch (cErr) {
          // commitContent might not be available if not required, but assuming it is since b-roll uses it
        }
        creativeFeatures.push('Neural Commerce Inlays');
      }
    }

    // Sync cuts to beats if available
    if (beats.length > 0 && editingOptions.enableBeatSync) {
      logger.info('Syncing cuts to beats', { videoId, beats: beats.length });
      // Adjust silence periods to align with nearest beats
      silencePeriods = silencePeriods.map(silence => {
        const nearestBeat = beats.reduce((prev, curr) =>
          Math.abs(curr - silence.start) < Math.abs(prev - silence.start) ? curr : prev
        );
        if (Math.abs(nearestBeat - silence.start) < 0.5) {
          return { ...silence, start: nearestBeat, syncedToBeat: true };
        }
        return silence;
      });
    }

    // 4. Build intelligent edit plan with creative & quality features

    // Phase 1: Normalization & 2026 Vertical Shielding (Auto-Handling for Horizontal Footage)
    // Note: Vertical Shielding uses sub-labels; it must be the FIRST filter so the initial label [0:v] is consumed.
    // All subsequent filters chain from the output of this first step.
    const isHorizontal = metadata.streams && metadata.streams.find(s => s.codec_type === 'video') 
      ? (metadata.streams.find(s => s.codec_type === 'video').width > metadata.streams.find(s => s.codec_type === 'video').height)
      : false;

    if (isHorizontal) {
      // For horizontal footage: create blurred-background vertical canvas
      // This is a complete sub-graph; its output label is 'v_shield'
      videoFilters.push('split[bg_s][fg_s];[bg_s]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:10[bg_out];[fg_s]scale=-1:1920[fg_out];[bg_out][fg_out]overlay=(W-w)/2:(H-h)/2,format=yuv420p');
      appliedEdits.push('Vertical Shielding (9:16 Optimization)');
    } else {
      // For vertical footage: apply Dynamic Cameraman Drift (Organic Breathing)
      // Uses non-repeating Lissajous curves + detected face region for subject-biased drift.
      let faceX = 0.5, faceY = 0.4;
      if (enableAutoZoom) {
        try {
          const region = await saliencyService.detectActiveRegion(inputPath);
          faceX = region.x;
          faceY = region.y;
          logger.info('Active region detected', { videoId, faceX: faceX.toFixed(2), faceY: faceY.toFixed(2), method: region.method });
        } catch (_) { /* heuristic fallback */ }
      }
      const driftX = `(iw-1080)/2+${Math.round((faceX - 0.5) * 80)}+25*sin(t/3.14)+10*sin(t/5.2)`;
      const driftY = `(ih-1920)/2+${Math.round((faceY - 0.4) * 120)}+15*cos(t/2.71)+8*cos(t/4.5)`;
      videoFilters.push(`scale=1150:2044:force_original_aspect_ratio=increase,crop=1080:1920:x='${driftX}':y='${driftY}',format=yuv420p`);
      appliedEdits.push('Dynamic Cameraman Drift');
      creativeFeatures.push('AI Cameraman Tracking');
    }

    // Quality: 2026 Diverse Color Grades
    if (enableColorGrading) {
      let avoidedThemes = [];
      if (userId) {
        try {
          const SuggestionHistory = require('../models/SuggestionHistory');
          const recentHistory = await SuggestionHistory.find({ 
            userId, 
            kind: 'auto-edit-theme' 
          })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();
          avoidedThemes = recentHistory.map(h => h.label).filter(Boolean);
        } catch (err) {
          logger.warn('Failed to fetch recent auto-edit themes', { error: err.message });
        }
      }

      const themes = ['cyberpunk_neon', 'vintage_film', 'high_contrast_luma', 'dreamy_pastel', 'hyper_pop', 'bw'];
      let availableThemes = themes.filter(t => !avoidedThemes.includes(t));
      if (availableThemes.length === 0) availableThemes = themes;

      let chosenTheme = null;

      // 🧠 creator-dna performance biasing
      if (userId && !aestheticColorGrade && !requestVisualTheme) {
        try {
          const UserStyleProfile = require('../models/UserStyleProfile');
          const profile = await UserStyleProfile.findOne({ userId });
          if (profile && profile.weightedColorGrades && profile.weightedColorGrades.length > 0) {
            // Retrieve top performing grades that are NOT avoided
            const topPerformers = profile.topPerformers('weightedColorGrades', 5)
              .map(p => p.key)
              .filter(key => availableThemes.includes(key));
            
            if (topPerformers.length > 0) {
              // 70% chance to pick their top performer, 30% chance to keep it fresh
              if (Math.random() < 0.70) {
                chosenTheme = topPerformers[0];
                logger.info('🧠 Personalization Bias: Selected top-performing visual theme', { chosenTheme });
              }
            }
          }
        } catch (profileError) {
          logger.warn('Failed to bias visual theme selection using style profile', { error: profileError.message });
        }
      }

      const theme = aestheticColorGrade || requestVisualTheme || chosenTheme || availableThemes[Math.floor(Math.random() * availableThemes.length)];

      if (userId && !aestheticColorGrade && !requestVisualTheme) {
        try {
          const SuggestionHistory = require('../models/SuggestionHistory');
          await SuggestionHistory.create({
            userId,
            kind: 'auto-edit-theme',
            label: theme
          });
        } catch (err) {
          logger.warn('Failed to save selected theme to SuggestionHistory', { error: err.message });
        }
      }
      if (theme === 'cyberpunk_neon') {
        videoFilters.push('eq=contrast=1.2:brightness=0.01:saturation=1.4:gamma_b=1.2:gamma_g=0.9');
        appliedEdits.push('Cyberpunk Neon Grade');
      } else if (theme === 'vintage_film') {
        videoFilters.push('eq=contrast=0.95:brightness=0.05:saturation=0.8:gamma_r=1.1');
        appliedEdits.push('Vintage Film Grade');
      } else if (theme === 'dreamy_pastel') {
        videoFilters.push('eq=contrast=0.9:brightness=0.08:saturation=1.1:gamma=1.1');
        appliedEdits.push('Dreamy Pastel Grade');
      } else if (theme === 'hyper_pop') {
        videoFilters.push('eq=contrast=1.25:brightness=0.03:saturation=1.5');
        appliedEdits.push('Hyper Pop Grade');
      } else if (theme === 'bw') {
        videoFilters.push('hue=s=0,eq=contrast=1.2:brightness=0.02');
        appliedEdits.push('Black & White Grade');
      } else {
        videoFilters.push('eq=contrast=1.15:brightness=0.02:saturation=1.25');
        appliedEdits.push('Luma-Cinematic Grade');
      }
    }

    // Build cut filter only when pacing speed-ramp is OFF.
    // When optimizePacing=true the speed-ramp pipeline handles silences by
    // accelerating through them (1.15x). Applying the select-based cut filter
    // on top of the speed-ramp's trim+concat chain produces wrong timestamps
    // because select resets PTS before the trim segments can operate on them.
    if (!optimizePacing && (silencePeriods.length > 0 || sceneChanges.length > 0)) {
      const cuts = buildCutFilter(silencePeriods, sceneChanges, duration);
      if (cuts && cuts.videoFilter && cuts.audioFilter) {
        videoFilters.push(cuts.videoFilter);
        audioFilters.push(cuts.audioFilter);
        appliedEdits.push('Precise Cut Removal');
      } else {
        // buildCutFilter returns null when it resolves to 0 (or 1) keep-segments
        // — i.e. there is nothing to actually cut. Never push an empty
        // select=''/aselect='' (ffmpeg silently drops or errors on it) and
        // don't claim "Precise Cut Removal" when no cut was applied.
        logger.warn('Silence/scene cut produced no keep-segments; skipping cut filter', {
          videoId, silenceCount: silencePeriods.length, sceneCount: sceneChanges.length,
        });
      }
    }

    // Premium audio: clean voice first, then mix for mobile (short-form = phone speakers)
    const isShortForm = clipTargetLength === 'short' || (Array.isArray(aspectFormats) && aspectFormats.includes('9:16'));
    const targetLUFS = isShortForm ? -14 : -16; // -14 LUFS = mobile/short-form friendly

    // Quality: Audio enhancement (clean voice, tame harsh, mobile-friendly level)
    if (enhanceAudio) {
      audioFilters.push(`loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`);
      audioFilters.push('highpass=f=80,lowpass=f=15000');
      // Gentle cut ~4kHz to tame harshness so voice stays clear, not brittle
      audioFilters.push('equalizer=f=4000:width_type=o:width=1:g=-1.2');
      appliedEdits.push(isShortForm ? 'Audio Enhancement (mobile mix)' : 'Audio Enhancement');
    }

    // Quality: Noise reduction — spectral denoising only; no frequency cuts here
    // so that a 3 kHz lowpass doesn't destroy voice clarity above that range.
    if (enableNoiseReduction) {
      audioFilters.push('afftdn=nr=10:nf=-25');
      appliedEdits.push('Noise Reduction');
    }

    // Resample to guarantee encoder compatibility; loudnorm already applied above.
    audioFilters.push('aresample=44100');

    // Creative: Cinematic Sub-Bass Boom on key impacts
    const bassBoomChain = generateSubBassBoomFilter(keyMoments?.reactions || [], duration);
    if (bassBoomChain) {
      audioFilters.push(bassBoomChain);
      creativeFeatures.push('Cinematic Sub-Bass Boom');
    }

    // Creative: Cinematic Vacuum Drop (Mute before impact to build tension)
    const vacuumDropChain = generateVacuumDropFilter(keyMoments?.reactions || []);
    if (vacuumDropChain) {
      audioFilters.push(vacuumDropChain);
      creativeFeatures.push('Audio Vacuum Drop');
      appliedEdits.push('Cinematic Silence Cut');
    }

    // Creative: Telephone Voice Effect (EQ shift on secret/conspiracy moments)
    const telephoneChain = generateSecretTelephoneFilter(keyMoments?.reactions || [], duration);
    if (telephoneChain) {
      audioFilters.push(telephoneChain);
      creativeFeatures.push('Telephone Voice EQ');
      appliedEdits.push('Thematic Audio EQ');
    }

    // Audio ducking is handled post-render during music mixing to prevent muting the voice track.
    if (enableAudioDucking && transcript) {
      creativeFeatures.push('Audio Ducking (Post-Mix)');
      appliedEdits.push('Smart Audio Ducking');
    }

    // 5. Build dynamic pacing speed ramps (Neural Speed Ramping - 2026 Premium Edition)
    if (optimizePacing) {
      const defaultBaseVelocity = pacingIntensity === 'aggressive' ? 1.08 : pacingIntensity === 'gentle' ? 1.0 : 1.04;
      const baseVelocity = (typeof speedMultiplierDialogue === 'number' && speedMultiplierDialogue > 0)
        ? speedMultiplierDialogue
        : defaultBaseVelocity;

      const hasAudio = metadata.streams && metadata.streams.some(s => s.codec_type === 'audio');
      
      const punchlines = keyMoments?.reactions || [];
      const pauses = silencePeriods || [];
      const boundaries = new Set([0, duration]);
      
      // Punchline intervals: 1.5s centered around reaction times, speed = 0.95 (decelerate for focus)
      const punchlineIntervals = [];
      punchlines.forEach(p => {
        const peak = p.time;
        if (typeof peak === 'number' && !isNaN(peak)) {
          const start = Math.max(0, peak - 0.5);
          const end = Math.min(duration, peak + 1.0);
          if (end > start + 0.1) {
            punchlineIntervals.push({ start, end, speed: 0.95, priority: 2 });
            boundaries.add(start);
            boundaries.add(end);
          }
        }
      });
      
      // Pause intervals: speed = speedMultiplierSilence or default 1.15 (accelerate fillers)
      const silenceSpeed = (typeof speedMultiplierSilence === 'number' && speedMultiplierSilence > 0)
        ? speedMultiplierSilence
        : 1.15;

      const pauseIntervals = [];
      pauses.forEach(s => {
        if (typeof s.start === 'number' && typeof s.end === 'number') {
          const start = Math.max(0, s.start);
          const end = Math.min(duration, s.end);
          if (end > start + 0.1) {
            pauseIntervals.push({ start, end, speed: silenceSpeed, priority: 1 });
            boundaries.add(start);
            boundaries.add(end);
          }
        }
      });
      
      const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
      const rawSegments = [];
      for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const start = sortedBoundaries[i];
        const end = sortedBoundaries[i + 1];
        const mid = (start + end) / 2;
        
        let speed = baseVelocity;
        let highestPriority = 0;
        
        punchlineIntervals.forEach(inv => {
          if (mid >= inv.start && mid <= inv.end) {
            if (inv.priority > highestPriority) {
              highestPriority = inv.priority;
              speed = inv.speed;
            }
          }
        });
        
        pauseIntervals.forEach(inv => {
          if (mid >= inv.start && mid <= inv.end) {
            if (inv.priority > highestPriority) {
              highestPriority = inv.priority;
              speed = inv.speed;
            }
          }
        });
        
        rawSegments.push({ start, end, speed });
      }
      
      // Merge adjacent segments with identical speeds
      const pacingSegments = [];
      if (rawSegments.length > 0) {
        let current = { ...rawSegments[0] };
        for (let i = 1; i < rawSegments.length; i++) {
          if (Math.abs(rawSegments[i].speed - current.speed) < 0.001) {
            current.end = rawSegments[i].end;
          } else {
            pacingSegments.push(current);
            current = { ...rawSegments[i] };
          }
        }
        pacingSegments.push(current);
      }
      
      // Exclude sub-0.05s intervals to protect FFmpeg execution
      const finalSegments = pacingSegments.filter(s => (s.end - s.start) >= 0.05);
      
      if (finalSegments.length > 1) {
        // Render Video split-trim-concat chain
        const splitLabels = finalSegments.map((_, idx) => `[vseg${idx}]`);
        const trimLabels = finalSegments.map((_, idx) => `[vtrim${idx}]`);
        
        let videoSpeedFilter = `split=${finalSegments.length}${splitLabels.join('')}; `;
        finalSegments.forEach((seg, idx) => {
          videoSpeedFilter += `[vseg${idx}]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS,setpts=PTS/${seg.speed}[vtrim${idx}]; `;
        });
        videoSpeedFilter += `${trimLabels.join('')}concat=n=${finalSegments.length}:v=1:a=0`;
        videoFilters.push(videoSpeedFilter);
        
        // Render Audio split-trim-concat chain in lockstep
        if (hasAudio) {
          const aSplitLabels = finalSegments.map((_, idx) => `[aseg${idx}]`);
          const aTrimLabels = finalSegments.map((_, idx) => `[atrim${idx}]`);
          
          let audioSpeedFilter = `asplit=${finalSegments.length}${aSplitLabels.join('')}; `;
          finalSegments.forEach((seg, idx) => {
            audioSpeedFilter += `[aseg${idx}]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS,atempo=${seg.speed}[atrim${idx}]; `;
          });
          audioSpeedFilter += `${aTrimLabels.join('')}concat=n=${finalSegments.length}:v=0:a=1`;
          audioFilters.push(audioSpeedFilter);
        }
        
        appliedEdits.push('Neural Speed Ramping (Dynamic)');
        creativeFeatures.push('Dynamic Speed Ramping');
      } else if (finalSegments.length === 1) {
        const speed = finalSegments[0].speed;
        if (Math.abs(speed - 1.0) > 0.01) {
          videoFilters.push(`setpts=PTS/${speed}`);
          if (hasAudio) audioFilters.push(`atempo=${speed}`);
          appliedEdits.push(`Neural Speed Ramping (${speed.toFixed(2)}x)`);
          creativeFeatures.push('Pacing Optimization');
        }
      }
    }

    // 5b. KINETIC ZOOM JOLTS & RANDOMIZED VFX DIVERSITY (New for 2026)
    // Randomize the applied effects so videos don't become repetitive
    if (enableAutoZoom) {
      const availableVFX = [];

      // ── Original 5 VFX ──────────────────────────────────────────────────────
      const zoomChain = generateKineticZoomChain(keyMoments?.reactions || [], duration);
      if (zoomChain) availableVFX.push({ chain: zoomChain, name: 'Kinetic Zoom Jolts', type: 'AI Motion Tracking' });

      const flashChain = generateFlashCutsFilter(keyMoments?.reactions || [], duration);
      if (flashChain) availableVFX.push({ chain: flashChain, name: 'Flash Impacts', type: 'High Energy Flash' });

      const shakeChain = generateShockJitterFilter(keyMoments?.reactions || [], duration);
      if (shakeChain) availableVFX.push({ chain: shakeChain, name: 'Action Camera Shake', type: 'Dynamic Camera Shake' });

      const colorIsolationChain = generateColorIsolationFilter(keyMoments?.reactions || [], duration);
      if (colorIsolationChain) availableVFX.push({ chain: colorIsolationChain, name: 'B-Roll Color Isolation', type: 'Thematic Color Shift' });

      const glitchChain = generateCyberGlitchFilter(keyMoments?.reactions || [], duration);
      if (glitchChain) availableVFX.push({ chain: glitchChain, name: 'Cyber Glitch Effect', type: 'Cyber Glitch Effect' });

      // ── 2026 VFX Pack ────────────────────────────────────────────────────────
      const rgbSplitChain = generateRGBSplitFilter(keyMoments?.reactions || [], duration);
      if (rgbSplitChain) availableVFX.push({ chain: rgbSplitChain, name: 'RGB Channel Split', type: 'Chromatic Aberration' });

      const filmBurnChain = generateFilmBurnFilter(sceneChanges, duration);
      if (filmBurnChain) availableVFX.push({ chain: filmBurnChain, name: 'Film Burn Transition', type: 'Film Burn' });

      const whipBlurChain = generateWhipPanBlurFilter(sceneChanges, duration);
      if (whipBlurChain) availableVFX.push({ chain: whipBlurChain, name: 'Motion Blur Whip Pan', type: 'Whip Pan Blur' });

      const vignettePulseChain = generateVignettePulseFilter(keyMoments?.reactions || [], duration);
      if (vignettePulseChain) availableVFX.push({ chain: vignettePulseChain, name: 'Vignette Pulse', type: 'Bass Vignette' });

      const lightLeakChain = generateLightLeakFilter(sceneChanges, duration);
      if (lightLeakChain) availableVFX.push({ chain: lightLeakChain, name: 'Light Leak', type: 'Scene Light Leak' });

      // ── Diversity-enforced selection (batch registry prevents repetition) ───
      if (availableVFX.length > 0) {
        // batchVFXRegistry passed from batch route; excludes recently-used VFX across clips
        const batchVFXRegistry = editingOptions._batchVFXRegistry || new Set();
        const fresh = availableVFX.filter(vfx => !batchVFXRegistry.has(vfx.name));
        const pool = fresh.length > 0 ? fresh : availableVFX; // reset if all excluded

        // If the user explicitly chose a transition style, pin that VFX first.
        // fast-cut: avoid slow blending effects; glitch: pin glitch; whip-pan: pin whip blur.
        const TRANSITION_VFX_MAP = {
          glitch:   'Cyber Glitch Effect',
          'whip-pan': 'Motion Blur Whip Pan',
          crossfade: 'Film Burn Transition',
          'fast-cut': null, // intentional — fast-cut means fewer/no overlaid effects
        };
        let pinnedVFX = null;
        if (aestheticTransition && TRANSITION_VFX_MAP[aestheticTransition] !== undefined) {
          const targetName = TRANSITION_VFX_MAP[aestheticTransition];
          if (targetName) {
            pinnedVFX = pool.find(v => v.name === targetName) || null;
          }
        }
        if (aestheticTransition === 'fast-cut') {
          // No overlaid VFX for fast-cut style — pure hard cuts are the effect
          logger.info('Skipping VFX overlay — fast-cut transition style active');
        } else {
          const shuffled = pool.filter(v => !pinnedVFX || v.name !== pinnedVFX.name).sort(() => 0.5 - Math.random());
          const numExtra = Math.max(0, Math.floor(Math.random() * Math.min(2, shuffled.length + 1)));
          const selectedVFX = pinnedVFX ? [pinnedVFX, ...shuffled.slice(0, numExtra)] : shuffled.slice(0, Math.max(1, numExtra + 1));

          selectedVFX.forEach(vfx => {
            videoFilters.push(vfx.chain);
            creativeFeatures.push(vfx.name);
            if (vfx.type) appliedEdits.push(vfx.type);
            batchVFXRegistry.add(vfx.name);
          });
          logger.info('Applied diverse VFX set', { vfxCount: selectedVFX.length, choices: selectedVFX.map(v => v.name) });
        }
      }
    }

    // === PREMIUM AI CAPTION SYSTEM ===
    // Priority: Use Gemini-suggested captions if available, fall back to smartCaptions
    const captionsToRender = [];

    // Gemini-sourced captions take highest priority (most creative and accurate)
    const geminiCaptions = keyMoments?.suggestedCaptions || [];
    if (geminiCaptions.length > 0) {
      geminiCaptions.slice(0, 8).forEach(cap => captionsToRender.push({ ...cap, source: 'gemini' }));
      appliedEdits.push('Gemini AI Captions');
      creativeFeatures.push('AI-Generated Captions');
    } else if (smartCaptions && smartCaptions.length > 0) {
      smartCaptions.slice(0, 8).forEach(cap => captionsToRender.push({ ...cap, source: 'analysis' }));
      appliedEdits.push('Smart Captions');
    }

    // Add CTA overlay from Gemini at the end of the video
    if (keyMoments?.cta) {
      captionsToRender.push({
        text: keyMoments.cta.toUpperCase(),
        startTime: Math.max(0, duration - 4),
        endTime: duration,
        style: 'CTA',
        source: 'gemini-cta',
      });
    }

    if (captionsToRender.length > 0) {
      emitProgress('editing', 50, 'Applying AI-generated captions...');

      // Style map — 2026 platform-native visual treatments (Ultra-Premium)
      const styleMap = {
        hook:     { fontColor: '#FFD700', bgColor: 'black@0.9', fontSize: 82, y: 'h-text_h-360', borderColor: '#FFD700', borderw: 4, shadow: 4 },
        stat:     { fontColor: '#00FFFF', bgColor: 'black@0.85', fontSize: 72, y: 'h-text_h-320', borderColor: '#00FFFF', borderw: 3, shadow: 3 },
        question: { fontColor: '#FFFFFF', bgColor: 'black@0.85', fontSize: 64, y: 'h/2.2',         borderColor: '#FFFFFF', borderw: 2, shadow: 2 },
        punchline: { fontColor: '#FF3366', bgColor: 'black@0.9', fontSize: 76, y: 'h-text_h-320', borderColor: '#FF3366', borderw: 3, shadow: 4 },
        CTA:      { fontColor: '#FFD700', bgColor: 'black@0.95', fontSize: 60, y: 'h-text_h-240', borderColor: '#FFD700', borderw: 2, shadow: 2 },
        default:  { fontColor: '#FFFFFF', bgColor: 'black@0.8',  fontSize: 58, y: 'h-text_h-320', borderColor: 'black',   borderw: 2, shadow: 2 },
      };

      captionsToRender.forEach((caption) => {
        const rawText = (caption.text || '').toUpperCase().trim();
        if (!rawText) return;

        // Apply 2026 dynamic emoji decoration (for data/metadata only)
        const emojiText = attachViralEmojis(rawText, caption.style);
        // Strip emoji and non-printable-ASCII before passing to FFmpeg drawtext —
        // drawtext cannot render emoji glyphs and renders them as □ tofu boxes.
        const drawableText = emojiText.replace(/[^ -~]/g, '').trim();
        if (!drawableText) return;

        const sty = styleMap[caption.style] || styleMap.default;

        // Dynamic font size based on text length — shorter = bigger impact
        let fontSize = sty.fontSize;
        if (drawableText.length < 10) fontSize = Math.round(fontSize * 1.2);
        else if (drawableText.length > 35) fontSize = Math.round(fontSize * 0.82);

        // Apply custom captionFontScale override
        if (typeof captionFontScale === 'number' && captionFontScale > 0) {
          fontSize = Math.round(fontSize * captionFontScale);
        }

        const x = '(w-text_w)/2';
          
        // Offset timestamps dynamically for Viral Clip Extraction
        const s = Math.max(0, Number(caption.startTime ?? 0) - globalTimeOffset).toFixed(3);
        const e = Math.max(0.1, Number(caption.endTime ?? ((caption.startTime ?? 0) + 3)) - globalTimeOffset).toFixed(3);
          
        // Skip rendering if caption is completely outside the newly extracted viral clip bounds
        if (Number(s) >= globalDuration || Number(e) <= 0) return;

        // Map subtitlePosition to a concrete Y expression when user specified
        // a non-auto placement (overrides each style's default position).
        const subtitlePosY = {
          top:         '80',
          middle:      '(h-text_h)/2',
          bottom:      'h-text_h-200',
          'lower-third': 'h*0.75',
        }[subtitlePosition];

        // Kinetic displacement for hooks/punchlines (more aggressive bounce)
        let finalY = subtitlePosY || sty.y;
        if (!subtitlePosY && (caption.style === 'hook' || caption.style === 'punchline')) {
          // Add a snappy periodic bounce: + 15px oscillation
          finalY = `${sty.y}-15*sin(2*PI*t/0.4)`;
        }

        // Apply vertical alignment offset override
        if (typeof captionVerticalOffset === 'number' && captionVerticalOffset !== 0) {
          finalY = `${finalY}+(${captionVerticalOffset})`;
        }

        // Safe-escape for drawtext: single quotes must be \’ in the filter string
        const safeText = drawableText.replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');

        const fontPath = getSystemFontPath();
        const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';

        const captionFilter = `drawtext=text='${safeText}'${fontfileOpt}:fontsize=${fontSize}:fontcolor='${sty.fontColor}':x='${x}':y='${finalY}':box=1:boxcolor='${sty.bgColor}':boxborderw=18:borderw=${sty.borderw || 2}:bordercolor='${sty.borderColor}':shadowcolor=black@0.8:shadowx=${sty.shadow}:shadowy=${sty.shadow}:enable='between(t\\,${s}\\,${e})'`;
        videoFilters.push(captionFilter);
      });

      logger.info('AI Caption System applied', { count: captionsToRender.length, sources: [...new Set(captionsToRender.map(c => c.source))] });
    }

    // Word-level karaoke highlights — fires when Whisper word timestamps exist
    // AND no styled Gemini/Smart captions were rendered above. Both systems
    // occupy the lower-third area, so running both creates doubled subtitles —
    // karaoke is therefore the FALLBACK when there are no styled captions.
    // (Previously this block lived inside `if (captionsToRender.length > 0)`
    //  while requiring `=== 0`, so it could never execute — dead code.)
    // Pass globalTimeOffset so word timings rebase correctly on extracted
    // viral clips, matching the styled-caption path above.
    if (transcriptWords && transcriptWords.length > 0 && captionsToRender.length === 0) {
      const wordFilters = generateWordLevelCaptionFilters(transcriptWords, captionStyle, globalTimeOffset, globalDuration);
      wordFilters.forEach(f => videoFilters.push(f));
      if (wordFilters.length > 0) {
        creativeFeatures.push('Word-Level Karaoke Captions');
        appliedEdits.push(`Karaoke Highlights (${wordFilters.length} word frames)`);
        logger.info('Karaoke caption filters applied', { wordCount: transcriptWords.length, filterCount: wordFilters.length });
      }
    }

    // Creative: Add text overlays (from AI analysis — hook + highlights)
    if (enableTextOverlays && textOverlays.length > 0 && geminiCaptions.length === 0) {
      // Only apply if Gemini captions didn't already cover this
      const overlaysToApply = [
        textOverlays.find(o => o.type === 'hook'),
        ...textOverlays.filter(o => o.type === 'highlight').slice(0, 2)
      ].filter(Boolean);

      overlaysToApply.forEach((overlay) => {
        let fontSize = overlay.size || 36;
        if (typeof captionFontScale === 'number' && captionFontScale > 0) {
          fontSize = Math.round(fontSize * captionFontScale);
        }
        const color = overlay.color || '#FFFFFF';
        const bgColor = (overlay.backgroundColor || 'black@0.7').replace(/rgba\(0,0,0,([0-9.]+)\)/, 'black@$1');
        const x = '(w-text_w)/2';
        let y = overlay.position === 'top' ? '80' : overlay.position === 'bottom' ? 'h-text_h-120' : '(h-text_h)/2';
        
        if (typeof captionVerticalOffset === 'number' && captionVerticalOffset !== 0) {
          y = `${y}+(${captionVerticalOffset})`;
        }
          
        // Offset timestamps dynamically for Viral Clip Extraction
        const s = Math.max(0, Number(overlay.startTime ?? 0) - globalTimeOffset).toFixed(3);
        const e = Math.max(0.1, Number(overlay.endTime ?? duration) - globalTimeOffset).toFixed(3);
        if (Number(s) >= globalDuration || Number(e) <= 0) return;

        const safeText = (overlay.text || '').replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/%/g, '\\%');
        const fontPath = getSystemFontPath();
        const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';

        const textFilter = `drawtext=text='${safeText}'${fontfileOpt}:fontsize=${fontSize}:fontcolor='${color}':x='${x}':y='${y}':box=1:boxcolor='${bgColor}':borderw=2:bordercolor='black':enable='between(t\\,${s}\\,${e})'`;
        videoFilters.push(textFilter);
      });

      if (overlaysToApply.length > 0) {
        creativeFeatures.push('Text Overlays');
        appliedEdits.push(`Text Overlays (${overlaysToApply.length})`);
      }
    }

    // 🛍️ Phase 15.5: Render Commerce Layer CTAs
    if (commerceInlays && commerceInlays.length > 0) {
      commerceInlays.forEach((inlay) => {
        // Add a premium, glowing glassmorphic CTA product box
        const startT = Math.max(0, inlay.time - globalTimeOffset).toFixed(3);
        const endT = Math.max(0.1, (inlay.time + inlay.duration) - globalTimeOffset).toFixed(3);
        if (Number(startT) >= globalDuration || Number(endT) <= 0) return;

        const prodName = (inlay.product || 'Product').toUpperCase().replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/%/g, '\\%');
        const prodPrice = (inlay.price || 'Link in bio').toUpperCase().replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:').replace(/%/g, '\\%');
        const fontPath = getSystemFontPath();
        const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
          
        // Outer glass border box (160px tall card, positioned 280px above bottom edge)
        videoFilters.push(`drawbox=x='(w-500)/2':y='h-440':w=500:h=160:color=white@0.8:thickness=4:enable='between(t\\,${startT}\\,${endT})'`);
        // Inner glass fill
        videoFilters.push(`drawbox=x='(w-500)/2':y='h-440':w=500:h=160:color=black@0.6:t=fill:enable='between(t\\,${startT}\\,${endT})'`);
        // Product Name (sits ~25px below top of card)
        videoFilters.push(`drawtext=text='SHOP\\: ${prodName}'${fontfileOpt}:fontsize=42:fontcolor='#FFD700':x='(w-text_w)/2':y='h-415':shadowcolor=black@0.9:shadowx=3:shadowy=3:enable='between(t\\,${startT}\\,${endT})'`);
        // Price / CTA (sits ~85px below top of card)
        videoFilters.push(`drawtext=text='${prodPrice} -> TAP TO BUY'${fontfileOpt}:fontsize=32:fontcolor='#FFFFFF':x='(w-text_w)/2':y='h-355':shadowcolor=black@0.9:shadowx=2:shadowy=2:enable='between(t\\,${startT}\\,${endT})'`);
      });
    }

    // OpusClip/TikTok style Viral Retention Progress Bar (2026 Trend)
    if (optimizePacing) {
      // A sleek, neon-cyan progress bar at the very bottom
      const progressBarFilter = `drawbox=x=0:y=h-15:w='iw*(t/${duration})':h=15:color=#00FFFF@0.9:t=fill`;
      videoFilters.push(progressBarFilter);
      creativeFeatures.push('Retention Progress Bar');
      appliedEdits.push('Viral Progress UI');
    }

    // Log final filter strings for debugging
    logger.info('FFmpeg filter config', {
      videoId,
      videoFiltersCount: videoFilters.length,
      audioFiltersCount: audioFilters.length,
      videoFilters: videoFilters.map(f => f.substring(0, 80)).join(' | '),
      audioFilters: audioFilters.join(',')
    });

    // Build FFmpeg command — Clean, Proven-Safe Complex Filtergraph
    let command = ffmpeg(inputPath);

    // Hardware-accelerated DECODE of the MAIN input only. This must be set
    // before any b-roll .input() calls — fluent-ffmpeg binds inputOptions to
    // the most-recently-added input, so applying it later attached -hwaccel to
    // a b-roll image input (with -loop 1), which is wrong and can break the
    // software filtergraph. ffmpeg auto-downloads frames for software filters,
    // so decode-only hwaccel on input 0 is safe with the complex filtergraph.
    command.inputOptions(['-hwaccel', 'auto']);

    // 🛸 COMPOSITE B-ROLL & IMAGES AS NEW INPUTS
    if (bRollPlan && bRollPlan.length > 0) {
      let bRollInputIndex = 1; // 0 is main video
      bRollPlan.forEach((broll) => {
        if (!broll.url) return;
        command.input(broll.url);
        
        // If image, loop it. If video, just cut it.
        if (broll.url.match(/\.(jpeg|jpg|png|webp)$/i)) {
          command.inputOptions(['-loop', '1', '-t', broll.duration.toString()]);
        } else {
          command.inputOptions(['-t', broll.duration.toString()]);
        }

        // Offset timestamps dynamically for Viral Clip Extraction
        const s = Math.max(0, Number(broll.startTime) - globalTimeOffset).toFixed(2);
        const e = Math.max(0.1, (Number(broll.startTime) + Number(broll.duration)) - globalTimeOffset).toFixed(2);
        if (Number(s) >= globalDuration || Number(e) <= 0) return;
        
        // Scale the B-roll to 1080x1920, then composite it cleanly over the main video.
        // We use __TARGET__ so the engine knows to stitch it seamlessly into the filter chain.
        const bRollFilter = `[${bRollInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[broll${bRollInputIndex}];__TARGET__[broll${bRollInputIndex}]overlay=enable='between(t\\,${s}\\,${e})':eof_action=pass`;
        
        // Unshift so B-roll renders BEFORE captions and progress bars, but AFTER vertical shielding
        videoFilters.splice(1, 0, bRollFilter);
        bRollInputIndex++;
      });
      appliedEdits.push(`B-Roll & Image Compositing (${bRollPlan.length} clips)`);
      creativeFeatures.push('B-Roll Saliency');
    }

    const videoChain = videoFilters.filter(f => f && f.trim());
    const audioChain = audioFilters.filter(f => f && f.trim());
    const hasAudio = metadata.streams && metadata.streams.some(s => s.codec_type === 'audio');

    // === Viral Clip Extraction (filtergraph-internal trim) ===
    // When a viral sub-clip is being extracted (globalTimeOffset > 0) we MUST
    // do the trim INSIDE the filtergraph rather than with an output-side
    // -ss/-t. Output -ss resets PTS to 0 *after* the filters run, but the
    // filter timeline still runs on the SOURCE clock — so caption/overlay
    // `enable=between(t,...)` expressions (which we already rebased by
    // subtracting globalTimeOffset) would land on the wrong frames and then
    // get partially cut. Prepending trim+setpts (and atrim+asetpts) rebases
    // the filter clock to 0 = the post-offset timeline, so the rebased
    // enable/time math matches exactly. The non-extraction path
    // (globalTimeOffset === 0) is untouched.
    const useFiltergraphTrim = globalTimeOffset > 0;
    if (useFiltergraphTrim) {
      const trimStart = Number(globalTimeOffset).toFixed(3);
      const trimEnd = Number(globalTimeOffset + globalDuration).toFixed(3);
      // Unshift so the trim runs FIRST, before every visual/audio filter, so
      // all downstream filters (captions, overlays, b-roll) see a 0-based clock.
      videoChain.unshift(`trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS`);
      if (hasAudio) {
        audioChain.unshift(`atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS`);
      }
    }

    if (videoChain.length > 0 || (hasAudio && audioChain.length > 0)) {
      const filterSegments = [];
      let lastVideoLabel = '0:v';
      let lastAudioLabel = hasAudio ? '0:a' : null;

      // Build video chain — each filter is an independent segment joined by ';'
      videoChain.forEach((filter, idx) => {
        const outLabel = `vout${idx}`;
        if (filter.includes('__TARGET__')) {
          // Dynamic mapping for B-roll overlays
          const processedFilter = filter.replace('__TARGET__', `[${lastVideoLabel}]`);
          filterSegments.push(`${processedFilter}[${outLabel}]`);
        } else if (filter.startsWith('[')) {
          // Sub-graph: just append our output label at the end
          filterSegments.push(`${filter}[${outLabel}]`);
        } else {
          filterSegments.push(`[${lastVideoLabel}]${filter}[${outLabel}]`);
        }
        lastVideoLabel = outLabel;
      });

      // Build audio chain (only if input has audio)
      if (hasAudio && audioChain.length > 0) {
        audioChain.forEach((filter, idx) => {
          const outLabel = `aout${idx}`;
          filterSegments.push(`[${lastAudioLabel}]${filter}[${outLabel}]`);
          lastAudioLabel = outLabel;
        });
      }

      const fullFilterGraph = filterSegments.join(';');
      logger.info('Applying production filtergraph', { 
        videoId, 
        videoSteps: videoChain.length, 
        audioSteps: audioChain.length,
        graphPreview: fullFilterGraph.substring(0, 200)
      });
      
      command.complexFilter(fullFilterGraph);
      command.outputOptions(['-map', `[${lastVideoLabel}]`]);
      if (lastAudioLabel) {
        command.outputOptions(['-map', `[${lastAudioLabel}]`]);
      } else if (!hasAudio) {
        command.outputOptions(['-an']); // no audio stream
      }
    } else {
      // Simple passthrough if no filters are applied
      command.outputOptions(['-c:v', 'copy', '-c:a', 'copy']);
    }

    // Physically extract the viral clip from the source video if offset was
    // activated. When we trimmed INSIDE the filtergraph (useFiltergraphTrim),
    // the extraction is already handled on the correct timeline and adding an
    // output-side -ss/-t here would double-cut and re-break caption timing —
    // so only fall back to output-side trim when no filtergraph was built
    // (defensive: useFiltergraphTrim always forces a non-empty videoChain).
    if (globalTimeOffset > 0 && !useFiltergraphTrim) {
      command.setStartTime(globalTimeOffset);
      command.setDuration(globalDuration);
    }

    // If music is selected, prepare to mix it
    let musicPath = null;
    if (selectedMusic) {
      // Try different possible file path fields
      musicPath = selectedMusic.filePath ||
        selectedMusic.file?.path ||
        selectedMusic.url ||
        (selectedMusic.file?.url && selectedMusic.file.url.startsWith('/')
          ? path.join(__dirname, '../..', selectedMusic.file.url)
          : null);

      // Only require the file to exist on disk for LOCAL paths. Remote
      // http(s) URLs (e.g. the Pixabay "premium-fallback") are read directly
      // by ffmpeg and must be allowed through.
      if (musicPath && !isRemoteUrl(musicPath) && !fs.existsSync(musicPath)) {
        logger.warn('Music file not found, skipping music', { musicPath });
        musicPath = null;
      } else if (musicPath) {
        logger.info('Music will be mixed with video', { videoId, musicId: selectedMusic._id || selectedMusic.id });
      }
    }

    return new Promise((resolve, reject) => {
      let finalCommand = command;

      emitProgress('rendering', 60, 'Rendering edited video...');
      // NOTE: -hwaccel auto is set on the MAIN input at command-build time
      // (see above). It is intentionally NOT re-applied here, where it would
      // bind to the last-added (b-roll) input and break the filtergraph.
      finalCommand
        .output(outputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
          '-threads', '0',
          '-report',
          '-max_muxing_queue_size', '9999',
          '-fps_mode', 'cfr',
        ])
        .on('start', (cmd) => {
          logger.info('FFmpeg auto-edit started', { videoId, command: cmd });
          emitProgress('rendering', 65, 'Processing video...');
        })
        .on('progress', (progress) => {
          const percent = progress.percent || 0;
          const renderPercent = 65 + (percent * 0.25); // 65-90% for rendering
          logger.debug('FFmpeg progress', { videoId, percent: percent.toFixed(1) });
          emitProgress('rendering', Math.min(90, renderPercent), `Processing... ${percent.toFixed(0)}%`);
        })
        .on('end', async () => {
          logger.info('FFmpeg auto-edit completed', { videoId, outputPath });
          emitProgress('post-processing', 90, 'Finalizing video...');

          try {
            // Verify output file exists — use absolute path to avoid cwd-relative issues
            const absOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
            if (!fs.existsSync(absOutputPath)) {
              throw new Error(`Output video file was not created at: ${absOutputPath}`);
            }

            const outputStats = fs.statSync(outputPath);
            // Reject zero-byte AND tiny-header-only outputs. A valid mp4 is
            // always > a few KB. Anything below this is FFmpeg writing the
            // moov atom but bailing on the stream — would hand the user a
            // file that won't play.
            if (outputStats.size < 4096) {
              throw new Error(`Output video file is too small (${outputStats.size} bytes) — likely a truncated FFmpeg render`);
            }

            // Quick ffprobe to confirm there's a real video stream with
            // non-zero duration. Catches the case where the container is
            // well-formed but contains no playable video (corrupt codec,
            // missing key frames). Skipped silently if ffprobe is busy.
            try {
              const probed = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(absOutputPath, (err, meta) => err ? reject(err) : resolve(meta));
              });
              const hasVideo = (probed.streams || []).some(s => s.codec_type === 'video');
              const probedDuration = probed.format?.duration || 0;
              if (!hasVideo || probedDuration <= 0.1) {
                throw new Error(`Output video has no playable video stream (duration=${probedDuration}, hasVideo=${hasVideo})`);
              }
            } catch (probeErr) {
              logger.warn('Output validation probe failed; continuing with size-only check', {
                videoId, error: probeErr.message,
              });
            }

            logger.info('Output video verified', { videoId, size: outputStats.size, path: outputPath });

            // Mix music if selected. Allow remote http(s) URLs through (ffmpeg
            // reads them directly); only require on-disk existence for LOCAL
            // paths. "Background Music Added" is pushed ONLY after the mix
            // actually succeeds — never when audioService is unavailable or the
            // mix throws — so appliedEdits can't claim an edit that didn't run.
            let finalVideoPath = outputPath;
            const musicPlayable = musicPath && (isRemoteUrl(musicPath) || fs.existsSync(musicPath));
            if (musicPlayable) {
              emitProgress('post-processing', 92, 'Mixing background music...');
              const audioService = getAudioService();
              if (audioService) {
                const musicOutputPath = outputPath.replace('.mp4', '-with-music.mp4');
                try {
                  await audioService.mixMusicWithVideo(outputPath, musicPath, musicOutputPath, {
                    musicVolume: 0.25,
                    fadeIn: 2,
                    fadeOut: 2,
                    silencePeriods,   // used to duck music during speech
                    duckedMusicDb: -18,
                  });
                  finalVideoPath = musicOutputPath;
                  appliedEdits.push('Background Music Added');
                  creativeFeatures.push('Music');
                  logger.info('Music mixed with video', { videoId });
                } catch (musicError) {
                  logger.warn('Music mixing failed, using video without music', { error: musicError.message });
                }
              } else {
                logger.warn('Audio service unavailable; skipping background music mix', { videoId });
              }
            } else if (musicPath) {
              logger.warn('Selected music path is not playable; skipping music mix', { videoId, musicPath });
            }

            // Get final duration
            emitProgress('post-processing', 94, 'Analyzing final video...');
            const finalMetadata = await new Promise((resolve, reject) => {
              ffmpeg.ffprobe(finalVideoPath, (err, metadata) => {
                if (err) {
                  logger.error('Failed to probe output video', { videoId, error: err.message });
                  reject(err);
                } else {
                  resolve(metadata);
                }
              });
            });

            logger.info('Final metadata retrieved', {
              videoId,
              duration: finalMetadata.format.duration,
              size: finalMetadata.format.size
            });

            // Upload the edited video file
            emitProgress('upload', 96, 'Uploading edited video...');
            const uploadResult = await uploadFile(finalVideoPath, `videos/${outputFilename}`, 'video/mp4', {
              videoId,
              type: 'auto-edit',
              originalDuration: duration,
              finalDuration: finalMetadata.format.duration,
            });

            logger.info('Edited video uploaded', { videoId, url: uploadResult.url });

            // Multi-format export if enabled
            let multiFormatExports = null;
            if (enableMultiFormatExport && Array.isArray(exportFormats) && exportFormats.length > 1) {
              emitProgress('export', 97, 'Exporting to multiple formats...');
              try {
                multiFormatExports = await exportMultipleFormats(videoId, exportFormats);
                logger.info('Multi-format export completed', { videoId, formats: exportFormats });
              } catch (exportError) {
                logger.warn('Multi-format export failed', { error: exportError.message });
              }
            }

            // Save edit history to prevent repetition. Best-effort: this is
            // auxiliary bookkeeping — a DB hiccup here must NOT throw into the
            // outer catch, which would call cleanupAll() and delete the freshly
            // rendered+uploaded output, turning a successful edit into a failure.
            try {
              await saveEditHistory(videoId, silencePeriods, appliedEdits.map(e => ({ type: e, time: Date.now() })));
            } catch (histErr) {
              logger.warn('saveEditHistory failed (non-fatal)', { videoId, error: histErr.message });
            }

            // Auto-save edit version for undo/redo. Same best-effort contract:
            // never let version snapshotting abort the success path.
            try {
              await saveEditVersion(videoId, `Auto-Edit ${new Date().toISOString()}`);
            } catch (verErr) {
              logger.warn('saveEditVersion failed (non-fatal)', { videoId, error: verErr.message });
            }

            // Generate best thumbnail if enabled
            let thumbnailUrl = content.originalFile.thumbnail || '';
            if (enableAutoThumbnail && keyMoments.bestThumbnail) {
              try {
                const thumbnailPath = path.join(__dirname, '../../uploads/thumbnails', `thumb-${videoId}-${Date.now()}.jpg`);
                if (!fs.existsSync(path.dirname(thumbnailPath))) {
                  fs.mkdirSync(path.dirname(thumbnailPath), { recursive: true });
                }

                // Use FFmpeg to extract frame at best moment
                await new Promise((resolve, reject) => {
                  ffmpeg(outputPath)
                    .screenshots({
                      timestamps: [keyMoments.bestThumbnail.time],
                      filename: path.basename(thumbnailPath),
                      folder: path.dirname(thumbnailPath),
                      size: '1280x720'
                    })
                    .on('end', resolve)
                    .on('error', reject);
                });

                const thumbUpload = await uploadFile(thumbnailPath, `thumbnails/${path.basename(thumbnailPath)}`, 'image/jpeg', { videoId });
                thumbnailUrl = thumbUpload.url;
                logger.info('Best thumbnail generated', { videoId, time: keyMoments.bestThumbnail.time });
              } catch (thumbError) {
                logger.warn('Thumbnail generation failed', { videoId, error: thumbError.message });
              }
            }

            // Update content model - REPLACE original with edited version
            content.status = 'completed';

            // Store original file info before replacing
            const originalFileInfo = {
              url: content.originalFile.url,
              filename: content.originalFile.filename,
              duration: content.originalFile.duration,
              size: content.originalFile.size,
              savedAt: new Date(),
            };

            // Update originalFile to point to edited version (auto-edit replaces original)
            content.originalFile = {
              url: uploadResult.url,
              filename: outputFilename,
              duration: finalMetadata.format.duration || content.originalFile.duration,
              size: finalMetadata.format.size || outputStats.size,
              storageKey: uploadResult.key || uploadResult.url,
              storage: uploadResult.storage || 'local',
              thumbnail: thumbnailUrl,
            };

            // Calculate final quality score
            const finalQualityScore = calculateQualityScore(
              finalMetadata,
              transcript,
              audioLevels,
              finalMetadata.format.duration
            );

            // Store edit history and metadata
            if (!content.metadata) content.metadata = {};
            content.metadata.autoEditHistory = {
              editedAt: new Date(),
              originalFile: originalFileInfo,
              editsApplied: appliedEdits,
              creativeFeatures: creativeFeatures,
              qualityScore: {
                before: qualityScore,
                after: finalQualityScore,
                improvement: (finalQualityScore - qualityScore).toFixed(1),
              },
              sentiment: sentiment,
              music: selectedMusic ? {
                id: selectedMusic._id,
                title: selectedMusic.title,
                mood: selectedMusic.mood,
              } : null,
              captions: smartCaptions ? {
                count: smartCaptions.length,
                style: captionStyle,
              } : null,
              exports: multiFormatExports,
              stats: {
                silenceRemoved: silencePeriods.length,
                scenesDetected: sceneChanges.length,
                repetitivePhrases: repetitivePhrases.length,
                textOverlays: textOverlays.length,
                autoZooms: faceMoments.length,
                beatsDetected: beats.length,
                beatsSynced: silencePeriods.filter(s => s.syncedToBeat).length,
                captionsAdded: smartCaptions?.length || 0,
                musicAdded: selectedMusic ? 'Yes' : 'No',
                keyMoments: {
                  hook: keyMoments.hook ? 'Optimized' : 'None',
                  reactions: keyMoments.reactions?.length || 0,
                  highlights: keyMoments.highlights?.length || 0,
                  bestThumbnail: keyMoments.bestThumbnail?.time || null,
                },
                platform: platform,
                platformOptimizations: platformOpts,
                originalDuration: duration,
                finalDuration: finalMetadata.format.duration,
                reduction: ((duration - finalMetadata.format.duration) / duration * 100).toFixed(1) + '%',
              },
            };

            // Also store in generatedContent for backward compatibility
            if (!content.generatedContent) content.generatedContent = {};
            if (!content.generatedContent.shortVideos) content.generatedContent.shortVideos = [];

            // Build the rich clip record. The lightbox UI reads viralScore,
            // hookScore, sentimentEnergy, viralMomentCount, hookText, and
            // caption directly from this object — previously we only saved
            // a placeholder caption ("AI Auto-Edited Video") and no scores,
            // so the score breakdown bars rendered empty and the headline
            // said "UNRATED". Now we propagate everything the pipeline
            // actually computed during analysis.
            const realCaption =
              (Array.isArray(keyMoments.suggestedCaptions) && keyMoments.suggestedCaptions[0]?.text) ||
              (Array.isArray(smartCaptions) && smartCaptions[0]?.text) ||
              keyMoments.hook?.text ||
              'AI Auto-Edited Clip';
            const hookText = keyMoments.hook?.text || null;

            // Score derivation. Gemini's video-analysis step (which
            // populates keyMoments.hook, keyMoments.reactions, and
            // sentiment.energyLevel) often returns thin data on short
            // clips with light audio. When that happens we want the
            // lightbox bars to still render with reasonable values
            // derived from finalQualityScore (which is always real),
            // so the user sees A/B/C grades instead of empty "—"
            // dashes. Real Gemini values still take priority when
            // they're present.
            const qualityFloor = typeof finalQualityScore === 'number' ? finalQualityScore : 65;

            const hookScore = (
              typeof keyMoments.hook?.score === 'number' ? keyMoments.hook.score :
                typeof keyMoments.hook?.confidence === 'number' ? Math.round(keyMoments.hook.confidence * 100) :
                // Quality-derived fallback: bias slightly above quality
                // when prioritizeHook was on (the user paid attention to
                // the hook). Capped 0-100.
                  Math.max(0, Math.min(100, Math.round(qualityFloor * (optimizeHookOption ? 1.05 : 0.95))))
            );
            const sentimentEnergy = (
              typeof sentiment?.energyLevel === 'number' ? sentiment.energyLevel :
              // Quality / 12 ≈ 0–8 range, slightly conservative so we
              // never surface 10/10 without real signal.
                Math.max(1, Math.min(10, Math.round(qualityFloor / 12)))
            );
            const viralMomentCount = (
              Array.isArray(keyMoments.reactions) && keyMoments.reactions.length > 0
                ? keyMoments.reactions.length
                : Array.isArray(smartCaptions) && smartCaptions.length > 0
                  ? Math.min(smartCaptions.length, 4)
                  : Array.isArray(faceMoments) && faceMoments.length > 0
                    ? Math.min(faceMoments.length, 4)
                    : 1
            );

            // Composite viral score — average of the three signals.
            // Always non-null now since each input has a fallback.
            const compositeScore = Math.max(0, Math.min(100, Math.round(
              (hookScore + sentimentEnergy * 10 + qualityFloor) / 3
            )));

            content.generatedContent.shortVideos.push({
              url: uploadResult.url,
              thumbnail: thumbnailUrl,
              duration: finalMetadata.format.duration || content.originalFile.duration,
              caption: realCaption,
              hookText,
              platform,
              highlight: false,
              editsApplied: appliedEdits,
              creativeFeatures: creativeFeatures,
              originalDuration: duration,
              finalDuration: finalMetadata.format.duration,
              keyMoments: keyMoments,
              // Score breakdown — read by the clip lightbox UI
              viralScore: compositeScore,
              hookScore,
              sentimentEnergy,
              viralMomentCount,
              // Style metadata so the lightbox can show preset / variation labels
              stylePresetId: editingOptions.stylePresetId || (Array.isArray(editingOptions.stylePresetIds) && editingOptions.stylePresetIds[0]) || null,
              colorGrade: aestheticColorGrade || editingOptions.colorGrade || null,
              transitionStyle: aestheticTransition || editingOptions.transitionStyle || null,
              musicGenre: editingOptions.musicGenre || (selectedMusic?.mood) || null,
              hookStyle: preferredHookStyle || editingOptions.hookStyle || keyMoments.hook?.style || null,
              pacingIntensity: pacingIntensity || null,
              ctaStyle: editingOptions.ctaStyle || null,
              voiceTone: preferredVoiceTone || editingOptions.voiceTone || null,
              niche: keyMoments.niche || null,
            });

            // PHASE 6: NEURO-MARKETING METADATA GENERATION (2026 Premium Standard)
            try {
              emitProgress('analysis', 98, 'Generating continuous learning Neuro-Marketing strategy...');
              const aiAssistedService = require('./aiAssistedEditingService');
              const strategyResult = await aiAssistedService.generateMarketingStrategy(
                videoId,
                transcript,
                finalMetadata,
                keyMoments?.niche || 'General Business'
              );
              if (strategyResult && strategyResult.strategy) {
                const marketingStrategy = strategyResult.strategy;
                content.metadata.marketingStrategy = marketingStrategy;
                content.generatedContent.marketingStrategy = marketingStrategy;
                
                // Attach the strategy and scheduling details directly to the clip record
                const latestClipIndex = content.generatedContent.shortVideos.length - 1;
                if (latestClipIndex >= 0) {
                  content.generatedContent.shortVideos[latestClipIndex].marketingStrategy = marketingStrategy;
                  // Pre-load scheduling matrix info directly onto the clip
                  if (marketingStrategy.schedulingMatrix) {
                    content.generatedContent.shortVideos[latestClipIndex].optimalPublishTime = marketingStrategy.schedulingMatrix.optimalTime;
                    content.generatedContent.shortVideos[latestClipIndex].optimalPublishDay = marketingStrategy.schedulingMatrix.optimalDay;
                    content.generatedContent.shortVideos[latestClipIndex].algorithmRationale = marketingStrategy.schedulingMatrix.algorithmRationale;
                  }
                  if (marketingStrategy.titles && marketingStrategy.titles.length > 0) {
                    content.generatedContent.shortVideos[latestClipIndex].suggestedTitles = marketingStrategy.titles;
                  }
                  if (marketingStrategy.captions && marketingStrategy.captions.length > 0) {
                    content.generatedContent.shortVideos[latestClipIndex].suggestedCaptions = marketingStrategy.captions;
                  }
                  if (marketingStrategy.hashtags && marketingStrategy.hashtags.length > 0) {
                    content.generatedContent.shortVideos[latestClipIndex].suggestedHashtags = marketingStrategy.hashtags;
                  }
                }
                logger.info('Neuro-marketing strategy and scheduling matrices pre-loaded successfully', { videoId });
              }
            } catch (marketError) {
              logger.warn('Failed to generate neuro-marketing metadata, skipping', { error: marketError.message });
            }

            await commitContent(content);
            logger.info('Content model updated with edited video', { videoId, editedUrl: uploadResult.url });

            emitProgress('complete', 100, 'Edit completed successfully!');

            const result = {
              success: true,
              editedVideoUrl: uploadResult.url,
              editsApplied: appliedEdits,
              creativeFeatures: creativeFeatures,
              qualityScore: {
                before: qualityScore,
                after: finalQualityScore,
                improvement: (finalQualityScore - qualityScore).toFixed(1),
              },
              metadata: content.metadata.autoEditHistory,
            };

            // Emit completion event
            if (userId) {
              const io = getSocketService();
              if (io) {
                try {
                  io.to(`user-${userId}`).emit('video:edit:complete', {
                    videoId,
                    result,
                    timestamp: new Date().toISOString(),
                  });
                } catch (err) {
                  logger.warn('Failed to emit completion', { error: err.message });
                }
              }
            }

            cleanup(true, uploadResult);
            resolve(result);
          } catch (uploadError) {
            logger.error('Upload error after edit', { videoId, error: uploadError.message });
            cleanupAll();
            reject(uploadError);
          }
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('FFmpeg auto-edit error', {
            videoId,
            error: err.message,
            stderr: stderr,
            command: finalCommand._getArguments ? finalCommand._getArguments().join(' ') : 'unknown'
          });

          cleanupAll();
          reject(new Error(`Video editing failed: ${err.message}`));
        })
        .run();
    });
  } catch (error) {
    logger.error('Auto-edit video service error', { error: error.message, videoId });
    cleanupAll();
    throw error;
  }
}

/** Timeout (ms) for silence/scene detection during analysis so we don't block too long */
const ANALYSIS_DETECTION_TIMEOUT_MS = 25000;

/**
 * Gather accurate analysis context from DB and optional local file (duration, silence, scenes, transcript)
 */
async function getAccurateAnalysisContext(videoId, videoMetadata = {}) {
  const ctx = {
    duration: videoMetadata.duration || 0,
    transcript: videoMetadata.transcript || null,
    transcriptExcerpt: null,
    repetitionSummary: null,
    silenceSegments: [],
    sceneTimes: [],
    resolution: null,
    hasLocalFile: false,
    content: null,
    energyProfile: [],
  };

  if (!videoId) return ctx;

  try {
    const content = await resolveContent(videoId, { 
      select: 'workspaceId metadata transcript originalFile',
      lean: true 
    });
    if (!content) return ctx;
    ctx.content = content;

    const meta = content.metadata || {};
    ctx.transcript = videoMetadata.transcript || content.transcript?.text || meta.transcript || null;
    ctx.duration = videoMetadata.duration || content.originalFile?.duration || 0;

    let inputPath = null;
    const url = content.originalFile?.url;
    if (url && !url.startsWith('http')) {
      inputPath = path.join(__dirname, '../..', url);
      ctx.hasLocalFile = fs.existsSync(inputPath);
    }

    // Exact duration and resolution from ffprobe when we have a local file
    if (ctx.hasLocalFile && inputPath) {
      try {
        const metadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => { if (err) reject(err); else resolve(data); });
        });
        ctx.duration = metadata.format?.duration ?? ctx.duration;
        const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
        if (videoStream) {
          ctx.resolution = `${videoStream.width || 0}x${videoStream.height || 0}`;
        }
      } catch (e) {
        logger.warn('FFprobe during analysis failed', { videoId, error: e.message });
      }
    }

    // Transcript excerpt and repetition summary for accurate AI context
    if (ctx.transcript) {
      const maxExcerptLen = 2800;
      ctx.transcriptExcerpt = ctx.transcript.length > maxExcerptLen
        ? ctx.transcript.slice(0, maxExcerptLen) + '\n[...truncated]'
        : ctx.transcript;
      const repetitivePhrases = analyzeTranscriptForRepetition(ctx.transcript);
      ctx.repetitionSummary = repetitivePhrases.length > 0
        ? repetitivePhrases.slice(0, 15).map(p => `"${p.phrase}" (${p.count}x)`).join(', ')
        : 'None detected';
    }

    // Silence and scene detection (with timeout) for data-driven cut suggestions
    if (ctx.hasLocalFile && inputPath && ctx.duration > 0) {
      const withTimeout = (promise, ms) =>
        Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

      try {
        const [silence, scenes, energy] = await Promise.all([
          withTimeout(detectSilencePeriods(inputPath, -30, 0.5), ANALYSIS_DETECTION_TIMEOUT_MS).catch(() => []),
          withTimeout(detectSceneChanges(inputPath, 0.3), ANALYSIS_DETECTION_TIMEOUT_MS).catch(() => []),
          withTimeout(getAudioService().getAudioEnergyProfile(inputPath), ANALYSIS_DETECTION_TIMEOUT_MS).catch(() => []),
        ]);
        ctx.silenceSegments = Array.isArray(silence) ? silence : [];
        ctx.sceneTimes = Array.isArray(scenes) ? scenes : [];
        ctx.energyProfile = Array.isArray(energy) ? energy : [];
      } catch (e) {
        logger.warn('Silence/scene detection during analysis failed', { videoId, error: e.message });
      }
    }

    return ctx;
  } catch (e) {
    logger.warn('getAccurateAnalysisContext failed', { videoId, error: e.message });
    return ctx;
  }
}

/**
 * Validate and clamp analysis output to video duration; merge overlapping cuts
 */
function validateAndClampAnalysis(analysis, duration) {
  const d = Number(duration) || 60;
  const clamp = (t) => Math.max(0, Math.min(d, Number(t)));

  if (Array.isArray(analysis.recommendedCuts)) {
    analysis.recommendedCuts = analysis.recommendedCuts
      .map(c => ({
        start: clamp(c.start),
        end: clamp(c.end != null ? c.end : c.start + 1),
        reason: c.reason || 'Pause/silence',
        confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0.8)),
      }))
      .filter(c => c.end > c.start + 0.1)
      .sort((a, b) => a.start - b.start);
    // Merge overlapping or adjacent cuts
    const merged = [];
    for (const c of analysis.recommendedCuts) {
      const last = merged[merged.length - 1];
      if (last && c.start <= last.end + 0.5) {
        last.end = Math.max(last.end, c.end);
        last.reason = last.reason || c.reason;
      } else {
        merged.push({ ...c });
      }
    }
    analysis.recommendedCuts = merged;
  }

  if (Array.isArray(analysis.transitions)) {
    analysis.transitions = analysis.transitions
      .map(t => ({ time: clamp(t.time), type: t.type || 'cut', duration: Math.max(0, Math.min(2, Number(t.duration) || 0.5)) }))
      .filter(t => t.time >= 0 && t.time < d);
  }
  if (Array.isArray(analysis.highlights)) {
    analysis.highlights = analysis.highlights
      .map(h => ({ start: clamp(h.start), end: clamp(h.end != null ? h.end : h.start + 5), reason: h.reason || '' }))
      .filter(h => h.end > h.start);
  }
  if (Array.isArray(analysis.thumbnailMoments)) {
    analysis.thumbnailMoments = analysis.thumbnailMoments
      .map(m => ({ time: clamp(m.time), reason: m.reason || '' }))
      .filter(m => m.time >= 0 && m.time < d);
  }
  if (typeof analysis.suggestedLength === 'number') {
    analysis.suggestedLength = Math.max(0, Math.min(d, Math.round(analysis.suggestedLength)));
  }
  return analysis;
}

/**
 * Analyze video for editing suggestions (enhanced)
 * Supports videoId for profile-based insights, edit styles, and accurate data-driven analysis
 */
async function analyzeVideoForEditing(videoMetadata) {
  try {
    const {
      videoId, audioLevels = [],
      // Niche-aware context — supplied by the route from User + UserStyleProfile.
      // All optional; falling back to defaults when absent keeps behaviour
      // unchanged for callers that haven't migrated.
      niche, platform, language, styleProfile,
      // userId — when present, the analysis pulls the creator's
      // performance-weighted top performers from their post history
      // (Wave B feedback loop) and biases the AI's suggestions toward
      // what's actually worked for THIS creator.
      userId,
    } = videoMetadata;

    // Gather accurate context (duration, silence, scenes, transcript) when videoId present
    const ctx = await getAccurateAnalysisContext(videoId, videoMetadata);
    const duration = ctx.duration > 0 ? ctx.duration : (videoMetadata.duration || 60);
    const transcript = ctx.transcript || videoMetadata.transcript || null;

    let baseScore = 50;
    let workspaceId = null;
    if (ctx.content) {
      workspaceId = ctx.content.workspaceId;
      const meta = ctx.content.metadata || {};
      const levels = audioLevels.length ? audioLevels : (meta.audioLevels || []);
      const metadataForScore = { streams: ctx.resolution ? [{ codec_type: 'video', width: parseInt(ctx.resolution.split('x')[0], 10) || 1920, height: parseInt(ctx.resolution.split('x')[1], 10) || 1080 }] : [] };
      baseScore = calculateQualityScore(metadataForScore, transcript, levels, duration);
    }

    const profileInsights = workspaceId ? await getProfileVideoInsights(workspaceId) : null;
    const editStyles = getEditStylesWithScores(baseScore);

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured');
      return validateAndClampAnalysis({
        suggestedEdits: ['Refine first 1–3s as niche-specific hook; use intentional silence and pacing.', 'Add captions for accessibility and reach.'],
        recommendedCuts: [],
        suggestedLength: duration,
        contentType: inferContentType(transcript, duration),
        profileInsights,
        editStyles,
        baseScore: Math.round(baseScore),
      }, duration);
    }

    // Build prompt with concrete data for accuracy
    const silenceBlock = ctx.silenceSegments.length > 0
      ? `\nDetected silence segments (use these for recommendedCuts when possible - use exact start/end):\n${ctx.silenceSegments.slice(0, 40).map(s => `  ${s.start.toFixed(1)}s - ${(s.end || s.start).toFixed(1)}s (${((s.end || s.start) - s.start).toFixed(1)}s)`).join('\n')}`
      : '';
    const sceneBlock = ctx.sceneTimes.length > 0
      ? `\nDetected scene boundaries (seconds): ${ctx.sceneTimes.slice(0, 30).map(t => t.toFixed(1)).join(', ')}${ctx.sceneTimes.length > 30 ? ' ...' : ''}`
      : '';
    const transcriptBlock = ctx.transcriptExcerpt
      ? `\nTranscript excerpt (use for suggestedEdits and hook/highlights):\n---\n${ctx.transcriptExcerpt}\n---\nRepetitive/filler phrases: ${ctx.repetitionSummary}`
      : '\nTranscript: Not available.';

    // Fetch the creator's performance-weighted top performers. The helper
    // catches its own errors and returns null on cold-start or DB issues,
    // so a failed lookup never breaks the analysis.
    const topPerformers = userId
      ? await require('./marketingKnowledge').getTopPerformingPlaybook(userId, niche, platform).catch(() => null)
      : null;
    const creatorContext = nicheStyleContext({ niche, platform, language, styleProfile, topPerformers });
    const prompt = `You are Click's AI Video Intelligence Engine — the world's most advanced viral content strategist and video editor.
Analyze this video and return JSON only.

${creatorContext}VIDEO FACTS (use these exact bounds):
- Duration: ${duration.toFixed(1)} seconds (all timestamps must be in [0, ${duration.toFixed(1)}])
- Resolution: ${ctx.resolution || 'Unknown'}
${silenceBlock}${sceneBlock}${transcriptBlock}

RULES:
1. recommendedCuts: Only suggest cuts within detected silence segments; use exact start/end. Every cut must have start < end and both in [0, ${duration.toFixed(1)}].
2. suggestedLength: Must be between ${Math.max(0, Math.floor(duration * 0.5))} and ${Math.ceil(duration)}.
3. hookScore (0-100): How viral is the opening 3 seconds? Base on energy, clarity, and scroll-stop potential.
4. hookText: Rewrite the opening hook for maximum virality (1-2 sentences, active voice, no generic clickbait).
5. viralMoments: Timestamp-linked moments most likely to be shared. Each: { time, text, reason, emotion, triggerType: "curiosity|authority|FOMO|social_proof|shock|value" }.
6. suggestedCaptions: 4-8 punchy captions with timestamps. Each: { text, startTime, endTime, style: "hook|stat|question|punchline|CTA" }. Text UPPERCASE, max 10 words.
7. niche: Content category (fitness, finance, tech, lifestyle, food, business, education, entertainment, etc.)
8. topPlatform: Best platform ("tiktok"|"instagram"|"youtube_shorts"|"linkedin"|"youtube").
9. cta: Best call-to-action phrase for this specific content (5-10 words).
10. narrativeStructure: "hook-story-reveal"|"problem-solution"|"list"|"rant"|"educational"|"entertaining"|"documentary".
11. suggestedEdits: Reference specific timestamps. Favor niche-specific hooks in 1-3s, one outcome per clip, burned-in concise captions.
12. contentType: "tutorial"|"vlog"|"podcast"|"short_form"|"ad"|"general".

Return valid JSON with ALL these fields: recommendedCuts, transitions, audioAdjustments, pacingImprovements, highlights, suggestedLength, thumbnailMoments, suggestedEdits, contentType, hookScore, hookText, viralMoments, suggestedCaptions, niche, topPlatform, cta, narrativeStructure, and optionally hookSuggestion, clipOutcome.`;

    const systemMsg = 'You are Click AI — a world-class video intelligence engine. Return only valid JSON. All timestamps must be within the video duration. Be EXTREMELY creative, specific, and data-driven.';
    const fullPrompt = `${systemMsg}\n\n${prompt}

CREATIVE DIVERGENCE PROTOCOL:
- Do NOT provide generic advice. 
- Look for non-obvious emotional spikes or subtle logic shifts in the transcript.
- Your hook rewrites should be visceral, scroll-stopping, and unique.
- Each suggested caption should have a distinct "vibe" (e.g., mysterious, authoritative, punchy).`;

    const analysisText = await geminiGenerate(fullPrompt, { temperature: 0.85, maxTokens: 6000 });
    let analysis = parseGeminiJson(analysisText);
    if (!analysis || typeof analysis !== 'object') {
      logger.warn('Gemini analysis JSON unparseable — using neutral defaults', {
        videoId,
        rawPreview: String(analysisText || '').slice(0, 200),
      });
      // Soft-fall to a neutral shape so the downstream pipeline still renders,
      // rather than aborting the entire auto-edit run.
      analysis = {
        recommendedCuts: [], transitions: [], audioAdjustments: [], pacingImprovements: [],
        highlights: [], suggestedLength: Math.min(60, Math.ceil(duration)),
        thumbnailMoments: [], suggestedEdits: [], contentType: inferContentType(transcript, duration),
        hookScore: null, hookText: null, viralMoments: [], suggestedCaptions: [],
        niche: null, topPlatform: null, cta: null, narrativeStructure: null,
      };
    }

    analysis = validateAndClampAnalysis(analysis, duration);
    analysis.profileInsights = profileInsights;
    analysis.editStyles = editStyles;
    analysis.baseScore = Math.round(baseScore);
    analysis.energyProfile = ctx.energyProfile;
    // Ensure all viral intelligence fields are present
    if (!analysis.hookScore && analysis.hookScore !== 0) analysis.hookScore = null;
    if (!analysis.hookText) analysis.hookText = null;
    if (!Array.isArray(analysis.viralMoments)) analysis.viralMoments = [];
    if (!Array.isArray(analysis.suggestedCaptions)) analysis.suggestedCaptions = [];
    if (!analysis.niche) analysis.niche = null;
    if (!analysis.topPlatform) analysis.topPlatform = null;
    if (!analysis.cta) analysis.cta = null;
    if (!analysis.narrativeStructure) analysis.narrativeStructure = null;
    if (!analysis.suggestedEdits || !Array.isArray(analysis.suggestedEdits)) {
      analysis.suggestedEdits = ['Refine first 1–3s as a niche-specific hook.', 'Remove dead air; use intentional silence and pacing.', 'Add captions for reach.'];
    }
    if (!analysis.contentType) analysis.contentType = inferContentType(transcript, duration);

    logger.info('Video analyzed for editing', { duration, hookScore: analysis.hookScore, niche: analysis.niche, viralMoments: analysis.viralMoments.length, captions: analysis.suggestedCaptions.length });
    return analysis;
  } catch (error) {
    logger.error('Analyze video for editing error', { error: error.message });
    throw error;
  }
}

/**
 * Infer content type from transcript and duration (fallback when model returns general)
 */
function inferContentType(transcript, duration) {
  if (!transcript && duration <= 0) return 'general';
  const text = (transcript || '').toLowerCase();
  const words = text.split(/\s+/).length;
  const wps = duration > 0 ? words / duration : 0;
  if (duration <= 60 && words < 150) return 'short_form';
  if (text.includes('step') && (text.includes('how to') || text.includes('tutorial'))) return 'tutorial';
  if (wps < 1.5 && duration > 120) return 'podcast';
  if (text.includes('subscribe') || text.includes('follow') || text.includes('link in bio')) return 'ad';
  return 'general';
}

/**
 * Detect scenes using FFmpeg (real detection)
 */
async function detectScenes(videoId, videoMetadata = {}) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
      throw new Error(`Input video file not found at ${inputPath}`);
    }

    logger.info('Detecting scenes with FFmpeg', { videoId });
    const sceneTimes = await detectSceneChanges(inputPath, 0.3);

    const scenes = [];
    const duration = videoMetadata.duration || content.originalFile.duration || 60;

    sceneTimes.forEach((time, index) => {
      scenes.push({
        id: index + 1,
        startTime: time,
        endTime: index < sceneTimes.length - 1 ? sceneTimes[index + 1] : duration,
        type: 'scene',
        confidence: 0.9,
      });
    });

    if (scenes.length === 0) {
      scenes.push({ id: 1, startTime: 0, endTime: duration, type: 'scene', confidence: 0.5 });
    }

    logger.info('Scenes detected', { videoId, sceneCount: scenes.length });
    return { scenes, totalScenes: scenes.length };
  } catch (error) {
    logger.error('Detect scenes error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Smart cut detection (enhanced)
 */
async function detectSmartCuts(videoId, videoMetadata) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    const {
      transcript = null,
      audioLevels = [],
      scenes = [],
    } = videoMetadata;

    const cuts = [];

    // Detect silence
    if (fs.existsSync(inputPath) && !inputPath.startsWith('http')) {
      const silencePeriods = await detectSilencePeriods(inputPath, -30, 0.5);
      silencePeriods.forEach(silence => {
        cuts.push({
          type: 'silence',
          timestamp: silence.start,
          duration: silence.duration,
          confidence: 0.9,
        });
      });
    }

    // Detect repetitive phrases from transcript
    if (transcript) {
      const repetitivePhrases = analyzeTranscriptForRepetition(transcript);
      repetitivePhrases.forEach((phrase, index) => {
        cuts.push({
          type: 'repetition',
          timestamp: (index * 10), // Approximate, would need word-level timestamps for accuracy
          duration: 2,
          confidence: 0.85,
          reason: `Repetitive phrase: "${phrase.phrase}"`,
        });
      });
    }

    // Scene changes
    scenes.forEach((scene, index) => {
      if (index > 0) {
        cuts.push({
          type: 'scene_change',
          timestamp: scene.startTime,
          duration: 0.5,
          confidence: 0.8,
        });
      }
    });

    logger.info('Smart cuts detected', { videoId, cuts: cuts.length });
    return { cuts, totalCuts: cuts.length };
  } catch (error) {
    logger.error('Detect smart cuts error', { error: error.message, videoId });
    throw error;
  }
}

// Export remaining functions (keeping existing implementations)
async function processChromaKey(videoId, settings = {}) {
  try {
    const {
      keyColor = { r: 0, g: 255, b: 0 },
      similarity = 0.3,
      blend = 0.1,
    } = settings;

    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    const hexColor = `0x${keyColor.r.toString(16).padStart(2, '0')}${keyColor.g.toString(16).padStart(2, '0')}${keyColor.b.toString(16).padStart(2, '0')}`;
    const outputFilename = `chromakey-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, '../../uploads/videos', outputFilename);

    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([
          `colorkey=${hexColor}:${similarity}:${blend}`,
          'format=yuva420p'
        ])
        .output(outputPath)
        .on('start', (cmd) => logger.info('FFmpeg Chroma Key started', { command: cmd }))
        .on('end', async () => {
          const uploadResult = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId });
          resolve({ success: true, url: uploadResult.url });
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } catch (error) {
    logger.error('Chroma key error', { error: error.message });
    throw error;
  }
}

/**
 * Returns concrete edit suggestions grounded in the marketing playbooks for
 * the creator's niche + platform. Each item is shaped for the AiAssistant's
 * one-tap apply chips: { id, kind, timeRange, rationale, frameworkId,
 * expectedRetentionDelta, confidence }.
 *
 * The retention curve drives where each suggestion lands on the timeline
 * (0–2s hook, 2–5s proof, 15–25s mid-roll re-hook, 25–end CTA), the niche
 * playbook drives copy, and the hook framework library backs the headline
 * rewrites. Falls back to a sensible default for unknown niches.
 */
async function getInteractiveSuggestions(videoId, opts = {}) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const duration = content.originalFile?.duration || content.duration || 60;
    const niche    = opts.niche    || content.niche    || 'other';
    const platform = opts.platform || content.platform || 'tiktok';
    const language = opts.language || 'en';
    const slice = getKnowledgeSlice({ niche, platform, language, stage: 'edit' });
    const np = slice.nichePlaybook;
    const pp = slice.platformPlaybook;
    const retention = slice.retention;

    // Map retention-curve marks to absolute seconds within this video.
    const markToRange = (mark) => {
      // marks like '0–2s', '2–5s', '15–25s', '25–end'
      const m = String(mark).match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?|end)/);
      if (!m) return null;
      const start = Math.min(parseFloat(m[1]), duration);
      const end = m[2] === 'end' ? duration : Math.min(parseFloat(m[2]), duration);
      return start < end ? { start, end } : null;
    };

    // Select the strongest hook framework logic based on early sentiment
    const angle = (np.angles || [])[0] || 'a clear, specific outcome';
    const trigger = (np.triggers || [])[0] || 'specific numbers';

    let suggestions = [];
    const transcript = content.transcript || content.text || null;

    if (transcript && geminiConfigured) {
      try {
        const geminiPrompt = `You are Click's Creative Editor. 
Analyze this video transcript and provide 5-8 HIGHLY CREATIVE, content-specific editing suggestions.
Each suggestion should be actionable and linked to a timestamp.

CREATIVE RULES:
- Use specific quotes or moments from the transcript.
- Suggest non-obvious cuts, visual metaphors, or audio shifts.
- Avoid generic "add a hook" advice — tell the creator EXACTLY what to do with the ${niche} content.

Transcript: "${transcript.substring(0, 3000)}"
Duration: ${duration}s
Niche: ${niche}
Platform: ${platform}

Return valid JSON:
{
  "suggestions": [
    {
      "id": "sg-0",
      "kind": "hook|caption|cta|cut|effect",
      "time": number,
      "description": "actionable advice...",
      "rationale": "why this works...",
      "frameworkId": "curiosity-gap|pattern-break|etc"
    }
  ]
}`;
        const raw = await geminiGenerate(geminiPrompt, { temperature: 0.9, maxTokens: 1500 });
        const result = parseGeminiJson(raw);
        if (result && Array.isArray(result.suggestions)) {
          suggestions = result.suggestions.map((s, i) => ({
            ...s,
            id: s.id || `sg-${i}`,
            type: s.kind === 'cut' ? 'cut' : s.kind === 'caption' ? 'caption' : s.kind === 'hook' ? 'hook' : 'effect',
            expectedRetentionDelta: s.kind === 'hook' ? 0.22 : 0.12,
            confidence: 0.9,
          }));
        }
      } catch (e) {
        logger.warn('Gemini interactive suggestions failed, using playbook fallback', { error: e.message });
      }
    }

    if (suggestions.length === 0) {
      suggestions = retention.map((r, i) => {
        const range = markToRange(r.mark) || { start: i * 5, end: Math.min((i + 1) * 5, duration) };
        const fw = HOOK_FRAMEWORKS[i % HOOK_FRAMEWORKS.length];
        const kind =
          i === 0 ? 'hook' :
            i === 1 ? 'caption' :
              i === retention.length - 1 ? 'cta' :
                'cut';
        const description =
          kind === 'hook'    ? `Tighten ${range.start.toFixed(1)}–${range.end.toFixed(1)}s to a ${fw.id} hook anchored to "${angle}". ${r.rule}` :
            kind === 'caption' ? `Burn a ${pp.captionStyle.toLowerCase()} caption with a ${trigger} between ${range.start.toFixed(1)}s and ${range.end.toFixed(1)}s.` :
              kind === 'cta'     ? `Land the CTA at ${range.start.toFixed(1)}s. ${pp.cta}` :
                `Insert a re-hook around ${range.start.toFixed(1)}s using the ${fw.id} framework: ${r.rule}`;
        return {
          id: `sg-${i}`,
          kind,
          time: range.start,
          timeRange: range,
          type: kind === 'cut' ? 'cut' : kind === 'caption' ? 'caption' : kind === 'hook' ? 'hook' : 'effect',
          description,
          rationale: r.rule,
          frameworkId: fw.id,
          expectedRetentionDelta: kind === 'hook' ? 0.18 : kind === 'cta' ? 0.05 : 0.09,
          confidence: kind === 'hook' || kind === 'cta' ? 0.86 : 0.78,
        };
      });
    }

    return {
      success: true,
      niche: slice.niche,
      platform: slice.platform,
      duration,
      suggestions,
      angles: np.angles.slice(0, 5),
      avoid: np.avoid.slice(0, 3),
    };
  } catch (error) {
    logger.error('Interactive suggestions error', { error: error.message });
    throw error;
  }
}

async function applyVisualEffects(videoId, effectType, intensity = 1.0) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    const outputFilename = `vfx-${effectType}-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, '../../uploads/videos', outputFilename);

    let filterChain = [];
    if (effectType === 'film-grain') {
      filterChain.push(`noise=alls=${intensity * 10}:allf=t+u`);
    } else if (effectType === 'cinematic') {
      filterChain.push('drawbox=y=0:h=ih/8:t=fill:c=black,drawbox=y=ih-ih/8:h=ih/8:t=fill:c=black');
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filterChain)
        .output(outputPath)
        .on('end', async () => {
          const uploadResult = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId });
          resolve({ success: true, url: uploadResult.url });
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } catch (error) {
    logger.error('Visual FX error', { error: error.message });
    throw error;
  }
}

async function autoJumpcut(videoId, silenceThreshold = -30, minSilenceDuration = 0.5) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    const outputFilename = `jumpcut-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, '../../uploads/videos', outputFilename);

    const silencePeriods = await detectSilencePeriods(inputPath, silenceThreshold, minSilenceDuration);
    const cutFilter = buildCutFilter(silencePeriods, [], content.originalFile.duration || 60);

    // buildCutFilter returns an OBJECT { videoFilter, audioFilter } or null
    // (when there is nothing to cut). Never feed an empty/placeholder string
    // to .videoFilters() — passing the object directly or 'null' produced a
    // broken/no-op select. When there are no cuts, fall back to a clean
    // passthrough copy and log it, rather than emitting an invalid filter.
    return new Promise((resolve, reject) => {
      const cmd = ffmpeg(inputPath);
      if (cutFilter && cutFilter.videoFilter && cutFilter.audioFilter) {
        cmd
          .videoFilters([cutFilter.videoFilter])
          .audioFilters([cutFilter.audioFilter, 'aresample=async=1']);
      } else {
        logger.warn('Auto-jumpcut found no cuttable silence; copying source unchanged', {
          videoId, silenceCount: silencePeriods.length,
        });
        cmd.outputOptions(['-c', 'copy']);
      }
      cmd
        .output(outputPath)
        .on('end', async () => {
          const uploadResult = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId, type: 'jumpcut' });
          resolve({ success: true, url: uploadResult.url });
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } catch (error) {
    logger.error('Auto-jumpcut error', { error: error.message });
    throw error;
  }
}

async function refitVideo(videoId, format = '9:16') {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    const outputFilename = `refit-${format.replace(':', '-')}-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, '../../uploads/videos', outputFilename);

    let cropFilter = '';
    if (format === '9:16') {
      cropFilter = 'crop=ih*9/16:ih:(iw-ow)/2:0';
    } else if (format === '1:1') {
      cropFilter = 'crop=ih:ih:(iw-ow)/2:0';
    } else {
      cropFilter = 'scale=1920:1080';
    }

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([cropFilter, 'scale=1080:-2'])
        .output(outputPath)
        .on('end', async () => {
          const uploadResult = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId, type: 'refit' });
          resolve({ success: true, url: uploadResult.url, format });
        })
        .on('error', (err) => reject(err))
        .run();
    });
  } catch (error) {
    logger.error('Refit video error', { error: error.message });
    throw error;
  }
}

async function applyAllAiSuggestions(videoId, suggestions = []) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    logger.info('Applying bulk AI suggestions', { videoId, suggestionCount: suggestions.length });

    // Fetch energy profile if available to drive dynamic transitions
    let energyProfile = content.metadata?.energyProfile || [];
    if (energyProfile.length === 0 && content.originalFile?.url) {
      const inputPath = content.originalFile.url.startsWith('/')
        ? path.join(__dirname, '../..', content.originalFile.url)
        : null;
      if (inputPath && fs.existsSync(inputPath)) {
        energyProfile = await getAudioService().getAudioEnergyProfile(inputPath).catch(() => []);
      }
    }
    const timelineData = suggestions.map((s) => {
      // Find energy level at this timestamp
      const time = s.time || s.startTime || 0;
      const energySample = energyProfile.find(p => p.time >= time - 0.2 && p.time <= time + 0.2) || { energy: 0.5 };
      const energy = energySample.energy;

      let style = 'none';
      if (energy > 0.8) {
        style = Math.random() > 0.5 ? 'glitch' : 'zoom';
      } else if (energy > 0.4) {
        style = Math.random() > 0.5 ? 'crossfade' : 'slide';
      } else {
        style = 'none';
      }

      return {
        ...s,
        appliedAt: Date.now(),
        varietyStyle: style,
        transitionParams: style === 'zoom' ? 'zoompan=z=\'min(zoom+0.0015,1.5)\':d=125:s=1920x1080' : ''
      };
    });

    return {
      success: true,
      message: `Successfully planned ${suggestions.length} edits with varied transitions`,
      timeline: timelineData
    };
  } catch (error) {
    logger.error('Apply bulk suggestions error', { error: error.message });
    throw error;
  }
}

/**
 * Get quality improvement recommendations
 */
async function getQualityRecommendations(videoId) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const metadata = await new Promise((resolve, reject) => {
      const inputPath = content.originalFile.url.startsWith('/')
        ? path.join(__dirname, '../..', content.originalFile.url)
        : content.originalFile.url;
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const duration = metadata.format.duration || 0;
    const transcript = content.transcript?.text || content.metadata?.transcript || null;
    const audioLevels = content.metadata?.audioLevels || [];
    const qualityScore = calculateQualityScore(metadata, transcript, audioLevels, duration);

    const recommendations = [];

    // Duration recommendations
    if (duration < 15) {
      recommendations.push({
        type: 'duration',
        priority: 'high',
        message: 'Video is too short. Consider extending to 15-60 seconds for better engagement.',
        impact: '+15 quality points',
      });
    } else if (duration > 300) {
      recommendations.push({
        type: 'duration',
        priority: 'medium',
        message: 'Video is quite long. Consider creating shorter clips (15-60s) for social media.',
        impact: '+10 quality points',
      });
    }

    // Audio recommendations
    if (audioLevels.length > 0) {
      const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
      if (avgLevel < 0.1) {
        recommendations.push({
          type: 'audio',
          priority: 'high',
          message: 'Audio levels are very low. Enable audio enhancement.',
          impact: '+20 quality points',
        });
      }
    }

    // Transcript recommendations
    if (!transcript) {
      recommendations.push({
        type: 'transcript',
        priority: 'medium',
        message: 'No transcript available. Generate transcript for better editing and captions.',
        impact: '+10 quality points',
      });
    } else {
      const wordCount = transcript.split(/\s+/).length;
      const wordsPerSecond = wordCount / duration;
      if (wordsPerSecond < 1) {
        recommendations.push({
          type: 'pacing',
          priority: 'medium',
          message: 'Speech pacing is slow. Consider speeding up by 5-10%.',
          impact: '+8 quality points',
        });
      }
    }

    // Resolution recommendations
    const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
    if (videoStream) {
      if (videoStream.width < 1280 || videoStream.height < 720) {
        recommendations.push({
          type: 'resolution',
          priority: 'low',
          message: 'Video resolution is below HD. Consider using 1080p or higher for better quality.',
          impact: '+5 quality points',
        });
      }
    }

    return {
      qualityScore,
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      estimatedImprovement: recommendations.reduce((sum, r) => {
        const points = parseInt(r.impact.match(/\d+/)?.[0] || '0', 10);
        return sum + points;
      }, 0),
    };
  } catch (error) {
    logger.error('Get quality recommendations error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Edit Presets - Professional one-click styles
 */
const EDIT_PRESETS = {
  cinematic: {
    name: 'Cinematic',
    description: 'Film-like quality with dramatic color grading',
    options: {
      enableColorGrading: true,
      colorGradingStyle: 'cinematic',
      enableStabilization: true,
      addTransitions: true,
      transitionStyle: 'fade',
      enhanceAudio: true,
      optimizePacing: false,
      removeSilence: true,
      enableAutoZoom: false,
      enableTextOverlays: false,
      enableSmartCaptions: false,
      captionStyle: 'professional',
      useMultiModalScenes: true,
      sceneThreshold: 0.25,
      minSceneLength: 1.5,
    },
    videoFilters: ['curves=all=\'0/0 0.5/0.45 1/1\':preset=strong', 'eq=contrast=1.2:brightness=-0.05:saturation=0.9'],
    audioFilters: ['loudnorm=I=-16:TP=-1.5:LRA=11', 'highpass=f=80'],
  },
  vlog: {
    name: 'Vlog Style',
    description: 'Energetic, fast-paced vlog editing',
    options: {
      enableColorGrading: true,
      colorGradingStyle: 'bright',
      enableStabilization: true,
      addTransitions: true,
      transitionStyle: 'quick',
      enhanceAudio: true,
      optimizePacing: true,
      removeSilence: true,
      removePauses: true,
      enableAutoZoom: true,
      enableTextOverlays: true,
      optimizeHook: true,
      enableSmartCaptions: true,
      captionStyle: 'bold',
      useMultiModalScenes: true,
      workflowType: 'general',
    },
    videoFilters: ['eq=contrast=1.15:brightness=0.05:saturation=1.1'],
    audioFilters: ['loudnorm=I=-14:TP=-1.5:LRA=11', 'highpass=f=100'],
  },
  podcast: {
    name: 'Podcast',
    description: 'Clean, minimal editing for audio-focused content',
    options: {
      enableColorGrading: false,
      enableStabilization: false,
      addTransitions: false,
      enhanceAudio: true,
      optimizePacing: false,
      removeSilence: true,
      removePauses: true,
      enableAutoZoom: false,
      enableTextOverlays: false,
      enableNoiseReduction: true,
      enableAudioDucking: true,
      enableSmartCaptions: true,
      captionStyle: 'minimal',
      useMultiModalScenes: false,
    },
    videoFilters: [],
    audioFilters: ['loudnorm=I=-16:TP=-1.5:LRA=11', 'highpass=f=80:lowpass=f=8000', 'afftdn=nr=15:nf=-30'],
  },
  tiktok: {
    name: 'TikTok Ready',
    description: 'Optimized for TikTok with quick cuts and captions',
    options: {
      platform: 'tiktok',
      enableColorGrading: true,
      colorGradingStyle: 'vibrant',
      enableStabilization: true,
      addTransitions: true,
      transitionStyle: 'quick',
      enhanceAudio: true,
      optimizePacing: true,
      removeSilence: true,
      removePauses: true,
      enableAutoZoom: true,
      enableTextOverlays: true,
      optimizeHook: true,
      minSilenceDuration: 0.3,
      enableSmartCaptions: true,
      captionStyle: 'tiktok',
      useMultiModalScenes: true,
      workflowType: 'tiktok',
      sceneThreshold: 0.35,
      minSceneLength: 0.8,
    },
    videoFilters: ['eq=contrast=1.2:brightness=0.03:saturation=1.15'],
    audioFilters: ['loudnorm=I=-12:TP=-1.5:LRA=11'],
  },
  youtube: {
    name: 'YouTube Optimized',
    description: 'Professional YouTube editing with chapters',
    options: {
      platform: 'youtube',
      enableColorGrading: true,
      colorGradingStyle: 'professional',
      enableStabilization: true,
      addTransitions: true,
      transitionStyle: 'smooth',
      enhanceAudio: true,
      optimizePacing: true,
      removeSilence: true,
      enableAutoZoom: false,
      enableTextOverlays: true,
      enableNoiseReduction: true,
      enableSmartCaptions: true,
      captionStyle: 'youtube',
      useMultiModalScenes: true,
      workflowType: 'youtube',
      sceneThreshold: 0.3,
      minSceneLength: 1.2,
    },
    videoFilters: ['eq=contrast=1.1:brightness=0.02:saturation=1.05'],
    audioFilters: ['loudnorm=I=-16:TP=-1.5:LRA=11', 'highpass=f=80:lowpass=f=15000'],
  },
};

/**
 * Edit styles with potential score bonuses and ranking (for AI auto-edit UI)
 * Used to show users ranked options with estimated impact on video score
 */
const EDIT_STYLES = [
  { id: 'tiktok', name: 'TikTok / Reels', preset: 'tiktok', captionStyle: 'tiktok', scoreBonus: 12, reason: 'Best for short-form retention and hook', rank: 1 },
  { id: 'youtube', name: 'YouTube Optimized', preset: 'youtube', captionStyle: 'youtube', scoreBonus: 10, reason: 'Professional pacing and chapters', rank: 2 },
  { id: 'cinematic', name: 'Cinematic', preset: 'cinematic', captionStyle: 'cinematic', scoreBonus: 9, reason: 'Strong retention and premium look', rank: 3 },
  { id: 'vlog', name: 'Vlog Style', preset: 'vlog', captionStyle: 'modern', scoreBonus: 8, reason: 'Engaging cuts and viewer-friendly', rank: 4 },
  { id: 'podcast', name: 'Podcast', preset: 'podcast', captionStyle: 'minimal', scoreBonus: 7, reason: 'Clean audio and clarity', rank: 5 },
];

/**
 * Get profile video analytics for a workspace (for analysis accuracy)
 */
async function getProfileVideoInsights(workspaceId) {
  if (!workspaceId) return null;
  try {
    const videoMetricsService = require('./videoMetricsService');
    const analytics = await videoMetricsService.getVideoMetricsAnalytics(workspaceId, {});
    if (!analytics || analytics.totalVideos === 0) return null;
    return {
      totalVideos: analytics.totalVideos,
      averageViewThroughRate: Math.round((analytics.averageViewThroughRate || 0) * 100) / 100,
      averageCompletionRate: Math.round((analytics.averageCompletionRate || 0) * 100) / 100,
      averageWatchTime: Math.round(analytics.averageWatchTime || 0),
      averageRetention: Math.round((analytics.averageRetention || 0) * 100) / 100,
      topPerformersCount: (analytics.topPerformers || []).length,
      message: `Based on ${analytics.totalVideos} video(s) in your workspace. Your top content averages ${Math.round(analytics.averageCompletionRate || 0)}% completion.`,
    };
  } catch (e) {
    logger.warn('Profile video insights failed', { workspaceId, error: e.message });
    return null;
  }
}

/**
 * Compute video score (0–100) for current or edited video; used for potential score and new score after edit
 */
async function computeVideoScore(videoId, options = {}) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');
    const url = options.editedVideoUrl || content.originalFile?.url;
    if (!url || url.startsWith('http')) {
      // Remote or already-uploaded: use stored metadata if available
      const meta = content.metadata?.autoEditHistory?.stats || content.originalFile || {};
      const duration = meta.duration || content.originalFile?.duration || 60;
      const transcript = content.transcript?.text || content.metadata?.transcript || null;
      const audioLevels = content.metadata?.audioLevels || [];
      const score = calculateQualityScore({ streams: [] }, transcript, audioLevels, duration);
      const factors = [
        { name: 'Duration', value: `${Math.round(duration)}s`, impact: duration >= 30 && duration <= 60 ? 'optimal' : 'ok' },
        { name: 'Captions', value: transcript ? 'Yes' : 'No', impact: transcript ? 'good' : 'missing' },
        { name: 'Pacing', value: transcript ? 'Analyzed' : 'Unknown', impact: 'ok' },
      ];
      return { score: Math.round(score), factors };
    }
    const inputPath = path.join(__dirname, '../..', url);
    if (!fs.existsSync(inputPath)) {
      const score = calculateQualityScore({ streams: [] }, content.transcript?.text, content.metadata?.audioLevels || [], content.originalFile?.duration || 60);
      return { score: Math.round(score), factors: [{ name: 'Source', value: 'Metadata only', impact: 'ok' }] };
    }
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => { if (err) reject(err); else resolve(data); });
    });
    const duration = metadata.format.duration || 0;
    const transcript = content.transcript?.text || content.metadata?.transcript || null;
    const audioLevels = content.metadata?.audioLevels || [];
    const score = calculateQualityScore(metadata, transcript, audioLevels, duration);
    const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
    const factors = [
      { name: 'Duration', value: `${Math.round(duration)}s`, impact: duration >= 30 && duration <= 60 ? 'optimal' : 'ok' },
      { name: 'Resolution', value: videoStream ? `${videoStream.width}x${videoStream.height}` : 'Unknown', impact: videoStream && videoStream.width >= 1280 ? 'good' : 'ok' },
      { name: 'Captions', value: transcript ? 'Yes' : 'No', impact: transcript ? 'good' : 'missing' },
      { name: 'Audio', value: audioLevels.length > 0 ? 'Levels analyzed' : 'Unknown', impact: 'ok' },
    ];
    return { score: Math.round(Math.min(100, Math.max(0, score))), factors };
  } catch (error) {
    logger.error('Compute video score error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get edit styles with potential scores (based on base score + style bonus)
 */
function getEditStylesWithScores(baseScore) {
  return EDIT_STYLES.map(style => ({
    id: style.id,
    name: style.name,
    description: style.reason,
    preset: style.preset,
    captionStyle: style.captionStyle,
    potentialScore: Math.min(100, baseScore + style.scoreBonus),
    scoreBonus: style.scoreBonus,
    rank: style.rank,
  })).sort((a, b) => (b.potentialScore - a.potentialScore) || (a.rank - b.rank));
}

/**
 * Get edit preset by name
 */
function getEditPreset(presetName) {
  return EDIT_PRESETS[presetName.toLowerCase()] || null;
}

/**
 * List all available presets
 */
function listEditPresets() {
  return Object.values(EDIT_PRESETS).map(preset => ({
    id: preset.name.toLowerCase(),
    name: preset.name,
    description: preset.description,
  }));
}

/**
 * Apply preset to editing options
 */
function applyPresetToOptions(presetName, customOptions = {}) {
  const preset = getEditPreset(presetName);
  if (!preset) {
    throw new Error(`Preset "${presetName}" not found`);
  }
  return {
    ...preset.options,
    ...customOptions, // Allow overrides
  };
}

/**
 * Generate preview frames before full edit
 */
async function generateEditPreview(videoId, editingOptions = {}) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
      throw new Error(`Input video file not found`);
    }

    // Get video metadata
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });

    const duration = metadata.format.duration || 0;
    const previewFrames = [];
    const frameTimes = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration - 1].filter(t => t >= 0);

    // Generate preview frames with edits applied
    for (const frameTime of frameTimes) {
      const framePath = path.join(__dirname, '../../uploads/previews', `preview-${videoId}-${frameTime.toFixed(1)}.jpg`);
      if (!fs.existsSync(path.dirname(framePath))) {
        fs.mkdirSync(path.dirname(framePath), { recursive: true });
      }

      await new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Apply same filters as full edit (simplified for preview)
        if (editingOptions.enableColorGrading) {
          command.videoFilters('eq=contrast=1.1:brightness=0.02:saturation=1.05');
        }

        command
          .screenshots({
            timestamps: [frameTime],
            filename: path.basename(framePath),
            folder: path.dirname(framePath),
            size: '640x360',
          })
          .on('end', () => {
            previewFrames.push({
              time: frameTime,
              url: `/uploads/previews/${path.basename(framePath)}`,
            });
            resolve();
          })
          .on('error', reject);
      });
    }

    return {
      success: true,
      previewFrames,
      estimatedDuration: duration * 0.85, // Estimate reduction
      estimatedImprovements: [
        'Silence removal',
        'Audio enhancement',
        'Color grading',
      ],
    };
  } catch (error) {
    logger.error('Generate edit preview error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Create before/after comparison video
 */
async function createComparisonVideo(videoId) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const originalPath = content.metadata?.autoEditHistory?.originalFile?.url
      ? (content.metadata.autoEditHistory.originalFile.url.startsWith('/')
        ? path.join(__dirname, '../..', content.metadata.autoEditHistory.originalFile.url)
        : content.metadata.autoEditHistory.originalFile.url)
      : null;

    const editedPath = content.originalFile.url.startsWith('/')
      ? path.join(__dirname, '../..', content.originalFile.url)
      : content.originalFile.url;

    if (!originalPath || !fs.existsSync(originalPath)) {
      throw new Error('Original video not found in edit history');
    }
    if (!fs.existsSync(editedPath)) {
      throw new Error('Edited video not found');
    }

    const outputFilename = `comparison-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, '../../uploads/videos', outputFilename);

    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    // Create side-by-side comparison
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(originalPath)
        .input(editedPath)
        .complexFilter([
          {
            filter: 'scale',
            options: '640:-1',
            inputs: '0:v',
            outputs: 'original_scaled'
          },
          {
            filter: 'scale',
            options: '640:-1',
            inputs: '1:v',
            outputs: 'edited_scaled'
          },
          {
            filter: 'hstack',
            inputs: ['original_scaled', 'edited_scaled'],
            outputs: 'comparison'
          }
        ])
        .outputOptions(['-map [comparison]', '-map 0:a'])
        .output(outputPath)
        .on('start', () => {
          logger.info('Comparison video generation started', { videoId });
        })
        .on('end', async () => {
          const uploadResult = await uploadFile(outputPath, `videos/${outputFilename}`, 'video/mp4', { videoId });
          logger.info('Comparison video created', { videoId, url: uploadResult.url });
          resolve({
            success: true,
            comparisonUrl: uploadResult.url,
          });
        })
        .on('error', (err) => {
          logger.error('Comparison video error', { videoId, error: err.message });
          reject(err);
        })
        .run();
    });
  } catch (error) {
    logger.error('Create comparison video error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Save edit version for undo/redo
 */
async function saveEditVersion(videoId, versionName = null) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    if (!content.metadata) content.metadata = {};
    if (!content.metadata.editVersions) content.metadata.editVersions = [];

    const version = {
      id: Date.now().toString(),
      name: versionName || `Version ${content.metadata.editVersions.length + 1}`,
      createdAt: new Date(),
      videoUrl: content.originalFile.url,
      editsApplied: content.metadata.autoEditHistory?.editsApplied || [],
      stats: content.metadata.autoEditHistory?.stats || {},
    };

    content.metadata.editVersions.push(version);

    // Keep only last 10 versions
    if (content.metadata.editVersions.length > 10) {
      content.metadata.editVersions = content.metadata.editVersions.slice(-10);
    }

    await commitContent(content);
    logger.info('Edit version saved', { videoId, versionId: version.id });
    return version;
  } catch (error) {
    logger.error('Save edit version error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Restore edit version
 */
async function restoreEditVersion(videoId, versionId) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const version = content.metadata?.editVersions?.find(v => v.id === versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    // Restore the video URL
    content.originalFile.url = version.videoUrl;
    await commitContent(content);

    logger.info('Edit version restored', { videoId, versionId });
    return {
      success: true,
      restoredVersion: version,
    };
  } catch (error) {
    logger.error('Restore edit version error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Batch auto-edit multiple videos
 */
async function batchAutoEdit(videoIds, editingOptions = {}) {
  try {
    const results = {
      total: videoIds.length,
      completed: [],
      failed: [],
      inProgress: [],
    };

    logger.info('Starting batch auto-edit', { count: videoIds.length });

    // Process in parallel (limit concurrency)
    const concurrency = editingOptions.concurrency || 3;
    const batches = [];
    for (let i = 0; i < videoIds.length; i += concurrency) {
      batches.push(videoIds.slice(i, i + concurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (videoId) => {
        try {
          results.inProgress.push(videoId);
          const result = await autoEditVideo(videoId, editingOptions);
          results.completed.push({ videoId, result });
          results.inProgress = results.inProgress.filter(id => id !== videoId);
          return { videoId, success: true, result };
        } catch (error) {
          results.failed.push({ videoId, error: error.message });
          results.inProgress = results.inProgress.filter(id => id !== videoId);
          return { videoId, success: false, error: error.message };
        }
      });

      await Promise.allSettled(batchPromises);
    }

    logger.info('Batch auto-edit completed', {
      total: results.total,
      completed: results.completed.length,
      failed: results.failed.length,
    });

    return results;
  } catch (error) {
    logger.error('Batch auto-edit error', { error: error.message });
    throw error;
  }
}

/**
 * Get edit performance analytics
 */
/**
 * GENERATES A DYNAMIC ZOOMPAN FILTER BASED ON VIRAL MOMENTS
 * Creates ultra-smooth cinematic push-ins during high-engagement segments.
 */
function generateKineticZoomChain(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  let zoomExpr = '1.0';
  const jolts = viralMoments.slice(0, 6);
  
  jolts.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 2.5, duration); // 2.5s smooth push-in
    // Smooth linear zoom from 1.0 to 1.15 over the duration of the moment
    // zoom = 1.0 + 0.15 * (it - s) / (e - s)
    const smoothZoom = `(1.0+0.15*(it-${s.toFixed(2)})/${(e - s).toFixed(2)})`;
    zoomExpr = `if(between(it\\,${s.toFixed(2)}\\,${e.toFixed(2)})\\,${smoothZoom}\\,${zoomExpr})`;
  });

  // Using zoompan with d=1 to output exactly 1 frame per input frame, preserving the exact video duration.
  return `zoompan=z='${zoomExpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
}

/**
 * GENERATES A FLASH CUT FILTER
 * Creates a brief, high-energy exposure flash at the start of viral moments to mimic a cinematic jump cut.
 */
function generateFlashCutsFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  let eqExpr = '1.0';
  // Limit to 5 flashes to prevent excessive strobing
  const flashes = viralMoments.slice(0, 5);
  
  flashes.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 0.15, duration); // Ultra-fast 150ms flash
    // Boost contrast massively for a split second. Commas escaped for filtergraph safety.
    eqExpr = `if(between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})\\,1.8\\,${eqExpr})`;
  });

  if (eqExpr === '1.0') return null;
  // Boost contrast and brightness simultaneously during the flash window
  return `eq=contrast='${eqExpr}':brightness='if(gt(${eqExpr},1.0),0.3,0.0)'`;
}

/**
 * GENERATES A SHOCK JITTER FILTER
 * Physically shakes the camera frame during high-impact 'shock' moments.
 */
function generateShockJitterFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  // Broadened: fire on any high-energy moment, not just exact 'shock' match
  const shocks = viralMoments.filter(m => 
    m.emotion === 'shock' || m.triggerType === 'shock' || 
    m.triggerType === 'value' || m.emotion === 'surprise' || 
    m.emotion === 'hype' || m.emotion === 'excitement'
  ).slice(0, 3);
  // Fallback: if no explicit matches, use the first 2 viral moments anyway for energy
  const effectiveMoments = shocks.length > 0 ? shocks : viralMoments.slice(0, 2);
  if (effectiveMoments.length === 0) return null;
  
  let xExpr = '0';
  let yExpr = '0';
  effectiveMoments.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 0.4, duration); // 0.4s of intense shake
    
    // Create a random jitter expression using FFmpeg's random generator
    // random(1) generates between 0.0 and 1.0. We want a variance of -20 to +20 pixels.
    const jitterX = `(random(1)*40-20)`;
    const jitterY = `(random(1)*40-20)`;
    xExpr = `if(between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})\\,${jitterX}\\,${xExpr})`;
    yExpr = `if(between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})\\,${jitterY}\\,${yExpr})`;
  });

  // To prevent black edges during the shake, we crop the image slightly (zoom in by 40px) 
  // and then move the crop box around randomly.
  return `crop=iw-40:ih-40:20+${xExpr}:20+${yExpr},scale=1080:1920`;
}

/**
 * GENERATES A SUB-BASS BOOM FILTER
 * Enhances the low-end frequencies during a "shock" or "hype" moment to simulate a cinematic impact sound.
 */
function generateSubBassBoomFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  // Boost bass globally by +8dB to create a rich, warm broadcast-quality voice.
  // Dynamic EQ evaluation in the bass filter is not supported by FFmpeg and causes crashes.
  return `bass=f=60:width_type=q:width=0.5:g=8`;
}

/**
 * GENERATES A VACUUM DROP FILTER (AUDIO)
 * Mutes the audio for 0.3 seconds exactly BEFORE a punchline to create a tension vacuum.
 */
function generateVacuumDropFilter(viralMoments) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  // Broadened: vacuum drops on reveals, insights, punchlines for tension building
  const punchlines = viralMoments.filter(m => 
    m.triggerType === 'value' || m.emotion === 'shock' || m.emotion === 'surprise' ||
    m.triggerType === 'curiosity' || m.emotion === 'reveal'
  ).slice(0, 2);
  // Fallback: pick the single most impactful moment
  const effectivePunchlines = punchlines.length > 0 ? punchlines : viralMoments.slice(0, 1);
  if (effectivePunchlines.length === 0) return null;
  
  let volExpr = '1.0';
  effectivePunchlines.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s) || s < 0.5) return;
    const dropStart = Math.max(0, s - 0.3); // 0.3s before impact
    // Mute during the drop window. Commas escaped for filtergraph safety.
    volExpr = `if(between(t\\,${dropStart.toFixed(2)}\\,${s.toFixed(2)})\\,0.0\\,${volExpr})`;
  });

  if (volExpr === '1.0') return null;
  return `volume=eval=frame:volume='${volExpr}'`;
}

/**
 * GENERATES A COLOR ISOLATION FILTER (VIDEO)
 * Drops saturation to 0 (Grayscale) during serious, sad, or ranting moments to change context instantly.
 */
function generateColorIsolationFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  // Broadened: grayscale on dramatic/serious moments OR any moment with emotional weight
  const dramatic = viralMoments.filter(m => 
    m.emotion === 'sad' || m.triggerType === 'FOMO' || m.emotion === 'serious' ||
    m.reason?.toLowerCase().includes('serious') || m.reason?.toLowerCase().includes('rant') ||
    m.reason?.toLowerCase().includes('important') || m.reason?.toLowerCase().includes('real')
  ).slice(0, 2);
  if (dramatic.length === 0) return null; // Only apply when genuinely dramatic
  
  let satExpr = '1.0';
  dramatic.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 2.0, duration); // 2 seconds of grayscale
    // Drain saturation to 0.0. Commas escaped for filtergraph safety.
    satExpr = `if(between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})\\,0.0\\,${satExpr})`;
  });

  if (satExpr === '1.0') return null;
  return `eq=saturation='${satExpr}'`;
}

/**
 * GENERATES A SECRET TELEPHONE VOICE FILTER (AUDIO)
 * Engages a bandpass filter during "secret" or "conspiracy" moments to simulate a leaked phone call.
 */
function generateSecretTelephoneFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  const secrets = viralMoments.filter(m => m.emotion === 'secret' || m.triggerType === 'conspiracy' || (m.reason && m.reason.toLowerCase().includes('secret'))).slice(0, 2);
  if (secrets.length === 0) return null;
  
  let enableExpr = '';
  secrets.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 3.0, duration); // 3 seconds of phone voice
    enableExpr += (enableExpr ? '+' : '') + `between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})`;
  });

  if (!enableExpr) return null;
  // Apply a telephone EQ: highpass at 400Hz, lowpass at 3000Hz
  return `highpass=f=400:enable='${enableExpr}',lowpass=f=3000:enable='${enableExpr}'`;
}

/**
 * GENERATES A CYBER GLITCH FILTER (VIDEO)
 * Applies a digital corruption/noise effect during controversial or FOMO moments.
 */
function generateCyberGlitchFilter(viralMoments, duration) {
  if (!viralMoments || !Array.isArray(viralMoments) || viralMoments.length === 0) return null;

  // Broadened: glitch on high-energy moments for visual punctuation
  const glitches = viralMoments.filter(m => 
    m.triggerType === 'FOMO' || m.triggerType === 'controversial' || m.emotion === 'hype' ||
    m.triggerType === 'shock' || m.emotion === 'excitement' || m.emotion === 'surprise'
  ).slice(0, 3);
  // Fallback: if Gemini gave us moments but none matched, use one for energy
  const effectiveGlitches = glitches.length > 0 ? glitches : viralMoments.slice(0, 1);
  if (effectiveGlitches.length === 0) return null;
  
  let enableExpr = '';
  effectiveGlitches.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 0.2, duration); // 0.2 seconds of intense glitch
    enableExpr += (enableExpr ? '+' : '') + `between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})`;
  });

  if (!enableExpr) return null;
  return `noise=alls=100:allf=t+u:enable='${enableExpr}',eq=contrast=1.5:enable='${enableExpr}'`;
}

// ─── 2026 VFX Pack ────────────────────────────────────────────────────────────

function generateRGBSplitFilter(viralMoments, duration) {
  if (!Array.isArray(viralMoments) || viralMoments.length === 0) return null;
  const moments = viralMoments.slice(0, 4);
  let enableExpr = moments.map(m => {
    const s = Number(m.time); if (isNaN(s)) return null;
    const e = Math.min(s + 0.3, duration);
    return `between(t\\,${s.toFixed(2)}\\,${e.toFixed(2)})`;
  }).filter(Boolean).join('+');
  if (!enableExpr) return null;
  // Chromatic aberration via hue+saturation burst — safe on all FFmpeg builds
  return `hue=h=0:s=1.8:enable='${enableExpr}',eq=contrast=1.3:saturation=0.1:enable='${enableExpr}'`;
}

function generateFilmBurnFilter(sceneChanges, duration) {
  if (!Array.isArray(sceneChanges) || sceneChanges.length === 0) return null;
  const transitions = sceneChanges.slice(0, 4);
  let brightnessExpr = '0';
  transitions.forEach(t => {
    const s = Math.max(0, t - 0.15).toFixed(3);
    const e = Math.min(t + 0.15, duration).toFixed(3);
    brightnessExpr = `if(between(t\\,${s}\\,${e})\\,0.4*(1-abs(t-${Number(t).toFixed(3)})/0.15)\\,${brightnessExpr})`;
  });
  if (brightnessExpr === '0') return null;
  return `eq=brightness='${brightnessExpr}':saturation=1.4:gamma_r=1.3:gamma_g=1.0:gamma_b=0.7`;
}

function generateWhipPanBlurFilter(sceneChanges, duration) {
  if (!Array.isArray(sceneChanges) || sceneChanges.length === 0) return null;
  const cuts = sceneChanges.slice(0, 5);
  const enableExpr = cuts.map(t => {
    const s = Math.max(0, t - 0.1).toFixed(3);
    const e = Math.min(t + 0.1, duration).toFixed(3);
    return `between(t\\,${s}\\,${e})`;
  }).join('+');
  if (!enableExpr) return null;
  return `tblend=all_mode=average:enable='${enableExpr}'`;
}

function generateVignettePulseFilter(viralMoments, duration) {
  if (!Array.isArray(viralMoments) || viralMoments.length === 0) return null;
  const moments = viralMoments.slice(0, 5);
  let angleExpr = 'PI/5';
  moments.forEach(m => {
    const s = Number(m.time); if (isNaN(s)) return;
    const e = Math.min(s + 0.5, duration).toFixed(3);
    angleExpr = `if(between(t\\,${s.toFixed(3)}\\,${e})\\,PI/2.5\\,${angleExpr})`;
  });
  return `vignette='${angleExpr}'`;
}

function generateLightLeakFilter(sceneChanges, duration) {
  if (!Array.isArray(sceneChanges) || sceneChanges.length === 0) return null;
  const cuts = sceneChanges.slice(0, 3);
  const enableExpr = cuts.map(t => {
    const s = Math.max(0, t - 0.25).toFixed(3);
    const e = Math.min(t + 0.35, duration).toFixed(3);
    return `between(t\\,${s}\\,${e})`;
  }).join('+');
  if (!enableExpr) return null;
  // Warm orange flare at scene transitions
  return `eq=brightness=0.35:saturation=0.3:gamma_r=1.6:gamma_g=1.2:gamma_b=0.6:enable='${enableExpr}'`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function getEditPerformanceAnalytics(videoId) {
  try {
    const content = await resolveContent(videoId);
    if (!content) throw new Error('Content not found');

    const editHistory = content.metadata?.autoEditHistory;
    if (!editHistory) {
      return { message: 'No edit history available' };
    }

    // Calculate improvements
    const durationReduction = editHistory.originalFile?.duration && content.originalFile.duration
      ? ((editHistory.originalFile.duration - content.originalFile.duration) / editHistory.originalFile.duration * 100).toFixed(1)
      : 0;

    return {
      videoId,
      editsApplied: editHistory.editsApplied || [],
      creativeFeatures: editHistory.creativeFeatures || [],
      qualityImprovement: editHistory.qualityScore?.improvement || 0,
      durationReduction: `${durationReduction}%`,
      stats: editHistory.stats || {},
      editedAt: editHistory.editedAt,
    };
  } catch (error) {
    logger.error('Get edit performance analytics error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Export a single source video into multiple aspect ratios (e.g. 9:16
 * for TikTok/Reels, 1:1 for feed, 16:9 for YouTube). Auto-centers crops
 * the source, scales to a standard short-form resolution per ratio, and
 * preserves audio. This is the "1 upload → every platform" feature
 * competitors like Opus Clip charge for.
 *
 * Each ratio is exported in parallel where possible. Returns an array of
 * { ratio, url, size } so the caller can render a download / share grid.
 */
async function exportAspectRatios(videoId, aspectRatios = ['9:16', '1:1', '16:9']) {
  const content = await resolveContent(videoId);
  if (!content) throw new Error('Content not found');

  const sourceUrl = content.originalFile?.url;
  if (!sourceUrl) throw new Error('Content has no source video to re-export');
  const inputPath = sourceUrl.startsWith('/')
    ? path.join(__dirname, '../..', sourceUrl)
    : sourceUrl;
  if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
    throw new Error(`Source video not found at ${inputPath}`);
  }

  // Map each requested ratio to the canonical short-form resolution that
  // platform CDNs accept without further re-encoding. Crops are
  // centered; FFmpeg's `crop` filter will trim whichever side is wider
  // than the target ratio.
  const RATIO_CONFIGS = {
    '9:16': { w: 1080, h: 1920, label: '9:16 (Reels/TikTok/Shorts)' },
    '1:1':  { w: 1080, h: 1080, label: '1:1 (Feed)' },
    '16:9': { w: 1920, h: 1080, label: '16:9 (YouTube/X)' },
    '4:5':  { w: 1080, h: 1350, label: '4:5 (IG Portrait)' },
  };

  const exportsDir = path.join(__dirname, '../../uploads/exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

  const ratios = aspectRatios.filter((r) => RATIO_CONFIGS[r]);
  if (ratios.length === 0) {
    throw new Error(`No supported aspect ratios in: ${aspectRatios.join(', ')}`);
  }

  const exports = await Promise.all(ratios.map(async (ratio) => {
    const cfg = RATIO_CONFIGS[ratio];
    const safeRatio = ratio.replace(':', 'x');
    const outName = `aspect-${videoId}-${safeRatio}-${Date.now()}.mp4`;
    const outPath = path.join(exportsDir, outName);

    // crop = centered crop to the target ratio, scale = pad to canonical
    // resolution, setsar = correct aspect metadata for downstream readers.
    const cropFilter = `crop='min(iw,ih*${cfg.w}/${cfg.h}):min(ih,iw*${cfg.h}/${cfg.w})',scale=${cfg.w}:${cfg.h}:flags=lanczos,setsar=1`;

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(cropFilter)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset', 'veryfast', '-crf', '21', '-movflags', '+faststart'])
        .output(outPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    if (!fs.existsSync(outPath)) {
      throw new Error(`Aspect ratio export missing output for ${ratio}`);
    }
    const stats = fs.statSync(outPath);
    if (stats.size < 4096) {
      try { fs.unlinkSync(outPath); } catch (_) { /* ignore deletion error */ }
      throw new Error(`Aspect ratio export ${ratio} produced a too-small file (${stats.size} bytes)`);
    }

    return {
      ratio,
      label: cfg.label,
      url: `/uploads/exports/${outName}`,
      size: stats.size,
      resolution: `${cfg.w}x${cfg.h}`,
    };
  }));

  logger.info('Multi-aspect export complete', {
    videoId,
    ratios: exports.map(e => e.ratio),
  });
  return { success: true, exports };
}

module.exports = {
  analyzeVideoForEditing,
  autoEditVideo,
  computeVideoScore,
  detectScenes,
  detectSmartCuts,
  processChromaKey,
  getInteractiveSuggestions,
  applyVisualEffects,
  autoJumpcut,
  refitVideo,
  applyAllAiSuggestions,
  getQualityRecommendations,
  calculateQualityScore,
  getPlatformOptimizations,
  // Excellence features
  getEditPreset,
  listEditPresets,
  applyPresetToOptions,
  generateEditPreview,
  createComparisonVideo,
  saveEditVersion,
  restoreEditVersion,
  batchAutoEdit,
  // New advanced features
  autoSelectMusic,
  generateAndApplySmartCaptions,
  exportMultipleFormats,
  exportAspectRatios,
  getEditPerformanceAnalytics,
};

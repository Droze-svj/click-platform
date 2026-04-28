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
 * Compose an additional context block that biases AI prompts toward the
 * creator's niche, target platform, language, and recent style picks. Returns
 * an empty string when no usable context is provided so callers can safely
 * concatenate without conditionals.
 */
function nicheStyleContext({ niche, platform, language, styleProfile } = {}) {
  if (!niche && !platform && !styleProfile) return '';
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
    const top = (arr, k) =>
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
  return lines.join('\n') + '\n';
}

/**
 * Unified save helper for both Mongoose models and DevStore objects
 */
async function commitContent(content) {
  if (!content) return;
  
  // If it's a Mongoose model instance, it has a .save() function
  if (typeof content.save === 'function') {
    return await content.save();
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

/**
 * Analysis result cache — 10-minute TTL per videoId
 * Prevents redundant Gemini calls when re-triggering edits on the same video
 */
const ANALYSIS_CACHE = new Map();
const ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedAnalysis(videoId) {
  const entry = ANALYSIS_CACHE.get(videoId);
  if (!entry) return null;
  if (Date.now() - entry.ts > ANALYSIS_CACHE_TTL_MS) {
    ANALYSIS_CACHE.delete(videoId);
    return null;
  }
  return entry.data;
}

function setCachedAnalysis(videoId, data) {
  ANALYSIS_CACHE.set(videoId, { data, ts: Date.now() });
  // Cap cache size at 50 entries
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
    const analysis = JSON.parse(raw || '{}');
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
  return new Promise((resolve) => {
    const beats = [];
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-af', 'beatdetect',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Beat detection output parsing (simplified)
        const beatMatch = stderrLine.match(/beat at ([\d.]+)/i);
        if (beatMatch) {
          beats.push(parseFloat(beatMatch[1]));
        }
      })
      .on('end', () => {
        resolve(beats.sort((a, b) => a - b));
      })
      .on('error', () => {
        resolve([]); // Fallback if beat detection fails
      });

    command.output('/dev/null').run();
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
    `between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)})`
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
async function detectKeyMoments(transcript, duration, audioLevels = []) {
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
      const geminiPrompt = `You are Click's AI Video Intelligence Engine — the world's most advanced content strategy AI.
      
Analyze this transcript and return a JSON object with deep, platform-native insights:

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

Return ONLY valid JSON. Be brutally specific, data-driven and creative.`;

      const raw = await geminiGenerate(geminiPrompt, { temperature: 0.4, maxTokens: 1800 });
      let cleanRaw = (raw || '{}').replace(/```json\n?|\n?```/g, '').trim();
      const gemini = JSON.parse(cleanRaw);
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
    
    zoomExpression = `if(between(it,${s},${e}),${smoothZoom},${zoomExpression})`;
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
    `volume=enable='between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)})':volume='0.3'`
  );

  return volumeParts.join(',');
}

/**
 * Auto-select music based on content sentiment, mood, and Phase 0 Intelligence
 */
async function autoSelectMusic(videoId, sentiment, duration) {
  try {
    // Retrieve the highly-accurate genre chosen by Gemini in Phase 0
    const targetGenre = global.lastAISelectedGenre || 'upbeat_pop';
    
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
async function autoEditVideo(videoId, editingOptions = {}, userId = null) {
  try {
    let bRollPlan = [];
    let commerceInlays = [];
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
    } = editingOptions;

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
      }
    }

    const pacingPresets = {
      gentle: { minSilenceDuration: 0.8, silenceThreshold: -25 },
      medium: { minSilenceDuration: 0.5, silenceThreshold: -30 },
      aggressive: { minSilenceDuration: 0.3, silenceThreshold: -35 },
    };
    const pacing = pacingPresets[pacingIntensity] || pacingPresets.medium;
    const effectiveMinSilence = pacingPresets[pacingIntensity] ? pacing.minSilenceDuration : minSilenceDuration;
    const effectiveSilenceThreshold = pacingPresets[pacingIntensity] ? pacing.silenceThreshold : silenceThreshold;

    logger.info('Auto-edit options (Opus+)', { clipTargetLength, clipCount, contentGenre, prioritizeHook: optimizeHookOption, aspectRatiosToExport, effectiveWorkflow, pacingIntensity: pacingIntensity || 'medium' });

    const content = await resolveContent(videoId);
    if (!content) throw new Error('Video content not found');

    const inputPath = content.originalFile.url.startsWith('/')
      ? path.relative(process.cwd(), path.join(__dirname, '../..', content.originalFile.url))
      : content.originalFile.url;

    if (!inputPath.startsWith('http') && !fs.existsSync(path.join(process.cwd(), inputPath))) {
      throw new Error(`Input video file not found at ${inputPath}`);
    }

    const outputFilename = `auto-edit-${videoId}-${Date.now()}.mp4`;
    const outputPath = path.relative(process.cwd(), path.join(__dirname, '../../uploads/videos', outputFilename));
    const tempPath = path.relative(process.cwd(), path.join(__dirname, '../../uploads/temp', `temp-${outputFilename}`));

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

    let duration = metadata.format.duration || 0;
    let globalTimeOffset = 0;
    let globalDuration = duration;
    const transcript = content.transcript?.text || content.metadata?.transcript || null;
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

    // 🚀 Neural Speed Ramping (2026 Pacing Standard)
    if (optimizePacing) {
      const speedFactor = pacingIntensity === 'aggressive' ? 0.9 : pacingIntensity === 'gentle' ? 1.1 : 1.0;
      if (speedFactor !== 1.0) {
        videoFilters.push(`setpts=${speedFactor}*PTS`);
        audioFilters.push(`atempo=${(1/speedFactor).toFixed(2)}`);
        appliedEdits.push(`Neural Speed Ramping (${pacingIntensity})`);
      }
    }

    // Get platform optimizations
    const platformOpts = getPlatformOptimizations(platform);

    // PHASE 0: 2026 AUTONOMOUS PRE-FLIGHT ORCHESTRATION
    // This step completely removes the need for user input by autonomously deducing
    // the optimal pacing, style, and effects based on the video's actual semantic content.
    if (transcript && geminiConfigured && enableSmartCaptions) {
      emitProgress('analysis', 8, 'Autonomous AI analyzing content profile...');
      try {
        const preFlightPrompt = `You are Click's Autonomous Video Architect (2026 Edition).
Analyze this transcript and autonomously decide the PERFECT editing configuration. Override standard presets to maximize retention and virality.

Return ONLY valid JSON:
{
  "pacingIntensity": "aggressive|medium|slow",
  "captionStyle": "tiktok|bold|outline|modern|professional",
  "enableAutoZoom": true|false,
  "enableColorGrading": true|false,
  "musicGenre": "phonk|lofi|dark_ambient|synthwave|upbeat_pop|cinematic",
  "viralExtraction": {
    "shouldExtract": true|false,
    "startTime": 0.0,
    "endTime": 60.0
  },
  "reasoning": "Explain why you chose this exact configuration for this specific video"
}

Transcript: "${transcript.substring(0, 1500)}"`;

        const rawPreflight = await geminiGenerate(preFlightPrompt, { temperature: 0.3, maxTokens: 400 });
        const cleanPreflight = (rawPreflight || '{}').replace(/```json\n?|\n?```/g, '').trim();
        const preflightData = JSON.parse(cleanPreflight);
        
        // Autonomously override settings to match optimal viral logic
        if (preflightData.pacingIntensity) pacingIntensity = preflightData.pacingIntensity;
        if (preflightData.captionStyle) captionStyle = preflightData.captionStyle;
        if (preflightData.enableAutoZoom !== undefined) enableAutoZoom = preflightData.enableAutoZoom;
        if (preflightData.enableColorGrading !== undefined) enableColorGrading = preflightData.enableColorGrading;
        
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

        // Store musicGenre locally to pass to autoSelectMusic
        global.lastAISelectedGenre = preflightData.musicGenre;

        logger.info('Autonomous Pre-Flight Orchestration Applied', { overrides: preflightData });
        appliedEdits.push(`Autonomous Override: ${preflightData.reasoning || 'AI selected optimal pacing and style'}`);
        creativeFeatures.push('Autonomous Architecture');
      } catch (err) {
        logger.warn('Pre-flight analysis failed, proceeding with standard options');
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
          const moments = await detectKeyMoments(transcript, duration, audioLevels);
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

    const keyMoments = keyMomentsResult.moments || {};
    let textOverlays = keyMomentsResult.overlays || [];
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
        // Sentiment-aware generic fallback
        const energy = sentiment?.energyLevel || 5;
        const hookWord = energy >= 7 ? 'LET’S GO 🔥' : energy >= 5 ? 'WAIT FOR IT' : 'WATCH THIS';
        const midWord = energy >= 7 ? 'INSANE 🤯' : 'MIND BLOWN 🤯';
        textOverlays = [
          { type: 'hook', text: hookWord, startTime: 0, endTime: Math.min(1.5, duration), size: 72, color: '#FFD700', position: 'center' },
          { type: 'highlight', text: midWord, startTime: duration > 4 ? Math.floor(duration / 2) : duration - 1, endTime: duration > 4 ? Math.floor(duration / 2) + 2 : duration, size: 64, color: '#FFFFFF', position: 'bottom' }
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

    // Auto-select music based on sentiment
    if (enableMusicAutoSelect && sentiment) {
      selectedMusic = await autoSelectMusic(videoId, sentiment, duration);
      if (selectedMusic) {
        logger.info('Music selected for video', { videoId, musicId: selectedMusic._id });
      }
    }

    // Generate smart captions if enabled
    if (enableSmartCaptions && transcript) {
      emitProgress('captions', 15, 'Generating smart captions...');
      const captionOverrides = editingOptions.captionFontFamily ? { fontFamily: editingOptions.captionFontFamily } : {};
      const targetLang = editingOptions.targetLang || 'en';
      smartCaptions = await generateAndApplySmartCaptions(videoId, transcript, duration, captionStyle, captionOverrides, null, targetLang);
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
      silencePeriods = await retryWithBackoff(
        () => detectSilencePeriods(inputPath, effectiveSilenceThreshold, effectiveMinSilence),
        2
      );

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
      if (editingOptions.enableBRoll !== false) {
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

      // 🛍️ Phase 15: Neural Commerce Layer (Autonomous Inlays)
      if (editingOptions.enableCommerceInlays !== false) {
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
      // Uses non-repeating Lissajous curves to perfectly simulate a human cameraman.
      videoFilters.push("scale=1150:2044:force_original_aspect_ratio=increase,crop=1080:1920:x='(iw-1080)/2+25*sin(t/3.14)+10*sin(t/5.2)':y='(ih-1920)/2+15*cos(t/2.71)+8*cos(t/4.5)',format=yuv420p");
      appliedEdits.push('Dynamic Cameraman Drift');
      creativeFeatures.push('AI Cameraman Tracking');
    }

    // Quality: 2026 Luma-Cinematic Color Grade (High Contrast, Vibrant Mids)
    if (enableColorGrading) {
      videoFilters.push('eq=contrast=1.15:brightness=0.02:saturation=1.25');
      appliedEdits.push('Luma-Cinematic Grade');
    }

    // Build cut filter if we have silence/scenes to remove
    if (silencePeriods.length > 0 || sceneChanges.length > 0) {
      const cuts = buildCutFilter(silencePeriods, sceneChanges, duration);
      if (cuts) {
        videoFilters.push(cuts.videoFilter);
        audioFilters.push(cuts.audioFilter);
        appliedEdits.push('Precise Cut Removal');
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

    // Quality: Noise reduction (clean voice)
    if (enableNoiseReduction) {
      audioFilters.push('highpass=f=200,lowpass=f=3000,afftdn=nr=10:nf=-25');
      appliedEdits.push('Noise Reduction');
    }

    // Quality: Professional Audio Mastering (normalize loudness for platform standards)
    // Followed by resampling to ensure absolute encoder compatibility
    audioFilters.push('loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100');
    appliedEdits.push('Loudness Mastering');

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

    // 5. Build dynamic Viral Velocity (High retention: slightly speed up entire video for engaging pace)
    // NOTE: Only ONE setpts/atempo allowed per chain to avoid conflicts
    if (optimizePacing) {
      const baseVelocity = pacingIntensity === 'aggressive' ? 1.1 : 1.06;
      const velocityScale = repetitivePhrases.length > 0
        ? Math.min(1.18, baseVelocity + (repetitivePhrases.length * 0.015))
        : baseVelocity;
      videoFilters.push(`setpts=PTS/${velocityScale}`);
      audioFilters.push(`atempo=${velocityScale}`);
      appliedEdits.push('Viral Velocity Optimization (Aggressive)');
      creativeFeatures.push('High-Energy Pace');
    }

    // 5b. KINETIC ZOOM JOLTS & FLASH CUTS (New for 2026)
    if (enableAutoZoom) {
      // Use keyMoments.reactions which contains the mapped viral moments
      const zoomChain = generateKineticZoomChain(keyMoments?.reactions || [], duration);
      if (zoomChain) {
        videoFilters.push(zoomChain);
        creativeFeatures.push('Kinetic Zoom Jolts');
        appliedEdits.push('AI Motion Tracking');
      }
      
      // Add flash impacts on viral triggers for high energy
      const flashChain = generateFlashCutsFilter(keyMoments?.reactions || [], duration);
      if (flashChain) {
        videoFilters.push(flashChain);
        creativeFeatures.push('Flash Impacts');
      }

      // Add Action Camera Shake on 'shock' moments
      const shakeChain = generateShockJitterFilter(keyMoments?.reactions || [], duration);
      if (shakeChain) {
        videoFilters.push(shakeChain);
        creativeFeatures.push('Action Camera Shake');
        appliedEdits.push('Dynamic Camera Shake');
      }

      // Add Color Isolation (B&W shift) on negative/serious moments
      const colorIsolationChain = generateColorIsolationFilter(keyMoments?.reactions || [], duration);
      if (colorIsolationChain) {
        videoFilters.push(colorIsolationChain);
        creativeFeatures.push('B-Roll Color Isolation');
        appliedEdits.push('Thematic Color Shift');
      }

      // Add Cyber Glitch Corruption on controversial/FOMO moments
      const glitchChain = generateCyberGlitchFilter(keyMoments?.reactions || [], duration);
      if (glitchChain) {
        videoFilters.push(glitchChain);
        creativeFeatures.push('Cyber Glitch Effect');
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

          const sty = styleMap[caption.style] || styleMap.default;

          // Dynamic font size based on text length — shorter = bigger impact
          let fontSize = sty.fontSize;
          if (rawText.length < 10) fontSize = Math.round(fontSize * 1.2);
          else if (rawText.length > 35) fontSize = Math.round(fontSize * 0.82);

          const x = '(w-text_w)/2';
          const y = sty.y;
          
          // Offset timestamps dynamically for Viral Clip Extraction
          const s = Math.max(0, Number(caption.startTime ?? 0) - globalTimeOffset).toFixed(3);
          const e = Math.max(0.1, Number(caption.endTime ?? ((caption.startTime ?? 0) + 3)) - globalTimeOffset).toFixed(3);
          
          // Skip rendering if caption is completely outside the newly extracted viral clip bounds
          if (Number(s) >= globalDuration || Number(e) <= 0) return;

          // Kinetic displacement for hooks/punchlines (more aggressive bounce)
          let finalY = sty.y;
          if (caption.style === 'hook' || caption.style === 'punchline') {
            // Add a snappy periodic bounce: + 15px oscillation
            finalY = `${sty.y}-15*sin(2*PI*t/0.4)`;
          }

          // Safe-escape for drawtext: single quotes must be \' in the filter string
          const safeText = rawText.replace(/[\\:]/g, '').replace(/'/g, "\u2019");

          const captionFilter = `drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor='${sty.fontColor}':x='${x}':y='${finalY}':box=1:boxcolor='${sty.bgColor}':boxborderw=18:borderw=${sty.borderw || 2}:bordercolor='${sty.borderColor}':shadowcolor=black@0.8:shadowx=${sty.shadow}:shadowy=${sty.shadow}:enable='between(t,${s},${e})'`;
          videoFilters.push(captionFilter);
        });

        logger.info('AI Caption System applied', { count: captionsToRender.length, sources: [...new Set(captionsToRender.map(c => c.source))] });
      }

      // Creative: Add text overlays (from AI analysis — hook + highlights)
      if (enableTextOverlays && textOverlays.length > 0 && geminiCaptions.length === 0) {
        // Only apply if Gemini captions didn't already cover this
        const overlaysToApply = [
          textOverlays.find(o => o.type === 'hook'),
          ...textOverlays.filter(o => o.type === 'highlight').slice(0, 2)
        ].filter(Boolean);

        overlaysToApply.forEach((overlay) => {
          const fontSize = overlay.size || 36;
          const color = overlay.color || '#FFFFFF';
          const bgColor = (overlay.backgroundColor || 'black@0.7').replace(/rgba\(0,0,0,([0-9.]+)\)/, 'black@$1');
          const x = '(w-text_w)/2';
          const y = overlay.position === 'top' ? '80' : overlay.position === 'bottom' ? 'h-text_h-120' : '(h-text_h)/2';
          
          // Offset timestamps dynamically for Viral Clip Extraction
          const s = Math.max(0, Number(overlay.startTime ?? 0) - globalTimeOffset).toFixed(3);
          const e = Math.max(0.1, Number(overlay.endTime ?? duration) - globalTimeOffset).toFixed(3);
          if (Number(s) >= globalDuration || Number(e) <= 0) return;

          const safeText = (overlay.text || '').replace(/[\\:]/g, '').replace(/'/g, "\u2019");

          const textFilter = `drawtext=text='${safeText}':fontsize=${fontSize}:fontcolor='${color}':x='${x}':y='${y}':box=1:boxcolor='${bgColor}':borderw=2:bordercolor='black':enable='between(t,${s},${e})'`;
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

          const prodName = (inlay.product || 'Product').toUpperCase().replace(/[\\:]/g, '').replace(/'/g, "\u2019");
          const prodPrice = (inlay.price || 'Link in bio').toUpperCase().replace(/[\\:]/g, '').replace(/'/g, "\u2019");
          
          // Outer glass border box
          videoFilters.push(`drawbox=x='(w-500)/2':y='h-text_h-280':w=500:h=160:color=white@0.8:thickness=4:enable='between(t,${startT},${endT})'`);
          // Inner glass fill
          videoFilters.push(`drawbox=x='(w-500)/2':y='h-text_h-280':w=500:h=160:color=black@0.6:t=fill:enable='between(t,${startT},${endT})'`);
          // Product Name
          videoFilters.push(`drawtext=text='SHOP\\: ${prodName}':fontsize=42:fontcolor='#FFD700':x='(w-text_w)/2':y='h-text_h-240':shadowcolor=black@0.9:shadowx=3:shadowy=3:enable='between(t,${startT},${endT})'`);
          // Price / CTA
          videoFilters.push(`drawtext=text='${prodPrice} -> TAP TO BUY':fontsize=32:fontcolor='#FFFFFF':x='(w-text_w)/2':y='h-text_h-180':shadowcolor=black@0.9:shadowx=2:shadowy=2:enable='between(t,${startT},${endT})'`);
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
        const bRollFilter = `[${bRollInputIndex}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[broll${bRollInputIndex}];__TARGET__[broll${bRollInputIndex}]overlay=enable='between(t,${s},${e})':eof_action=pass`;
        
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

    // Physically extract the viral clip from the source video if offset was activated
    if (globalTimeOffset > 0) {
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

      if (musicPath && !musicPath.startsWith('http') && !fs.existsSync(musicPath)) {
        logger.warn('Music file not found, skipping music', { musicPath });
        musicPath = null;
      } else if (musicPath) {
        logger.info('Music will be mixed with video', { videoId, musicId: selectedMusic._id || selectedMusic.id });
      }
    }

    return new Promise((resolve, reject) => {
      let finalCommand = command;

      emitProgress('rendering', 60, 'Rendering edited video...');
      finalCommand
        .output(outputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
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
            if (outputStats.size === 0) {
              throw new Error('Output video file is empty');
            }

            logger.info('Output video verified', { videoId, size: outputStats.size, path: outputPath });

            // Mix music if selected
            let finalVideoPath = outputPath;
            if (musicPath && fs.existsSync(musicPath)) {
              emitProgress('post-processing', 92, 'Mixing background music...');
              const audioService = getAudioService();
              if (audioService) {
                const musicOutputPath = outputPath.replace('.mp4', '-with-music.mp4');
                try {
                  await audioService.mixMusicWithVideo(outputPath, musicPath, musicOutputPath, {
                    musicVolume: 0.25,
                    fadeIn: 2,
                    fadeOut: 2,
                  });
                  finalVideoPath = musicOutputPath;
                  appliedEdits.push('Background Music Added');
                  creativeFeatures.push('Music');
                  logger.info('Music mixed with video', { videoId });
                } catch (musicError) {
                  logger.warn('Music mixing failed, using video without music', { error: musicError.message });
                }
              }
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
            if (enableMultiFormatExport && exportFormats.length > 1) {
              emitProgress('export', 97, 'Exporting to multiple formats...');
              try {
                multiFormatExports = await exportMultipleFormats(videoId, exportFormats);
                logger.info('Multi-format export completed', { videoId, formats: exportFormats });
              } catch (exportError) {
                logger.warn('Multi-format export failed', { error: exportError.message });
              }
            }

            // Save edit history to prevent repetition
            await saveEditHistory(videoId, silencePeriods, appliedEdits.map(e => ({ type: e, time: Date.now() })));

            // Auto-save edit version for undo/redo
            await saveEditVersion(videoId, `Auto-Edit ${new Date().toISOString()}`);

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

            content.generatedContent.shortVideos.push({
              url: uploadResult.url,
              thumbnail: thumbnailUrl,
              duration: finalMetadata.format.duration || content.originalFile.duration,
              caption: 'AI Auto-Edited Video',
              platform: platform,
              highlight: false,
              editsApplied: appliedEdits,
              creativeFeatures: creativeFeatures,
              originalDuration: duration,
              finalDuration: finalMetadata.format.duration,
              keyMoments: keyMoments,
            });

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

            resolve(result);
          } catch (uploadError) {
            logger.error('Upload error after edit', { videoId, error: uploadError.message });
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

          // Clean up partial output file if it exists
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
              logger.info('Cleaned up partial output file', { videoId, outputPath });
            } catch (cleanupError) {
              logger.warn('Failed to cleanup partial file', { videoId, error: cleanupError.message });
            }
          }

          reject(new Error(`Video editing failed: ${err.message}`));
        })
        .run();
    });
  } catch (error) {
    logger.error('Auto-edit video service error', { error: error.message, videoId });
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
        const [silence, scenes] = await Promise.all([
          withTimeout(detectSilencePeriods(inputPath, -30, 0.5), ANALYSIS_DETECTION_TIMEOUT_MS).catch(() => []),
          withTimeout(detectSceneChanges(inputPath, 0.3), ANALYSIS_DETECTION_TIMEOUT_MS).catch(() => []),
        ]);
        ctx.silenceSegments = Array.isArray(silence) ? silence : [];
        ctx.sceneTimes = Array.isArray(scenes) ? scenes : [];
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
      videoId, scenes: scenesInput = [], audioLevels = [],
      // Niche-aware context — supplied by the route from User + UserStyleProfile.
      // All optional; falling back to defaults when absent keeps behaviour
      // unchanged for callers that haven't migrated.
      niche, platform, language, styleProfile,
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

    const creatorContext = nicheStyleContext({ niche, platform, language, styleProfile });
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

    const systemMsg = 'You are Click AI — a world-class video intelligence engine. Return only valid JSON. All timestamps must be within the video duration. Be creative, specific, and data-driven.';
    const fullPrompt = `${systemMsg}\n\n${prompt}`;
    const analysisText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 3000 });
    let analysis;
    try {
      const cleaned = (analysisText || '{}').replace(/```json\n?|\n?```/g, '').trim();
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = cleaned.substring(jsonStart, jsonEnd + 1);
        analysis = JSON.parse(jsonString);
      } else {
        analysis = JSON.parse(cleaned);
      }
    } catch (error) {
      // Final desperate attempt: find first { and last }
      const jsonMatch = (analysisText || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error('Failed to parse video analysis: Invalid JSON structure');
        }
      } else {
        throw new Error('Failed to parse video analysis: No JSON block found');
      }
    }

    analysis = validateAndClampAnalysis(analysis, duration);
    analysis.profileInsights = profileInsights;
    analysis.editStyles = editStyles;
    analysis.baseScore = Math.round(baseScore);
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

    const hookFw = HOOK_FRAMEWORKS[0]; // strongest framework first
    const angle = (np.angles || [])[0] || 'a clear, specific outcome';
    const trigger = (np.triggers || [])[0] || 'specific numbers';

    const suggestions = retention.map((r, i) => {
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
        time: range.start,                    // legacy field for older consumers
        timeRange: range,
        type: kind === 'cut' ? 'cut' : kind === 'caption' ? 'caption' : kind === 'hook' ? 'hook' : 'effect',
        description,
        rationale: r.rule,
        frameworkId: fw.id,
        expectedRetentionDelta: kind === 'hook' ? 0.18 : kind === 'cta' ? 0.05 : 0.09,
        confidence: kind === 'hook' || kind === 'cta' ? 0.86 : 0.78,
      };
    });

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

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters([cutFilter || 'null'])
        .audioFilters(['aresample=async=1'])
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

    const transitionStyles = ['zoom', 'crossfade', 'none', 'glitch'];
    let transitionIdx = 0;

    const timelineData = suggestions.map((s, idx) => {
      const style = transitionStyles[transitionIdx % transitionStyles.length];
      transitionIdx++;

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
        const points = parseInt(r.impact.match(/\d+/)?.[0] || '0');
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
    // zoom = 1.0 + 0.15 * (t - s) / (e - s)
    const smoothZoom = `(1.0+0.15*(t-${s.toFixed(2)})/${(e - s).toFixed(2)})`;
    zoomExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}),${smoothZoom},${zoomExpr})`;
  });

  // Using zoompan with high fps to ensure smooth motion and no jitter. d=99999 prevents frame truncation.
  return `zoompan=z='${zoomExpr}':d=99999:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
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
    // Boost contrast massively for a split second
    eqExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}),1.8,${eqExpr})`;
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
    xExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}),${jitterX},${xExpr})`;
    yExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}),${jitterY},${yExpr})`;
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

  // Broadened: apply bass boom on any impactful moment for cinematic weight
  const impacts = viralMoments.filter(m => 
    m.emotion === 'shock' || m.triggerType === 'shock' || m.emotion === 'hype' ||
    m.triggerType === 'value' || m.triggerType === 'authority' || m.emotion === 'excitement' || m.emotion === 'surprise'
  ).slice(0, 3);
  // Fallback: use first 2 moments if nothing specific matched
  const effectiveImpacts = impacts.length > 0 ? impacts : viralMoments.slice(0, 2);
  if (effectiveImpacts.length === 0) return null;
  
  let gainExpr = '0';
  effectiveImpacts.forEach(m => {
    const s = Number(m.time);
    if (isNaN(s)) return;
    const e = Math.min(s + 1.0, duration); // 1s boom
    // Peak gain of 12dB tapering off linearly
    gainExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}), 12*(1-(t-${s.toFixed(2)})), ${gainExpr})`;
  });

  if (gainExpr === '0') return null;
  // Boost 60Hz by the dynamic gain
  return `bass=f=60:width_type=q:width=0.5:g='${gainExpr}'`;
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
    // Mute during the drop window
    volExpr = `if(between(t,${dropStart.toFixed(2)},${s.toFixed(2)}), 0.0, ${volExpr})`;
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
    // Force saturation to 0
    satExpr = `if(between(t,${s.toFixed(2)},${e.toFixed(2)}), 0.0, ${satExpr})`;
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
    enableExpr += (enableExpr ? '+' : '') + `between(t,${s.toFixed(2)},${e.toFixed(2)})`;
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
    enableExpr += (enableExpr ? '+' : '') + `between(t,${s.toFixed(2)},${e.toFixed(2)})`;
  });

  if (!enableExpr) return null;
  return `noise=alls=100:allf=t+u:enable='${enableExpr}',eq=contrast=1.5:enable='${enableExpr}'`;
}

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
  getEditPerformanceAnalytics,
};

// Video Caption Service - AI-powered auto-captions using OpenAI Whisper API

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Content = require('../models/Content');
const {
  smartSentenceSplit,
  distributeSentencesByCharCount,
  stripFillers,
  dedupeAdjacentCues,
} = require('../utils/subtitleUtils');

// Initialize OpenAI client
let openai = null;
function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('OpenAI not configured for video captions', { error: error.message });
    }
  }
  return openai;
}

/**
 * Generate transcript from video file using Whisper API
 * @param {string} videoFilePath - Path to video file
 * @param {string} language - Language code (optional, auto-detect if not provided)
 * @returns {Promise<Object>} Transcript with text and segments
 */
async function generateTranscript(videoFilePath, language = null) {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI API not configured');
  }

  try {
    logger.info('Generating transcript', { videoFilePath, language });

    // Read video file
    // Create file stream for OpenAI (using fs.createReadStream for Node.js)
    const { createReadStream } = require('fs');
    const fileStream = createReadStream(videoFilePath);

    // Call Whisper API
    const response = await client.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: language || undefined, // Auto-detect if not provided
      response_format: 'verbose_json', // Get detailed response with segments
      timestamp_granularities: ['segment', 'word'], // Get both segment and word-level timestamps
    });

    logger.info('Transcript generated successfully', {
      textLength: response.text?.length || 0,
      segmentsCount: response.segments?.length || 0,
    });

    return {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments || [],
      words: response.words || [],
    };
  } catch (error) {
    logger.error('Error generating transcript', {
      videoFilePath,
      error: error.message,
      stack: error.stack,
    });
    captureException(error, {
      tags: { service: 'videoCaptionService', action: 'generateTranscript' },
    });
    throw error;
  }
}

/**
 * Generate captions for video content
 * @param {string} contentId - Content ID
 * @param {string} videoFilePath - Path to video file
 * @param {Object} options - Options (language, format, etc.)
 * @returns {Promise<Object>} Caption data
 */
async function generateCaptionsForContent(contentId, videoFilePath, options = {}) {
  try {
    const { language, format = 'srt' } = options;

    // Generate transcript
    const transcript = await generateTranscript(videoFilePath, language);

    // Format captions based on requested format
    const formattedCaptions = formatCaptions(transcript, format);

    // Save captions to content
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        transcript: transcript.text,
        captions: {
          text: transcript.text,
          language: transcript.language,
          format,
          segments: transcript.segments,
          words: transcript.words,
          formatted: formattedCaptions,
          generatedAt: new Date(),
        },
      },
    });

    logger.info('Captions saved to content', { contentId, format, language: transcript.language });

    return {
      contentId,
      transcript: transcript.text,
      language: transcript.language,
      format,
      captions: formattedCaptions,
      segments: transcript.segments,
    };
  } catch (error) {
    logger.error('Error generating captions for content', {
      contentId,
      error: error.message,
    });
    captureException(error, {
      tags: { service: 'videoCaptionService', action: 'generateCaptionsForContent' },
    });
    throw error;
  }
}

/**
 * Format transcript into caption format (SRT, VTT, SSA)
 * @param {Object} transcript - Transcript data from Whisper
 * @param {string} format - Format (srt, vtt, ssa)
 * @returns {string} Formatted captions
 */
function formatCaptions(transcript, format = 'srt') {
  const { segments, text } = transcript;

  switch (format.toLowerCase()) {
  case 'srt':
    return formatSRT(segments);
  case 'vtt':
    return formatVTT(segments);
  case 'ssa':
    return formatSSA(segments);
  default:
    return text;
  }
}

/**
 * Format as SRT (SubRip)
 */
function formatSRT(segments) {
  if (!segments || segments.length === 0) {
    return '';
  }

  return segments
    .map((segment, index) => {
      const start = formatSRTTime(segment.start);
      const end = formatSRTTime(segment.end);
      return `${index + 1}\n${start} --> ${end}\n${segment.text}\n`;
    })
    .join('\n');
}

/**
 * Format as VTT (WebVTT)
 */
function formatVTT(segments) {
  if (!segments || segments.length === 0) {
    return '';
  }

  const header = 'WEBVTT\n\n';
  const body = segments
    .map((segment) => {
      const start = formatVTTTime(segment.start);
      const end = formatVTTTime(segment.end);
      return `${start} --> ${end}\n${segment.text}\n`;
    })
    .join('\n');

  return header + body;
}

/**
 * Format as SSA (SubStation Alpha)
 */
function formatSSA(segments) {
  if (!segments || segments.length === 0) {
    return '';
  }

  const header = `[Script Info]
Title: Generated Captions
ScriptType: v4.00

[V4 Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&Hffffff,&Hffffff,&H0,&H0,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = segments
    .map((segment) => {
      const start = formatSSATime(segment.start);
      const end = formatSSATime(segment.end);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${segment.text}`;
    })
    .join('\n');

  return header + events;
}

/**
 * Format time for SRT (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Format time for VTT (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Format time for SSA (H:MM:SS.cc)
 */
function formatSSATime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * Translate captions to another language
 * @param {string} text - Caption text
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateCaptions(text, targetLanguage) {
  const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
  if (!geminiConfigured) {
    throw new Error('Google AI API not configured. Set GOOGLE_AI_API_KEY.');
  }

  try {
    const fullPrompt = `You are a professional translator. Translate the following text to ${targetLanguage}. Maintain the same tone and style. Return only the translation.\n\n${text}`;
    return await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1024 });
  } catch (error) {
    logger.error('Error translating captions', {
      targetLanguage,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Translate per-segment captions while preserving timestamps. Whisper returns
 * { start, end, text } segments — we keep the timing untouched and replace
 * each `text` with its translation. Batches all segments into a single Gemini
 * call so the model can keep tone consistent across the script and we save
 * 90%+ on API calls vs. translating segment-by-segment.
 *
 * Returns a new array of segments; never mutates the input. Falls back to
 * the original segments if Gemini fails so the caller never crashes the
 * caption pipeline because of a translation hiccup.
 */
async function translateSegments(segments, targetLanguage) {
  if (!Array.isArray(segments) || segments.length === 0) return segments || [];
  const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
  if (!geminiConfigured) {
    logger.warn('[caption-translate] Google AI not configured; returning source segments');
    return segments;
  }

  // Pack segments into a JSON array Gemini can return verbatim. Numbered
  // markers help the model keep the order if it accidentally reflows.
  const lines = segments.map((s, i) => `[${i}] ${s.text || ''}`).join('\n');
  const prompt = [
    `You are a professional video-caption translator. Translate the following`,
    `numbered caption lines to ${targetLanguage}. Keep the [N] markers exactly.`,
    `Maintain tone, slang register, and rhythm. Do not merge lines. Do not add`,
    `commentary. Return ONLY the translated lines in the same numbered format.`,
    ``,
    lines,
  ].join('\n');

  try {
    const raw = await geminiGenerate(prompt, { temperature: 0.3, maxTokens: 3000 });
    const lookup = new Map();
    for (const line of (raw || '').split('\n')) {
      const m = line.match(/^\s*\[(\d+)\]\s*(.*)$/);
      if (m) lookup.set(Number(m[1]), m[2].trim());
    }
    return segments.map((s, i) => ({ ...s, text: lookup.get(i) || s.text }));
  } catch (err) {
    logger.error('[caption-translate] segment batch translation failed', { error: err.message, targetLanguage });
    return segments;
  }
}

/**
 * Ensure a content's captions exist in `targetLanguage`. Idempotent: if the
 * source captions are already in that language, returns immediately. If a
 * translation already exists in `captions.translations[targetLanguage]`,
 * returns it. Otherwise generates the translation, persists it, and returns.
 *
 * Returns the captions in the requested language as
 * { language, text, segments, formatted } so the caller can hand them
 * directly to a video player or burn-in pipeline.
 */
async function ensureCaptionsInLanguage(contentId, targetLanguage, format = 'srt') {
  const content = await Content.findById(contentId);
  if (!content) throw new Error('Content not found');
  if (!content.captions?.text) {
    throw new Error('Captions have not been generated yet. Generate base captions first.');
  }
  const target = String(targetLanguage || '').toLowerCase();
  if (!target) throw new Error('targetLanguage required');

  const sourceLang = String(content.captions.language || 'en').toLowerCase();
  // Already in the right language → no-op.
  if (sourceLang === target || sourceLang.split('-')[0] === target.split('-')[0]) {
    return {
      language: sourceLang,
      text: content.captions.text,
      segments: content.captions.segments || [],
      formatted: content.captions.formatted || formatCaptions({ text: content.captions.text, segments: content.captions.segments || [] }, format),
      cached: true,
    };
  }
  // Cached translation exists → return it.
  const cached = content.captions.translations?.[target];
  if (cached?.text && Array.isArray(cached.segments)) {
    return {
      language: target,
      text: cached.text,
      segments: cached.segments,
      formatted: cached.formatted || formatCaptions({ text: cached.text, segments: cached.segments }, format),
      cached: true,
    };
  }

  // Generate the translation, preserving per-segment timing.
  const translatedSegments = await translateSegments(content.captions.segments || [], target);
  const translatedText = translatedSegments.map(s => s.text).join(' ').trim();
  const formatted = formatCaptions({ text: translatedText, segments: translatedSegments }, format);

  // Persist into captions.translations[target].
  const update = {};
  update[`captions.translations.${target}`] = {
    text: translatedText,
    segments: translatedSegments,
    formatted,
    format,
    translatedAt: new Date(),
  };
  await Content.findByIdAndUpdate(contentId, { $set: update });

  return { language: target, text: translatedText, segments: translatedSegments, formatted, cached: false };
}

/**
 * Generate auto-captions from transcript with Cognitive features (Phase 11).
 * Includes: Object-Aware Positioning, Emotion-Sync, and Auto-Highlighting.
 */
async function generateAutoCaptions(videoId, options = {}) {
  const { transcript, videoPath, stripFillerWords = true, aggressiveFillers = false } = options;
  if (!transcript || typeof transcript !== 'string') {
    return { captions: [] };
  }

  const visualAwareness = require('./visualAwarenessService');
  const avoidanceZones = videoPath ? await visualAwareness.getAvoidanceZones(videoPath) : [];
  const safePosition = visualAwareness.calculateSafeCaptionPosition(avoidanceZones);

  try {
    const content = await Content.findById(videoId);
    let segments = [];
    const duration = content?.originalFile?.duration || content?.metadata?.duration || 60;
    const language = content?.language || 'en';

    let words = content?.captions?.words;
    if (Array.isArray(words) && words.length > 0 && stripFillerWords) {
      // Drop "um/uh/eh/etc." while preserving every other word's
      // original timing — caption density goes up without changing the
      // visual rhythm of the speech.
      const before = words.length;
      words = stripFillers(words, { language, aggressive: aggressiveFillers });
      if (before !== words.length) {
        logger.info('captions: stripped filler words', { videoId, removed: before - words.length, language });
      }
    }
    if (words && Array.isArray(words) && words.length > 0) {
      const maxWordsPerLine = 6;
      const maxDuration = 3.5;
      let lineStart = words[0].start ?? 0;
      let lineWords = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const wordStart = w.start ?? 0;
        // Use the next word's start as our end-of-line time when the
        // current word is missing .end — that's tighter than the prior
        // 0.3s assumption which fudged trailing captions to overflow.
        const next = words[i + 1];
        const wordEnd = w.end ?? next?.start ?? wordStart + 0.3;
        lineWords.push(typeof w.word === 'string' ? w.word : w.text || '');
        const lineEnd = wordEnd;
        const lineDuration = lineEnd - lineStart;
        const shouldEmit = lineWords.length >= maxWordsPerLine || lineDuration >= maxDuration || i === words.length - 1;
        if (shouldEmit && lineWords.length > 0) {
          const text = lineWords.join(' ').trim();
          segments.push({
            text,
            startTime: lineStart,
            endTime: lineEnd,
            ...analyzeSentimentAndHighlight(text)
          });
          lineWords = [];
          if (i < words.length - 1) {
            lineStart = words[i + 1].start ?? lineEnd;
          }
        }
      }
    } else {
      // Fallback path: no word-level data available. Use the smart
      // splitter (abbreviation-safe) + proportional timer (long
      // sentence → long span) instead of the prior naive sentence-split
      // + uniform-chunk-duration approach.
      const sentences = smartSentenceSplit(transcript);
      const cues = distributeSentencesByCharCount(sentences, duration);
      segments = cues.map((c) => ({
        text: c.text,
        startTime: c.start,
        endTime: c.end,
        ...analyzeSentimentAndHighlight(c.text),
      }));
    }

    // Final pass: drop adjacent identical lines (Whisper emits these
    // occasionally during silence-bridge regions). Convert/re-export
    // the canonical caption shape after dedupe.
    const cuesShape = segments.map(s => ({ start: s.startTime, end: s.endTime, text: s.text, _full: s }));
    const deduped = dedupeAdjacentCues(cuesShape);
    segments = deduped.map(c => c._full ? { ...c._full, startTime: c.start, endTime: c.end } : { text: c.text, startTime: c.start, endTime: c.end });

    return {
      captions: segments,
      suggestedPosition: safePosition,
      isObjectAware: avoidanceZones.length > 0,
    };
  } catch (error) {
    logger.error('generateAutoCaptions failed', { videoId, error: error.message });
    return { captions: [] };
  }
}

/**
 * AI analysis of text for emotion and auto-highlighting (Phase 10/11)
 * Now incorporates Market Velocity and Trend-Highlighting.
 */
function analyzeSentimentAndHighlight(text) {
  const lowercaseText = text.toLowerCase();
  const predictionService = require('./predictionService');
  
  // Real-time Trend Injection (Simulated lookup)
  const marketTrends = predictionService.ingestMarketTrendsSync?.() || { trendingTopics: [] };
  const hasTrendingTopic = marketTrends.trendingTopics.some(topic => lowercaseText.includes(topic.toLowerCase()));

  // Emotion-Sync tokens
  let animation = null;
  if (/\b(wow|amazing|huge|incredible|boom)\b/.test(lowercaseText)) animation = 'shake-accent';
  else if (/\b(wait|stop|actually|look)\b/.test(lowercaseText)) animation = 'scale-in';
  else if (/\b(shh|quiet|secret|whisper)\b/.test(lowercaseText)) animation = 'fade-glow';
  
  // Phase 10: Trend-Highlighting
  if (hasTrendingTopic) {
    animation = 'shake-accent'; // Override for maximum visibility
  }

  // Auto-Highlighting (detect most significant word)
  // Logic: Highlight the trending topic if present, else use heuristic
  let pivotWord = null;
  const trendingMatch = marketTrends.trendingTopics.find(topic => lowercaseText.includes(topic.toLowerCase()));
  
  if (trendingMatch) {
    pivotWord = trendingMatch;
  } else {
    const highlightWords = text.split(' ').filter(w => w.length > 4); 
    pivotWord = highlightWords.length > 0 ? highlightWords[0] : null;
  }

  return {
    animation,
    pivotWord,
    sentiment: animation ? 'high-energy' : 'neutral',
    isTrendAligned: hasTrendingTopic,
    velocityContext: hasTrendingTopic ? 'high-growth-signal' : 'baseline'
  };
}

/**
 * Apply style options to caption segments.
 */
function styleCaptions(captions, styleOptions = {}) {
  if (!Array.isArray(captions)) return [];
  return captions.map((c) => {
    const style = {
      fontSize: styleOptions.fontSize ?? 42,
      fontColor: styleOptions.fontColor ?? '#FFFFFF',
      backgroundColor: styleOptions.backgroundColor ?? 'rgba(0,0,0,0.75)',
      outline: styleOptions.outline !== false,
      outlineColor: styleOptions.outlineColor ?? '#000000',
      outlineWidth: styleOptions.outlineWidth ?? (styleOptions.outline ? 2 : 0),
      position: styleOptions.position ?? 'bottom',
      fontFamily: styleOptions.fontFamily || 'Arial',
      // Apply emotion-sync overrides
      ...(c.animation === 'shake-accent' && { fontSize: 52, fontColor: '#FFD700' }),
      ...(c.animation === 'fade-glow' && { fontColor: '#ADD8E6', outline: false })
    };
    return { ...c, style };
  });
}

/**
 * Get captions for content
 * @param {string} contentId - Content ID
 * @param {string} format - Caption format (srt, vtt, ssa)
 * @returns {Promise<Object>} Caption data
 */
async function getCaptions(contentId, format = 'srt') {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.captions) {
      throw new Error('Captions not generated for this content');
    }

    // Return formatted captions in requested format
    if (format && content.captions.format !== format) {
      // Re-format if different format requested
      return {
        text: content.captions.text,
        language: content.captions.language,
        format,
        captions: formatCaptions(
          {
            segments: content.captions.segments,
            text: content.captions.text,
          },
          format
        ),
      };
    }

    return {
      text: content.captions.text,
      language: content.captions.language,
      format: content.captions.format,
      captions: content.captions.formatted,
      segments: content.captions.segments,
    };
  } catch (error) {
    logger.error('Error getting captions', { contentId, error: error.message });
    throw error;
  }
}

/**
 * Generate translated captions for content (Phase 15)
 */
async function generateTranslatedCaptions(contentId, targetLang) {
  const Content = require('../models/Content');
  const translationService = require('./globalTranslationService');
  
  try {
    const content = await Content.findById(contentId);
    if (!content || !content.captions?.segments) {
      throw new Error('Original captions not found');
    }

    logger.info(`Phase 15: Generating ${targetLang} translation for content ${contentId}`);
    
    // Translate segments
    const translatedSegments = await translationService.translateSegments(
      content.captions.segments,
      targetLang
    );

    // Save as additional language in content
    if (!content.metadata.translations) content.metadata.translations = {};
    content.metadata.translations[targetLang] = {
      segments: translatedSegments,
      generatedAt: new Date()
    };
    
    await content.save();
    return translatedSegments;
  } catch (err) {
    logger.error('Failed to generate translated captions', { error: err.message, contentId, targetLang });
    throw err;
  }
}

module.exports = {
  generateTranscript,
  generateCaptionsForContent,
  formatCaptions,
  translateCaptions,
  translateSegments,
  ensureCaptionsInLanguage,
  getCaptions,
  generateAutoCaptions,
  styleCaptions,
  generateTranslatedCaptions
};


// Video Caption Service - AI-powered auto-captions
// Click is configured for Gemini-only AI: this service routes through
// utils/googleAI.transcribeAudio. Gemini returns plain transcript text only,
// so segment/word timing is approximated by even time-distribution. Callers
// that need true word-level timing should treat `wordTimingsApproximate=true`
// as a signal to fall back to a dedicated speech recognizer.

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Content = require('../models/Content');
const { transcribeAudio: geminiTranscribe, isConfigured: geminiConfigured } = require('../utils/googleAI');

function getAudioDurationSec(filePath) {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err || !data?.format?.duration) return resolve(null);
        resolve(Number(data.format.duration));
      });
    });
  } catch (_) {
    return Promise.resolve(null);
  }
}

async function generateTranscript(videoFilePath, language = null) {
  if (!geminiConfigured) {
    throw new Error('Gemini API not configured (GOOGLE_AI_API_KEY missing)');
  }

  try {
    logger.info('Generating transcript via Gemini', { videoFilePath, language });

    const text = await geminiTranscribe(videoFilePath, { language: language || 'en' });
    if (!text) {
      return { text: '', language: language || 'en', duration: 0, segments: [], words: [], wordTimingsApproximate: true };
    }

    const duration = (await getAudioDurationSec(videoFilePath)) || 0;
    const wordTokens = text.split(/\s+/).filter(Boolean);
    const perWordSec = duration && wordTokens.length > 0 ? duration / wordTokens.length : 0.4;

    const words = wordTokens.map((w, i) => ({
      word: w,
      start: i * perWordSec,
      end: (i + 1) * perWordSec,
    }));

    // Build naive segment groups of ~6 words each so SRT export still produces
    // readable cue blocks. Real segment boundaries would require a recognizer
    // that emits punctuation+pause data; this approximation is fine for UX.
    const segments = [];
    const groupSize = 6;
    for (let i = 0; i < words.length; i += groupSize) {
      const group = words.slice(i, i + groupSize);
      if (group.length === 0) continue;
      segments.push({
        id: segments.length,
        start: group[0].start,
        end: group[group.length - 1].end,
        text: group.map((g) => g.word).join(' '),
      });
    }

    logger.info('Transcript generated successfully (Gemini)', {
      textLength: text.length,
      segmentsCount: segments.length,
    });

    return {
      text,
      language: language || 'en',
      duration,
      segments,
      words,
      wordTimingsApproximate: true,
    };
  } catch (error) {
    logger.error('Error generating transcript', { videoFilePath, error: error.message, stack: error.stack });
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
 * Generate auto-captions from transcript with Cognitive features (Phase 11).
 * Includes: Object-Aware Positioning, Emotion-Sync, and Auto-Highlighting.
 */
async function generateAutoCaptions(videoId, options = {}) {
  const { transcript, videoPath } = options;
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

    const words = content?.captions?.words;
    if (words && Array.isArray(words) && words.length > 0) {
      const maxWordsPerLine = 6;
      const maxDuration = 3.5;
      let lineStart = words[0].start ?? 0;
      let lineWords = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const wordStart = w.start ?? 0;
        const wordEnd = w.end ?? wordStart + 0.3;
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
      // Fallback splitting...
      const sentences = transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
      const chunkDuration = duration / Math.max(1, sentences.length);
      segments = sentences.map((text, i) => ({
        text: text.trim(),
        startTime: i * chunkDuration,
        endTime: (i + 1) * chunkDuration,
        ...analyzeSentimentAndHighlight(text.trim())
      }));
    }

    return {
      captions: segments,
      suggestedPosition: safePosition,
      isObjectAware: avoidanceZones.length > 0
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

module.exports = {
  generateTranscript,
  generateCaptionsForContent,
  formatCaptions,
  translateCaptions,
  getCaptions,
  generateAutoCaptions,
  styleCaptions,
};

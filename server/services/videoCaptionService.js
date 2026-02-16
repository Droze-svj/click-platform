// Video Caption Service - AI-powered auto-captions using OpenAI Whisper API

const OpenAI = require('openai');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Content = require('../models/Content');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenAI client
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  logger.warn('OpenAI not configured for video captions', { error: error.message });
}

/**
 * Generate transcript from video file using Whisper API
 * @param {string} videoFilePath - Path to video file
 * @param {string} language - Language code (optional, auto-detect if not provided)
 * @returns {Promise<Object>} Transcript with text and segments
 */
async function generateTranscript(videoFilePath, language = null) {
  if (!openai) {
    throw new Error('OpenAI API not configured');
  }

  try {
    logger.info('Generating transcript', { videoFilePath, language });

    // Read video file
    const videoFile = await fs.readFile(videoFilePath);
    const filename = path.basename(videoFilePath);

    // Create file stream for OpenAI (using fs.createReadStream for Node.js)
    const { createReadStream } = require('fs');
    const fileStream = createReadStream(videoFilePath);

    // Call Whisper API
    const response = await openai.audio.transcriptions.create({
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
 * Generate auto-captions from transcript for AI editing (smart captions).
 * Uses content.captions.segments if available, otherwise splits transcript over duration.
 * @param {string} videoId - Content ID
 * @param {Object} options - { language, transcript, style, position }
 * @returns {Promise<Object>} { captions: [{ text, startTime, endTime }] }
 */
async function generateAutoCaptions(videoId, options = {}) {
  const { transcript, style = 'modern', position = 'bottom' } = options;
  if (!transcript || typeof transcript !== 'string') {
    return { captions: [] };
  }
  try {
    const content = await Content.findById(videoId);
    let segments = [];
    const duration = content?.originalFile?.duration || content?.metadata?.duration || 60;

    const words = content?.captions?.words;
    if (words && Array.isArray(words) && words.length > 0) {
      // Word-level timestamps (e.g. from Whisper verbose_json): group into readable lines (~2–4s or max 6 words)
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
          segments.push({
            text: lineWords.join(' ').trim(),
            startTime: lineStart,
            endTime: lineEnd,
          });
          lineWords = [];
          if (i < words.length - 1) {
            lineStart = words[i + 1].start ?? lineEnd;
          }
        }
      }
      if (lineWords.length > 0) {
        const lastEnd = words[words.length - 1]?.end ?? duration;
        segments.push({
          text: lineWords.join(' ').trim(),
          startTime: lineStart,
          endTime: lastEnd,
        });
      }
    } else if (content?.captions?.segments && Array.isArray(content.captions.segments) && content.captions.segments.length > 0) {
      segments = content.captions.segments.map((s) => ({
        text: s.text || '',
        startTime: s.start ?? 0,
        endTime: s.end ?? 0,
      }));
    } else {
      const sentences = transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length === 0) {
        segments = [{ text: transcript.trim(), startTime: 0, endTime: Math.max(1, duration) }];
      } else {
        const chunkDuration = duration / sentences.length;
        segments = sentences.map((text, i) => ({
          text: text.trim(),
          startTime: i * chunkDuration,
          endTime: (i + 1) * chunkDuration,
        }));
      }
    }

    return { captions: segments };
  } catch (error) {
    logger.error('generateAutoCaptions failed', { videoId, error: error.message });
    return { captions: [] };
  }
}

/**
 * Apply style options to caption segments (for burn-in). Returns same segments with .style attached.
 * @param {Array} captions - [{ text, startTime, endTime }]
 * @param {Object} styleOptions - { fontSize, fontColor, backgroundColor, outline, outlineColor, position, fontFamily }
 * @returns {Array} [{ text, startTime, endTime, style }]
 */
function styleCaptions(captions, styleOptions = {}) {
  if (!Array.isArray(captions)) return [];
  const style = {
    fontSize: styleOptions.fontSize ?? 42,
    fontColor: styleOptions.fontColor ?? '#FFFFFF',
    backgroundColor: styleOptions.backgroundColor ?? 'rgba(0,0,0,0.75)',
    outline: styleOptions.outline !== false,
    outlineColor: styleOptions.outlineColor ?? '#000000',
    outlineWidth: styleOptions.outlineWidth ?? (styleOptions.outline ? 2 : 0),
    position: styleOptions.position ?? 'bottom',
    fontFamily: styleOptions.fontFamily || 'Arial',
  };
  return captions.map((c) => ({ ...c, style }));
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

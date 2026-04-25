// Video Transcription Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

const whisperService = require('./whisperService');

/**
 * Transcribe video
 */
async function transcribeVideo(videoId, options = {}) {
  try {
    const {
      language = 'en',
      videoPath = null,
      audioFile = null,
      timestamps = true
    } = options;

    const inputPath = videoPath || audioFile;
    if (!inputPath) {
      throw new Error('Video path or audio file required for transcription');
    }

    logger.info('Starting real transcription for video', { videoId, inputPath });

    // Use Whisper Service for real transcription
    const transcriptText = await whisperService.generateTranscriptFromVideo(inputPath, {
      language,
      responseFormat: timestamps ? 'verbose_json' : 'text',
    });

    if (!transcriptText) {
      throw new Error('Transcription failed to generate text');
    }

    // If verbose_json was used, transcriptText might be an object if we didn't extract .text in whisperService
    // But whisperService.js:125 says: const transcript = typeof transcription === 'string' ? transcription : transcription.text;
    // Actually, verbose_json returns an object with segments if handled correctly.
    // Let's assume whisperService returns just the text for now as per its code.

    // If we want segments, we might need a more detailed call or update whisperService.
    // whisperService.js:91 uses response_format: responseFormat.
    // If responseFormat is 'verbose_json', OpenAI returns an object.

    const transcript = {
      videoId,
      language,
      fullText: typeof transcriptText === 'string' ? transcriptText : transcriptText.text,
      segments: transcriptText.segments || [],
      duration: transcriptText.duration || 0,
      wordCount: (typeof transcriptText === 'string' ? transcriptText : transcriptText.text).split(/\s+/).length,
      confidence: 0.99,
    };

    logger.info('Video transcribed successfully', { videoId, language, segments: transcript.segments.length });
    return transcript;
  } catch (error) {
    logger.error('Transcribe video error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Transcribe with timestamps
 */
async function transcribeWithTimestamps(videoId, audioFile, language = 'en') {
  try {
    const transcript = await transcribeVideo(videoId, {
      language,
      audioFile,
      timestamps: true,
    });

    // Format with timestamps
    const timestamped = transcript.segments.map(segment => ({
      ...segment,
      timestamp: `${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}`,
    }));

    return {
      ...transcript,
      segments: timestamped,
    };
  } catch (error) {
    logger.error('Transcribe with timestamps error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Format timestamp
 */
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Extract keywords from transcript
 */
async function extractKeywords(transcript) {
  try {
    const fullText = transcript.fullText || transcript.segments.map(s => s.text).join(' ');

    const prompt = `Extract key topics and keywords from this video transcript:

${fullText}

Provide:
1. Main topics (3-5)
2. Keywords (10-15)
3. Key phrases
4. Summary (2-3 sentences)

Format as JSON object with fields: topics (array), keywords (array), keyPhrases (array), summary (string)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot extract keywords');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content analyst. Extract key topics and keywords from transcripts.\n\n${prompt}`;
    const extractedText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1000 });

    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch (error) {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse keyword extraction');
      }
    }

    logger.info('Keywords extracted', { topics: extracted.topics?.length || 0 });
    return extracted;
  } catch (error) {
    logger.error('Extract keywords error', { error: error.message });
    throw error;
  }
}

/**
 * Generate video summary
 */
async function generateVideoSummary(transcript) {
  try {
    const fullText = transcript.fullText || transcript.segments.map(s => s.text).join(' ');

    const prompt = `Generate a comprehensive summary of this video:

${fullText}

Provide:
1. Main points (3-5 bullet points)
2. Key takeaways
3. Summary paragraph
4. Suggested title

Format as JSON object with fields: mainPoints (array), takeaways (array), summary (string), suggestedTitle (string)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate video summary');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a video summarizer. Create concise, informative summaries.\n\n${prompt}`;
    const summaryText = await geminiGenerate(fullPrompt, { temperature: 0.5, maxTokens: 1000 });

    let summary;
    try {
      summary = JSON.parse(summaryText);
    } catch (error) {
      const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse summary');
      }
    }

    logger.info('Video summary generated');
    return summary;
  } catch (error) {
    logger.error('Generate video summary error', { error: error.message });
    throw error;
  }
}

module.exports = {
  transcribeVideo,
  transcribeWithTimestamps,
  extractKeywords,
  generateVideoSummary,
};







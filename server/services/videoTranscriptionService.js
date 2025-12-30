// Video Transcription Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client for video transcription', { error: error.message });
      return null;
    }
  }
  return openai;
}

/**
 * Transcribe video
 */
async function transcribeVideo(videoId, options = {}) {
  try {
    const {
      language = 'en',
      audioFile = null,
      timestamps = true,
      speakerDiarization = false,
    } = options;

    // In production, use Whisper API or similar
    // For now, provide framework
    
    if (!audioFile) {
      throw new Error('Audio file required for transcription');
    }

    // Simulate transcription
    const transcript = {
      videoId,
      language,
      segments: [
        {
          start: 0,
          end: 5,
          text: 'Welcome to this video tutorial.',
          speaker: speakerDiarization ? 'Speaker 1' : null,
        },
        {
          start: 5,
          end: 15,
          text: 'Today we will learn about video processing and editing.',
          speaker: speakerDiarization ? 'Speaker 1' : null,
        },
        {
          start: 15,
          end: 25,
          text: 'Let me show you some advanced features.',
          speaker: speakerDiarization ? 'Speaker 1' : null,
        },
      ],
      fullText: 'Welcome to this video tutorial. Today we will learn about video processing and editing. Let me show you some advanced features.',
      duration: 25,
      wordCount: 20,
      confidence: 0.95,
    };

    logger.info('Video transcribed', { videoId, language, segments: transcript.segments.length });
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

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot transcribe video');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a content analyst. Extract key topics and keywords from transcripts.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const extractedText = response.choices[0].message.content;
    
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

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot transcribe video');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a video summarizer. Create concise, informative summaries.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const summaryText = response.choices[0].message.content;
    
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







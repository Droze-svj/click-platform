// Video Caption Service

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
      logger.warn('Failed to initialize OpenAI client for video captions', { error: error.message });
      return null;
    }
  }
  return openai;
}

/**
 * Generate auto-captions
 */
async function generateAutoCaptions(videoId, options = {}) {
  try {
    const {
      language = 'en',
      transcript = null,
      timestamps = null,
      style = 'default',
      position = 'bottom',
    } = options;

    if (!transcript) {
      throw new Error('Transcript is required for caption generation');
    }

    // Generate captions from transcript
    const prompt = `Generate video captions from this transcript:

Transcript:
${transcript}

Language: ${language}
Style: ${style}
Position: ${position}

Requirements:
- Break into readable chunks (2-3 words per line)
- Timing should match speech pace
- Include timestamps
- Format for ${language} language

Format as JSON array with objects containing: startTime (seconds), endTime (seconds), text (string), style (object)`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate captions');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a video captioning expert. Generate accurate, readable captions with proper timing.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const captionsText = response.choices[0].message.content;
    
    let captions;
    try {
      captions = JSON.parse(captionsText);
    } catch (error) {
      const jsonMatch = captionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        captions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse captions');
      }
    }

    logger.info('Auto-captions generated', { videoId, language, count: captions.length });
    return {
      videoId,
      language,
      captions,
      style,
      position,
      format: 'srt', // SRT format
    };
  } catch (error) {
    logger.error('Generate auto-captions error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Translate captions
 */
async function translateCaptions(captions, targetLanguage) {
  try {
    const captionsText = captions.map(c => c.text).join('\n');

    const prompt = `Translate these video captions to ${targetLanguage}:

Captions:
${captionsText}

Maintain:
- Timing information
- Caption breaks
- Natural language flow

Format as JSON array with same structure: startTime, endTime, text`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot generate captions');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate video captions while maintaining timing and natural flow.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const translatedText = response.choices[0].message.content;
    
    let translated;
    try {
      translated = JSON.parse(translatedText);
    } catch (error) {
      const jsonMatch = translatedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        translated = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse translated captions');
      }
    }

    logger.info('Captions translated', { targetLanguage, count: translated.length });
    return translated;
  } catch (error) {
    logger.error('Translate captions error', { error: error.message });
    throw error;
  }
}

/**
 * Style captions
 */
function styleCaptions(captions, styleOptions = {}) {
  try {
    const {
      fontSize = 20,
      fontFamily = 'Arial',
      fontColor = '#FFFFFF',
      backgroundColor = 'rgba(0,0,0,0.7)',
      position = 'bottom',
      alignment = 'center',
      outline = true,
      outlineColor = '#000000',
    } = styleOptions;

    const styled = captions.map(caption => ({
      ...caption,
      style: {
        fontSize,
        fontFamily,
        fontColor,
        backgroundColor,
        position,
        alignment,
        outline,
        outlineColor,
      },
    }));

    logger.info('Captions styled', { count: styled.length });
    return styled;
  } catch (error) {
    logger.error('Style captions error', { error: error.message });
    throw error;
  }
}

/**
 * Generate SRT file
 */
function generateSRTFile(captions) {
  try {
    let srt = '';
    
    captions.forEach((caption, index) => {
      const start = formatSRTTime(caption.startTime);
      const end = formatSRTTime(caption.endTime);
      
      srt += `${index + 1}\n`;
      srt += `${start} --> ${end}\n`;
      srt += `${caption.text}\n\n`;
    });

    return srt;
  } catch (error) {
    logger.error('Generate SRT file error', { error: error.message });
    throw error;
  }
}

/**
 * Format time for SRT
 */
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Generate VTT file
 */
function generateVTTFile(captions) {
  try {
    let vtt = 'WEBVTT\n\n';
    
    captions.forEach(caption => {
      const start = formatVTTTime(caption.startTime);
      const end = formatVTTTime(caption.endTime);
      
      vtt += `${start} --> ${end}\n`;
      vtt += `${caption.text}\n\n`;
    });

    return vtt;
  } catch (error) {
    logger.error('Generate VTT file error', { error: error.message });
    throw error;
  }
}

/**
 * Format time for VTT
 */
function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

module.exports = {
  generateAutoCaptions,
  translateCaptions,
  styleCaptions,
  generateSRTFile,
  generateVTTFile,
};







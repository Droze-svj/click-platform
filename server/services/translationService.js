// Translation Service
// Handles automatic content translation and language detection

const { OpenAI } = require('openai');
const ContentTranslation = require('../models/ContentTranslation');
const Content = require('../models/Content');
const TranslationMemory = require('../models/TranslationMemory');
const TranslationGlossary = require('../models/TranslationGlossary');
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
      logger.warn('Failed to initialize OpenAI client for translation', { error: error.message });
      return null;
    }
  }
  return openai;
}

// Supported languages with their codes
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish'
};

/**
 * Detect language of content
 */
async function detectLanguage(text) {
  try {
    if (!text || text.trim().length === 0) {
      return { language: 'en', confidence: 0 };
    }

    const prompt = `Detect the language of this text and respond with only the ISO 639-1 language code (e.g., "en", "es", "fr"):

Text: ${text.substring(0, 500)}

Respond with only the language code:`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, using fallback language detection');
      return { language: 'en', confidence: 0.5 };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a language detection expert. Respond with only the ISO 639-1 language code.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const detectedCode = response.choices[0].message.content.trim().toLowerCase();
    const language = SUPPORTED_LANGUAGES[detectedCode] ? detectedCode : 'en';
    const confidence = detectedCode === language ? 0.9 : 0.5;

    logger.info('Language detected', { text: text.substring(0, 50), language, confidence });
    return { language, confidence };
  } catch (error) {
    logger.error('Error detecting language', { error: error.message });
    return { language: 'en', confidence: 0 };
  }
}

/**
 * Translate content to target language
 */
async function translateContent(contentId, targetLanguage, options = {}) {
  try {
    const {
      preserveFormatting = true,
      culturalAdaptation = false,
      platformOptimization = null,
      translationMethod = 'ai',
      useTranslationMemory = true,
      useGlossary = true,
      userId = null
    } = options;

    // Get original content
    const content = await Content.findById(contentId).lean();
    if (!content) {
      throw new Error('Content not found');
    }

    const contentUserId = userId || content.userId;

    // Check if translation already exists
    const existing = await ContentTranslation.findOne({
      contentId,
      language: targetLanguage.toUpperCase()
    });

    if (existing && !options.forceRetranslate) {
      logger.info('Translation already exists', { contentId, language: targetLanguage });
      return existing;
    }

    // Detect source language
    const sourceLanguage = await detectLanguage(
      content.title || content.description || content.body || ''
    );

    // Get translation memory matches
    let memoryMatches = [];
    if (useTranslationMemory && contentUserId) {
      memoryMatches = await getTranslationMemoryMatches(
        contentUserId,
        sourceLanguage.language,
        targetLanguage,
        content.title || '',
        content.description || '',
        content.body || ''
      );
    }

    // Get glossary terms
    let glossaryTerms = [];
    if (useGlossary && contentUserId) {
      glossaryTerms = await getGlossaryTerms(
        contentUserId,
        sourceLanguage.language,
        targetLanguage
      );
    }

    // Prepare content for translation
    const contentToTranslate = {
      title: content.title || '',
      description: content.description || '',
      body: content.body || content.transcript || '',
      transcript: content.transcript || '',
      tags: content.tags || []
    };

    // Build translation prompt
    let prompt = `Translate the following content to ${SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}:\n\n`;

    if (contentToTranslate.title) {
      prompt += `Title: ${contentToTranslate.title}\n`;
    }
    if (contentToTranslate.description) {
      prompt += `Description: ${contentToTranslate.description}\n`;
    }
    if (contentToTranslate.body) {
      prompt += `Body: ${contentToTranslate.body}\n`;
    }

    prompt += `\nRequirements:\n`;
    prompt += `- Maintain the original tone and style\n`;
    prompt += `- Keep formatting and structure\n`;
    
    if (culturalAdaptation) {
      prompt += `- Adapt culturally for ${SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage} audience\n`;
      prompt += `- Use culturally appropriate references and idioms\n`;
    }

    if (platformOptimization) {
      prompt += `- Optimize for ${platformOptimization} platform\n`;
      prompt += `- Follow platform-specific best practices\n`;
    }

    prompt += `\nRespond with JSON object containing: title, description, body, hashtags (array of translated relevant hashtags)`;

    // Translate using AI
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API key not configured. Translation service unavailable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in ${SUPPORTED_LANGUAGES[targetLanguage] || targetLanguage}. Provide accurate, natural translations that maintain the original meaning and tone.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const translatedText = response.choices[0].message.content;
    
    let translated;
    try {
      translated = JSON.parse(translatedText);
    } catch (error) {
      // Try to extract JSON from response
      const jsonMatch = translatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translated = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: use original content
        translated = {
          title: contentToTranslate.title,
          description: contentToTranslate.description,
          body: contentToTranslate.body,
          hashtags: []
        };
      }
    }

    // Calculate quality score (simple heuristic)
    const qualityScore = calculateTranslationQuality(translated, contentToTranslate);

    // Create or update translation
    const translation = existing || new ContentTranslation({
      contentId,
      userId: content.userId,
      language: targetLanguage.toUpperCase()
    });

    translation.title = translated.title || contentToTranslate.title;
    translation.description = translated.description || contentToTranslate.description;
    translation.body = translated.body || contentToTranslate.body;
    translation.transcript = translated.transcript || contentToTranslate.transcript;
    translation.hashtags = translated.hashtags || [];
    translation.tags = contentToTranslate.tags || [];
    translation.metadata.translationMethod = translationMethod;
    translation.metadata.translatedAt = new Date();
    translation.metadata.translator = 'openai-gpt-4';
    translation.metadata.qualityScore = qualityScore;
    translation.metadata.culturalAdaptation = culturalAdaptation;
    
    if (platformOptimization) {
      translation.metadata.platformOptimizations.set(platformOptimization, {
        optimized: true,
        optimizedAt: new Date()
      });
    }

    await translation.save();

    // Save to translation memory
    if (useTranslationMemory && contentUserId) {
      await saveToTranslationMemory(
        contentUserId,
        sourceLanguage.language,
        targetLanguage,
        contentToTranslate,
        translated,
        content.category || 'general'
      );
    }

    logger.info('Content translated', { contentId, language: targetLanguage, qualityScore });
    return translation;
  } catch (error) {
    logger.error('Error translating content', { error: error.message, contentId, targetLanguage });
    throw error;
  }
}

/**
 * Calculate translation quality score
 */
function calculateTranslationQuality(translated, original) {
  let score = 50; // Base score

  // Check if all fields are translated
  if (translated.title && translated.title !== original.title) score += 10;
  if (translated.description && translated.description !== original.description) score += 10;
  if (translated.body && translated.body !== original.body) score += 20;

  // Check length similarity (translated shouldn't be too short)
  if (translated.body && original.body) {
    const lengthRatio = translated.body.length / original.body.length;
    if (lengthRatio > 0.7 && lengthRatio < 1.5) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Translate content to multiple languages
 */
async function translateToMultipleLanguages(contentId, languages, options = {}) {
  try {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    for (const lang of languages) {
      try {
        // Check if already exists
        const existing = await ContentTranslation.findOne({
          contentId,
          language: lang.toUpperCase()
        });

        if (existing && !options.forceRetranslate) {
          results.skipped.push({ language: lang, translationId: existing._id });
          continue;
        }

        const translation = await translateContent(contentId, lang, options);
        results.successful.push({ language: lang, translationId: translation._id });
      } catch (error) {
        logger.error('Error translating to language', { error: error.message, language: lang });
        results.failed.push({ language: lang, error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error translating to multiple languages', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Get content in specific language
 */
async function getContentInLanguage(contentId, language, fallbackToOriginal = true) {
  try {
    const translation = await ContentTranslation.findOne({
      contentId,
      language: language.toUpperCase()
    }).lean();

    if (translation) {
      return {
        ...translation,
        isTranslation: true
      };
    }

    if (fallbackToOriginal) {
      const original = await Content.findById(contentId).lean();
      return {
        ...original,
        isTranslation: false,
        language: 'en' // Assume English if not specified
      };
    }

    return null;
  } catch (error) {
    logger.error('Error getting content in language', { error: error.message, contentId, language });
    throw error;
  }
}

/**
 * Get all translations for content
 */
async function getContentTranslations(contentId) {
  try {
    const translations = await ContentTranslation.find({ contentId })
      .sort({ language: 1 })
      .lean();

    return translations;
  } catch (error) {
    logger.error('Error getting content translations', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Update translation
 */
async function updateTranslation(translationId, userId, updates) {
  try {
    const translation = await ContentTranslation.findOne({
      _id: translationId,
      userId
    });

    if (!translation) {
      throw new Error('Translation not found');
    }

    if (updates.title !== undefined) translation.title = updates.title;
    if (updates.description !== undefined) translation.description = updates.description;
    if (updates.body !== undefined) translation.body = updates.body;
    if (updates.caption !== undefined) translation.caption = updates.caption;
    if (updates.hashtags !== undefined) translation.hashtags = updates.hashtags;
    if (updates.tags !== undefined) translation.tags = updates.tags;
    if (updates.status !== undefined) translation.status = updates.status;

    translation.metadata.translationMethod = 'manual';
    translation.metadata.translatedAt = new Date();
    translation.metadata.translator = userId.toString();

    await translation.save();

    logger.info('Translation updated', { translationId, userId });
    return translation;
  } catch (error) {
    logger.error('Error updating translation', { error: error.message, translationId });
    throw error;
  }
}

/**
 * Delete translation
 */
async function deleteTranslation(translationId, userId) {
  try {
    const translation = await ContentTranslation.findOneAndDelete({
      _id: translationId,
      userId
    });

    if (!translation) {
      throw new Error('Translation not found');
    }

    logger.info('Translation deleted', { translationId, userId });
    return translation;
  } catch (error) {
    logger.error('Error deleting translation', { error: error.message, translationId });
    throw error;
  }
}

/**
 * Get supported languages
 */
function getSupportedLanguages() {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name
  }));
}

module.exports = {
  detectLanguage,
  translateContent,
  translateToMultipleLanguages,
  getContentInLanguage,
  getContentTranslations,
  updateTranslation,
  deleteTranslation,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES
};


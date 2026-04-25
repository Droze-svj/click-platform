const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

class GlobalTranslationService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Translate text into one or more target languages
   * @param {string} text - Text to translate
   * @param {string|string[]} targetLanguages - ISO language codes (e.g., 'es', 'hi')
   * @returns {Promise<Object>} Map of language code to translated text
   */
  async translateContent(text, targetLanguages) {
    if (!geminiConfigured) {
      throw new Error('Google AI (Gemini) not configured for translation');
    }

    const languages = Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages];
    const results = {};

    for (const lang of languages) {
      const cacheKey = `${lang}:${Buffer.from(text.substring(0, 50)).toString('base64')}`;
      if (this.cache.has(cacheKey)) {
        results[lang] = this.cache.get(cacheKey);
        continue;
      }

      try {
        logger.info(`Translating content to: ${lang}`);
        const prompt = `You are a professional social media localizer. Translate the following content into ${this.getLanguageName(lang)}. 
        Maintain the viral tone, emojis, and slang appropriate for that culture.
        
        Content:
        ${text}`;

        const translation = await geminiGenerate(prompt, { temperature: 0.3, maxTokens: 2000 });
        this.cache.set(cacheKey, translation);
        results[lang] = translation;
      } catch (err) {
        logger.error(`Translation failed for ${lang}`, { error: err.message });
        results[lang] = text; // Fallback to original
      }
    }

    return results;
  }

  /**
   * Translate segments (captions) while preserving timestamps
   */
  async translateSegments(segments, lang) {
    if (!segments || segments.length === 0) return [];
    
    // To minimize API calls, we batch segments
    const batchSize = 10;
    const translatedSegments = [];

    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const textToTranslate = batch.map((s, idx) => `[[${idx}]] ${s.text}`).join('\n');
      
      const prompt = `Translate these caption segments into ${this.getLanguageName(lang)}. 
      Keep the format [[number]] and only translate the text after it.
      
      Segments:
      ${textToTranslate}`;

      try {
        const rawRes = await geminiGenerate(prompt, { temperature: 0.2 });
        const translations = this.parseBatchResponse(rawRes, batch.length);
        
        batch.forEach((seg, idx) => {
          translatedSegments.push({
            ...seg,
            text: translations[idx] || seg.text,
            language: lang
          });
        });
      } catch (err) {
        logger.warn(`Batch translation failed for ${lang}, using original text for segment ${i}`);
        batch.forEach(seg => translatedSegments.push({ ...seg, language: lang }));
      }
    }

    return translatedSegments;
  }

  parseBatchResponse(raw, expectedSize) {
    const lines = raw.split('\n').filter(l => l.includes(']]'));
    return lines.map(l => l.split(']]')[1]?.trim());
  }

  getLanguageName(code) {
    const names = {
      es: 'Spanish',
      hi: 'Hindi',
      fr: 'French',
      de: 'German',
      pt: 'Portuguese',
      zh: 'Mandarin Chinese',
      ja: 'Japanese'
    };
    return names[code] || code;
  }
}

module.exports = new GlobalTranslationService();

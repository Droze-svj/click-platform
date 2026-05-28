const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const { retimeTranslatedCues } = require('../utils/subtitleUtils');

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
   * Translate segments (captions) and re-time them so caption timing
   * matches the new text length.
   *
   * The previous version preserved original `start`/`end` exactly,
   * which produced over- or under-flowing captions when the target
   * language was significantly longer or shorter than the source
   * (Spanish runs +25%, German +30%, Japanese -50% by character count).
   * Now we run the translated cues through `retimeTranslatedCues`,
   * which redistributes the original total span proportionally to the
   * NEW character count of each cue. The caption block as a whole stays
   * anchored to the same start and end so it doesn't drift relative to
   * the audio — only the within-block boundaries shift.
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
            language: lang,
          });
        });
      } catch (err) {
        logger.warn(`Batch translation failed for ${lang}, using original text for segment ${i}`);
        batch.forEach(seg => translatedSegments.push({ ...seg, language: lang }));
      }
    }

    // Re-time across the full set so over-runs / under-runs caused by
    // language length differences don't drift past the original audio.
    // The retimer treats the first cue's start + last cue's end as the
    // anchor — only the within-block boundaries get redistributed.
    const cuesForRetime = translatedSegments.map(s => ({
      start: typeof s.start === 'number' ? s.start : (s.startTime ?? 0),
      end: typeof s.end === 'number' ? s.end : (s.endTime ?? 0),
      text: s.text,
    }));
    const retimed = retimeTranslatedCues(cuesForRetime);
    return translatedSegments.map((seg, idx) => {
      const r = retimed[idx];
      if (!r) return seg;
      // Write to whichever timing field shape the original cue used so
      // we don't accidentally invalidate a downstream consumer.
      const out = { ...seg, text: r.text };
      if ('startTime' in seg) { out.startTime = r.start; out.endTime = r.end; }
      if ('start' in seg) { out.start = r.start; out.end = r.end; }
      return out;
    });
  }

  parseBatchResponse(raw, expectedSize) {
    const lines = raw.split('\n').filter(l => l.includes(']]'));
    return lines.map(l => l.split(']]')[1]?.trim());
  }

  getLanguageName(code) {
    const names = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Mandarin Chinese',
      ar: 'Arabic',
      hi: 'Hindi',
      nl: 'Dutch',
      pl: 'Polish',
      tr: 'Turkish'
    };
    return names[code] || code;
  }
}

module.exports = new GlobalTranslationService();

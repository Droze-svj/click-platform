const crypto = require('crypto');
const stockFootage = require('./stockFootageService');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

// Cache keywords for 7 days — the (contentId + segment text) pairing is stable
// across re-runs of the same video, so we never re-pay Gemini for it.
const KEYWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

class BRollIntelligenceService {
  /**
   * Orchestrate B-roll insertion for a video based on its transcript.
   *
   * Output shape preserved: returns an array of
   *   { startTime, duration, url, keyword, source }
   */
  async orchestrateBRoll(videoId, transcriptData, options = {}) {
    logger.info(`BRoll Intelligence: Orchestrating for ${videoId}`);

    const {
      gapThreshold = 4, // Max seconds of talking head before B-roll
      targetDensity = 0.3 // Aim for 30% visual variety
    } = options;

    const segments = transcriptData.segments || [];
    const bRollPlan = [];

    // 1. Identify "Visual Gaps" (long segments without intense punctuation /
    //    hook markers). Collect the gaps first so we can extract ALL keywords
    //    in a single Gemini call instead of one call per segment (the old N+1).
    const gaps = [];
    let currentGapStart = 0;
    for (const segment of segments) {
      const gapDuration = segment.end - currentGapStart;
      if (gapDuration >= gapThreshold) {
        gaps.push({ segment, gapDuration });
        currentGapStart = segment.end;
      }
    }

    if (gaps.length === 0) {
      logger.info(`BRoll Plan Generated: 0 insertions`, { videoId });
      return bRollPlan;
    }

    // 2. Extract a keyword per gap in ONE batched call (cached by contentId+text).
    const keywords = await this.extractContextKeywordsBatch(
      videoId,
      gaps.map((g) => g.segment.text || '')
    );

    // 3. Fetch matching stock footage per gap.
    for (let i = 0; i < gaps.length; i++) {
      const { segment, gapDuration } = gaps[i];
      const keyword = keywords[i] || this.simpleKeywordFallback(segment.text || '');
      const clips = await stockFootage.searchVideos(keyword, { perPage: 1 });
      if (clips.length > 0) {
        bRollPlan.push({
          startTime: segment.start,
          duration: Math.min(3, gapDuration), // Keep B-roll snappy
          url: clips[0].url,
          keyword,
          source: clips[0].source
        });
      }
    }

    logger.info(`BRoll Plan Generated: ${bRollPlan.length} insertions`, { videoId });
    return bRollPlan;
  }

  /**
   * Stable cache key for one (contentId + segment text) pair. Hashing the text
   * keeps keys bounded and avoids leaking transcript content into key space.
   */
  cacheKeyFor(contentId, text) {
    const hash = crypto.createHash('sha1').update(String(text || '')).digest('hex').slice(0, 16);
    return `broll:kw:${contentId || 'unknown'}:${hash}`;
  }

  /**
   * Deterministic simple-keyword fallback (no AI). Picks the first long-ish
   * word, else a safe default. Mirrors the prior per-segment fallback.
   */
  simpleKeywordFallback(text) {
    const significants = String(text || '').split(/\s+/).filter((w) => w.length > 6);
    if (significants.length > 0) {
      return significants[0].replace(/[^a-zA-Z]/g, '') || 'cinematic';
    }
    return 'cinematic';
  }

  /**
   * Parse Gemini's batch response into a keyword array of length `expectedLen`.
   * Accepts a JSON array of strings (preferred) or a JSON array of
   * { index, keyword } objects. Returns null on unusable output so the caller
   * can fall back. Pure — exported-style helper, no I/O.
   */
  parseBatchKeywords(raw, expectedLen) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) s = fence[1].trim();
    const first = s.indexOf('[');
    const last = s.lastIndexOf(']');
    if (first !== -1 && last > first) s = s.slice(first, last + 1);

    let arr;
    try {
      arr = JSON.parse(s);
    } catch (_) {
      return null;
    }
    if (!Array.isArray(arr)) return null;

    const clean = (v) => {
      if (typeof v !== 'string') return '';
      return v.trim().replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/)[0] || '';
    };

    const out = new Array(expectedLen).fill('');
    if (arr.length && typeof arr[0] === 'object' && arr[0] !== null) {
      // [{ index, keyword }] shape.
      for (const item of arr) {
        const idx = Number(item.index);
        if (Number.isInteger(idx) && idx >= 0 && idx < expectedLen) {
          out[idx] = clean(item.keyword);
        }
      }
    } else {
      // [ "kw", "kw", ... ] shape.
      for (let i = 0; i < expectedLen && i < arr.length; i++) {
        out[i] = clean(arr[i]);
      }
    }
    return out;
  }

  /**
   * Batch keyword extraction. One Gemini call for every (uncached) segment.
   * Cuts Gemini calls from ~N (one per segment) to ~1 per video. Caches each
   * result by hash(contentId + text). Falls back to the simple keyword
   * heuristic if Gemini is unavailable, fails, or returns malformed output.
   *
   * @param {string} contentId
   * @param {string[]} texts
   * @returns {Promise<string[]>} one keyword per input text (same order/length)
   */
  async extractContextKeywordsBatch(contentId, texts) {
    const results = new Array(texts.length).fill(null);

    // 1. Serve from cache where possible; collect the misses.
    const misses = [];
    for (let i = 0; i < texts.length; i++) {
      const cached = cache.get(this.cacheKeyFor(contentId, texts[i]));
      if (typeof cached === 'string' && cached) {
        results[i] = cached;
      } else {
        misses.push(i);
      }
    }

    if (misses.length === 0) return results;

    // 2. One batched Gemini call for all misses.
    let aiKeywords = null;
    try {
      const { generateContent, isConfigured } = require('../utils/googleAI');
      if (isConfigured) {
        const numbered = misses
          .map((idx, n) => `[${n}] ${String(texts[idx] || '').slice(0, 300)}`)
          .join('\n');
        const prompt = [
          'For EACH numbered transcript line below, extract the single most',
          'visually evocative, marketing-relevant keyword to search premium',
          'stock footage. Avoid generic words. Return ONLY a JSON array of',
          `exactly ${misses.length} single-word strings, in the same order as`,
          'the [N] markers. No prose, no markdown.',
          '',
          numbered,
        ].join('\n');
        // maxTokens scales with batch size; keep a sane ceiling.
        const maxTokens = Math.min(2000, 20 + misses.length * 8);
        const raw = await generateContent(prompt, { temperature: 0.2, maxTokens });
        aiKeywords = this.parseBatchKeywords(raw, misses.length);
      }
    } catch (err) {
      logger.warn('Gemini batch keyword extraction failed, using fallback', { error: err.message });
    }

    // 3. Fill misses from AI output (when valid) else simple fallback; cache each.
    for (let n = 0; n < misses.length; n++) {
      const idx = misses[n];
      let keyword = aiKeywords && aiKeywords[n];
      if (!keyword) keyword = this.simpleKeywordFallback(texts[idx]);
      results[idx] = keyword;
      cache.set(this.cacheKeyFor(contentId, texts[idx]), keyword, KEYWORD_TTL_MS);
    }

    return results;
  }

  /**
   * Single-segment keyword extraction — retained for backward compatibility
   * with any external caller. Internally routes through the batch path.
   */
  async extractContextKeyword(text, contentId) {
    const [kw] = await this.extractContextKeywordsBatch(contentId, [text]);
    return kw || this.simpleKeywordFallback(text);
  }
}

module.exports = new BRollIntelligenceService();

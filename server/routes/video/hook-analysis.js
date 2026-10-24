// AI Hook & Script Analysis Route — Click Intelligence Engine
// Primary: GPT-4o | Fallback: Gemini 2.0 | Heuristic: Pattern-based
// POST /api/video/hook-analysis

const express = require('express');
const auth = require('../../middleware/auth');
const { requireFeature } = require('../../middleware/tierGate');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

// AI cost/fan-out guard: the GPT-4o call must be rate-limited + budget-gated
// independently of the Redis-backed requireFeature (which fails open without Redis).
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { costGuard } = require('../../middleware/costGuard');
router.use((req, res, next) => (['POST', 'PUT'].includes(req.method) ? aiLimiter(req, res, next) : next()));
router.use(costGuard());

const OpenAI = require('openai');
// Bound the GPT-4o call: without an explicit timeout a stuck request pins the
// handler for the SDK default (10 min). Match aiRouter's 90s / single retry.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90000, maxRetries: 1 })
  : null;

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../../utils/googleAI');

const VIRAL_ANALYSIS_PROMPT = `You are Click's AI Video Intelligence Engine — the world's most advanced viral content analyst, trained on millions of high-performing short-form videos (TikTok, YouTube Shorts, Instagram Reels, LinkedIn).

Analyze this video transcript and return a JSON response with:
1. hookStrength (0-100): How likely is the first 3 seconds to stop a scroll?
2. toneCohesion (0-100): How consistent is the tone/energy throughout?
3. pacing (0-100): Is the information density and rhythm optimal for the platform?
4. viralPotential (0-100): Overall viral potential score
5. hookType: Classify as one of ["question", "stat", "story", "controversy", "pattern-interrupt", "pain-point", "curiosity-gap", "authority", "FOMO"]
6. psychologicalTrigger: Primary trigger this content uses ["curiosity", "fear", "social-proof", "authority", "scarcity", "reciprocity", "identity"]
7. weakestMoment: Timestamp range (in seconds) where engagement likely drops (e.g. "15-22s")
8. strongestMoment: Timestamp range where engagement likely peaks (e.g. "0-8s")
9. rewrites: Array of 3 improved hook alternatives (just the opening 1-2 sentences, each using a different hookType)
10. directives: Array of 3 specific actionable edits with: { action: string, reason: string, impact: "high"|"medium"|"low", timestamp: optional seconds }
11. summary: 1-sentence diagnosis of the video's main strength and weakness
12. suggestedTitle: A highly clickable, viral-optimized title under 60 characters
13. suggestedDescription: A 2-3 sentence description optimized for the algorithm (including a CTA)
14. suggestedTags: Array of 5-8 highly relevant, high-volume hashtags
15. platformRecommendation: Best platform for this content ["tiktok", "instagram", "youtube_shorts", "linkedin"]
16. estimatedRetentionCurve: ["strong-open", "mid-drop", "strong-close"] or similar 3-point descriptor
17. contentNiche: Detected content niche/category

Return ONLY valid JSON. No markdown, no explanation.`;

/**
 * POST /api/video/ai-hook-analysis
 * Runs AI analysis on a transcript — GPT-4o primary, Gemini fallback, heuristic last resort
 */
router.post('/', auth, requireFeature('ai_analysis'), asyncHandler(async (req, res) => {
  const { transcript, videoId, duration } = req.body;

  if (!transcript || transcript.trim().length < 20) {
    return sendError(res, 'Transcript is required (min 20 characters)', 400);
  }

  // === PRIMARY: GPT-4o ===
  if (openai) {
    try {
      logger.info('Starting GPT-4o hook analysis', { videoId, transcriptLength: transcript.length });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: VIRAL_ANALYSIS_PROMPT },
          { role: 'user', content: `Video Duration: ${duration || 'unknown'} seconds\n\nTranscript:\n${transcript.slice(0, 4000)}` }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        user: String(req.user._id)
      });

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error('Invalid response from OpenAI API');
      }
      if (choice.message?.refusal) {
        throw new Error(`OpenAI model refused request: ${choice.message.refusal}`);
      }
      const content = choice.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI API');
      }

      const analysis = normalizeAnalysis(JSON.parse(content), transcript);
      logger.info('GPT-4o hook analysis completed', { videoId, viralPotential: analysis.viralPotential });
      return sendSuccess(res, 'Hook analysis complete', 200, { ...analysis, engine: 'gpt-4o' });
    } catch (error) {
      logger.warn('GPT-4o hook analysis failed, trying Gemini', { error: error.message });
    }
  }

  // === FALLBACK: Gemini ===
  if (geminiConfigured) {
    try {
      logger.info('Starting Gemini hook analysis', { videoId });
      const raw = await geminiGenerate(
        `${VIRAL_ANALYSIS_PROMPT}\n\nVideo Duration: ${duration || 'unknown'} seconds\n\nTranscript:\n${transcript.slice(0, 4000)}`,
        { temperature: 0.3, maxTokens: 1500 }
      );
      const cleaned = (raw || '{}').replace(/```json\n?|\n?```/g, '').trim();
      const analysis = normalizeAnalysis(JSON.parse(cleaned), transcript);
      logger.info('Gemini hook analysis completed', { videoId, viralPotential: analysis.viralPotential });
      return sendSuccess(res, 'Hook analysis complete', 200, { ...analysis, engine: 'gemini' });
    } catch (error) {
      logger.warn('Gemini hook analysis failed, using heuristic', { error: error.message });
    }
  }

  // === LAST RESORT: Heuristic ===
  logger.warn('All AI engines unavailable — returning heuristic hook analysis', { videoId });
  return sendSuccess(res, 'Hook analysis (heuristic)', 200, { ...generateFallbackAnalysis(transcript, duration), engine: 'heuristic' });
}));

/**
 * Normalize and validate analysis output from any AI engine
 */
function normalizeAnalysis(raw, transcript) {
  const normalize = (v) => Math.min(100, Math.max(0, Math.round(v || 0)));
  return {
    hookStrength: normalize(raw.hookStrength),
    toneCohesion: normalize(raw.toneCohesion),
    pacing: normalize(raw.pacing),
    viralPotential: normalize(raw.viralPotential),
    hookType: raw.hookType || 'story',
    psychologicalTrigger: raw.psychologicalTrigger || 'curiosity',
    weakestMoment: raw.weakestMoment || 'Unknown',
    strongestMoment: raw.strongestMoment || '0–8s',
    rewrites: Array.isArray(raw.rewrites) ? raw.rewrites.slice(0, 3) : [],
    directives: Array.isArray(raw.directives) ? raw.directives.slice(0, 3) : [],
    summary: raw.summary || 'Analysis complete.',
    suggestedTitle: raw.suggestedTitle || null,
    suggestedDescription: raw.suggestedDescription || null,
    suggestedTags: Array.isArray(raw.suggestedTags) ? raw.suggestedTags.slice(0, 8) : [],
    platformRecommendation: raw.platformRecommendation || 'tiktok',
    estimatedRetentionCurve: raw.estimatedRetentionCurve || ['unknown'],
    contentNiche: raw.contentNiche || null,
  };
}

/**
 * POST /api/video/ai-hook-analysis/auto-caption
 * Generate auto-captions with sentence-level timing and 2026 style metadata
 */
router.post('/auto-caption', auth, requireFeature('auto_captions'), asyncHandler(async (req, res) => {
  const { transcript, videoId, style = 'tiktok-pop', wordsPerCaption = 4, duration } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  const words = transcript.replace(/\n/g, ' ').trim().split(/\s+/);
  const totalDuration = duration || words.length * 0.38;
  const avgWordDuration = totalDuration / words.length;

  // Sentence-aware grouping: break at punctuation boundaries first, then by word count
  const captions = [];
  let currentGroup = [];
  let currentTime = 0;
  let captionIndex = 0;

  // Style map for 2026 visual treatment tagging
  const CAPTION_STYLES = ['hook', 'stat', 'question', 'punchline', 'default'];

  words.forEach((word, i) => {
    currentGroup.push(word);
    const isEndOfSentence = /[.!?]$/.test(word);
    const isGroupFull = currentGroup.length >= wordsPerCaption;
    const isLastWord = i === words.length - 1;

    if (isEndOfSentence || isGroupFull || isLastWord) {
      const groupText = currentGroup.join(' ');
      const groupDuration = currentGroup.length * avgWordDuration;

      // Assign style based on content signals
      let captionStyle = 'default';
      if (captionIndex === 0) captionStyle = 'hook';
      else if (/\d+%|\$\d|million|billion|thousand/i.test(groupText)) captionStyle = 'stat';
      else if (groupText.includes('?')) captionStyle = 'question';
      else if (/!$/.test(groupText.trim())) captionStyle = 'punchline';

      captions.push({
        id: `caption-${captionIndex}`,
        text: groupText,
        startTime: parseFloat(currentTime.toFixed(2)),
        endTime: parseFloat((currentTime + groupDuration).toFixed(2)),
        style: captionStyle,
        displayStyle: style,
      });

      currentTime += groupDuration;
      currentGroup = [];
      captionIndex++;
    }
  });

  logger.info('Auto-captions generated', { videoId, captionCount: captions.length, style });
  sendSuccess(res, 'Auto-captions generated', 200, {
    captions,
    style,
    totalCaptions: captions.length,
    estimatedDuration: currentTime,
  });
}));

/**
 * Text-only fallback when no AI engine is available.
 *
 * Deterministic: the same transcript always gets the same scores, and every
 * score comes from something countable in the text (a question, a number, an
 * exclamation, sentence length, speaking rate). It used to add Math.random() to
 * each score, so re-running the same video gave different numbers, and it padded
 * the result with canned "insights" ("I analyzed 1,000 videos…", "72% of
 * short-form is watched muted") that no analysis ever produced. Anything we
 * cannot measure from text alone is left empty/unknown, and `isFallback: true`
 * lets the UI say these are rough text-only estimates.
 */
function generateFallbackAnalysis(transcript, duration) {
  const text = String(transcript || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
  const opening = (sentences[0] || text).slice(0, 160);
  const openingWords = opening.split(/\s+/).filter(Boolean).length;

  const openingHasQuestion = /\?/.test(text.slice(0, opening.length + 1));
  const openingHasNumber = /\d/.test(opening);
  const openingHasExclamation = /!/.test(text.slice(0, opening.length + 1));
  const addressesViewer = /\b(you|your)\b/i.test(opening);

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

  // Hook: a short opening line that asks, quantifies, exclaims or speaks to the
  // viewer directly scores higher. Base 50, capped at 90 — text alone can't
  // justify a top score.
  const hookStrength = clamp(Math.min(90,
    50
    + (openingHasQuestion ? 12 : 0)
    + (openingHasNumber ? 10 : 0)
    + (openingHasExclamation ? 6 : 0)
    + (addressesViewer ? 6 : 0)
    + (openingWords > 0 && openingWords <= 12 ? 6 : 0)
  ));

  // Pacing: words per second when the duration is known (about 2.3–3.2 wps is a
  // comfortable short-form speaking rate); otherwise average sentence length
  // (shorter sentences read faster).
  let pacing;
  const secs = Number(duration);
  if (Number.isFinite(secs) && secs > 0 && wordCount > 0) {
    const wps = wordCount / secs;
    const distance = wps < 2.3 ? 2.3 - wps : wps > 3.2 ? wps - 3.2 : 0;
    pacing = clamp(85 - distance * 30);
  } else {
    const avgSentence = sentences.length ? wordCount / sentences.length : wordCount;
    pacing = clamp(85 - Math.max(0, avgSentence - 14) * 2.5);
  }

  // Tone consistency can't be measured from plain text without a model —
  // report a neutral midpoint rather than a made-up number.
  const toneCohesion = 50;

  const viralPotential = clamp(hookStrength * 0.6 + pacing * 0.4);

  const hookType = openingHasQuestion ? 'question' : openingHasNumber ? 'stat' : openingHasExclamation ? 'pattern-interrupt' : 'story';

  const directives = [];
  if (!openingHasQuestion && !openingHasNumber) {
    directives.push({
      action: 'Open with a question or a specific number',
      reason: 'Your first line is a plain statement — a question or a concrete number gives viewers a reason to keep watching',
      impact: 'high',
    });
  }
  if (openingWords > 20) {
    directives.push({
      action: 'Shorten your first sentence',
      reason: `Your opening sentence is ${openingWords} words long — get to the point sooner`,
      impact: 'medium',
    });
  }
  if (!addressesViewer) {
    directives.push({
      action: 'Speak to the viewer directly in the first line',
      reason: 'Your opening never says "you" — addressing the viewer makes it feel personal',
      impact: 'low',
    });
  }

  return {
    hookStrength,
    toneCohesion,
    pacing,
    viralPotential,
    hookType,
    psychologicalTrigger: openingHasQuestion ? 'curiosity' : openingHasNumber ? 'authority' : 'unknown',
    weakestMoment: 'Unknown',
    strongestMoment: 'Unknown',
    rewrites: [],
    directives: directives.slice(0, 3),
    summary: 'AI analysis was unavailable, so these are rough estimates from the text only (questions, numbers, sentence length and speaking rate).',
    suggestedTitle: null,
    suggestedDescription: null,
    suggestedTags: [],
    platformRecommendation: null,
    estimatedRetentionCurve: ['unknown'],
    contentNiche: null,
    isFallback: true,
  };
}

module.exports = router;
module.exports.generateFallbackAnalysis = generateFallbackAnalysis;

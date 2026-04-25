// AI Hook & Script Analysis Route — Click Intelligence Engine
// Primary: GPT-4o | Fallback: Gemini 2.0 | Heuristic: Pattern-based
// POST /api/video/ai-hook-analysis

const express = require('express');
const auth = require('../../middleware/auth');
const { requireFeature } = require('../../middleware/tierGate');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

const OpenAI = require('openai');
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
        response_format: { type: 'json_object' }
      });

      const analysis = normalizeAnalysis(JSON.parse(completion.choices[0].message.content), transcript);
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
  return sendSuccess(res, 'Hook analysis (heuristic)', 200, { ...generateFallbackAnalysis(transcript), engine: 'heuristic' });
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
 * Smart heuristic fallback when no AI is available
 */
function generateFallbackAnalysis(transcript) {
  const words = transcript.trim().split(/\s+/);
  const wordCount = words.length;
  const hasQuestion = transcript.includes('?');
  const hasNumbers = /\d/.test(transcript);
  const firstWords = words.slice(0, 8).join(' ').toLowerCase();
  const hasExclamation = transcript.includes('!');

  const hookStrength = Math.min(95,
    55 + (hasQuestion ? 12 : 0) + (hasNumbers ? 10 : 0) + (hasExclamation ? 8 : 0) + Math.floor(Math.random() * 10)
  );
  const hookType = hasQuestion ? 'question' : hasNumbers ? 'stat' : hasExclamation ? 'pattern-interrupt' : 'story';

  return {
    hookStrength,
    toneCohesion: Math.floor(65 + Math.random() * 25),
    pacing: Math.floor(60 + Math.random() * 30),
    viralPotential: Math.min(95, Math.floor((hookStrength * 0.4) + (wordCount > 50 ? 12 : 5) + 30 + Math.random() * 15)),
    hookType,
    psychologicalTrigger: hasQuestion ? 'curiosity' : hasNumbers ? 'authority' : 'social-proof',
    weakestMoment: `${Math.floor(wordCount * 0.5 * 0.4)}–${Math.floor(wordCount * 0.65 * 0.4)}s`,
    strongestMoment: '0–8s',
    rewrites: [
      `Wait — ${firstWords}... but most people get this completely wrong.`,
      `Here's the truth about ${words[0]} ${words[1] || ''} that nobody talks about...`,
      `I analyzed 1,000 videos to find this — here's what actually works:`
    ],
    directives: [
      { action: 'Add a 3-second visual hook before the first word', reason: 'Stops the scroll before audio kicks in', impact: 'high' },
      { action: 'Cut the opening sentence in half — front-load the value', reason: 'Opens with a clear pattern interrupt', impact: 'high' },
      { action: 'Burn in captions — 72% of short-form is watched muted', reason: 'Doubles watch time on muted feeds', impact: 'medium' }
    ],
    summary: 'Solid foundation — the hook needs urgency and a stronger pattern interrupt to maximize retention.',
    suggestedTitle: `The truth about ${words[0] || 'this'}...`,
    suggestedDescription: `Most people don't know this. Watch to the end to see exactly why it matters. 👇\n\nFollow for daily insights that actually move the needle.`,
    suggestedTags: ['#viral', '#contentcreator', '#tips', '#foryou', '#trending'],
    platformRecommendation: 'tiktok',
    estimatedRetentionCurve: ['strong-open', 'mid-drop', 'unknown-close'],
    contentNiche: null,
    isFallback: true,
  };
}

module.exports = router;

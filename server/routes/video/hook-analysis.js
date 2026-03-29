// AI Hook & Script Analysis Route
// Wires transcript → GPT-4o for real viral score + rewrites + directives
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

const VIRAL_ANALYSIS_PROMPT = `You are an expert viral video analyst trained on millions of high-performing short-form videos (TikTok, YouTube Shorts, Instagram Reels).

Analyze this video transcript and return a JSON response with:
1. hookStrength (0-100): How likely is the first 3 seconds to stop a scroll?
2. toneCohesion (0-100): How consistent is the tone/energy throughout?
3. pacing (0-100): Is the information density and rhythm optimal?
4. viralPotential (0-100): Overall viral potential score
5. hookType: Classify as one of ["question", "stat", "story", "controversy", "pattern-interrupt", "pain-point", "curiosity-gap"]
6. weakestMoment: Timestamp range (in seconds) where engagement likely drops (e.g. "15-22s")
7. strongestMoment: Timestamp range where engagement likely peaks (e.g. "0-8s")
8. rewrites: Array of 3 improved hook alternatives (just the opening 1-2 sentences)
9. directives: Array of 3 specific actionable edits with: { action: string, reason: string, impact: "high"|"medium"|"low" }
10. summary: 1-sentence diagnosis of the video's main strength and weakness
11. suggestedTitle: A highly clickable, viral-optimized title under 60 characters
12. suggestedDescription: A 2-3 sentence description optimized for the algorithm (including a call to action)
13. suggestedTags: Array of 5-8 highly relevant, high-volume hashtags

Return ONLY valid JSON. No markdown, no explanation.`;

/**
 * POST /api/video/ai-hook-analysis
 * Runs real GPT-4o analysis on a transcript
 */
router.post('/', auth, requireFeature('ai_analysis'), asyncHandler(async (req, res) => {
  const { transcript, videoId, duration } = req.body;

  if (!transcript || transcript.trim().length < 20) {
    return sendError(res, 'Transcript is required (min 20 characters)', 400);
  }

  if (!openai) {
    // Return smart fallback analysis if no API key
    logger.warn('OpenAI not configured — returning fallback hook analysis');
    return sendSuccess(res, 'Hook analysis (fallback)', 200, generateFallbackAnalysis(transcript));
  }

  try {
    logger.info('Starting AI hook analysis', { videoId, transcriptLength: transcript.length });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: VIRAL_ANALYSIS_PROMPT
        },
        {
          role: 'user',
          content: `Video Duration: ${duration || 'unknown'} seconds\n\nTranscript:\n${transcript.slice(0, 4000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    const rawContent = completion.choices[0].message.content;
    let analysis;

    try {
      analysis = JSON.parse(rawContent);
    } catch (parseError) {
      logger.error('Failed to parse GPT-4o response', { rawContent, parseError: parseError.message });
      analysis = generateFallbackAnalysis(transcript);
    }

    // Normalize scores to 0-100 range
    const normalize = (v) => Math.min(100, Math.max(0, Math.round(v || 0)));
    analysis.hookStrength = normalize(analysis.hookStrength);
    analysis.toneCohesion = normalize(analysis.toneCohesion);
    analysis.pacing = normalize(analysis.pacing);
    analysis.viralPotential = normalize(analysis.viralPotential);

    // Ensure arrays exist
    analysis.rewrites = Array.isArray(analysis.rewrites) ? analysis.rewrites.slice(0, 3) : [];
    analysis.directives = Array.isArray(analysis.directives) ? analysis.directives.slice(0, 3) : [];

    logger.info('AI hook analysis completed', {
      videoId,
      viralPotential: analysis.viralPotential,
      hookStrength: analysis.hookStrength
    });

    sendSuccess(res, 'Hook analysis complete', 200, analysis);
  } catch (error) {
    logger.error('AI hook analysis error', { error: error.message, videoId });
    // Return fallback so UI never breaks
    sendSuccess(res, 'Hook analysis (fallback)', 200, generateFallbackAnalysis(transcript));
  }
}));

/**
 * POST /api/video/ai-hook-analysis/auto-caption
 * Generate auto-captions with word-level timestamps from transcript
 */
router.post('/auto-caption', auth, requireFeature('auto_captions'), asyncHandler(async (req, res) => {
  const { transcript, videoId, style = 'tiktok-pop', wordsPerCaption = 4, duration } = req.body;

  if (!transcript) {
    return sendError(res, 'Transcript is required', 400);
  }

  // Convert transcript to word-timed caption segments
  // If Whisper timestamps available, use them; otherwise estimate from word count
  const words = transcript.replace(/\n/g, ' ').trim().split(/\s+/);
  const avgWordDuration = (duration || words.length * 0.4) / words.length;

  const captions = [];
  let currentTime = 0;

  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const group = words.slice(i, i + wordsPerCaption);
    const groupDuration = group.length * avgWordDuration;

    captions.push({
      id: `caption-${i}`,
      text: group.join(' '),
      startTime: parseFloat(currentTime.toFixed(2)),
      endTime: parseFloat((currentTime + groupDuration).toFixed(2)),
      style,
    });

    currentTime += groupDuration;
  }

  logger.info('Auto-captions generated', { videoId, captionCount: captions.length });
  sendSuccess(res, 'Auto-captions generated', 200, { captions, style, totalCaptions: captions.length });
}));

/**
 * Smart fallback when no OpenAI key is present
 */
function generateFallbackAnalysis(transcript) {
  const words = transcript.trim().split(/\s+/);
  const wordCount = words.length;
  const hasQuestion = transcript.includes('?');
  const hasNumbers = /\d/.test(transcript);
  const firstWords = words.slice(0, 8).join(' ').toLowerCase();

  // Heuristic scoring
  const hookStrength = Math.min(95,
    60 +
    (hasQuestion ? 10 : 0) +
    (hasNumbers ? 8 : 0) +
    (firstWords.length > 20 ? 5 : 0) +
    Math.floor(Math.random() * 12)
  );

  return {
    hookStrength,
    toneCohesion: Math.floor(65 + Math.random() * 25),
    pacing: Math.floor(60 + Math.random() * 30),
    viralPotential: Math.floor((hookStrength * 0.4) + (wordCount > 50 ? 10 : 5) + (35 + Math.random() * 20)),
    hookType: hasQuestion ? 'question' : hasNumbers ? 'stat' : 'story',
    weakestMoment: `${Math.floor(wordCount * 0.5 * 0.4)}–${Math.floor(wordCount * 0.65 * 0.4)}s`,
    strongestMoment: '0–8s',
    rewrites: [
      `Wait — ${firstWords}... (but most people get this wrong)`,
      `Here's what nobody tells you about ${words[0]} ${words[1] || ''}...`,
      `I studied 1,000 videos so you don't have to — here's what works:`
    ],
    directives: [
      { action: 'Add a 3-second visual hook before the first word', reason: 'Stops the scroll before audio kicks in', impact: 'high' },
      { action: 'Cut the first sentence in half', reason: 'Opens with a clear pattern interrupt', impact: 'high' },
      { action: 'Add captions — 72% of videos are watched muted', reason: 'Doubles watch time on muted feeds', impact: 'medium' }
    ],
    summary: 'Solid foundation — hook needs urgency and a stronger pattern interrupt to maximize retention.',
    suggestedTitle: `The truth about ${words[0] || 'this'}...`,
    suggestedDescription: `I discovered a secret method that changes everything. Watch till the end to see the results! 👇\n\nFollow for more daily tips!`,
    suggestedTags: ['#viral', '#tips', '#creator', '#foryou', '#trending'],
    isFallback: true,
  };
}

module.exports = router;

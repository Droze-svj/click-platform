// AI Confidence Service
// Analyze AI-generated content for confidence and edit effort

const AIConfidenceScore = require('../models/AIConfidenceScore');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Analyze content confidence
 */
async function analyzeContentConfidence(contentId, content, context = {}) {
  try {
    const {
      platform = null,
      brandGuidelines = null,
      previousContent = null
    } = context;

    // Analyze content
    const analysis = await performConfidenceAnalysis(content, platform, brandGuidelines);

    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(analysis);

    // Detect uncertainty flags
    const uncertaintyFlags = detectUncertaintyFlags(content, analysis);

    // Estimate edit effort
    const editEffort = estimateEditEffort(analysis, uncertaintyFlags);

    // Determine if human review needed
    const needsHumanReview = determineHumanReviewNeeded(overallConfidence, editEffort, uncertaintyFlags);

    // Create confidence score record
    const confidenceScore = new AIConfidenceScore({
      contentId,
      overallConfidence,
      aspectConfidence: analysis.aspectConfidence,
      uncertaintyFlags,
      editEffort,
      needsHumanReview,
      reviewReason: needsHumanReview ? generateReviewReason(uncertaintyFlags, overallConfidence) : null,
      confidenceBreakdown: analysis.breakdown,
      // Honest provenance — this service uses Gemini or a deterministic heuristic,
      // never GPT-4. Reflect what actually produced the scores.
      model: analysis.metadata?.source === 'heuristic-fallback' ? 'heuristic' : 'gemini-2.5-flash',
      analysisMetadata: analysis.metadata
    });

    await confidenceScore.save();

    logger.info('Content confidence analyzed', { contentId, overallConfidence, needsHumanReview });
    return confidenceScore;
  } catch (error) {
    logger.error('Error analyzing content confidence', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Perform confidence analysis using AI
 */
/**
 * Deterministic confidence heuristics from the content text itself — used when
 * the LLM is unavailable so we return a REAL signal instead of hardcoded 75s.
 */
function heuristicConfidence(content) {
  const text = String(content?.text || content || '');
  const words = text.trim().split(/\s+/).filter(Boolean);
  const len = words.length;
  const lower = text.toLowerCase();

  const hedges = (lower.match(/\b(maybe|perhaps|might|possibly|i think|not sure|kind of|sort of)\b/g) || []).length;
  const exclaims = (text.match(/!/g) || []).length;
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  const sarcasmMarkers = /\/s\b|yeah right|so great|obviously/i.test(text) ? 1 : 0;
  const sensitiveHit = /\b(politic|religion|death|violence|nsfw|suicide|drugs)\b/i.test(lower) ? 1 : 0;

  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  // Clarity drops for very short or hedge-heavy copy.
  const clarity = clamp(90 - hedges * 8 - (len < 4 ? 25 : 0));
  // Tone drops with shouting / over-punctuation.
  const tone = clamp(85 - capsWords * 4 - Math.max(0, exclaims - 2) * 5);
  const sarcasm = sarcasmMarkers ? 65 : 30;
  const humor = /\b(lol|haha|joke|funny|😂|🤣)\b/i.test(lower) ? 65 : 45;
  const sensitivity = clamp(85 - sensitiveHit * 35);
  const engagement = clamp(55 + Math.min(20, len) + exclaims * 2);

  return {
    aspectConfidence: { tone, humor, sarcasm, sensitivity, brandAlignment: 70, clarity, engagement },
    breakdown: { textAnalysis: clarity, contextAnalysis: tone, brandCompliance: 70, platformFit: 70 },
    metadata: {
      detectedTopics: [],
      detectedSentiment: 'neutral',
      languageComplexity: len > 30 ? 'high' : len > 12 ? 'medium' : 'low',
      readingLevel: len > 30 ? '12th grade' : '8th grade',
      source: 'heuristic-fallback',
    },
  };
}

async function performConfidenceAnalysis(content, platform, brandGuidelines) {
  try {
    const prompt = `Analyze the following content for confidence scoring. Provide scores (0-100) for:
1. Tone appropriateness
2. Humor detection (if present, how confident are you it's appropriate?)
3. Sarcasm detection (if present, how confident are you it's appropriate?)
4. Sensitivity (sensitive topics, controversial content)
5. Brand alignment (if brand guidelines provided)
6. Clarity
7. Engagement potential

Content: "${content.text || content}"

${platform ? `Platform: ${platform}` : ''}
${brandGuidelines ? `Brand Guidelines: ${JSON.stringify(brandGuidelines)}` : ''}

Respond with JSON:
{
  "tone": 85,
  "humor": 60,
  "sarcasm": 30,
  "sensitivity": 70,
  "brandAlignment": 80,
  "clarity": 90,
  "engagement": 75,
  "breakdown": {
    "textAnalysis": 85,
    "contextAnalysis": 70,
    "brandCompliance": 80,
    "platformFit": 75
  },
  "metadata": {
    "detectedTopics": ["topic1", "topic2"],
    "detectedSentiment": "positive",
    "languageComplexity": "medium",
    "readingLevel": "8th grade"
  }
}`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot analyze confidence');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content quality analyst. Analyze content and provide confidence scores. Return valid JSON only.\n\n${prompt}`;
    const raw = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1024 });
    const { safeJsonParse } = require('../utils/aiRouter');
    const analysis = safeJsonParse(raw, null);

    // The model can return null (quota/blocked), prose, or TRUNCATED JSON that
    // parses to an object missing the numeric aspects. In every such case we must
    // NOT fabricate a "confident" 75 across the board (which would flip a record
    // to needsHumanReview:false — the exact case this service exists to catch).
    // Fall through to the deterministic text heuristic instead, same as a throw.
    const hasScores = analysis && typeof analysis === 'object' &&
      ['tone', 'clarity', 'engagement', 'sensitivity'].some(k => typeof analysis[k] === 'number');
    if (!hasScores) {
      logger.warn('Confidence LLM returned unusable output; using deterministic heuristics');
      return heuristicConfidence(content);
    }

    // Use ?? (not ||) so a genuine 0 (e.g. sensitivity:0) isn't overwritten by the
    // default — a real 0 must survive to trip the low-score uncertainty flags.
    return {
      aspectConfidence: {
        tone: analysis.tone ?? 75,
        humor: analysis.humor ?? 50,
        sarcasm: analysis.sarcasm ?? 50,
        sensitivity: analysis.sensitivity ?? 75,
        brandAlignment: analysis.brandAlignment ?? 75,
        clarity: analysis.clarity ?? 80,
        engagement: analysis.engagement ?? 75
      },
      breakdown: analysis.breakdown || {
        textAnalysis: 75,
        contextAnalysis: 70,
        brandCompliance: 75,
        platformFit: 75
      },
      metadata: {
        detectedTopics: [],
        detectedSentiment: 'neutral',
        languageComplexity: 'medium',
        readingLevel: '8th grade',
        ...(analysis.metadata || {}),
        source: 'gemini',
      }
    };
  } catch (error) {
    logger.warn('Confidence LLM unavailable; using deterministic heuristics', { error: error.message });
    // Real text-derived heuristics instead of hardcoded 75s.
    return heuristicConfidence(content);
  }
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(analysis) {
  const aspects = Object.values(analysis.aspectConfidence);
  const breakdown = Object.values(analysis.breakdown);

  const aspectAvg = aspects.reduce((sum, val) => sum + val, 0) / aspects.length;
  const breakdownAvg = breakdown.reduce((sum, val) => sum + val, 0) / breakdown.length;

  return Math.round((aspectAvg + breakdownAvg) / 2);
}

/**
 * Detect uncertainty flags
 */
function detectUncertaintyFlags(content, analysis) {
  const flags = [];
  const text = content.text || content || '';

  // Humor detection
  if (analysis.aspectConfidence.humor < 70 && analysis.aspectConfidence.humor > 30) {
    flags.push({
      type: 'humor_detected',
      severity: analysis.aspectConfidence.humor < 50 ? 'high' : 'medium',
      message: 'Humor detected but confidence is low',
      suggestion: 'Review humor for appropriateness'
    });
  }

  // Sarcasm detection
  if (analysis.aspectConfidence.sarcasm < 70 && analysis.aspectConfidence.sarcasm > 30) {
    flags.push({
      type: 'sarcasm_detected',
      severity: analysis.aspectConfidence.sarcasm < 50 ? 'high' : 'medium',
      message: 'Sarcasm detected but may be misinterpreted',
      suggestion: 'Clarify tone or remove sarcasm'
    });
  }

  // Sensitive topics
  if (analysis.aspectConfidence.sensitivity < 60) {
    flags.push({
      type: 'sensitive_topic',
      severity: analysis.aspectConfidence.sensitivity < 40 ? 'critical' : 'high',
      message: 'Content may contain sensitive topics',
      suggestion: 'Review for sensitivity and appropriateness'
    });
  }

  // Ambiguous tone
  if (analysis.aspectConfidence.tone < 60) {
    flags.push({
      type: 'ambiguous_tone',
      severity: 'medium',
      message: 'Tone is ambiguous or unclear',
      suggestion: 'Clarify tone to match brand voice'
    });
  }

  // Brand mismatch
  if (analysis.aspectConfidence.brandAlignment < 60) {
    flags.push({
      type: 'brand_mismatch',
      severity: analysis.aspectConfidence.brandAlignment < 40 ? 'high' : 'medium',
      message: 'Content may not align with brand guidelines',
      suggestion: 'Review and adjust to match brand voice'
    });
  }

  // Low clarity
  if (analysis.aspectConfidence.clarity < 60) {
    flags.push({
      type: 'low_clarity',
      severity: 'medium',
      message: 'Content clarity is low',
      suggestion: 'Simplify language and structure'
    });
  }

  // Complex language
  if (analysis.metadata.languageComplexity === 'high') {
    flags.push({
      type: 'complex_language',
      severity: 'low',
      message: 'Language complexity is high',
      suggestion: 'Consider simplifying for broader audience'
    });
  }

  return flags;
}

/**
 * Estimate edit effort
 */
function estimateEditEffort(analysis, uncertaintyFlags) {
  let effort = 0;

  // Base effort from confidence
  effort += (100 - analysis.aspectConfidence.tone) * 0.2;
  effort += (100 - analysis.aspectConfidence.brandAlignment) * 0.3;
  effort += (100 - analysis.aspectConfidence.clarity) * 0.2;

  // Add effort from flags
  uncertaintyFlags.forEach(flag => {
    switch (flag.severity) {
    case 'critical':
      effort += 20;
      break;
    case 'high':
      effort += 15;
      break;
    case 'medium':
      effort += 10;
      break;
    case 'low':
      effort += 5;
      break;
    }
  });

  return Math.min(100, Math.round(effort));
}

/**
 * Determine if human review needed
 */
function determineHumanReviewNeeded(overallConfidence, editEffort, uncertaintyFlags) {
  // Review needed if:
  // - Confidence below 70
  // - Edit effort above 50
  // - Critical or high severity flags
  return overallConfidence < 70 ||
    editEffort > 50 ||
    uncertaintyFlags.some(f => f.severity === 'high' || f.severity === 'critical');
}

/**
 * Generate review reason
 */
function generateReviewReason(uncertaintyFlags, overallConfidence) {
  const criticalFlags = uncertaintyFlags.filter(f => f.severity === 'critical' || f.severity === 'high');

  if (criticalFlags.length > 0) {
    return `High priority flags: ${criticalFlags.map(f => f.type).join(', ')}`;
  }

  if (overallConfidence < 70) {
    return `Low confidence score: ${overallConfidence}%`;
  }

  return 'Multiple uncertainty flags detected';
}

/**
 * Get confidence score for content
 */
async function getContentConfidence(contentId) {
  try {
    const score = await AIConfidenceScore.findOne({ contentId })
      .sort({ createdAt: -1 })
      .lean();

    return score;
  } catch (error) {
    logger.error('Error getting content confidence', { error: error.message, contentId });
    return null;
  }
}

module.exports = {
  analyzeContentConfidence,
  getContentConfidence
};



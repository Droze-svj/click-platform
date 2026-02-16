// Content moderation service using AI and filters

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');

// Profanity filter patterns (basic - can be enhanced with library)
const PROFANITY_PATTERNS = [
  /\b(fuck|shit|damn|bitch|asshole|bastard)\b/gi,
];

// Spam detection patterns
const SPAM_PATTERNS = [
  /(click here|buy now|limited time|act now|urgent|free money)/gi,
  /(http|https):\/\/[^\s]+/g,
  /[A-Z]{10,}/g,
  /!{3,}/g,
];

/**
 * Check content with Google Gemini for safety/harm
 */
async function checkWithAI(content) {
  try {
    if (!geminiConfigured) {
      logger.warn('Google AI not configured, skipping AI moderation');
      return null;
    }

    const prompt = `Analyze this content for safety. Check for: hate, harassment, self-harm, sexual content, violence, dangerous content.

Content: ${content.substring(0, 2000)}

Return a JSON object with:
- flagged (boolean): true if content violates safety guidelines
- categories (object): keys "hate", "harassment", "self-harm", "sexual", "violence", "dangerous" - each boolean
- categoryScores (object): same keys, each 0-1 score
- recommendedAction: "review" if flagged, "approve" otherwise

Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 500, temperature: 0.1 });
    if (!response) return null;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { flagged: false, recommendedAction: 'approve' };

    return {
      flagged: !!result.flagged,
      categories: result.categories || {},
      categoryScores: result.categoryScores || {},
      recommendedAction: result.recommendedAction || (result.flagged ? 'review' : 'approve'),
    };
  } catch (error) {
    logger.error('AI moderation error', { error: error.message });
    captureException(error, { tags: { service: 'moderation', operation: 'ai' } });
    return null;
  }
}

// Backward compatibility
const checkWithOpenAI = checkWithAI;

/**
 * Check for profanity
 */
function checkProfanity(text) {
  const issues = [];

  PROFANITY_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      issues.push({
        type: 'profanity',
        severity: 'high',
        matches: matches.length,
        pattern: index,
      });
    }
  });

  return {
    hasProfanity: issues.length > 0,
    issues,
  };
}

/**
 * Check for spam
 */
function checkSpam(text) {
  const issues = [];
  let spamScore = 0;

  SPAM_PATTERNS.forEach((pattern, index) => {
    const matches = text.match(pattern);
    if (matches) {
      spamScore += matches.length;
      issues.push({
        type: 'spam',
        severity: 'medium',
        matches: matches.length,
        pattern: index,
      });
    }
  });

  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = {};
  words.forEach((word) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  const repeatedWords = Object.entries(wordCounts)
    .filter(([word, count]) => count > 5 && word.length > 3)
    .map(([word, count]) => ({ word, count }));

  if (repeatedWords.length > 0) {
    spamScore += repeatedWords.length;
    issues.push({
      type: 'repetition',
      severity: 'medium',
      repeatedWords,
    });
  }

  return {
    isSpam: spamScore > 3,
    spamScore,
    issues,
  };
}

/**
 * Moderate content (comprehensive check)
 */
async function moderateContent(content, options = {}) {
  const {
    text,
    title,
    description,
    checkAI = true,
    checkProfanity: checkProfanityFlag = true,
    checkSpam: checkSpamFlag = true,
  } = options;

  const fullText = [text, title, description].filter(Boolean).join(' ');

  const results = {
    approved: true,
    flagged: false,
    issues: [],
    scores: {
      profanity: 0,
      spam: 0,
      ai: null,
    },
    recommendations: [],
  };

  if (checkProfanityFlag && fullText) {
    const profanityCheck = checkProfanity(fullText);
    if (profanityCheck.hasProfanity) {
      results.flagged = true;
      results.approved = false;
      results.issues.push(...profanityCheck.issues);
      results.scores.profanity = profanityCheck.issues.length;
      results.recommendations.push('Remove profanity from content');
    }
  }

  if (checkSpamFlag && fullText) {
    const spamCheck = checkSpam(fullText);
    if (spamCheck.isSpam) {
      results.flagged = true;
      results.approved = false;
      results.issues.push(...spamCheck.issues);
      results.scores.spam = spamCheck.spamScore;
      results.recommendations.push('Content appears to be spam. Review and revise.');
    }
  }

  if (checkAI && fullText) {
    const aiCheck = await checkWithAI(fullText);
    if (aiCheck) {
      results.scores.ai = aiCheck;
      if (aiCheck.flagged) {
        results.flagged = true;
        results.approved = false;

        const flaggedCategories = Object.entries(aiCheck.categories || {})
          .filter(([_, flagged]) => flagged)
          .map(([category]) => category);

        results.issues.push({
          type: 'ai_flagged',
          severity: 'high',
          categories: flaggedCategories,
        });

        results.recommendations.push(
          `Content flagged by AI moderation: ${flaggedCategories.join(', ')}`
        );
      }
    }
  }

  const maxScore = 100;
  let penalty = 0;
  if (results.scores.profanity > 0) penalty += 30;
  if (results.scores.spam > 3) penalty += 20;
  if (results.scores.ai?.flagged) penalty += 50;

  results.moderationScore = Math.max(0, maxScore - penalty);
  results.healthStatus =
    results.moderationScore >= 80 ? 'healthy' : results.moderationScore >= 50 ? 'needs_review' : 'unhealthy';

  return results;
}

/**
 * Auto-flag content for manual review
 */
async function flagForReview(contentId, reason, userId) {
  try {
    logger.warn('Content flagged for review', { contentId, reason, userId });
    return {
      flagged: true,
      contentId,
      reason,
      flaggedAt: new Date(),
    };
  } catch (error) {
    logger.error('Flag for review error', { error: error.message, contentId });
    throw error;
  }
}

module.exports = {
  moderateContent,
  checkProfanity,
  checkSpam,
  checkWithOpenAI,
  checkWithAI,
  flagForReview,
};

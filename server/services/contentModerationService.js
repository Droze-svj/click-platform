// Content moderation service using AI and filters

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

// Optional: Try to load OpenAI, fallback if not available
let openai = null;
try {
  openai = require('../utils/openai');
} catch (error) {
  logger.warn('OpenAI utils not available, AI moderation will be disabled', { error: error.message });
  // Try alternative import
  try {
    const OpenAI = require('openai');
    if (process.env.OPENAI_API_KEY) {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  } catch (err) {
    logger.warn('OpenAI package not available', { error: err.message });
  }
}

// Profanity filter patterns (basic - can be enhanced with library)
const PROFANITY_PATTERNS = [
  /\b(fuck|shit|damn|bitch|asshole|bastard)\b/gi,
  // Add more patterns as needed
];

// Spam detection patterns
const SPAM_PATTERNS = [
  /(click here|buy now|limited time|act now|urgent|free money)/gi,
  /(http|https):\/\/[^\s]+/g, // Multiple URLs
  /[A-Z]{10,}/g, // Excessive caps
  /!{3,}/g, // Multiple exclamation marks
];

/**
 * Check content with OpenAI Moderation API
 */
async function checkWithOpenAI(content) {
  try {
    if (!openai) {
      logger.warn('OpenAI not configured, skipping AI moderation');
      return null;
    }

    const response = await openai.moderations.create({
      input: content,
    });

    const result = response.results[0];
    
    return {
      flagged: result.flagged,
      categories: result.categories,
      categoryScores: result.category_scores,
      recommendedAction: result.flagged ? 'review' : 'approve',
    };
  } catch (error) {
    logger.error('OpenAI moderation error', { error: error.message });
    captureException(error, { tags: { service: 'moderation', operation: 'openai' } });
    return null;
  }
}

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

  // Check for excessive repetition
  const words = text.toLowerCase().split(/\s+/);
  const wordCounts = {};
  words.forEach(word => {
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

  // Check profanity
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

  // Check spam
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

  // Check with OpenAI
  if (checkAI && fullText) {
    const aiCheck = await checkWithOpenAI(fullText);
    if (aiCheck) {
      results.scores.ai = aiCheck;
      if (aiCheck.flagged) {
        results.flagged = true;
        results.approved = false;
        
        // Add flagged categories
        const flaggedCategories = Object.entries(aiCheck.categories)
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

  // Calculate overall score (0-100, lower is better)
  const maxScore = 100;
  let penalty = 0;
  
  if (results.scores.profanity > 0) penalty += 30;
  if (results.scores.spam > 3) penalty += 20;
  if (results.scores.ai?.flagged) penalty += 50;
  
  results.moderationScore = Math.max(0, maxScore - penalty);
  results.healthStatus = results.moderationScore >= 80 ? 'healthy' :
                        results.moderationScore >= 50 ? 'needs_review' : 'unhealthy';

  return results;
}

/**
 * Auto-flag content for manual review
 */
async function flagForReview(contentId, reason, userId) {
  try {
    // This would integrate with your content model
    // For now, just log it
    logger.warn('Content flagged for review', {
      contentId,
      reason,
      userId,
    });

    // In production, you'd update the content status
    // await Content.findByIdAndUpdate(contentId, {
    //   moderationStatus: 'flagged',
    //   moderationReason: reason,
    //   flaggedAt: new Date(),
    // });

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
  flagForReview,
};







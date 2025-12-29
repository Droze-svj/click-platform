// Help Center AI Service

const HelpArticle = require('../models/HelpArticle');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * AI-powered article search
 */
async function aiSearch(query, userId = null) {
  try {
    // In production, use OpenAI embeddings or similar
    // For now, enhanced semantic search
    
    const articles = await HelpArticle.find({
      published: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } },
      ],
    })
      .sort({ helpful: -1, views: -1 })
      .limit(10)
      .lean();

    // Score articles by relevance
    const scored = articles.map(article => ({
      ...article,
      relevanceScore: calculateRelevanceScore(article, query),
    }));

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored;
  } catch (error) {
    logger.error('AI search error', { error: error.message, query });
    throw error;
  }
}

/**
 * Get article recommendations
 */
async function getArticleRecommendations(articleId, userId = null) {
  try {
    const cacheKey = `help:recommendations:${articleId}`;
    
    return await getOrSet(cacheKey, async () => {
      const article = await HelpArticle.findById(articleId).lean();
      if (!article) {
        return [];
      }

      // Find similar articles by category and tags
      const similar = await HelpArticle.find({
        _id: { $ne: articleId },
        published: true,
        $or: [
          { category: article.category },
          { tags: { $in: article.tags } },
        ],
      })
        .sort({ helpful: -1, views: -1 })
        .limit(5)
        .select('title slug category views helpful')
        .lean();

      return similar;
    }, 1800); // Cache for 30 minutes
  } catch (error) {
    logger.error('Get recommendations error', {
      error: error.message,
      articleId,
    });
    return [];
  }
}

/**
 * Get personalized help suggestions
 */
async function getPersonalizedSuggestions(userId, context = {}) {
  try {
    // Based on user's recent activity, suggest relevant articles
    const { recentActions = [], currentPage = null } = context;

    let suggestions = [];

    // Suggest based on current page
    if (currentPage) {
      const pageBased = await HelpArticle.find({
        published: true,
        tags: { $in: [currentPage.toLowerCase()] },
      })
        .sort({ helpful: -1 })
        .limit(3)
        .select('title slug category')
        .lean();
      suggestions.push(...pageBased);
    }

    // Suggest based on recent actions
    if (recentActions.length > 0) {
      const actionBased = await HelpArticle.find({
        published: true,
        $or: recentActions.map(action => ({
          tags: { $in: [action.toLowerCase()] },
        })),
      })
        .sort({ helpful: -1 })
        .limit(3)
        .select('title slug category')
        .lean();
      suggestions.push(...actionBased);
    }

    // Remove duplicates
    const unique = suggestions.filter(
      (article, index, self) =>
        index === self.findIndex(a => a._id.toString() === article._id.toString())
    );

    return unique.slice(0, 5);
  } catch (error) {
    logger.error('Get personalized suggestions error', {
      error: error.message,
      userId,
    });
    return [];
  }
}

/**
 * Calculate relevance score
 */
function calculateRelevanceScore(article, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Title match (highest weight)
  if (article.title.toLowerCase().includes(queryLower)) {
    score += 10;
  }

  // Content match
  if (article.content.toLowerCase().includes(queryLower)) {
    score += 5;
  }

  // Tag match
  if (article.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
    score += 3;
  }

  // Helpful score
  score += (article.helpful || 0) * 0.1;

  // Views (popularity)
  score += Math.log(article.views + 1) * 0.1;

  return score;
}

module.exports = {
  aiSearch,
  getArticleRecommendations,
  getPersonalizedSuggestions,
};







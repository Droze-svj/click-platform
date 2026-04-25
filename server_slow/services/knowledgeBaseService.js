// Knowledge Base Service
// Search and suggest articles for support

const SupportKnowledgeBase = require('../models/SupportKnowledgeBase');
const logger = require('../utils/logger');

/**
 * Search knowledge base
 */
async function searchKnowledgeBase(query, filters = {}) {
  try {
    const {
      category = null,
      limit = 10
    } = filters;

    const searchQuery = {
      status: 'published',
      $text: { $search: query }
    };

    if (category) {
      searchQuery.category = category;
    }

    const articles = await SupportKnowledgeBase.find(searchQuery)
      .select('title content category tags solutions stats')
      .sort({ score: { $meta: 'textScore' }, 'stats.views': -1 })
      .limit(limit)
      .lean();

    return articles;
  } catch (error) {
    logger.error('Error searching knowledge base', { error: error.message });
    return [];
  }
}

/**
 * Suggest articles for ticket
 */
async function suggestArticlesForTicket(ticket) {
  try {
    const query = `${ticket.subject} ${ticket.description}`;
    const articles = await searchKnowledgeBase(query, {
      category: ticket.category,
      limit: 5
    });

    return articles.map(article => ({
      id: article._id,
      title: article.title,
      relevance: calculateRelevance(article, ticket),
      solutions: article.solutions
    })).sort((a, b) => b.relevance - a.relevance);
  } catch (error) {
    logger.error('Error suggesting articles', { error: error.message });
    return [];
  }
}

/**
 * Calculate relevance score
 */
function calculateRelevance(article, ticket) {
  let score = 0;

  // Category match
  if (article.category === ticket.category) {
    score += 30;
  }

  // Keyword matches in title
  const ticketText = `${ticket.subject} ${ticket.description}`.toLowerCase();
  const articleTitle = article.title.toLowerCase();
  
  const ticketWords = ticketText.split(/\s+/);
  ticketWords.forEach(word => {
    if (word.length > 3 && articleTitle.includes(word)) {
      score += 10;
    }
  });

  // Tag matches
  if (article.tags && article.tags.length > 0) {
    article.tags.forEach(tag => {
      if (ticketText.includes(tag.toLowerCase())) {
        score += 5;
      }
    });
  }

  // Usage stats
  score += Math.min(article.stats.views / 100, 10);
  score += Math.min(article.stats.helpful / 10, 10);

  return score;
}

/**
 * Get article
 */
async function getArticle(articleId) {
  try {
    const article = await SupportKnowledgeBase.findById(articleId);
    
    if (article) {
      // Increment views
      article.stats.views++;
      await article.save();
    }

    return article;
  } catch (error) {
    logger.error('Error getting article', { error: error.message });
    return null;
  }
}

/**
 * Mark article as helpful
 */
async function markArticleHelpful(articleId, helpful) {
  try {
    const article = await SupportKnowledgeBase.findById(articleId);
    if (!article) {
      throw new Error('Article not found');
    }

    if (helpful) {
      article.stats.helpful++;
    } else {
      article.stats.notHelpful++;
    }

    await article.save();
    return article;
  } catch (error) {
    logger.error('Error marking article helpful', { error: error.message });
    throw error;
  }
}

module.exports = {
  searchKnowledgeBase,
  suggestArticlesForTicket,
  getArticle,
  markArticleHelpful
};



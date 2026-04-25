// Help Center Service

const HelpArticle = require('../models/HelpArticle');
const SupportTicket = require('../models/SupportTicket');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get help articles
 */
async function getHelpArticles(options = {}) {
  try {
    const {
      category = null,
      search = null,
      featured = false,
      limit = 20,
      skip = 0,
    } = options;

    const query = { published: true };

    if (category) {
      query.category = category;
    }

    if (featured) {
      query.featured = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const [articles, total] = await Promise.all([
      HelpArticle.find(query)
        .sort({ featured: -1, views: -1, createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .select('-content') // Don't return full content in list
        .lean(),
      HelpArticle.countDocuments(query),
    ]);

    return {
      articles,
      total,
      limit,
      skip,
    };
  } catch (error) {
    logger.error('Get help articles error', { error: error.message });
    throw error;
  }
}

/**
 * Get help article by slug
 */
async function getHelpArticle(slug) {
  try {
    const article = await HelpArticle.findOne({ slug, published: true });

    if (article) {
      // Increment views
      await HelpArticle.findByIdAndUpdate(article._id, {
        $inc: { views: 1 },
      });
    }

    return article;
  } catch (error) {
    logger.error('Get help article error', { error: error.message, slug });
    throw error;
  }
}

/**
 * Get article categories
 */
async function getCategories() {
  try {
    const cacheKey = 'help:categories';
    
    return await getOrSet(cacheKey, async () => {
      const categories = await HelpArticle.aggregate([
        {
          $match: { published: true },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return categories.map(cat => ({
        category: cat._id,
        count: cat.count,
      }));
    }, 3600); // Cache for 1 hour
  } catch (error) {
    logger.error('Get categories error', { error: error.message });
    throw error;
  }
}

/**
 * Mark article as helpful
 */
async function markHelpful(articleId, helpful = true) {
  try {
    const update = helpful
      ? { $inc: { helpful: 1 } }
      : { $inc: { notHelpful: 1 } };

    await HelpArticle.findByIdAndUpdate(articleId, update);
    return true;
  } catch (error) {
    logger.error('Mark helpful error', { error: error.message, articleId });
    throw error;
  }
}

/**
 * Create support ticket
 */
async function createSupportTicket(userId, ticketData) {
  try {
    const ticket = new SupportTicket({
      userId,
      ...ticketData,
    });

    await ticket.save();
    logger.info('Support ticket created', { ticketId: ticket._id, userId });
    return ticket;
  } catch (error) {
    logger.error('Create support ticket error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user support tickets
 */
async function getUserTickets(userId, options = {}) {
  try {
    const { status = null, limit = 20, skip = 0 } = options;

    const query = { userId };

    if (status) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('assignedTo', 'name email')
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    return {
      tickets,
      total,
      limit,
      skip,
    };
  } catch (error) {
    logger.error('Get user tickets error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Add message to ticket
 */
async function addTicketMessage(ticketId, userId, message, attachments = []) {
  try {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Check if user owns ticket or is admin/assigned
    if (
      ticket.userId.toString() !== userId.toString() &&
      // Add admin check here if needed
      ticket.assignedTo?.toString() !== userId.toString()
    ) {
      throw new Error('Unauthorized');
    }

    ticket.messages.push({
      userId,
      message,
      attachments,
    });

    // Update status if it was closed
    if (ticket.status === 'closed') {
      ticket.status = 'open';
    }

    await ticket.save();
    return ticket;
  } catch (error) {
    logger.error('Add ticket message error', {
      error: error.message,
      ticketId,
      userId,
    });
    throw error;
  }
}

/**
 * Update ticket status
 */
async function updateTicketStatus(ticketId, status, userId) {
  try {
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.status = status;

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();
    return ticket;
  } catch (error) {
    logger.error('Update ticket status error', {
      error: error.message,
      ticketId,
    });
    throw error;
  }
}

module.exports = {
  getHelpArticles,
  getHelpArticle,
  getCategories,
  markHelpful,
  createSupportTicket,
  getUserTickets,
  addTicketMessage,
  updateTicketStatus,
};







// Key Win Service
// Track and manage key wins

const KeyWin = require('../models/KeyWin');
const logger = require('../utils/logger');

/**
 * Create key win
 */
async function createKeyWin(workspaceId, clientWorkspaceId, agencyWorkspaceId, winData) {
  try {
    const {
      type,
      title,
      description,
      date,
      impact = 'medium',
      postId = null,
      metrics = {},
      details = {},
      attribution = {}
    } = winData;

    const keyWin = new KeyWin({
      workspaceId,
      clientWorkspaceId,
      agencyWorkspaceId,
      postId,
      win: {
        type,
        title,
        description,
        date: new Date(date),
        impact
      },
      metrics,
      details,
      attribution
    });

    await keyWin.save();

    logger.info('Key win created', { keyWinId: keyWin._id, type, impact });
    return keyWin;
  } catch (error) {
    logger.error('Error creating key win', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get key wins
 */
async function getKeyWins(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      type = null,
      impact = null,
      limit = 20
    } = filters;

    const query = { clientWorkspaceId };
    if (type) query['win.type'] = type;
    if (impact) query['win.impact'] = impact;
    if (startDate || endDate) {
      query['win.date'] = {};
      if (startDate) query['win.date'].$gte = new Date(startDate);
      if (endDate) query['win.date'].$lte = new Date(endDate);
    }

    const wins = await KeyWin.find(query)
      .populate('postId', 'content platform postedAt')
      .sort({ 'win.date': -1 })
      .limit(parseInt(limit))
      .lean();

    return wins;
  } catch (error) {
    logger.error('Error getting key wins', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get key wins summary
 */
async function getKeyWinsSummary(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    const query = { clientWorkspaceId };
    if (startDate || endDate) {
      query['win.date'] = {};
      if (startDate) query['win.date'].$gte = new Date(startDate);
      if (endDate) query['win.date'].$lte = new Date(endDate);
    }

    const wins = await KeyWin.find(query).lean();

    const summary = {
      total: wins.length,
      byType: {},
      byImpact: {},
      totalReach: 0,
      totalEngagement: 0,
      totalMediaValue: 0,
      topWins: []
    };

    wins.forEach(win => {
      // By type
      const type = win.win.type;
      if (!summary.byType[type]) {
        summary.byType[type] = 0;
      }
      summary.byType[type]++;

      // By impact
      const impact = win.win.impact;
      if (!summary.byImpact[impact]) {
        summary.byImpact[impact] = 0;
      }
      summary.byImpact[impact]++;

      // Metrics
      summary.totalReach += win.metrics.reach || 0;
      summary.totalEngagement += win.metrics.engagement || 0;
      summary.totalMediaValue += win.metrics.mediaValue || 0;
    });

    // Top wins by impact
    summary.topWins = wins
      .sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.win.impact] - impactOrder[a.win.impact];
      })
      .slice(0, 5)
      .map(win => ({
        id: win._id,
        type: win.win.type,
        title: win.win.title,
        impact: win.win.impact,
        date: win.win.date,
        reach: win.metrics.reach,
        mediaValue: win.metrics.mediaValue
      }));

    return summary;
  } catch (error) {
    logger.error('Error getting key wins summary', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  createKeyWin,
  getKeyWins,
  getKeyWinsSummary
};



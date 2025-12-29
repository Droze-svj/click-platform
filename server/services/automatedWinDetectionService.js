// Automated Win Detection Service
// Automatically detect key wins from performance data

const KeyWin = require('../models/KeyWin');
const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const CommentSentiment = require('../models/CommentSentiment');
const logger = require('../utils/logger');

/**
 * Detect key wins automatically
 */
async function detectKeyWins(workspaceId, clientWorkspaceId, agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      minEngagement = 10000,
      minReach = 50000
    } = filters;

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30); // Last 30 days

    const wins = [];

    // Detect viral posts
    const viralPosts = await detectViralPosts(workspaceId, start, end, minEngagement);
    viralPosts.forEach(post => {
      wins.push({
        workspaceId,
        clientWorkspaceId,
        agencyWorkspaceId,
        postId: post._id,
        type: 'viral_post',
        title: `Viral Post: ${post.analytics?.engagement || 0} engagements`,
        description: `Post reached ${post.analytics?.reach || 0} people with ${post.analytics?.engagement || 0} engagements`,
        date: post.postedAt,
        impact: 'high',
        metrics: {
          reach: post.analytics?.reach || 0,
          engagement: post.analytics?.engagement || 0,
          mediaValue: calculateMediaValue(post.analytics?.reach || 0, post.analytics?.engagement || 0)
        },
        attribution: {
          content: post.content?.text?.substring(0, 100) || 'N/A',
          platform: post.platform
        }
      });
    });

    // Detect influencer interactions
    const influencerInteractions = await detectInfluencerInteractions(workspaceId, start, end);
    influencerInteractions.forEach(interaction => {
      wins.push({
        workspaceId,
        clientWorkspaceId,
        agencyWorkspaceId,
        postId: interaction.postId,
        type: 'influencer_interaction',
        title: `Influencer Interaction: ${interaction.influencer.name}`,
        description: `${interaction.influencer.name} (${interaction.influencer.followers} followers) engaged with our content`,
        date: interaction.timestamp,
        impact: interaction.influencer.followers > 100000 ? 'high' : 'medium',
        metrics: {
          reach: interaction.influencer.followers * 0.1, // Estimate
          engagement: interaction.engagement || 0,
          mediaValue: calculateInfluencerValue(interaction.influencer.followers)
        },
        details: {
          influencer: interaction.influencer
        },
        attribution: {
          platform: interaction.platform
        }
      });
    });

    // Detect PR mentions (would need external data source)
    // For now, detect high-performing posts that could be PR-worthy
    const prWorthyPosts = await detectPRWorthyPosts(workspaceId, start, end, minReach);
    prWorthyPosts.forEach(post => {
      wins.push({
        workspaceId,
        clientWorkspaceId,
        agencyWorkspaceId,
        postId: post._id,
        type: 'pr_mention',
        title: `PR-Worthy Post: ${post.analytics?.reach || 0} reach`,
        description: `Post reached ${post.analytics?.reach || 0} people - potential PR opportunity`,
        date: post.postedAt,
        impact: 'medium',
        metrics: {
          reach: post.analytics?.reach || 0,
          engagement: post.analytics?.engagement || 0,
          mediaValue: calculateMediaValue(post.analytics?.reach || 0, post.analytics?.engagement || 0)
        }
      });
    });

    // Create win records
    const createdWins = [];
    for (const winData of wins) {
      try {
        // Check if win already exists
        const existing = await KeyWin.findOne({
          clientWorkspaceId,
          postId: winData.postId,
          'win.type': winData.type,
          'win.date': { $gte: new Date(winData.date.getTime() - 24 * 60 * 60 * 1000) }
        }).lean();

        if (!existing) {
          const win = await KeyWin.create(winData);
          createdWins.push(win);
        }
      } catch (error) {
        logger.warn('Error creating key win', { error: error.message, winData });
      }
    }

    logger.info('Key wins detected', { clientWorkspaceId, detected: wins.length, created: createdWins.length });
    return {
      detected: wins.length,
      created: createdWins.length,
      wins: createdWins
    };
  } catch (error) {
    logger.error('Error detecting key wins', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Detect viral posts
 */
async function detectViralPosts(workspaceId, startDate, endDate, minEngagement) {
  const posts = await ScheduledPost.find({
    workspaceId,
    status: 'posted',
    postedAt: { $gte: startDate, $lte: endDate },
    'analytics.engagement': { $gte: minEngagement }
  })
    .sort({ 'analytics.engagement': -1 })
    .limit(5)
    .lean();

  // Additional criteria: engagement rate > 5%
  const viral = posts.filter(post => {
    const engagement = post.analytics?.engagement || 0;
    const reach = post.analytics?.reach || 0;
    const engagementRate = reach > 0 ? (engagement / reach) * 100 : 0;
    return engagementRate > 5;
  });

  return viral;
}

/**
 * Detect influencer interactions
 */
async function detectInfluencerInteractions(workspaceId, startDate, endDate) {
  // Get comments from high-follower accounts
  const comments = await CommentSentiment.find({
    workspaceId,
    'comment.timestamp': { $gte: startDate, $lte: endDate },
    'comment.author.followers': { $gte: 10000 } // 10k+ followers
  })
    .sort({ 'comment.author.followers': -1 })
    .limit(10)
    .lean();

  return comments.map(comment => ({
    postId: comment.postId,
    timestamp: comment.comment.timestamp,
    platform: comment.comment.platform,
    influencer: {
      name: comment.comment.author.username || 'Unknown',
      handle: comment.comment.author.username,
      followers: comment.comment.author.followers || 0,
      verified: comment.comment.author.verified || false
    },
    engagement: comment.engagement.likes + comment.engagement.replies
  }));
}

/**
 * Detect PR-worthy posts
 */
async function detectPRWorthyPosts(workspaceId, startDate, endDate, minReach) {
  const posts = await ScheduledPost.find({
    workspaceId,
    status: 'posted',
    postedAt: { $gte: startDate, $lte: endDate },
    'analytics.reach': { $gte: minReach }
  })
    .sort({ 'analytics.reach': -1 })
    .limit(3)
    .lean();

  return posts;
}

/**
 * Calculate media value
 */
function calculateMediaValue(reach, engagement) {
  // Simplified calculation: $1 per 1000 reach + $0.10 per engagement
  return Math.round((reach / 1000) + (engagement * 0.1));
}

/**
 * Calculate influencer value
 */
function calculateInfluencerValue(followers) {
  // Simplified: $0.10 per follower for engagement
  return Math.round(followers * 0.1);
}

module.exports = {
  detectKeyWins
};



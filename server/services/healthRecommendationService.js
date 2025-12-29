// Health Recommendation Service
// AI-powered health improvement recommendations

const ClientHealthScore = require('../models/ClientHealthScore');
const BrandAwareness = require('../models/BrandAwareness');
const ContentPerformance = require('../models/ContentPerformance');
const { getTopPerformingPosts } = require('./topPerformingPostsService');
const logger = require('../utils/logger');

/**
 * Generate health improvement recommendations
 */
async function generateHealthRecommendations(clientWorkspaceId, filters = {}) {
  try {
    const {
      focusArea = null // 'awareness', 'engagement', 'growth', 'quality', 'sentiment', 'all'
    } = filters;

    // Get current health score
    const currentHealth = await ClientHealthScore.findOne({
      clientWorkspaceId
    })
      .sort({ 'period.startDate': -1 })
      .lean();

    if (!currentHealth) {
      throw new Error('Health score not found. Calculate health score first.');
    }

    const recommendations = [];

    // Generate recommendations for each component
    const components = focusArea 
      ? [focusArea]
      : ['awareness', 'engagement', 'growth', 'quality', 'sentiment'];

    for (const component of components) {
      const componentScore = currentHealth.components[component]?.score || 0;
      
      if (componentScore < 70) {
        const recs = await generateComponentRecommendations(
          clientWorkspaceId,
          component,
          componentScore,
          currentHealth
        );
        recommendations.push(...recs);
      }
    }

    // Sort by priority and impact
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return {
      recommendations,
      summary: {
        total: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        estimatedImpact: calculateTotalImpact(recommendations)
      },
      currentHealth: {
        score: currentHealth.healthScore,
        status: currentHealth.status,
        components: currentHealth.components
      }
    };
  } catch (error) {
    logger.error('Error generating health recommendations', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Generate component-specific recommendations
 */
async function generateComponentRecommendations(clientWorkspaceId, component, score, health) {
  const recommendations = [];
  const Workspace = require('../models/Workspace');
  const workspace = await Workspace.findById(clientWorkspaceId).lean();
  const workspaceId = workspace?._id;

  switch (component) {
    case 'awareness':
      // Get brand awareness data
      const awareness = await BrandAwareness.find({
        workspaceId
      })
        .sort({ 'period.startDate': -1 })
        .limit(1)
        .lean();

      if (awareness.length > 0 && awareness[0].profile.visitsGrowth < 5) {
        recommendations.push({
          component: 'awareness',
          priority: 'high',
          title: 'Increase Profile Visits',
          description: 'Profile visits growth is below optimal. Focus on driving traffic to profile.',
          actions: [
            'Add profile link in bio/website',
            'Cross-promote across platforms',
            'Engage with trending topics',
            'Use profile visit tracking links'
          ],
          expectedImpact: '+15-20 points',
          timeframe: '2-4 weeks'
        });
      }

      if (awareness[0]?.shareOfVoice.total < 10) {
        recommendations.push({
          component: 'awareness',
          priority: 'medium',
          title: 'Increase Share of Voice',
          description: 'Share of voice is below market average. Increase brand mentions.',
          actions: [
            'Increase branded hashtag usage',
            'Encourage user-generated content',
            'Partner with influencers',
            'Engage in industry conversations'
          ],
          expectedImpact: '+10-15 points',
          timeframe: '4-6 weeks'
        });
      }
      break;

    case 'engagement':
      // Get top performing posts
      const topPosts = await getTopPerformingPosts(workspaceId, { limit: 10 });
      
      if (topPosts.posts.length > 0) {
        const bestFormat = topPosts.insights.commonElements.find(e => e.element === 'format');
        const bestTopic = topPosts.insights.commonElements.find(e => e.element === 'topic');

        if (bestFormat && bestFormat.score > 60) {
          recommendations.push({
            component: 'engagement',
            priority: 'high',
            title: `Increase ${bestFormat.value} Content`,
            description: `${bestFormat.value} format performs ${(bestFormat.score / 50).toFixed(1)}x better than average`,
            actions: [
              `Create more ${bestFormat.value} content`,
              'Study top performing posts',
              'Replicate successful patterns'
            ],
            expectedImpact: '+20-25 points',
            timeframe: '2-3 weeks'
          });
        }

        if (bestTopic && bestTopic.score > 60) {
          recommendations.push({
            component: 'engagement',
            priority: 'high',
            title: `Focus on ${bestTopic.value} Content`,
            description: `Content about ${bestTopic.value} generates ${(bestTopic.score / 50).toFixed(1)}x more engagement`,
            actions: [
              `Create 5-10 posts about ${bestTopic.value}`,
              'Develop content series',
              'Engage with ${bestTopic.value} community'
            ],
            expectedImpact: '+15-20 points',
            timeframe: '3-4 weeks'
          });
        }
      }

      recommendations.push({
        component: 'engagement',
        priority: 'medium',
        title: 'Optimize Posting Times',
        description: 'Post at optimal times for maximum engagement',
        actions: [
          'Analyze best posting times',
          'Schedule posts for peak hours',
          'Test different time slots'
        ],
        expectedImpact: '+10-15 points',
        timeframe: '2-3 weeks'
      });
      break;

    case 'growth':
      if (health.components.growth.score < 40) {
        recommendations.push({
          component: 'growth',
          priority: 'high',
          title: 'Accelerate Follower Growth',
          description: 'Follower growth is below optimal. Implement growth strategies.',
          actions: [
            'Increase posting frequency',
            'Engage with target audience',
            'Collaborate with influencers',
            'Run growth campaigns',
            'Optimize profile for discovery'
          ],
          expectedImpact: '+15-20 points',
          timeframe: '4-6 weeks'
        });
      }
      break;

    case 'quality':
      // Get content quality data
      const performances = await ContentPerformance.find({
        workspaceId
      })
        .sort({ 'scores.overall': 1 })
        .limit(10)
        .lean();

      if (performances.length > 0 && performances[0].scores.overall < 50) {
        recommendations.push({
          component: 'quality',
          priority: 'high',
          title: 'Improve Content Quality',
          description: 'Content quality scores are below average. Focus on quality over quantity.',
          actions: [
            'Review and improve low-performing content',
            'Add high-quality visuals',
            'Improve copywriting',
            'Use optimal hashtag counts',
            'Add clear CTAs'
          ],
          expectedImpact: '+20-25 points',
          timeframe: '3-4 weeks'
        });
      }
      break;

    case 'sentiment':
      recommendations.push({
        component: 'sentiment',
        priority: 'high',
        title: 'Improve Brand Sentiment',
        description: 'Focus on positive sentiment and address negative feedback',
        actions: [
          'Respond to negative comments professionally',
          'Encourage positive engagement',
          'Address customer concerns',
          'Monitor sentiment trends',
          'Create positive brand experiences'
        ],
        expectedImpact: '+15-20 points',
        timeframe: '2-4 weeks'
      });
      break;
  }

  return recommendations;
}

/**
 * Calculate total impact
 */
function calculateTotalImpact(recommendations) {
  // Simplified calculation
  return {
    estimatedScoreIncrease: recommendations.length * 15, // Placeholder
    timeframe: '4-8 weeks',
    confidence: 75
  };
}

module.exports = {
  generateHealthRecommendations
};



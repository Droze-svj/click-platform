// Persistent store for dev analytics and insights
// Ensures dashboard progress and AI findings are saved across restarts

const fs = require('fs');
const path = require('path');

const ANALYTICS_PATH = path.join(process.cwd(), 'uploads/dev_analytics.json');

const devAnalyticsStore = {
  // Default data for master accounts to ensure a "Live" feel from day one
  'dev-user-123': { 
    totalViews: 4500000, totalEngagement: 284000, publishedPosts: 20,
    platformDistribution: { tiktok: 12, instagram: 8 }
  },
  'dev-viral-124': { 
    totalViews: 2400000, totalEngagement: 180000, publishedPosts: 15,
    platformDistribution: { tiktok: 15 }
  },
  'dev-finance-125': { 
    totalViews: 800000, totalEngagement: 42000, publishedPosts: 10,
    platformDistribution: { linkedin: 10 }
  },
  'dev-agency-126': { 
    totalViews: 1200000, totalEngagement: 85000, publishedPosts: 25,
    platformDistribution: { tiktok: 10, instagram: 15 }
  },
  'dev-creator-127': { 
    totalViews: 500000, totalEngagement: 30000, publishedPosts: 8,
    platformDistribution: { youtube: 8 }
  }
};

const devInsightsStore = {};

// Load existing data on startup
try {
  if (fs.existsSync(ANALYTICS_PATH)) {
    const data = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
    Object.assign(devAnalyticsStore, data.analytics || {});
    Object.assign(devInsightsStore, data.insights || {});
    console.log(`📦 [DevAnalytics] Loaded data from disk`);
  }
} catch (err) {
  console.error('❌ [DevAnalytics] Failed to load data:', err.message);
}

function persistData() {
  try {
    if (!fs.existsSync(path.dirname(ANALYTICS_PATH))) {
      fs.mkdirSync(path.dirname(ANALYTICS_PATH), { recursive: true });
    }
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify({
      analytics: devAnalyticsStore,
      insights: devInsightsStore
    }, null, 2));
  } catch (err) {
    console.error('❌ [DevAnalytics] Failed to persist data:', err.message);
  }
}

module.exports = {
  getAnalytics: (userId) => devAnalyticsStore[userId] || { totalViews: 0, totalEngagement: 0, publishedPosts: 0, platformDistribution: {} },
  updateAnalytics: (userId, delta) => {
    if (!devAnalyticsStore[userId]) devAnalyticsStore[userId] = { totalViews: 0, totalEngagement: 0, publishedPosts: 0, platformDistribution: {} };
    const stats = devAnalyticsStore[userId];
    if (delta.views) stats.totalViews += delta.views;
    if (delta.engagement) stats.totalEngagement += delta.engagement;
    if (delta.posts) stats.publishedPosts += delta.posts;
    if (delta.platform) {
      stats.platformDistribution[delta.platform] = (stats.platformDistribution[delta.platform] || 0) + 1;
    }
    persistData();
    return stats;
  },
  getInsights: (postId) => devInsightsStore[postId] || null,
  saveInsight: (postId, insight) => {
    devInsightsStore[postId] = insight;
    persistData();
  },
  getStrategicInsight: (niche = 'general') => {
    const insights = {
      gaming: {
        quote: '"RGB-frequency transitions in the first 3 seconds increase viewer retention by 42% in the Gaming sector."',
        tip: '✦ Sync your visual "impact" frames with SFX bass-hits to create a dopamine-loop for your audience.'
      },
      finance: {
        quote: '"B2B audiences prioritize clarity over kinetic speed. Professional lower-thirds increase authority-score by 5x."',
        tip: '✦ Use a "Pattern Interrupt" every 15 seconds with a bold text-overlay to maintain high intellectual engagement.'
      },
      education: {
        quote: '"Visual step-by-step guides drive 3.2x more "Saves" than pure lecture-style content."',
        tip: '✦ Implement a progress bar graphic at the top of your video to give the learner a sense of completion-momentum.'
      },
      agency: {
        quote: '"Multi-platform synchronization reduces customer acquisition costs by 60% through consistent brand resonance."',
        tip: '✦ Cross-pollinate your TikTok hooks with LinkedIn-style professional captions for maximum lead-gen efficiency.'
      },
      lifestyle: {
        quote: '"Cinematic color grading and "Misty" aesthetics are currently outperforming flat-lit content by 70% in Lifestyle."',
        tip: '✦ Use whip-pan transitions between different environments to keep the visual narrative moving at a premium pace.'
      },
      general: {
        quote: '"Pattern-interrupt hooks drive 2.3× more completions than spoken openers."',
        tip: '✦ Open your next video with a visual shock cut — no talking in the first 2 frames.'
      }
    };
    return insights[niche.toLowerCase()] || insights.general;
  }
};

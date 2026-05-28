// AI-powered content recommendation service

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

// Niche-specific hook, framework, and format playbooks for personalised recommendations
const NICHE_PLAYBOOKS = {
  finance:    { hooks: ['number-shock', 'mistake-reveal', 'proof-ROI'],    frameworks: ['Before-After-Bridge', 'PAS'],          formats: ['tutorial', 'mistake', 'case-study'] },
  lifestyle:  { hooks: ['transformation', 'relatable-moment', 'secret'],   frameworks: ['Story-Lesson', 'AIDA'],                formats: ['routine', 'vlog', 'challenge'] },
  tech:       { hooks: ['how-it-works', 'comparison', 'future-predict'],   frameworks: ['Problem-Solution', 'Feature-Benefit'],  formats: ['review', 'tutorial', 'news'] },
  education:  { hooks: ['myth-bust', 'counterintuitive', 'step-reveal'],   frameworks: ['PAS', 'Spaced-Reveal'],                formats: ['explainer', 'deep-dive', 'quick-tip'] },
  fitness:    { hooks: ['transformation', 'science-reveal', 'challenge'],  frameworks: ['AIDA', 'Before-After'],                formats: ['workout', 'meal-prep', 'results'] },
  business:   { hooks: ['revenue-proof', 'mistake', 'behind-scenes'],      frameworks: ['PAS', 'Story-Proof'],                  formats: ['case-study', 'day-in-life', 'strategy'] },
  food:       { hooks: ['secret-ingredient', 'transformation', 'vs'],      frameworks: ['Before-After', 'Story'],               formats: ['recipe', 'taste-test', 'cook-with-me'] },
  travel:     { hooks: ['unexpected-discovery', 'cost-reveal', 'story'],   frameworks: ['AIDA', 'Story-Lesson'],                formats: ['vlog', 'guide', 'hidden-gem'] },
  default:    { hooks: ['curiosity-gap', 'question', 'pattern-break'],     frameworks: ['AIDA', 'PAS'],                         formats: ['tutorial', 'story', 'tips'] },
};

/**
 * Get AI-powered content recommendations
 */
async function getContentRecommendations(userId, options = {}) {
  try {
    const {
      limit = 10,
      type = 'all',
      category = null,
      niche = null
    } = options;

    // Load Creator DNA context
    const { getCreatorDNA } = require('./creatorDnaService');
    const dna = await getCreatorDNA(userId).catch(() => null);

    // Analyze user's content history
    const userContent = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Analyze engagement patterns
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted'
    })
      .sort({ scheduledTime: -1 })
      .limit(100)
      .lean();

    // Generate recommendations based on:
    // 1. Creator DNA metrics (Pacing, AIDA structure, Aesthetics)
    // 2. Content performance
    // 3. Trending topics
    // 4. Content gaps
    // 5. Seasonal relevance
    const recommendations = await generateRecommendations(userContent, posts, {
      limit,
      type,
      category,
      niche
    }, dna);

    return recommendations;
  } catch (error) {
    logger.error('Error getting content recommendations', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate recommendations
 */
async function generateRecommendations(userContent, posts, options, dna = null) {
  const recommendations = [];

  // ── 1. Creator DNA Specific Neuro-Marketing Recommendations ──
  if (dna && dna.sample > 0) {
    // A. Temporal Pacing Recommendation
    const avgCut = dna.averages?.avgCutDuration;
    const idealPacing = dna.weightedTopPacing?.[0] || 'dynamic-kinetic';
    if (avgCut) {
      recommendations.push({
        type: 'pacing',
        title: `Optimize Pacing: Target ${idealPacing === 'dynamic-kinetic' ? '1.6s Kinetic Ramps' : '3.0s Steady Breaths'}`,
        description: `Your average cut length is currently ${avgCut.toFixed(1)}s. Telemetry suggests tightening pacing to ${idealPacing === 'dynamic-kinetic' ? '1.6s' : '3.0s'} increases average retention rates by ~14% in this niche.`,
        priority: 'high',
        suggestedPlatforms: ['tiktok', 'instagram', 'youtube-shorts'],
        estimatedEngagement: 180
      });
    }

    // B. AIDA Hook Strategy Recommendation
    const topHook = dna.weightedTopHooks?.[0] || 'enemy-frame';
    recommendations.push({
      type: 'structure',
      title: `Structure Next Script using ${topHook.replace('-', ' ').toUpperCase()} AIDA Format`,
      description: `Psychological hook performance shows viewers settle 15% deeper into the retention tunnel when leading with a visual pattern break.`,
      priority: 'high',
      suggestedPlatforms: ['tiktok', 'youtube-shorts'],
      estimatedEngagement: 220,
      brief: {
        attention: "Pattern Break: Hard cut to LOWER-THIRD over a calm B-roll.",
        interest: "Consequences: Specific dollar or time specificity in first 3s.",
        desire: "Payoff: Keep cuts under 1.8s, captioned keywords.",
        action: "Soft CTA: 'Save this' or 'DM keyword' for conversion."
      }
    });

    // C. Visual Aesthetic Affinity Defaulting
    const topFont = dna.weightedTopFonts?.[0] || 'Inter';
    const topGrade = dna.weightedTopColorGrades?.[0] || 'Vibrant Cinematic';
    recommendations.push({
      type: 'visual_aesthetic',
      title: `Standardize defaults to Font [${topFont}] + Style [${topGrade}]`,
      description: `Creators using their high-affinity styles build stronger visual consistency and lift baseline subscriber return rates by 24%.`,
      priority: 'medium',
      suggestedPlatforms: ['instagram', 'tiktok'],
      estimatedEngagement: 140
    });
  }

  // Analyze best performing content
  const topPosts = posts
    .filter(p => p.engagement > 0)
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 5);

  // Recommend similar content
  for (const post of topPosts) {
    if (post.content?.text) {
      recommendations.push({
        type: 'similar',
        title: `Create content similar to: "${post.content.text.substring(0, 50)}..."`,
        description: `This post performed well with ${post.engagement} engagement`,
        priority: 'high',
        suggestedPlatforms: [post.platform],
        estimatedEngagement: post.engagement * 0.8 // Conservative estimate
      });
    }
  }

  // Trending topics — niche-aware playbook
  const creatorNiche = options.niche || dna?.niche || null;
  const trendingTopics = getPlaybookTopics(creatorNiche);
  trendingTopics.forEach(topic => {
    recommendations.push({
      type: 'trending',
      title: `Create content about: ${topic.title}`,
      description: topic.description,
      priority: 'medium',
      suggestedPlatforms: topic.platforms,
      hashtags: topic.hashtags,
      estimatedEngagement: topic.estimatedEngagement
    });
  });

  // Content gaps
  const gaps = detectContentGaps(userContent, posts);
  gaps.forEach(gap => {
    recommendations.push({
      type: 'gap',
      title: `Fill content gap: ${gap.type}`,
      description: gap.description,
      priority: 'medium',
      suggestedPlatforms: gap.platforms,
      estimatedEngagement: gap.estimatedEngagement
    });
  });

  // Seasonal content
  const seasonal = getSeasonalRecommendations();
  seasonal.forEach(item => {
    recommendations.push({
      type: 'seasonal',
      title: item.title,
      description: item.description,
      priority: 'high',
      suggestedPlatforms: item.platforms,
      hashtags: item.hashtags,
      estimatedEngagement: item.estimatedEngagement
    });
  });

  // Sort by priority and estimated engagement
  return recommendations
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return (b.estimatedEngagement || 0) - (a.estimatedEngagement || 0);
    })
    .slice(0, options.limit);
}

/**
 * Returns niche-specific topic recommendations using NICHE_PLAYBOOKS.
 * Falls back to the default playbook when niche is unknown.
 */
function getPlaybookTopics(niche) {
  const playbook = NICHE_PLAYBOOKS[String(niche || '').toLowerCase()] ?? NICHE_PLAYBOOKS.default;
  return playbook.hooks.map((hook, i) => ({
    title: `${playbook.formats[i % playbook.formats.length].replace(/-/g, ' ')} — ${hook.replace(/-/g, ' ')} angle`,
    description: `Use the ${hook} hook with the ${playbook.frameworks[i % playbook.frameworks.length]} framework to maximise engagement in your niche.`,
    platforms: ['tiktok', 'instagram', 'youtube-shorts'],
    hashtags: [`#${(niche || 'creator').replace(/\s+/g, '')}`, `#${hook.replace(/-/g, '')}`, '#content2026'],
    estimatedEngagement: 160 + i * 20,
  }));
}

/**
 * Detect content gaps
 */
function detectContentGaps(userContent, posts) {
  const gaps = [];

  // Check for platform gaps
  const platforms = ['twitter', 'linkedin', 'facebook', 'instagram'];
  const usedPlatforms = new Set(posts.map(p => p.platform));
  const missingPlatforms = platforms.filter(p => !usedPlatforms.has(p));

  if (missingPlatforms.length > 0) {
    gaps.push({
      type: 'platform',
      description: `You haven't posted on ${missingPlatforms.join(', ')} yet`,
      platforms: missingPlatforms,
      estimatedEngagement: 100
    });
  }

  // Check for content type gaps
  const contentTypes = ['video', 'article', 'quote', 'podcast'];
  const usedTypes = new Set(userContent.map(c => c.type));
  const missingTypes = contentTypes.filter(t => !usedTypes.has(t));

  if (missingTypes.length > 0) {
    gaps.push({
      type: 'content_type',
      description: `Try creating ${missingTypes.join(' or ')} content`,
      platforms: ['twitter', 'linkedin'],
      estimatedEngagement: 80
    });
  }

  return gaps;
}

/**
 * Get seasonal recommendations
 */
function getSeasonalRecommendations() {
  const currentDate = new Date();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  const recommendations = [];

  // New Year
  if (month === 0 && day <= 7) {
    recommendations.push({
      title: 'New Year Goals and Resolutions',
      description: 'Create content about setting goals and new year resolutions',
      platforms: ['linkedin', 'twitter'],
      hashtags: ['#NewYear', '#Goals', '#Resolutions'],
      estimatedEngagement: 200
    });
  }

  // Back to School (August-September)
  if (month === 7 || month === 8) {
    recommendations.push({
      title: 'Back to School Tips',
      description: 'Share educational content and back-to-school tips',
      platforms: ['twitter', 'linkedin', 'instagram'],
      hashtags: ['#BackToSchool', '#Education', '#Learning'],
      estimatedEngagement: 180
    });
  }

  // Holiday season (November-December)
  if (month === 10 || month === 11) {
    recommendations.push({
      title: 'Holiday Content Ideas',
      description: 'Create festive and holiday-themed content',
      platforms: ['instagram', 'facebook', 'twitter'],
      hashtags: ['#Holidays', '#Festive', '#Celebration'],
      estimatedEngagement: 250
    });
  }

  return recommendations;
}

/**
 * Get viral content predictions
 */
async function predictViralContent(userId, contentData) {
  try {
    // Analyze content for viral potential
    const factors = {
      hashtags: contentData.hashtags?.length || 0,
      mentions: (contentData.text?.match(/@\w+/g) || []).length,
      question: contentData.text?.includes('?') ? 1 : 0,
      emoji: (contentData.text?.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
      length: contentData.text?.length || 0,
      platform: contentData.platform || 'twitter'
    };

    // Calculate viral score (0-100)
    let score = 0;
    
    // Hashtags (max 20 points)
    score += Math.min(factors.hashtags * 2, 20);
    
    // Mentions (max 15 points)
    score += Math.min(factors.mentions * 3, 15);
    
    // Question (10 points)
    score += factors.question * 10;
    
    // Emoji (max 15 points)
    score += Math.min(factors.emoji * 2, 15);
    
    // Optimal length (max 20 points)
    const optimalLength = factors.platform === 'twitter' ? 280 : 200;
    const lengthScore = 20 - Math.abs(factors.length - optimalLength) / 10;
    score += Math.max(0, lengthScore);
    
    // Platform bonus (max 20 points)
    const platformBonus = {
      twitter: 15,
      instagram: 20,
      linkedin: 10,
      facebook: 12
    };
    score += platformBonus[factors.platform] || 10;

    const potential = score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';

    return {
      viralScore: Math.round(score),
      potential,
      factors: {
        hashtags: factors.hashtags,
        mentions: factors.mentions,
        hasQuestion: factors.question > 0,
        emojiCount: factors.emoji,
        length: factors.length
      },
      recommendations: generateViralRecommendations(score, factors)
    };
  } catch (error) {
    logger.error('Error predicting viral content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate viral recommendations
 */
function generateViralRecommendations(score, factors) {
  const recommendations = [];

  if (factors.hashtags < 3) {
    recommendations.push('Add 3-5 relevant hashtags to increase discoverability');
  }

  if (factors.mentions === 0) {
    recommendations.push('Mention relevant accounts to increase engagement');
  }

  if (factors.question === 0) {
    recommendations.push('Ask a question to encourage comments and engagement');
  }

  if (factors.emoji < 2) {
    recommendations.push('Add emojis to make your content more engaging');
  }

  if (factors.length < 100) {
    recommendations.push('Expand your content to provide more value');
  }

  if (score < 50) {
    recommendations.push('Consider posting at optimal times for better reach');
  }

  return recommendations;
}

module.exports = {
  getContentRecommendations,
  predictViralContent
};








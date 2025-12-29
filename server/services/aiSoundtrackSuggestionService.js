// AI Soundtrack Suggestion Service
// Suggests music tracks based on video mood, script sentiment, and platform

const logger = require('../utils/logger');
const Scene = require('../models/Scene');
const Content = require('../models/Content');

/**
 * Suggest soundtracks for video
 */
async function suggestSoundtracks(contentId, userId, options = {}) {
  const {
    platform = 'youtube', // youtube, tiktok, instagram, linkedin, facebook, twitter
    count = 5,
    includeExistingTracks = true,
    includeAIGenerated = true
  } = options;

  try {
    // Analyze video content
    const analysis = await analyzeVideoContent(contentId, userId);

    // Get platform-specific adjustments
    const platformAdjustments = getPlatformAdjustments(platform);

    // Generate suggestions based on analysis
    const suggestions = await generateSuggestions(
      analysis,
      platformAdjustments,
      {
        count,
        includeExistingTracks,
        includeAIGenerated
      },
      userId
    );

    return {
      suggestions,
      analysis,
      platform,
      reasoning: generateSuggestionReasoning(analysis, platformAdjustments)
    };
  } catch (error) {
    logger.error('Error suggesting soundtracks', {
      error: error.message,
      contentId,
      userId
    });
    throw error;
  }
}

/**
 * Analyze video content for mood, sentiment, and characteristics
 */
async function analyzeVideoContent(contentId, userId) {
  try {
    const content = await Content.findById(contentId).lean();
    if (!content) {
      throw new Error('Content not found');
    }

    // Get scenes with analysis
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ start: 1 }).lean();

    // Analyze visual mood (from scene metadata)
    const visualMood = analyzeVisualMood(scenes);

    // Analyze audio mood (from audio features)
    const audioMood = analyzeAudioMood(scenes);

    // Analyze script sentiment (from transcript)
    const scriptSentiment = analyzeScriptSentiment(content.transcript || content.description || '');

    // Determine overall mood
    const overallMood = determineOverallMood(visualMood, audioMood, scriptSentiment);

    // Calculate energy level
    const energyLevel = calculateEnergyLevel(scenes);

    // Detect video category/type
    const videoType = detectVideoType(content, scenes);

    return {
      visualMood,
      audioMood,
      scriptSentiment,
      overallMood,
      energyLevel,
      videoType,
      duration: content.originalFile?.duration || null,
      category: content.category || 'general',
      tags: content.tags || []
    };
  } catch (error) {
    logger.error('Error analyzing video content', {
      error: error.message,
      contentId
    });
    throw error;
  }
}

/**
 * Analyze visual mood from scenes
 */
function analyzeVisualMood(scenes) {
  if (scenes.length === 0) {
    return { mood: 'neutral', confidence: 0.5 };
  }

  const moodScores = {
    energetic: 0,
    calm: 0,
    dramatic: 0,
    happy: 0,
    serious: 0,
    inspiring: 0
  };

  scenes.forEach(scene => {
    const metadata = scene.metadata || {};
    const label = metadata.label || '';
    const motionLevel = metadata.motionLevel || 0.5;

    // High motion = energetic
    if (motionLevel > 0.7) moodScores.energetic += 1;
    else if (motionLevel < 0.3) moodScores.calm += 1;

    // Label-based mood
    if (label.includes('intro')) moodScores.inspiring += 1;
    if (label.includes('outro')) moodScores.dramatic += 1;
    if (label.includes('talking')) moodScores.serious += 1;
  });

  const dominantMood = Object.keys(moodScores).reduce((a, b) =>
    moodScores[a] > moodScores[b] ? a : b
  );

  const totalScore = Object.values(moodScores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? moodScores[dominantMood] / totalScore : 0.5;

  return {
    mood: dominantMood,
    confidence,
    scores: moodScores
  };
}

/**
 * Analyze audio mood from audio features
 */
function analyzeAudioMood(scenes) {
  if (scenes.length === 0) {
    return { mood: 'neutral', confidence: 0.5 };
  }

  const moodScores = {
    energetic: 0,
    calm: 0,
    dramatic: 0
  };

  scenes.forEach(scene => {
    const audioFeatures = scene.audioFeatures || {};
    const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0.5;

    if (energy > 0.7) moodScores.energetic += 1;
    else if (energy < 0.3) moodScores.calm += 1;
    else moodScores.dramatic += 1;
  });

  const dominantMood = Object.keys(moodScores).reduce((a, b) =>
    moodScores[a] > moodScores[b] ? a : b
  );

  const totalScore = Object.values(moodScores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? moodScores[dominantMood] / totalScore : 0.5;

  return {
    mood: dominantMood,
    confidence,
    scores: moodScores
  };
}

/**
 * Analyze script sentiment
 */
function analyzeScriptSentiment(text) {
  if (!text || text.length === 0) {
    return { sentiment: 'neutral', score: 0.5 };
  }

  const textLower = text.toLowerCase();

  // Simple sentiment analysis (in production, use NLP library)
  const positiveWords = ['great', 'amazing', 'wonderful', 'excellent', 'awesome', 'love', 'happy', 'excited', 'best'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'disappointed', 'worst', 'horrible'];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    if (textLower.includes(word)) positiveCount++;
  });

  negativeWords.forEach(word => {
    if (textLower.includes(word)) negativeCount++;
  });

  const totalWords = text.split(/\s+/).length;
  const positiveScore = positiveCount / Math.max(totalWords, 1);
  const negativeScore = negativeCount / Math.max(totalWords, 1);

  let sentiment = 'neutral';
  let score = 0.5;

  if (positiveScore > negativeScore && positiveScore > 0.05) {
    sentiment = 'positive';
    score = 0.5 + Math.min(positiveScore * 5, 0.5);
  } else if (negativeScore > positiveScore && negativeScore > 0.05) {
    sentiment = 'negative';
    score = 0.5 - Math.min(negativeScore * 5, 0.5);
  }

  return { sentiment, score };
}

/**
 * Determine overall mood
 */
function determineOverallMood(visualMood, audioMood, scriptSentiment) {
  const moods = [visualMood.mood, audioMood.mood];

  // Weight by confidence
  const moodVotes = {};
  moods.forEach(mood => {
    moodVotes[mood] = (moodVotes[mood] || 0) + 1;
  });

  const dominantMood = Object.keys(moodVotes).reduce((a, b) =>
    moodVotes[a] > moodVotes[b] ? a : b
  );

  // Adjust based on sentiment
  if (scriptSentiment.sentiment === 'positive' && dominantMood === 'calm') {
    return 'happy';
  }
  if (scriptSentiment.sentiment === 'negative' && dominantMood === 'energetic') {
    return 'dramatic';
  }

  return dominantMood;
}

/**
 * Calculate energy level
 */
function calculateEnergyLevel(scenes) {
  if (scenes.length === 0) return 0.5;

  let totalEnergy = 0;
  scenes.forEach(scene => {
    const metadata = scene.metadata || {};
    const audioFeatures = scene.audioFeatures || {};
    const motionLevel = metadata.motionLevel || 0.5;
    const energy = audioFeatures.energy || audioFeatures.averageEnergy || 0.5;
    totalEnergy += (motionLevel + energy) / 2;
  });

  return totalEnergy / scenes.length;
}

/**
 * Detect video type
 */
function detectVideoType(content, scenes) {
  const category = content.category || '';
  const description = content.description || '';
  const text = `${category} ${description}`.toLowerCase();

  if (text.includes('tutorial') || text.includes('how to')) return 'tutorial';
  if (text.includes('vlog')) return 'vlog';
  if (text.includes('gaming')) return 'gaming';
  if (text.includes('fitness') || text.includes('workout')) return 'fitness';
  if (text.includes('cooking') || text.includes('food')) return 'cooking';
  if (text.includes('tech') || text.includes('review')) return 'tech';
  if (scenes.some(s => s.metadata?.label?.includes('talking'))) return 'talking_head';

  return 'general';
}

/**
 * Get platform-specific adjustments
 */
function getPlatformAdjustments(platform) {
  const adjustments = {
    tiktok: {
      moodAdjustment: 'more_upbeat',
      energyBoost: 0.2,
      bpmRange: [120, 150],
      intensity: 'high',
      description: 'Upbeat and energetic tracks work best for TikTok'
    },
    instagram: {
      moodAdjustment: 'balanced',
      energyBoost: 0.1,
      bpmRange: [100, 130],
      intensity: 'medium',
      description: 'Balanced tracks that match the content mood'
    },
    linkedin: {
      moodAdjustment: 'more_subtle',
      energyBoost: -0.1,
      bpmRange: [70, 100],
      intensity: 'low',
      description: 'Subtle and professional background music'
    },
    youtube: {
      moodAdjustment: 'matched',
      energyBoost: 0,
      bpmRange: [80, 120],
      intensity: 'medium',
      description: 'Music that matches the video content'
    },
    facebook: {
      moodAdjustment: 'balanced',
      energyBoost: 0.05,
      bpmRange: [90, 120],
      intensity: 'medium',
      description: 'Versatile tracks for diverse audiences'
    },
    twitter: {
      moodAdjustment: 'more_upbeat',
      energyBoost: 0.15,
      bpmRange: [110, 140],
      intensity: 'medium-high',
      description: 'Engaging tracks that capture attention quickly'
    }
  };

  return adjustments[platform.toLowerCase()] || adjustments.youtube;
}

/**
 * Generate suggestions
 */
async function generateSuggestions(analysis, platformAdjustments, options, userId) {
  const { count, includeExistingTracks, includeAIGenerated } = options;

  // Adjust mood based on platform
  let targetMood = analysis.overallMood;
  if (platformAdjustments.moodAdjustment === 'more_upbeat') {
    if (targetMood === 'calm') targetMood = 'energetic';
    if (targetMood === 'serious') targetMood = 'inspiring';
  } else if (platformAdjustments.moodAdjustment === 'more_subtle') {
    if (targetMood === 'energetic') targetMood = 'calm';
    if (targetMood === 'dramatic') targetMood = 'serious';
  }

  // Adjust energy
  const targetEnergy = Math.min(1, Math.max(0,
    analysis.energyLevel + platformAdjustments.energyBoost
  ));

  // Get genre based on video type
  const genre = getGenreForVideoType(analysis.videoType, targetMood);

  const suggestions = [];

  // Search existing licensed tracks
  if (includeExistingTracks) {
    const { searchCatalog } = require('./musicCatalogService');
    const catalogResults = await searchCatalog(
      null, // no text query
      {
        genre: genre,
        mood: targetMood,
        bpm: platformAdjustments.bpmRange
      },
      null, // userId not needed for catalog search
      { limit: count * 2, includeLicensed: true, includeAIGenerated: false, includeUserUploads: false }
    ).catch(() => ({ tracks: [] }));

    // Filter and score tracks
    const scoredTracks = catalogResults.tracks
      .slice(0, count)
      .map(track => ({
        ...track,
        suggestionScore: calculateSuggestionScore(track, analysis, platformAdjustments),
        suggestionReason: 'Matches video mood and platform requirements'
      }))
      .sort((a, b) => b.suggestionScore - a.suggestionScore);

    suggestions.push(...scoredTracks.slice(0, Math.floor(count * 0.6)));
  }

  // Generate AI music suggestions
  if (includeAIGenerated && suggestions.length < count) {
    const aiSuggestions = generateAIMusicSuggestions(
      analysis,
      platformAdjustments,
      count - suggestions.length
    );

    suggestions.push(...aiSuggestions);
  }

  // Apply user preferences if available
  let finalSuggestions = suggestions.slice(0, count);
  if (userId) {
    const { applyUserPreferencesToSuggestions } = require('./musicLearningService');
    finalSuggestions = await applyUserPreferencesToSuggestions(finalSuggestions, userId);
  }

  return finalSuggestions;
}

/**
 * Get genre for video type
 */
function getGenreForVideoType(videoType, mood) {
  const genreMap = {
    tutorial: 'electronic',
    vlog: 'pop',
    gaming: 'electronic',
    fitness: 'electronic',
    cooking: 'jazz',
    tech: 'electronic',
    talking_head: 'ambient',
    general: mood === 'energetic' ? 'pop' : 'electronic'
  };

  return genreMap[videoType] || 'electronic';
}

/**
 * Calculate suggestion score
 */
function calculateSuggestionScore(track, analysis, platformAdjustments) {
  let score = 0.5; // Base score

  // Mood match
  if (track.mood && track.mood.includes(analysis.overallMood)) {
    score += 0.2;
  }

  // Energy match
  if (track.bpm) {
    const targetBpm = platformAdjustments.bpmRange[0] + 
                      (platformAdjustments.bpmRange[1] - platformAdjustments.bpmRange[0]) / 2;
    const bpmDiff = Math.abs(track.bpm - targetBpm);
    score += Math.max(0, 0.2 - (bpmDiff / 50));
  }

  // Usage popularity
  if (track.usageCount) {
    score += Math.min(0.1, track.usageCount / 100);
  }

  return Math.min(1, score);
}

/**
 * Generate AI music suggestions (parameters)
 */
function generateAIMusicSuggestions(analysis, platformAdjustments, count) {
  const suggestions = [];

  for (let i = 0; i < count; i++) {
    // Vary parameters slightly for diversity
    const energyVariation = (i / count) * 0.2 - 0.1;
    const targetEnergy = Math.min(1, Math.max(0, analysis.energyLevel + platformAdjustments.energyBoost + energyVariation));

    suggestions.push({
      id: `ai_suggestion_${i}`,
      type: 'ai_generated',
      provider: 'mubert', // Default provider
      suggestedParams: {
        mood: analysis.overallMood,
        genre: getGenreForVideoType(analysis.videoType, analysis.overallMood),
        duration: analysis.duration || 60,
        intensity: targetEnergy > 0.7 ? 'high' : targetEnergy > 0.4 ? 'medium' : 'low',
        bpm: platformAdjustments.bpmRange[0] + 
             (platformAdjustments.bpmRange[1] - platformAdjustments.bpmRange[0]) * targetEnergy
      },
      suggestionScore: 0.8 - (i * 0.1),
      suggestionReason: `AI-generated track matching ${analysis.overallMood} mood for ${analysis.videoType}`,
      canGenerate: true
    });
  }

  return suggestions;
}

/**
 * Generate suggestion reasoning
 */
function generateSuggestionReasoning(analysis, platformAdjustments) {
  return {
    videoAnalysis: {
      mood: analysis.overallMood,
      energyLevel: analysis.energyLevel,
      videoType: analysis.videoType
    },
    platformAdjustments: {
      moodAdjustment: platformAdjustments.moodAdjustment,
      intensity: platformAdjustments.intensity,
      description: platformAdjustments.description
    },
    recommendation: `Based on your ${analysis.videoType} video with ${analysis.overallMood} mood, we're suggesting ${platformAdjustments.intensity} intensity tracks that are ${platformAdjustments.moodAdjustment.replace('_', ' ')} for ${platformAdjustments.description.toLowerCase()}.`
  };
}

module.exports = {
  suggestSoundtracks,
  analyzeVideoContent
};


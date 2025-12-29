// Music Learning Service
// Learns from user selections to improve suggestions

const logger = require('../utils/logger');
const MusicSuggestionFeedback = require('../models/MusicSuggestionFeedback');

/**
 * Record user feedback on suggestions
 */
async function recordSuggestionFeedback(feedback, userId) {
  try {
    const feedbackRecord = new MusicSuggestionFeedback({
      userId,
      ...feedback
    });

    await feedbackRecord.save();

    logger.info('Suggestion feedback recorded', {
      userId,
      contentId: feedback.contentId,
      action: feedback.action
    });

    return feedbackRecord;
  } catch (error) {
    logger.error('Error recording suggestion feedback', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get user preferences based on past selections
 */
async function getUserMusicPreferences(userId, options = {}) {
  const {
    minSelections = 5,
    lookbackDays = 90
  } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    // Get user's past selections
    const selections = await MusicSuggestionFeedback.find({
      userId,
      action: 'selected',
      timestamp: { $gte: cutoffDate }
    }).lean();

    if (selections.length < minSelections) {
      return null; // Not enough data
    }

    // Analyze preferences
    const preferences = {
      preferredMoods: {},
      preferredGenres: {},
      preferredBPMRange: { min: Infinity, max: -Infinity },
      preferredPlatforms: {},
      videoTypePreferences: {}
    };

    selections.forEach(selection => {
      const details = selection.suggestionDetails || {};
      const context = selection.videoContext || {};

      // Mood preferences
      if (details.mood) {
        preferences.preferredMoods[details.mood] = 
          (preferences.preferredMoods[details.mood] || 0) + 1;
      }

      // Genre preferences
      if (details.genre) {
        preferences.preferredGenres[details.genre] = 
          (preferences.preferredGenres[details.genre] || 0) + 1;
      }

      // BPM range
      if (details.bpm) {
        preferences.preferredBPMRange.min = Math.min(
          preferences.preferredBPMRange.min,
          details.bpm
        );
        preferences.preferredBPMRange.max = Math.max(
          preferences.preferredBPMRange.max,
          details.bpm
        );
      }

      // Platform preferences
      if (context.platform) {
        preferences.preferredPlatforms[context.platform] = 
          (preferences.preferredPlatforms[context.platform] || 0) + 1;
      }

      // Video type preferences
      if (context.videoType) {
        preferences.videoTypePreferences[context.videoType] = 
          (preferences.videoTypePreferences[context.videoType] || {});
        
        if (details.mood) {
          preferences.videoTypePreferences[context.videoType][details.mood] = 
            (preferences.videoTypePreferences[context.videoType][details.mood] || 0) + 1;
        }
      }
    });

    // Normalize and calculate averages
    const totalSelections = selections.length;
    const topMood = Object.keys(preferences.preferredMoods)
      .sort((a, b) => preferences.preferredMoods[b] - preferences.preferredMoods[a])[0];
    const topGenre = Object.keys(preferences.preferredGenres)
      .sort((a, b) => preferences.preferredGenres[b] - preferences.preferredGenres[a])[0];

    return {
      hasPreferences: true,
      confidence: Math.min(1, totalSelections / 20), // More selections = higher confidence
      topMood,
      topGenre,
      bpmRange: preferences.preferredBPMRange.min !== Infinity ? {
        min: preferences.preferredBPMRange.min,
        max: preferences.preferredBPMRange.max,
        average: (preferences.preferredBPMRange.min + preferences.preferredBPMRange.max) / 2
      } : null,
      preferences,
      totalSelections
    };
  } catch (error) {
    logger.error('Error getting user preferences', {
      error: error.message,
      userId
    });
    return null;
  }
}

/**
 * Apply user preferences to suggestions
 */
async function applyUserPreferencesToSuggestions(suggestions, userId) {
  try {
    const preferences = await getUserMusicPreferences(userId);

    if (!preferences || !preferences.hasPreferences) {
      return suggestions; // No preferences to apply
    }

    // Boost suggestions that match user preferences
    const enhancedSuggestions = suggestions.map(suggestion => {
      let scoreBoost = 0;
      let reasons = [];

      // Mood match
      if (suggestion.mood && suggestion.mood.includes(preferences.topMood)) {
        scoreBoost += 0.15 * preferences.confidence;
        reasons.push(`Matches your preferred ${preferences.topMood} mood`);
      }

      // Genre match
      if (suggestion.genre && Array.isArray(suggestion.genre)) {
        if (suggestion.genre.includes(preferences.topGenre)) {
          scoreBoost += 0.1 * preferences.confidence;
          reasons.push(`Matches your preferred ${preferences.topGenre} genre`);
        }
      } else if (suggestion.genre === preferences.topGenre) {
        scoreBoost += 0.1 * preferences.confidence;
        reasons.push(`Matches your preferred ${preferences.topGenre} genre`);
      }

      // BPM match
      if (suggestion.bpm && preferences.bpmRange) {
        const { min, max, average } = preferences.bpmRange;
        if (suggestion.bpm >= min && suggestion.bpm <= max) {
          scoreBoost += 0.1 * preferences.confidence;
          reasons.push('BPM matches your preferences');
        }
      }

      return {
        ...suggestion,
        suggestionScore: (suggestion.suggestionScore || 0.5) + scoreBoost,
        personalizationReasons: reasons,
        personalized: reasons.length > 0
      };
    });

    // Re-sort by enhanced score
    return enhancedSuggestions.sort((a, b) => 
      (b.suggestionScore || 0) - (a.suggestionScore || 0)
    );
  } catch (error) {
    logger.error('Error applying user preferences', {
      error: error.message,
      userId
    });
    return suggestions; // Return original on error
  }
}

/**
 * Get suggestion statistics
 */
async function getSuggestionStatistics(userId, options = {}) {
  const {
    startDate,
    endDate
  } = options;

  try {
    const query = { userId };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const stats = await MusicSuggestionFeedback.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await MusicSuggestionFeedback.countDocuments(query);
    const selected = await MusicSuggestionFeedback.countDocuments({
      ...query,
      action: 'selected'
    });

    return {
      total,
      selected,
      selectionRate: total > 0 ? selected / total : 0,
      actions: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  } catch (error) {
    logger.error('Error getting suggestion statistics', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  recordSuggestionFeedback,
  getUserMusicPreferences,
  applyUserPreferencesToSuggestions,
  getSuggestionStatistics
};








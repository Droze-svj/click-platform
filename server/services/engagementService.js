// User engagement service

const Achievement = require('../models/Achievement');
const Streak = require('../models/Streak');
const Activity = require('../models/Activity');
const User = require('../models/User');
const Content = require('../models/Content');
const Script = require('../models/Script');
const logger = require('../utils/logger');

/**
 * Check and unlock achievements
 */
async function checkAchievements(userId, action, metadata = {}) {
  try {
    const achievements = [];

    // Get user stats
    const [contentCount, videoCount, scriptCount, workflowCount] = await Promise.all([
      Content.countDocuments({ userId, status: 'completed' }),
      Content.countDocuments({ userId, type: 'video', status: 'completed' }),
      Script.countDocuments({ userId }),
      require('../models/Workflow').countDocuments({ userId, isActive: true })
    ]);

    // First-time achievements
    if (action === 'upload_video' && videoCount === 1) {
      achievements.push(await unlockAchievement(userId, 'first_video', metadata));
    }
    if (action === 'generate_content' && contentCount === 1) {
      achievements.push(await unlockAchievement(userId, 'first_content', metadata));
    }
    if (action === 'generate_script' && scriptCount === 1) {
      achievements.push(await unlockAchievement(userId, 'first_script', metadata));
    }

    // Milestone achievements
    if (contentCount === 10) {
      achievements.push(await unlockAchievement(userId, 'content_milestone_10', { count: contentCount }));
    }
    if (contentCount === 50) {
      achievements.push(await unlockAchievement(userId, 'content_milestone_50', { count: contentCount }));
    }
    if (contentCount === 100) {
      achievements.push(await unlockAchievement(userId, 'content_milestone_100', { count: contentCount }));
    }

    if (videoCount === 10) {
      achievements.push(await unlockAchievement(userId, 'video_milestone_10', { count: videoCount }));
    }
    if (videoCount === 50) {
      achievements.push(await unlockAchievement(userId, 'video_milestone_50', { count: videoCount }));
    }

    // Workflow master
    if (workflowCount >= 5) {
      achievements.push(await unlockAchievement(userId, 'workflow_master', { count: workflowCount }));
    }

    // Social media pro (multiple platforms)
    if (action === 'generate_content' && metadata.platforms && metadata.platforms.length >= 5) {
      achievements.push(await unlockAchievement(userId, 'social_media_pro', { platforms: metadata.platforms.length }));
    }

    return achievements.filter(Boolean);
  } catch (error) {
    logger.error('Error checking achievements', { error: error.message, userId });
    return [];
  }
}

/**
 * Unlock an achievement
 */
async function unlockAchievement(userId, achievementType, metadata = {}) {
  try {
    // Check if already unlocked
    const existing = await Achievement.findOne({ userId, achievementType });
    if (existing) {
      return null; // Already unlocked
    }

    const achievement = new Achievement({
      userId,
      achievementType,
      metadata
    });

    await achievement.save();

    // Create activity
    await createActivity(userId, 'achievement_unlocked', {
      title: getAchievementTitle(achievementType),
      description: getAchievementDescription(achievementType),
      entityType: 'achievement',
      entityId: achievement._id,
      metadata: { achievementType }
    });

    logger.info('Achievement unlocked', { userId, achievementType });

    return achievement;
  } catch (error) {
    logger.error('Error unlocking achievement', { error: error.message, userId, achievementType });
    return null;
  }
}

/**
 * Update user streak
 */
async function updateStreak(userId) {
  try {
    let streak = await Streak.findOne({ userId });

    if (!streak) {
      streak = new Streak({ userId });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActivity = streak.lastActivityDate ? new Date(streak.lastActivityDate) : null;
    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
    }

    const daysDiff = lastActivity ? Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24)) : 999;

    if (daysDiff === 0) {
      // Already updated today
      return streak;
    } else if (daysDiff === 1) {
      // Continue streak
      streak.currentStreak += 1;
    } else {
      // Streak broken, start new
      if (streak.currentStreak > 0) {
        streak.streakHistory.push({
          startDate: streak.lastActivityDate || today,
          endDate: new Date(today.getTime() - 24 * 60 * 60 * 1000),
          days: streak.currentStreak
        });
      }
      streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    streak.lastActivityDate = today;
    await streak.save();

    // Check streak achievements
    if (streak.currentStreak === 7) {
      await unlockAchievement(userId, 'streak_7', { days: 7 });
    }
    if (streak.currentStreak === 30) {
      await unlockAchievement(userId, 'streak_30', { days: 30 });
    }
    if (streak.currentStreak === 100) {
      await unlockAchievement(userId, 'streak_100', { days: 100 });
    }

    // Create activity for streak continuation
    if (daysDiff === 1) {
      await createActivity(userId, 'streak_continued', {
        title: `${streak.currentStreak} Day Streak! 🔥`,
        description: `You've been active for ${streak.currentStreak} days in a row!`,
        metadata: { streak: streak.currentStreak }
      });
    }

    return streak;
  } catch (error) {
    logger.error('Error updating streak', { error: error.message, userId });
    return null;
  }
}

/**
 * Create activity entry
 */
async function createActivity(userId, type, data) {
  try {
    const activity = new Activity({
      userId,
      type,
      title: data.title,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata || {}
    });

    await activity.save();
    return activity;
  } catch (error) {
    logger.error('Error creating activity', { error: error.message, userId });
    return null;
  }
}

/**
 * Get user engagement stats
 */
async function getUserEngagementStats(userId) {
  try {
    const [achievements, streak, activities, contentCount, videoCount, scriptCount] = await Promise.all([
      Achievement.find({ userId }).sort({ unlockedAt: -1 }),
      Streak.findOne({ userId }),
      Activity.find({ userId }).sort({ createdAt: -1 }).limit(10),
      Content.countDocuments({ userId, status: 'completed' }),
      Content.countDocuments({ userId, type: 'video', status: 'completed' }),
      Script.countDocuments({ userId })
    ]);

    return {
      achievements: {
        total: achievements.length,
        recent: achievements.slice(0, 5),
        all: achievements
      },
      streak: streak || {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null
      },
      activities: activities,
      stats: {
        totalContent: contentCount,
        totalVideos: videoCount,
        totalScripts: scriptCount
      },
      level: calculateLevel(contentCount, videoCount, scriptCount, achievements.length)
    };
  } catch (error) {
    logger.error('Error getting engagement stats', { error: error.message, userId });
    throw error;
  }
}

/**
 * Calculate user level based on activity
 */
function calculateLevel(contentCount, videoCount, scriptCount, achievementCount) {
  const totalPoints = (contentCount * 10) + (videoCount * 15) + (scriptCount * 5) + (achievementCount * 20);
  return Math.floor(totalPoints / 100) + 1; // Level 1 starts at 0 points
}

/**
 * Get achievement title
 */
function getAchievementTitle(achievementType) {
  const titles = {
    'first_video': 'First Video! 🎥',
    'first_content': 'Content Creator! ✨',
    'first_script': 'Script Writer! 📝',
    'content_milestone_10': '10 Content Pieces! 🎉',
    'content_milestone_50': '50 Content Pieces! 🚀',
    'content_milestone_100': '100 Content Pieces! 💯',
    'video_milestone_10': '10 Videos! 🎬',
    'video_milestone_50': '50 Videos! 🎥',
    'streak_7': '7 Day Streak! 🔥',
    'streak_30': '30 Day Streak! ⭐',
    'streak_100': '100 Day Streak! 👑',
    'workflow_master': 'Workflow Master! 🤖',
    'social_media_pro': 'Social Media Pro! 📱',
    'content_creator': 'Content Creator! 🎨',
    'early_adopter': 'Early Adopter! 🌟',
    'power_user': 'Power User! ⚡'
  };
  return titles[achievementType] || 'Achievement Unlocked! 🏆';
}

/**
 * Get achievement description
 */
function getAchievementDescription(achievementType) {
  const descriptions = {
    'first_video': 'You uploaded your first video!',
    'first_content': 'You generated your first content!',
    'first_script': 'You created your first script!',
    'content_milestone_10': 'You\'ve created 10 pieces of content!',
    'content_milestone_50': 'You\'ve created 50 pieces of content!',
    'content_milestone_100': 'You\'ve created 100 pieces of content!',
    'video_milestone_10': 'You\'ve uploaded 10 videos!',
    'video_milestone_50': 'You\'ve uploaded 50 videos!',
    'streak_7': 'You\'ve been active for 7 days straight!',
    'streak_30': 'You\'ve been active for 30 days straight!',
    'streak_100': 'You\'ve been active for 100 days straight!',
    'workflow_master': 'You\'ve created 5+ workflows!',
    'social_media_pro': 'You\'ve posted to 5+ platforms!',
    'content_creator': 'You\'re a true content creator!',
    'early_adopter': 'Thanks for being an early adopter!',
    'power_user': 'You\'re a power user!'
  };
  return descriptions[achievementType] || 'Keep up the great work!';
}

module.exports = {
  checkAchievements,
  unlockAchievement,
  updateStreak,
  createActivity,
  getUserEngagementStats,
  calculateLevel
};








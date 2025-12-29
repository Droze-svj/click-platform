// Onboarding Analytics Service

const OnboardingProgress = require('../models/OnboardingProgress');
const logger = require('../utils/logger');

/**
 * Track onboarding step completion
 */
async function trackStepCompletion(userId, stepId, timeSpent, skipped = false) {
  try {
    // In production, store in analytics database
    logger.info('Onboarding step tracked', {
      userId,
      stepId,
      timeSpent,
      skipped,
      timestamp: new Date(),
    });

    // Could integrate with analytics service (e.g., Mixpanel, Amplitude)
    return true;
  } catch (error) {
    logger.error('Track step completion error', {
      error: error.message,
      userId,
      stepId,
    });
    return false;
  }
}

/**
 * Get onboarding analytics
 */
async function getOnboardingAnalytics(options = {}) {
  try {
    const { period = 30 } = options;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [
      totalUsers,
      completedUsers,
      skippedUsers,
      averageCompletionTime,
      stepCompletionRates,
      dropOffPoints,
    ] = await Promise.all([
      OnboardingProgress.countDocuments({
        startedAt: { $gte: startDate },
      }),
      OnboardingProgress.countDocuments({
        completed: true,
        skipped: false,
        completedAt: { $gte: startDate },
      }),
      OnboardingProgress.countDocuments({
        skipped: true,
        startedAt: { $gte: startDate },
      }),
      calculateAverageCompletionTime(startDate),
      calculateStepCompletionRates(startDate),
      identifyDropOffPoints(startDate),
    ]);

    return {
      period,
      totalUsers,
      completedUsers,
      skippedUsers,
      completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
      skipRate: totalUsers > 0 ? (skippedUsers / totalUsers) * 100 : 0,
      averageCompletionTime,
      stepCompletionRates,
      dropOffPoints,
    };
  } catch (error) {
    logger.error('Get onboarding analytics error', { error: error.message });
    throw error;
  }
}

/**
 * Calculate average completion time
 */
async function calculateAverageCompletionTime(startDate) {
  const completed = await OnboardingProgress.find({
    completed: true,
    skipped: false,
    completedAt: { $gte: startDate },
  }).select('startedAt completedAt').lean();

  if (completed.length === 0) return 0;

  const totalTime = completed.reduce((sum, progress) => {
    const time = new Date(progress.completedAt) - new Date(progress.startedAt);
    return sum + time;
  }, 0);

  return Math.round(totalTime / completed.length / 1000); // Return in seconds
}

/**
 * Calculate step completion rates
 */
async function calculateStepCompletionRates(startDate) {
  const allProgress = await OnboardingProgress.find({
    startedAt: { $gte: startDate },
  }).select('completedSteps').lean();

  const stepCounts = {};
  let totalUsers = allProgress.length;

  allProgress.forEach(progress => {
    progress.completedSteps.forEach(step => {
      if (!stepCounts[step.stepId]) {
        stepCounts[step.stepId] = 0;
      }
      stepCounts[step.stepId]++;
    });
  });

  return Object.keys(stepCounts).map(stepId => ({
    stepId,
    completionRate: totalUsers > 0 ? (stepCounts[stepId] / totalUsers) * 100 : 0,
    completions: stepCounts[stepId],
  }));
}

/**
 * Identify drop-off points
 */
async function identifyDropOffPoints(startDate) {
  const allProgress = await OnboardingProgress.find({
    startedAt: { $gte: startDate },
    completed: false,
  }).select('currentStep completedSteps').lean();

  const dropOffs = {};
  allProgress.forEach(progress => {
    const lastCompletedStep = progress.completedSteps.length;
    if (!dropOffs[lastCompletedStep]) {
      dropOffs[lastCompletedStep] = 0;
    }
    dropOffs[lastCompletedStep]++;
  });

  return Object.keys(dropOffs).map(step => ({
    step: parseInt(step),
    count: dropOffs[step],
  })).sort((a, b) => b.count - a.count);
}

/**
 * A/B test onboarding variants
 */
async function assignOnboardingVariant(userId) {
  try {
    // Simple hash-based assignment for consistency
    const hash = simpleHash(userId.toString());
    const variant = hash % 2 === 0 ? 'A' : 'B';
    
    logger.info('Onboarding variant assigned', { userId, variant });
    return variant;
  } catch (error) {
    logger.error('Assign variant error', { error: error.message, userId });
    return 'A'; // Default variant
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

module.exports = {
  trackStepCompletion,
  getOnboardingAnalytics,
  assignOnboardingVariant,
};







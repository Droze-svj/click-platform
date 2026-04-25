// Onboarding Service

const OnboardingProgress = require('../models/OnboardingProgress');
const logger = require('../utils/logger');

// Onboarding steps configuration
const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Click!',
    description: 'Let\'s get you started with creating amazing content',
    component: 'WelcomeStep',
    required: true,
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Tell us about yourself and your niche',
    component: 'ProfileStep',
    required: true,
  },
  {
    id: 'first-content',
    title: 'Create Your First Content',
    description: 'Generate or upload your first piece of content',
    component: 'FirstContentStep',
    required: true,
  },
  {
    id: 'connect-social',
    title: 'Connect Social Media',
    description: 'Link your social media accounts to start posting',
    component: 'ConnectSocialStep',
    required: false,
  },
  {
    id: 'explore-features',
    title: 'Explore Features',
    description: 'Discover powerful features to enhance your content',
    component: 'ExploreFeaturesStep',
    required: false,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start creating amazing content',
    component: 'CompleteStep',
    required: true,
  },
];

/**
 * Get or create onboarding progress
 */
async function getOnboardingProgress(userId) {
  try {
    let progress = await OnboardingProgress.findOne({ userId });

    if (!progress) {
      progress = new OnboardingProgress({
        userId,
        currentStep: 0,
      });
      await progress.save();
    }

    return {
      progress,
      steps: ONBOARDING_STEPS,
      currentStepData: ONBOARDING_STEPS[progress.currentStep] || null,
      totalSteps: ONBOARDING_STEPS.length,
      completedSteps: progress.completedSteps.length,
      isComplete: progress.completed,
    };
  } catch (error) {
    logger.error('Get onboarding progress error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Complete a step
 */
async function completeStep(userId, stepId, data = {}) {
  try {
    const progress = await OnboardingProgress.findOne({ userId });
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }

    // Check if step already completed
    const alreadyCompleted = progress.completedSteps.some(
      step => step.stepId === stepId
    );

    if (!alreadyCompleted) {
      progress.completedSteps.push({
        stepId,
        completedAt: new Date(),
      });
    }

    // Update current step
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepId);
    if (stepIndex !== -1 && stepIndex < ONBOARDING_STEPS.length - 1) {
      progress.currentStep = stepIndex + 1;
    }

    // Check if all required steps are completed
    const requiredSteps = ONBOARDING_STEPS.filter(step => step.required);
    const completedRequired = requiredSteps.every(step =>
      progress.completedSteps.some(cs => cs.stepId === step.id)
    );

    if (completedRequired && !progress.completed) {
      progress.completed = true;
      progress.completedAt = new Date();
    }

    // Update preferences if provided
    if (data.preferences) {
      progress.preferences = { ...progress.preferences, ...data.preferences };
    }

    await progress.save();

    logger.info('Onboarding step completed', { userId, stepId });
    return progress;
  } catch (error) {
    logger.error('Complete step error', { error: error.message, userId, stepId });
    throw error;
  }
}

/**
 * Skip onboarding
 */
async function skipOnboarding(userId) {
  try {
    const progress = await OnboardingProgress.findOne({ userId });
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }

    progress.skipped = true;
    progress.completed = true;
    progress.completedAt = new Date();
    await progress.save();

    logger.info('Onboarding skipped', { userId });
    return progress;
  } catch (error) {
    logger.error('Skip onboarding error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Go to specific step
 */
async function goToStep(userId, stepIndex) {
  try {
    const progress = await OnboardingProgress.findOne({ userId });
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }

    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      progress.currentStep = stepIndex;
      await progress.save();
    }

    return progress;
  } catch (error) {
    logger.error('Go to step error', { error: error.message, userId, stepIndex });
    throw error;
  }
}

/**
 * Reset onboarding
 */
async function resetOnboarding(userId) {
  try {
    await OnboardingProgress.deleteOne({ userId });
    logger.info('Onboarding reset', { userId });
    return true;
  } catch (error) {
    logger.error('Reset onboarding error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getOnboardingProgress,
  completeStep,
  skipOnboarding,
  goToStep,
  resetOnboarding,
  ONBOARDING_STEPS,
};


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
    href: '/dashboard/niche',
    component: 'ProfileStep',
    required: true,
  },
  {
    id: 'first-content',
    title: 'Create Your First Content',
    description: 'Generate or upload your first piece of content',
    href: '/dashboard/video',
    component: 'FirstContentStep',
    required: true,
  },
  {
    id: 'captions',
    title: 'Set Up Your Captions',
    description: 'Pick a caption look and keep Snap-to-Speech on for word-perfect captions',
    href: '/dashboard/onboarding/captions',
    component: 'CaptionSetupStep',
    required: false,
  },
  {
    id: 'connect-social',
    title: 'Connect Social Media',
    description: 'Link your social media accounts to start posting',
    href: '/dashboard/social',
    component: 'ConnectSocialStep',
    required: false,
  },
  {
    id: 'explore-features',
    title: 'Explore Features',
    description: 'Discover powerful features to enhance your content',
    href: '/dashboard/features',
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

const SOCIAL_PLATFORMS = ['twitter', 'tiktok', 'youtube', 'instagram', 'linkedin', 'facebook'];

/**
 * Steps the user has already done for real, wherever they did it. Before this,
 * steps only completed when ticked by hand on the Get Started page, so a
 * creator who had picked a niche, uploaded videos and connected accounts
 * still saw "0/7" on every dashboard visit. Never throws: a failed lookup just
 * means that step isn't auto-detected this time.
 */
async function detectEarnedSteps(userId) {
  const earned = new Set();
  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('niche oauth').lean();
    if (user) {
      if (user.niche && user.niche !== 'other') earned.add('profile');
      const oauth = user.oauth || {};
      if (SOCIAL_PLATFORMS.some((p) => oauth[p] && oauth[p].connected)) earned.add('connect-social');
    }
  } catch (error) {
    logger.warn('Onboarding: user signals unavailable', { error: error.message, userId });
  }
  try {
    const Content = require('../models/Content');
    // Content.userId is a String field.
    if (await Content.exists({ userId: String(userId) })) earned.add('first-content');
  } catch (error) {
    logger.warn('Onboarding: content signal unavailable', { error: error.message, userId });
  }
  // Anyone who has done a real step is past the welcome screen.
  if (earned.size > 0) earned.add('welcome');
  return earned;
}

function markRequiredComplete(progress) {
  const requiredSteps = ONBOARDING_STEPS.filter((step) => step.required && step.id !== 'complete');
  const doneIds = new Set(progress.completedSteps.map((cs) => cs.stepId));
  if (requiredSteps.every((step) => doneIds.has(step.id))) {
    if (!doneIds.has('complete')) progress.completedSteps.push({ stepId: 'complete', completedAt: new Date() });
    if (!progress.completed) {
      progress.completed = true;
      progress.completedAt = new Date();
    }
  }
}

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

    // Record steps the user has already done elsewhere in Click.
    const earned = await detectEarnedSteps(userId);
    const already = new Set((progress.completedSteps || []).map((cs) => cs.stepId));
    const fresh = [...earned].filter((id) => !already.has(id));
    if (fresh.length > 0) {
      for (const stepId of fresh) progress.completedSteps.push({ stepId, completedAt: new Date() });
      markRequiredComplete(progress);
      try {
        await progress.save();
      } catch (error) {
        logger.warn('Onboarding: could not save detected steps', { error: error.message, userId });
      }
    }

    // Each step carries its own `completed` flag. The client reads
    // step.completed, but the static step list never had one (completion
    // lives in progress.completedSteps[{ stepId }]), so every step looked
    // unfinished forever.
    const done = new Set((progress.completedSteps || []).map((cs) => cs.stepId));
    return {
      progress,
      steps: ONBOARDING_STEPS.map((step) => ({ ...step, completed: done.has(step.id) })),
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


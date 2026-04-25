// Learning & Tutorials Service
// Interactive tutorials, tooltips, video guides, feature discovery

const logger = require('../utils/logger');
const UserPreferences = require('../models/UserPreferences');

/**
 * Get tutorials for feature
 */
async function getTutorials(feature, userId = null) {
  const tutorials = {
    'color-grading': [
      {
        id: 'color-grading-1',
        title: 'Introduction to Color Grading',
        description: 'Learn the basics of color grading',
        type: 'interactive',
        steps: [
          { step: 1, title: 'Open Color Grading Panel', action: 'open-panel', target: 'color-grading' },
          { step: 2, title: 'Select a Preset', action: 'select-preset', target: 'cinematic' },
          { step: 3, title: 'Apply Preset', action: 'apply-preset' }
        ],
        duration: 5
      },
      {
        id: 'color-grading-2',
        title: 'Using Color Wheels',
        description: 'Master color wheel adjustments',
        type: 'video',
        videoUrl: '/tutorials/color-wheels.mp4',
        duration: 10
      }
    ],
    'audio-mixing': [
      {
        id: 'audio-mixing-1',
        title: 'Audio Mixing Basics',
        description: 'Learn to mix audio tracks',
        type: 'interactive',
        steps: [
          { step: 1, title: 'Open Audio Panel', action: 'open-panel', target: 'audio' },
          { step: 2, title: 'Select EQ Preset', action: 'select-preset', target: 'voice-enhancement' },
          { step: 3, title: 'Apply EQ', action: 'apply-eq' }
        ],
        duration: 7
      }
    ],
    'keyframes': [
      {
        id: 'keyframes-1',
        title: 'Keyframe Animation',
        description: 'Create smooth animations with keyframes',
        type: 'interactive',
        steps: [
          { step: 1, title: 'Select Clip', action: 'select-clip' },
          { step: 2, title: 'Add Keyframe', action: 'add-keyframe', time: 0 },
          { step: 3, title: 'Set Property', action: 'set-property', property: 'opacity', value: 0 },
          { step: 4, title: 'Add Second Keyframe', action: 'add-keyframe', time: 1 },
          { step: 5, title: 'Set Property', action: 'set-property', property: 'opacity', value: 1 }
        ],
        duration: 10
      }
    ],
    'timeline': [
      {
        id: 'timeline-1',
        title: 'Multi-Track Timeline',
        description: 'Work with multiple tracks',
        type: 'interactive',
        steps: [
          { step: 1, title: 'Add Video Track', action: 'add-track', type: 'video' },
          { step: 2, title: 'Add Audio Track', action: 'add-track', type: 'audio' },
          { step: 3, title: 'Add Clip to Track', action: 'add-clip' }
        ],
        duration: 8
      }
    ]
  };

  return tutorials[feature] || [];
}

/**
 * Get tooltips for feature
 */
function getTooltips(feature) {
  const tooltips = {
    'color-grading': {
      'preset-selector': 'Choose a color grading preset to quickly apply a professional look',
      'color-wheels': 'Adjust shadows, midtones, and highlights separately for precise control',
      'curves': 'Use curves for fine-tuned color and contrast adjustments',
      'luts': 'Import LUT files for cinematic color grades'
    },
    'audio-mixing': {
      'eq-preset': 'Select an EQ preset optimized for voice, music, or podcast',
      'volume-slider': 'Adjust track volume. Use keyframes for automation',
      'ducking': 'Automatically lower music when speech is detected',
      'normalize': 'Normalize audio to broadcast standards'
    },
    'keyframes': {
      'add-keyframe': 'Click to add a keyframe at the current time',
      'property-selector': 'Choose which property to animate (position, scale, rotation, opacity)',
      'easing-curve': 'Select easing for smooth animation transitions',
      'timeline': 'Drag keyframes on timeline to adjust timing'
    },
    'timeline': {
      'add-track': 'Add a new track for video, audio, text, or graphics',
      'track-controls': 'Lock, solo, or mute tracks for easier editing',
      'clip-trimming': 'Drag edges to trim clips, or use razor tool to split',
      'track-height': 'Adjust track height for better visibility'
    }
  };

  return tooltips[feature] || {};
}

/**
 * Track tutorial completion
 */
async function completeTutorial(userId, tutorialId) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId, completedTutorials: [] });
    }

    if (!preferences.completedTutorials) {
      preferences.completedTutorials = [];
    }

    if (!preferences.completedTutorials.includes(tutorialId)) {
      preferences.completedTutorials.push(tutorialId);
      await preferences.save();
    }

    logger.info('Tutorial completed', { userId, tutorialId });
    return { success: true };
  } catch (error) {
    logger.error('Complete tutorial error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user progress
 */
async function getUserProgress(userId) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    const completed = preferences?.completedTutorials || [];
    
    return {
      completedTutorials: completed,
      progress: {
        'color-grading': completed.filter(id => id.includes('color-grading')).length,
        'audio-mixing': completed.filter(id => id.includes('audio-mixing')).length,
        'keyframes': completed.filter(id => id.includes('keyframes')).length,
        'timeline': completed.filter(id => id.includes('timeline')).length
      }
    };
  } catch (error) {
    logger.error('Get user progress error', { error: error.message, userId });
    return { completedTutorials: [], progress: {} };
  }
}

/**
 * Get tips and tricks
 */
function getTipsAndTricks(feature = null) {
  const tips = {
    'color-grading': [
      'Use color wheels for quick adjustments - shadows affect dark areas, highlights affect bright areas',
      'Start with a preset and fine-tune with curves for best results',
      'Match colors between clips using the color match feature',
      'Use LUTs for cinematic looks - import your own or use built-in library'
    ],
    'audio-mixing': [
      'Use audio ducking to automatically lower music during speech',
      'Normalize audio to -16 LUFS for broadcast standards',
      'Apply noise reduction before other effects for best results',
      'Use EQ presets as starting points, then customize'
    ],
    'keyframes': [
      'Add keyframes at important moments for smooth animations',
      'Use easing curves (ease-in-out) for natural motion',
      'Copy and paste keyframes to reuse animations',
      'Use graph editor for precise control over animation speed'
    ],
    'timeline': [
      'Lock tracks you\'re not editing to avoid accidental changes',
      'Use solo to focus on one track at a time',
      'Group related tracks for easier management',
      'Adjust track height for better visibility of clips'
    ]
  };

  return feature ? (tips[feature] || []) : tips;
}

module.exports = {
  getTutorials,
  getTooltips,
  completeTutorial,
  getUserProgress,
  getTipsAndTricks,
};

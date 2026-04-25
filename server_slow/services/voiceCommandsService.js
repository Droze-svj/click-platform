// Voice Commands Service
// Voice-controlled video editing

const logger = require('../utils/logger');

/**
 * Process voice command
 */
async function processVoiceCommand(command, context = {}) {
  try {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Parse command intent
    const intents = {
      'apply cinematic color grade': {
        action: 'color-grading',
        preset: 'cinematic',
        confidence: 0.9
      },
      'add title card': {
        action: 'typography',
        template: 'title-card',
        confidence: 0.9
      },
      'stabilize this clip': {
        action: 'motion-graphics',
        operation: 'stabilize',
        strength: 0.5,
        confidence: 0.85
      },
      'export for youtube': {
        action: 'export',
        platform: 'youtube',
        confidence: 0.95
      },
      'add music': {
        action: 'audio',
        operation: 'add-music',
        confidence: 0.8
      },
      'undo': {
        action: 'history',
        operation: 'undo',
        confidence: 0.95
      },
      'redo': {
        action: 'history',
        operation: 'redo',
        confidence: 0.95
      },
      'play': {
        action: 'playback',
        operation: 'play',
        confidence: 0.95
      },
      'pause': {
        action: 'playback',
        operation: 'pause',
        confidence: 0.95
      }
    };

    // Find matching intent
    let bestMatch = null;
    let bestScore = 0;

    Object.entries(intents).forEach(([key, intent]) => {
      if (normalizedCommand.includes(key) || key.includes(normalizedCommand)) {
        const score = intent.confidence;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = intent;
        }
      }
    });

    if (bestMatch) {
      logger.info('Voice command processed', { command, intent: bestMatch.action });
      return {
        success: true,
        intent: bestMatch,
        confidence: bestScore
      };
    }

    return {
      success: false,
      message: 'Command not recognized',
      suggestions: Object.keys(intents).slice(0, 5)
    };
  } catch (error) {
    logger.error('Process voice command error', { error: error.message, command });
    throw error;
  }
}

/**
 * Get available voice commands
 */
function getAvailableCommands() {
  return [
    'Apply cinematic color grade',
    'Add title card',
    'Stabilize this clip',
    'Export for YouTube',
    'Add music',
    'Undo',
    'Redo',
    'Play',
    'Pause',
    'Split clip',
    'Delete clip',
    'Add transition',
    'Apply filter',
    'Normalize audio',
    'Generate captions'
  ];
}

module.exports = {
  processVoiceCommand,
  getAvailableCommands,
};

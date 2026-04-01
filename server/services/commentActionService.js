// Comment Action Service (Phase 11)
// Translates natural language feedback into timeline modifications

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Parse a client comment into a structured timeline action
 * @param {string} comment - e.g., "Make the music quieter at 0:15"
 * @param {Object} timeline - Current timeline state
 * @returns {Promise<Object>} Proposed action { type, params, timestamp }
 */
async function parseCommentToAction(comment, timeline = {}) {
  if (!geminiConfigured) {
    throw new Error('AI not configured for comment parsing');
  }

  try {
    const prompt = `Convert this client video feedback into a timeline command.

    Comment: "${comment}"
    Timeline Context: ${JSON.stringify(timeline).substring(0, 1000)}

    Available Commands:
    - UPDATE_VOLUME (param: layerId, value: 0-1, time: HH:MM:SS)
    - TRIM_CLIP (param: clipId, startDelta: seconds, endDelta: seconds)
    - REPLACE_BROLL (param: startTime, duration: seconds, prompt: string)
    - ADD_SOUND_EFFECT (param: type, time: HH:MM:SS)

    Respond in JSON:
    {
      "actionType": "COMMAND_NAME",
      "params": { ... },
      "explanation": "Why this action matches the comment"
    }`;

    const response = await geminiGenerate(prompt, { temperature: 0.2 });
    return JSON.parse(response);
  } catch (error) {
    logger.error('Comment parsing error', { error: error.message });
    return { actionType: 'MANUAL_REVIEW', explanation: 'Could not automate this request.' };
  }
}

/**
 * Execute a proposed action on a timeline
 * @param {Object} action - Action from parseCommentToAction
 * @param {Object} timeline - Current timeline
 * @returns {Object} Updated timeline
 */
function executeTimelineAction(action, timeline) {
  const newTimeline = JSON.parse(JSON.stringify(timeline)); // Deep clone

  switch (action.actionType) {
  case 'UPDATE_VOLUME':
    // Simplified: find layer and update volume at time
    const layer = newTimeline.layers.find(l => l.id === action.params.layerId) || newTimeline.layers[0];
    if (layer) {
      layer.volume = action.params.value;
      layer.events = [...(layer.events || []), { type: 'volume_change', time: action.params.time, value: action.params.value }];
    }
    break;
  case 'TRIM_CLIP':
    const clip = newTimeline.clips.find(c => c.id === action.params.clipId);
    if (clip) {
      clip.start += action.params.startDelta || 0;
      clip.end += action.params.endDelta || 0;
    }
    break;
  default:
    logger.info('Action requires manual execution', { actionType: action.actionType });
  }

  return newTimeline;
}

module.exports = {
  parseCommentToAction,
  executeTimelineAction
};

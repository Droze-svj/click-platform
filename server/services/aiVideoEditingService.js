// AI-Powered Video Editing Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client for AI video editing', { error: error.message });
      return null;
    }
  }
  return openai;
}

/**
 * Analyze video for editing suggestions
 */
async function analyzeVideoForEditing(videoMetadata) {
  try {
    const {
      duration,
      scenes = [],
      audioLevels = [],
      transcript = null,
    } = videoMetadata;

    const prompt = `Analyze this video and provide AI-powered editing suggestions:

Duration: ${duration} seconds
Scenes: ${scenes.length} detected
Audio Levels: ${audioLevels.length > 0 ? 'Available' : 'Not available'}
Transcript: ${transcript ? 'Available' : 'Not available'}

Provide:
1. Recommended cuts (remove dead air, pauses)
2. Scene transitions suggestions
3. Audio level adjustments
4. Pacing improvements
5. Highlight moments to keep
6. Suggested video length
7. Thumbnail moment suggestions

Format as JSON object with fields: recommendedCuts (array), transitions (array), audioAdjustments (array), pacingImprovements (array), highlights (array), suggestedLength (number), thumbnailMoments (array)`;

    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, cannot analyze video');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional video editor. Analyze videos and provide intelligent editing suggestions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const analysisText = response.choices[0].message.content;
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse video analysis');
      }
    }

    logger.info('Video analyzed for editing', { duration, scenes: scenes.length });
    return analysis;
  } catch (error) {
    logger.error('Analyze video for editing error', { error: error.message });
    throw error;
  }
}

/**
 * Auto-edit video
 */
async function autoEditVideo(videoId, editingOptions = {}) {
  try {
    const {
      removeSilence = true,
      removePauses = true,
      optimizePacing = true,
      enhanceAudio = true,
      addTransitions = true,
    } = editingOptions;

    // In production, this would use FFmpeg or similar
    // For now, return editing plan
    
    const editingPlan = {
      videoId,
      operations: [],
      estimatedTime: 0,
    };

    if (removeSilence) {
      editingPlan.operations.push({
        type: 'remove_silence',
        description: 'Remove silent segments',
        estimatedTime: 30,
      });
    }

    if (removePauses) {
      editingPlan.operations.push({
        type: 'remove_pauses',
        description: 'Remove long pauses',
        estimatedTime: 20,
      });
    }

    if (optimizePacing) {
      editingPlan.operations.push({
        type: 'optimize_pacing',
        description: 'Optimize video pacing',
        estimatedTime: 45,
      });
    }

    if (enhanceAudio) {
      editingPlan.operations.push({
        type: 'enhance_audio',
        description: 'Normalize and enhance audio',
        estimatedTime: 25,
      });
    }

    if (addTransitions) {
      editingPlan.operations.push({
        type: 'add_transitions',
        description: 'Add smooth transitions',
        estimatedTime: 15,
      });
    }

    editingPlan.estimatedTime = editingPlan.operations.reduce((sum, op) => sum + op.estimatedTime, 0);

    logger.info('Auto-edit plan created', { videoId, operations: editingPlan.operations.length });
    return editingPlan;
  } catch (error) {
    logger.error('Auto-edit video error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Detect scenes
 */
async function detectScenes(videoId, videoMetadata) {
  try {
    // In production, use video analysis tools
    // For now, provide framework
    
    const scenes = [];
    const duration = videoMetadata.duration || 60;
    const sceneCount = Math.ceil(duration / 10); // Approx 10 seconds per scene

    for (let i = 0; i < sceneCount; i++) {
      scenes.push({
        id: i + 1,
        startTime: i * 10,
        endTime: Math.min((i + 1) * 10, duration),
        type: 'scene',
        confidence: 0.85,
      });
    }

    logger.info('Scenes detected', { videoId, sceneCount: scenes.length });
    return { scenes, totalScenes: scenes.length };
  } catch (error) {
    logger.error('Detect scenes error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Smart cut detection
 */
async function detectSmartCuts(videoId, videoMetadata) {
  try {
    const {
      transcript = null,
      audioLevels = [],
      scenes = [],
    } = videoMetadata;

    const cuts = [];

    // Detect silence for cuts
    if (audioLevels.length > 0) {
      audioLevels.forEach((level, index) => {
        if (level < 0.1 && index > 0) {
          cuts.push({
            type: 'silence',
            timestamp: index,
            duration: 1,
            confidence: 0.9,
          });
        }
      });
    }

    // Detect scene changes
    scenes.forEach((scene, index) => {
      if (index > 0) {
        cuts.push({
          type: 'scene_change',
          timestamp: scene.startTime,
          duration: 0.5,
          confidence: 0.8,
        });
      }
    });

    logger.info('Smart cuts detected', { videoId, cuts: cuts.length });
    return { cuts, totalCuts: cuts.length };
  } catch (error) {
    logger.error('Detect smart cuts error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  analyzeVideoForEditing,
  autoEditVideo,
  detectScenes,
  detectSmartCuts,
};







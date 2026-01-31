// Keyframe Animation System Service
// Professional keyframe-based animation for video editing

const logger = require('../utils/logger');
const Content = require('../models/Content');

/**
 * Save keyframe animation
 */
async function saveKeyframeAnimation(videoId, animationData) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata) {
      content.metadata = {};
    }

    if (!content.metadata.animations) {
      content.metadata.animations = [];
    }

    const animation = {
      id: `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...animationData,
      createdAt: new Date().toISOString()
    };

    content.metadata.animations.push(animation);
    await content.save();

    logger.info('Keyframe animation saved', { videoId, animationId: animation.id });
    return { success: true, animation };
  } catch (error) {
    logger.error('Save keyframe animation error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Apply keyframe animation to video
 */
async function applyKeyframeAnimation(videoPath, outputPath, keyframes, property) {
  return new Promise((resolve, reject) => {
    // Build FFmpeg filter for keyframe animation
    // This is simplified - full implementation would handle complex animations
    
    let filter = '';
    
    switch (property) {
      case 'position':
        // Animate position using xfade or overlay
        filter = buildPositionAnimation(keyframes);
        break;
      case 'scale':
        filter = buildScaleAnimation(keyframes);
        break;
      case 'rotation':
        filter = buildRotationAnimation(keyframes);
        break;
      case 'opacity':
        filter = buildOpacityAnimation(keyframes);
        break;
      default:
        reject(new Error(`Unknown property: ${property}`));
        return;
    }

    if (!filter) {
      // No animation, just copy
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg(videoPath)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
      return;
    }

    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg(videoPath)
      .videoFilters(filter)
      .output(outputPath)
      .on('end', () => {
        logger.info('Keyframe animation applied', { outputPath, property });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Build position animation filter
 */
function buildPositionAnimation(keyframes) {
  // Simplified - would use complex filter for smooth interpolation
  const sorted = keyframes.sort((a, b) => a.time - b.time);
  const expressions = sorted.map((kf, i) => {
    const next = sorted[i + 1];
    if (!next) return '';
    
    const duration = next.time - kf.time;
    const xChange = next.value.x - kf.value.x;
    const yChange = next.value.y - kf.value.y;
    
    // Build expression for position change
    return `x='if(between(t,${kf.time},${next.time}),${kf.value.x}+(t-${kf.time})*${xChange}/${duration},x)':y='if(between(t,${kf.time},${next.time}),${kf.value.y}+(t-${kf.time})*${yChange}/${duration},y)'`;
  }).filter(Boolean).join(',');
  
  return expressions || '';
}

/**
 * Build scale animation filter
 */
function buildScaleAnimation(keyframes) {
  const sorted = keyframes.sort((a, b) => a.time - b.time);
  const expressions = sorted.map((kf, i) => {
    const next = sorted[i + 1];
    if (!next) return '';
    
    const duration = next.time - kf.time;
    const scaleChange = next.value - kf.value;
    
    return `scale='if(between(t,${kf.time},${next.time}),${kf.value}+(t-${kf.time})*${scaleChange}/${duration},iw)':'if(between(t,${kf.time},${next.time}),${kf.value}+(t-${kf.time})*${scaleChange}/${duration},ih)'`;
  }).filter(Boolean).join(',');
  
  return expressions || '';
}

/**
 * Build rotation animation filter
 */
function buildRotationAnimation(keyframes) {
  const sorted = keyframes.sort((a, b) => a.time - b.time);
  const expressions = sorted.map((kf, i) => {
    const next = sorted[i + 1];
    if (!next) return '';
    
    const duration = next.time - kf.time;
    const rotationChange = next.value - kf.value;
    
    return `rotate='if(between(t,${kf.time},${next.time}),${kf.value}+(t-${kf.time})*${rotationChange}/${duration},0)'`;
  }).filter(Boolean).join(',');
  
  return expressions || '';
}

/**
 * Build opacity animation filter
 */
function buildOpacityAnimation(keyframes) {
  const sorted = keyframes.sort((a, b) => a.time - b.time);
  const expressions = sorted.map((kf, i) => {
    const next = sorted[i + 1];
    if (!next) return '';
    
    const duration = next.time - kf.time;
    const opacityChange = next.value - kf.value;
    
    return `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(between(t,${kf.time},${next.time}),${kf.value}+(t-${kf.time})*${opacityChange}/${duration},1)'`;
  }).filter(Boolean).join(',');
  
  return expressions || '';
}

/**
 * Get easing function
 */
function getEasingFunction(easingType) {
  const easings = {
    'linear': 't',
    'ease-in': 't*t',
    'ease-out': 't*(2-t)',
    'ease-in-out': 't<0.5?2*t*t:-1+(4-2*t)*t',
    'bounce': 't<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1'
  };
  
  return easings[easingType] || easings['linear'];
}

/**
 * Get animation presets
 */
function getAnimationPresets() {
  return {
    'fade-in': {
      name: 'Fade In',
      keyframes: [
        { time: 0, value: 0, easing: 'ease-in' },
        { time: 1, value: 1, easing: 'ease-in' }
      ],
      property: 'opacity'
    },
    'fade-out': {
      name: 'Fade Out',
      keyframes: [
        { time: 0, value: 1, easing: 'ease-out' },
        { time: 1, value: 0, easing: 'ease-out' }
      ],
      property: 'opacity'
    },
    'slide-in-left': {
      name: 'Slide In Left',
      keyframes: [
        { time: 0, value: { x: -100, y: 0 }, easing: 'ease-out' },
        { time: 1, value: { x: 0, y: 0 }, easing: 'ease-out' }
      ],
      property: 'position'
    },
    'zoom-in': {
      name: 'Zoom In',
      keyframes: [
        { time: 0, value: 0.5, easing: 'ease-out' },
        { time: 1, value: 1, easing: 'ease-out' }
      ],
      property: 'scale'
    },
    'bounce': {
      name: 'Bounce',
      keyframes: [
        { time: 0, value: 0, easing: 'bounce' },
        { time: 0.5, value: 1.2, easing: 'bounce' },
        { time: 1, value: 1, easing: 'bounce' }
      ],
      property: 'scale'
    }
  };
}

module.exports = {
  saveKeyframeAnimation,
  applyKeyframeAnimation,
  getAnimationPresets,
  getEasingFunction,
};

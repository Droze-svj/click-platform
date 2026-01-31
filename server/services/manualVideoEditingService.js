// Manual Video Editing Tools Service
// Provides advanced manual editing capabilities beyond AI suggestions

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

/**
 * Apply manual video edits
 */
async function applyManualEdits(videoPath, edits) {
  try {
    const outputPath = videoPath.replace('.mp4', '_edited.mp4');
    let command = ffmpeg(videoPath);

    // Apply trim/cut edits
    if (edits.trim) {
      const { start, end, duration } = edits.trim;
      if (start !== undefined) command = command.setStartTime(start);
      if (duration !== undefined) command = command.setDuration(duration);
      if (end !== undefined) command = command.setDuration(end - (start || 0));
    }

    // Apply speed adjustments
    if (edits.speed && edits.speed !== 1) {
      command = command.videoFilters(`setpts=${1/edits.speed}*PTS`);
      command = command.audioFilters(`atempo=${edits.speed}`);
    }

    // Apply crop/resize
    if (edits.crop) {
      const { width, height, x, y } = edits.crop;
      command = command.videoFilters(`crop=${width}:${height}:${x}:${y}`);
    }

    // Apply rotation
    if (edits.rotation) {
      const rotations = { 90: 1, 180: 2, 270: 3 };
      if (rotations[edits.rotation]) {
        command = command.videoFilters(`transpose=${rotations[edits.rotation]}`);
      }
    }

    // Apply video filters
    const filters = [];
    if (edits.filters) {
      if (edits.filters.brightness) filters.push(`eq=brightness=${edits.filters.brightness}`);
      if (edits.filters.contrast) filters.push(`eq=contrast=${edits.filters.contrast}`);
      if (edits.filters.saturation) filters.push(`eq=saturation=${edits.filters.saturation}`);
      if (edits.filters.gamma) filters.push(`eq=gamma=${edits.filters.gamma}`);
    }

    if (filters.length > 0) {
      command = command.videoFilters(filters.join(','));
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Manual video editing failed', { error: error.message, videoPath, edits });
    throw error;
  }
}

/**
 * Add background music to video
 */
async function addBackgroundMusic(videoPath, musicPath, options = {}) {
  try {
    const outputPath = videoPath.replace('.mp4', '_with_music.mp4');

    const {
      volume = 0.3, // Background music volume (0-1)
      fadeIn = 0,
      fadeOut = 0,
      loop = true,
      startTime = 0 // When to start music in video
    } = options;

    let command = ffmpeg(videoPath);

    // Add audio input
    command = command.input(musicPath);

    // Mix audio
    const audioFilters = [];

    // Set background music volume
    audioFilters.push(`volume=${volume}`);

    // Add fade effects
    if (fadeIn > 0) audioFilters.push(`afade=t=in:ss=0:d=${fadeIn}`);
    if (fadeOut > 0) audioFilters.push(`afade=t=out:st=${fadeOut - 2}:d=2`);

    // Combine filters
    if (audioFilters.length > 0) {
      command = command.audioFilters(audioFilters.join(','));
    }

    // Mix original audio with background music
    command = command.audioFilters('amix=inputs=2:duration=first');

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .outputOptions('-c:v copy') // Copy video codec
        .outputOptions('-c:a aac') // Encode audio
        .outputOptions('-shortest') // End when shortest input ends
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Background music addition failed', { error: error.message, videoPath, musicPath });
    throw error;
  }
}

/**
 * Add image overlays to video
 */
async function addImageOverlay(videoPath, imageConfigs) {
  try {
    const outputPath = videoPath.replace('.mp4', '_with_images.mp4');
    let command = ffmpeg(videoPath);

    const imageFilters = imageConfigs.map((config, index) => {
      const {
        imagePath,
        x = 10,
        y = 10,
        width = 100,
        height = 100,
        start = 0,
        end,
        opacity = 1,
        rotation = 0
      } = config;

      // Scale and position image overlay
      let filter = `[${index + 1}:v]scale=${width}:${height}`;

      if (rotation !== 0) {
        filter += `,rotate=${rotation}*PI/180`;
      }

      filter += `,format=rgba,colorchannelmixer=aa=${opacity}`;

      // Add to main video
      filter += `[img${index}];[0:v][img${index}]overlay=${x}:${y}`;

      // Add timing
      if (start > 0 || end) {
        const enableCondition = end ?
          `between(t,${start},${end})` :
          `gte(t,${start})`;
        filter += `:enable='${enableCondition}'`;
      }

      return filter;
    });

    // Add input images
    imageConfigs.forEach(config => {
      command = command.input(config.imagePath);
    });

    if (imageFilters.length > 0) {
      command = command.complexFilter(imageFilters.join(';'));
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Image overlay addition failed', { error: error.message, videoPath, imageConfigs });
    throw error;
  }
}

/**
 * Apply advanced text overlays with custom styling
 */
async function addTextOverlay(videoPath, textConfigs) {
  try {
    const outputPath = videoPath.replace('.mp4', '_with_text.mp4');
    let command = ffmpeg(videoPath);

    const textFilters = textConfigs.map((config, index) => {
      const {
        text,
        x = 10,
        y = 10,
        fontsize = 24,
        fontcolor = 'white',
        fontfile, // Path to TTF font file
        box = 0,
        boxcolor = 'black@0.5',
        start = 0,
        end
      } = config;

      let filter = `drawtext=text='${text.replace(/'/g, "\\'")}':x=${x}:y=${y}:fontsize=${fontsize}:fontcolor=${fontcolor}`;

      if (fontfile) filter += `:fontfile=${fontfile}`;
      if (box) filter += `:box=${box}:boxcolor=${boxcolor}`;
      if (start > 0) filter += `:enable='between(t,${start},${end || 'inf'})'`;

      return filter;
    });

    if (textFilters.length > 0) {
      command = command.videoFilters(textFilters.join(','));
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Text overlay addition failed', { error: error.message, videoPath, textConfigs });
    throw error;
  }
}

/**
 * Create custom video layouts with multiple elements
 */
async function createCustomLayout(inputs, layout, outputPath) {
  try {
    let command = ffmpeg();

    // Add all input files
    inputs.forEach(input => {
      command = command.input(input.path);
    });

    // Apply layout filter
    const layoutFilters = [];

    switch (layout.type) {
      case 'picture-in-picture':
        const pipX = layout.pipX || '(W-w)/2';
        const pipY = layout.pipY || '(H-h)/2';
        const pipW = layout.pipW || 'W/3';
        const pipH = layout.pipH || 'H/3';
        layoutFilters.push(`[1:v]scale=${pipW}:${pipH}[pip];[0:v][pip]overlay=${pipX}:${pipY}`);
        break;

      case 'side-by-side':
        layoutFilters.push('[0:v]pad=2*W:H[bg];[bg][1:v]overlay=W/2:0');
        break;

      case 'grid':
        const gridSize = Math.ceil(Math.sqrt(inputs.length));
        // Complex grid layout logic would go here
        break;

      default:
        // Default to overlay first input on second
        layoutFilters.push('[0:v][1:v]overlay=10:10');
    }

    if (layoutFilters.length > 0) {
      command = command.complexFilter(layoutFilters);
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Custom layout creation failed', { error: error.message, inputs, layout });
    throw error;
  }
}

/**
 * Apply advanced caption styling
 */
async function applyAdvancedCaptions(videoPath, captions, styleConfig) {
  try {
    const outputPath = videoPath.replace('.mp4', '_with_captions.mp4');

    const {
      fontSize = 24,
      fontColor = 'white',
      fontFamily = 'Arial',
      backgroundColor = 'black@0.5',
      outlineColor = 'black',
      outlineWidth = 2,
      position = 'bottom',
      margin = 20
    } = styleConfig;

    let yPosition;
    switch (position) {
      case 'top': yPosition = margin; break;
      case 'center': yPosition = '(h-text_h)/2'; break;
      case 'bottom': default: yPosition = `h-text_h-${margin}`; break;
    }

    const captionFilters = captions.map(caption => {
      const { text, startTime, endTime } = caption;
      const escapedText = text.replace(/'/g, "\\'").replace(/:/g, '\\:');

      return `drawtext=text='${escapedText}':x=(w-text_w)/2:y=${yPosition}:fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${backgroundColor}:outline=${outlineColor}:outline_width=${outlineWidth}:enable='between(t,${startTime},${endTime})'`;
    });

    let command = ffmpeg(videoPath);

    if (captionFilters.length > 0) {
      command = command.videoFilters(captionFilters.join(','));
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Advanced caption styling failed', { error: error.message, videoPath, captions });
    throw error;
  }
}

/**
 * Get available fonts for text overlays
 */
async function getAvailableFonts() {
  // This would typically scan system fonts directory
  // For now, return common web-safe fonts
  return [
    'Arial',
    'Helvetica',
    'Verdana',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Impact',
    'Comic Sans MS',
    'Trebuchet MS',
    'Lucida Console'
  ];
}

/**
 * Process custom uploaded music
 */
async function processCustomMusic(musicFilePath, options = {}) {
  try {
    const {
      normalize = true,
      fadeIn = 0,
      fadeOut = 0,
      targetDuration = null
    } = options;

    const outputPath = musicFilePath.replace(/\.[^/.]+$/, '_processed.mp3');
    let command = ffmpeg(musicFilePath);

    const filters = [];

    // Normalize audio levels
    if (normalize) {
      filters.push('loudnorm');
    }

    // Add fade effects
    if (fadeIn > 0) {
      filters.push(`afade=t=in:ss=0:d=${fadeIn}`);
    }

    // Loop or trim to target duration
    if (targetDuration) {
      // For now, just trim to duration
      command = command.setDuration(targetDuration);
    }

    if (filters.length > 0) {
      command = command.audioFilters(filters.join(','));
    }

    return new Promise((resolve, reject) => {
      command
        .output(outputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });

  } catch (error) {
    logger.error('Custom music processing failed', { error: error.message, musicFilePath });
    throw error;
  }
}

/**
 * Get available sticker packs
 */
async function getAvailableStickers() {
  try {
    // This would typically return sticker categories and items
    return {
      categories: [
        {
          id: 'emojis',
          name: 'Emojis',
          stickers: [
            { id: 'smile', name: '😊', url: '/stickers/emojis/smile.png' },
            { id: 'heart', name: '❤️', url: '/stickers/emojis/heart.png' },
            { id: 'thumbs_up', name: '👍', url: '/stickers/emojis/thumbs_up.png' },
            { id: 'fire', name: '🔥', url: '/stickers/emojis/fire.png' },
            { id: 'star', name: '⭐', url: '/stickers/emojis/star.png' }
          ]
        },
        {
          id: 'decorative',
          name: 'Decorative',
          stickers: [
            { id: 'sparkles', name: '✨', url: '/stickers/decorative/sparkles.png' },
            { id: 'rainbow', name: '🌈', url: '/stickers/decorative/rainbow.png' },
            { id: 'butterfly', name: '🦋', url: '/stickers/decorative/butterfly.png' },
            { id: 'flower', name: '🌸', url: '/stickers/decorative/flower.png' },
            { id: 'crown', name: '👑', url: '/stickers/decorative/crown.png' }
          ]
        },
        {
          id: 'social',
          name: 'Social Media',
          stickers: [
            { id: 'like', name: 'Like', url: '/stickers/social/like.png' },
            { id: 'subscribe', name: 'Subscribe', url: '/stickers/social/subscribe.png' },
            { id: 'follow', name: 'Follow', url: '/stickers/social/follow.png' },
            { id: 'share', name: 'Share', url: '/stickers/social/share.png' },
            { id: 'comment', name: '💬', url: '/stickers/social/comment.png' }
          ]
        }
      ]
    };
  } catch (error) {
    logger.error('Failed to get available stickers', { error: error.message });
    throw error;
  }
}

/**
 * Get available music tracks for background
 */
async function getAvailableMusicTracks(userId) {
  try {
    // This would query user's music library
    // For now, return sample tracks
    return [
      { id: '1', name: 'Upbeat Electronic', duration: 180, genre: 'Electronic', url: '/music/electronic_upbeat.mp3' },
      { id: '2', name: 'Corporate Background', duration: 240, genre: 'Corporate', url: '/music/corporate_background.mp3' },
      { id: '3', name: 'Energetic Pop', duration: 200, genre: 'Pop', url: '/music/pop_energetic.mp3' },
      { id: '4', name: 'Calm Ambient', duration: 300, genre: 'Ambient', url: '/music/ambient_calm.mp3' },
      { id: '5', name: 'Motivational', duration: 220, genre: 'Motivational', url: '/music/motivational.mp3' }
    ];
  } catch (error) {
    logger.error('Failed to get available music tracks', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's uploaded custom assets
 */
async function getUserCustomAssets(userId) {
  try {
    // This would query user's uploaded music, images, etc.
    return {
      music: [
        // User's uploaded music would be here
      ],
      images: [
        // User's uploaded images would be here
      ],
      stickers: [
        // User's custom stickers would be here
      ]
    };
  } catch (error) {
    logger.error('Failed to get user custom assets', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  applyManualEdits,
  addBackgroundMusic,
  addImageOverlay,
  addTextOverlay,
  createCustomLayout,
  applyAdvancedCaptions,
  processCustomMusic,
  getAvailableFonts,
  getAvailableMusicTracks,
  getAvailableStickers,
  getUserCustomAssets
};

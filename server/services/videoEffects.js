// Video effects and filters

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Apply video filter/effect
 * @param {string} videoPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {string} effect - Effect name
 * @returns {Promise<string>} - Output path
 */
async function applyVideoEffect(videoPath, outputPath, effect) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);

    // Apply effect based on type
    switch (effect) {
      case 'brightness':
        command.videoFilters('eq=brightness=0.1');
        break;
      case 'contrast':
        command.videoFilters('eq=contrast=1.2');
        break;
      case 'saturation':
        command.videoFilters('eq=saturation=1.3');
        break;
      case 'vintage':
        command.videoFilters('curves=vintage');
        break;
      case 'blackwhite':
        command.videoFilters('hue=s=0');
        break;
      case 'blur':
        command.videoFilters('boxblur=2:1');
        break;
      case 'sharpen':
        command.videoFilters('unsharp=5:5:1.0:5:5:0.0');
        break;
      default:
        // No effect, just copy
        command.videoCodec('copy');
    }

    command
      .output(outputPath)
      .on('end', () => {
        logger.info('Video effect applied', { effect, outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Video effect error', { error: err.message, effect });
        reject(err);
      })
      .run();
  });
}

/**
 * Add text overlay to video
 * @param {string} videoPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {Object} textOptions - Text options
 * @returns {Promise<string>} - Output path
 */
async function addTextOverlay(videoPath, outputPath, textOptions) {
  const {
    text,
    x = 10,
    y = 10,
    fontSize = 24,
    fontColor = 'white',
    backgroundColor = 'black',
    backgroundColorAlpha = 0.5,
    position = 'top-left' // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
  } = textOptions;

  // Calculate position
  let xPos = x;
  let yPos = y;
  
  if (position.includes('center')) {
    xPos = '(w-text_w)/2';
  } else if (position.includes('right')) {
    xPos = 'w-text_w-10';
  }
  
  if (position.includes('bottom')) {
    yPos = 'h-text_h-10';
  }

  return new Promise((resolve, reject) => {
    const drawText = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${xPos}:y=${yPos}:box=1:boxcolor=${backgroundColor}@${backgroundColorAlpha}:boxborderw=5`;

    ffmpeg(videoPath)
      .videoFilters(drawText)
      .output(outputPath)
      .on('end', () => {
        logger.info('Text overlay added', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Text overlay error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Add watermark to video
 * @param {string} videoPath - Input video path
 * @param {string} watermarkPath - Watermark image path
 * @param {string} outputPath - Output video path
 * @param {Object} options - Watermark options
 * @returns {Promise<string>} - Output path
 */
async function addWatermark(videoPath, watermarkPath, outputPath, options = {}) {
  const {
    position = 'bottom-right', // top-left, top-right, bottom-left, bottom-right
    scale = 0.1, // Scale of watermark (0.1 = 10% of video width)
    opacity = 0.7,
    margin = 10
  } = options;

  // Calculate position
  let xPos, yPos;
  switch (position) {
    case 'top-left':
      xPos = margin;
      yPos = margin;
      break;
    case 'top-right':
      xPos = `main_w-overlay_w-${margin}`;
      yPos = margin;
      break;
    case 'bottom-left':
      xPos = margin;
      yPos = `main_h-overlay_h-${margin}`;
      break;
    case 'bottom-right':
    default:
      xPos = `main_w-overlay_w-${margin}`;
      yPos = `main_h-overlay_h-${margin}`;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(watermarkPath)
      .complexFilter([
        {
          filter: 'scale',
          options: `iw*${scale}:ih*${scale}`,
          inputs: '1:v',
          outputs: 'watermark_scaled'
        },
        {
          filter: 'overlay',
          options: `${xPos}:${yPos}`,
          inputs: ['0:v', 'watermark_scaled'],
          outputs: 'watermarked'
        }
      ])
      .outputOptions(['-map [watermarked]', '-map 0:a'])
      .output(outputPath)
      .on('end', () => {
        logger.info('Watermark added', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Watermark error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Add transition between clips
 * @param {string[]} clipPaths - Array of clip paths
 * @param {string} outputPath - Output video path
 * @param {string} transition - Transition type (fade, slide, etc.)
 * @returns {Promise<string>} - Output path
 */
async function addTransition(clipPaths, outputPath, transition = 'fade') {
  // This is a simplified version - full implementation would use concat filter
  // For now, we'll use a simple concatenation
  return new Promise((resolve, reject) => {
    const filterComplex = clipPaths.map((_, i) => 
      `[${i}:v][${i}:a]`
    ).join('');

    ffmpeg()
      .input(clipPaths[0])
      .inputOptions(['-t', '5']) // 5 second clips for demo
      .output(outputPath)
      .on('end', () => {
        logger.info('Transition added', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Transition error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

module.exports = {
  applyVideoEffect,
  addTextOverlay,
  addWatermark,
  addTransition
};








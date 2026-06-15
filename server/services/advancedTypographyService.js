// Advanced Typography & Text Tools Service
// Features: Animations, Templates, Fonts, Effects, Motion, Auto-Captions, TTS, Timing, Backgrounds

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { escapeDrawtext, safeColor, safeFontPath, safeExpr, safeNum } = require('../utils/ffmpegSafe');

/**
 * Apply animated text overlay
 */
async function applyAnimatedText(videoPath, outputPath, textOverlay) {
  return new Promise((resolve, reject) => {
    const { text, font = {}, style = {}, animation, position = {}, startTime, endTime } = textOverlay;
    const sT = safeNum(startTime, 0, 0, 1e6);
    const eT = safeNum(endTime, sT + 5, 0, 1e6);

    // Build base text filter. drawtext is an injection surface, so user text is
    // escaped, colors whitelisted, paths/expressions sanitized, numbers coerced.
    let xPos = safeExpr(position.x, '(w-text_w)/2');
    let yPos = safeExpr(position.y, 'h-th-50');

    if (position === 'top') yPos = '50';
    else if (position === 'center') yPos = '(h-text_h)/2';
    else if (position === 'bottom') yPos = 'h-th-50';

    let textFilter = `drawtext=text='${escapeDrawtext(text)}'`;
    const fontFile = safeFontPath(font.family);
    if (fontFile) textFilter += `:fontfile='${fontFile}'`;
    textFilter += `:fontsize=${safeNum(font.size, 42, 1, 2000)}`;
    textFilter += `:fontcolor=${safeColor(style.color, 'white')}`;
    textFilter += `:x=${xPos}:y=${yPos}`;

    // Add stroke
    if (style.stroke) {
      textFilter += `:borderw=${safeNum(style.stroke.width, 2, 0, 100)}:bordercolor=${safeColor(style.stroke.color, 'black')}`;
    }

    // Add shadow
    if (style.shadow) {
      textFilter += `:shadowx=${safeNum(style.shadow.x, 2, -100, 100)}:shadowy=${safeNum(style.shadow.y, 2, -100, 100)}:shadowcolor=${safeColor(style.shadow.color, 'black')}`;
    }

    // Add background
    if (style.background && style.background.type !== 'none') {
      if (style.background.type === 'solid') {
        textFilter += `:box=1:boxcolor=${safeColor(style.background.color, 'black')}@${safeNum(style.background.opacity, 0.7, 0, 1)}:boxborderw=5`;
      } else if (style.background.type === 'blur') {
        // Blur background (simplified)
        textFilter += `:box=1:boxcolor=black@0.5:boxborderw=5`;
      }
    }
    
    // Add animation. Times are coerced numbers (sT/eT/dur), so these built
    // expressions are numeric-only and not injectable.
    const dur = safeNum(animation && animation.duration, 1, 0.01, 1e6);
    if (animation && animation.type) {
      switch (animation.type) {
      case 'fade':
        textFilter += `:enable='between(t,${sT},${eT})':alpha='if(lt(t,${sT + dur}), (t-${sT})/${dur}, if(gt(t,${eT - dur}), (${eT}-t)/${dur}, 1))'`;
        break;
      case 'slide':
        textFilter += `:enable='between(t,${sT},${eT})':x='if(lt(t,${sT + dur}), w+(t-${sT})*w/${dur}, (w-text_w)/2)'`;
        break;
      case 'typewriter':
        // Simplified typewriter effect
        textFilter += `:enable='between(t,${sT},${eT})'`;
        break;
      case 'zoom':
        textFilter += `:enable='between(t,${sT},${eT})'`;
        break;
      }
    } else {
      textFilter += `:enable='between(t,${sT},${eT})'`;
    }

    ffmpeg(videoPath)
      .videoFilters(textFilter)
      .output(outputPath)
      .on('end', () => {
        logger.info('Animated text applied', { outputPath, text: String(text || '').substring(0, 20) });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Apply text template
 */
async function applyTextTemplate(videoPath, outputPath, template) {
  const templates = {
    'title-card': {
      text: template.text || 'Title',
      font: { family: 'Arial', size: 72, weight: 'bold' },
      style: {
        color: '#FFFFFF',
        stroke: { width: 3, color: '#000000' },
        shadow: { x: 4, y: 4, blur: 8, color: '#000000' },
        background: { type: 'solid', color: 'black', opacity: 0.7 }
      },
      position: 'center',
      animation: { type: 'fade', duration: 1 }
    },
    'lower-third': {
      text: template.text || 'Name',
      font: { family: 'Arial', size: 36, weight: 'bold' },
      style: {
        color: '#FFFFFF',
        background: { type: 'solid', color: '#000000', opacity: 0.8 }
      },
      position: 'bottom-left',
      animation: { type: 'slide', duration: 0.5 }
    },
    'end-card': {
      text: template.text || 'Thanks for watching!',
      font: { family: 'Arial', size: 48, weight: 'bold' },
      style: {
        color: '#FFFFFF',
        stroke: { width: 2, color: '#000000' }
      },
      position: 'center',
      animation: { type: 'fade', duration: 1 }
    },
    'tiktok-style': {
      text: template.text || 'Caption',
      font: { family: 'Arial', size: 42, weight: 'bold' },
      style: {
        color: '#FFFFFF',
        stroke: { width: 4, color: '#000000' }
      },
      position: 'bottom',
      animation: { type: 'fade', duration: 0.3 }
    },
    'youtube-style': {
      text: template.text || 'Subscribe',
      font: { family: 'Arial', size: 32, weight: 'normal' },
      style: {
        color: '#FFFFFF',
        background: { type: 'solid', color: '#FF0000', opacity: 0.9 }
      },
      position: 'bottom-right',
      animation: { type: 'slide', duration: 0.5 }
    }
  };
  
  const templateConfig = templates[template.type] || templates['title-card'];
  templateConfig.text = template.text || templateConfig.text;
  templateConfig.startTime = template.startTime || 0;
  templateConfig.endTime = template.endTime || 5;
  
  return applyAnimatedText(videoPath, outputPath, templateConfig);
}

/**
 * Generate auto-captions with styling
 */
async function generateAutoCaptions(videoPath, transcript, outputPath, options = {}) {
  const { style = 'modern', language = 'en' } = options;
  
  // Import caption service
  const captionService = require('./videoCaptionService');
  
  try {
    // Generate captions
    const captions = await captionService.generateAutoCaptions(null, {
      language,
      transcript,
      style,
      position: 'bottom'
    });
    
    // Apply styled captions to video
    let currentPath = videoPath;
    const tempFiles = [];
    
    for (let i = 0; i < captions.captions.length; i++) {
      const caption = captions.captions[i];
      const tempPath = i === captions.captions.length - 1 
        ? outputPath 
        : path.join(path.dirname(outputPath), `temp-caption-${i}.mp4`);
      
      if (i > 0) tempFiles.push(currentPath);
      
      await applyAnimatedText(currentPath, tempPath, {
        text: caption.text,
        font: { family: 'Arial', size: 42 },
        style: {
          color: '#FFFFFF',
          background: { type: 'solid', color: 'black', opacity: 0.75 },
          stroke: { width: 1, color: '#000000' }
        },
        position: 'bottom',
        startTime: caption.startTime,
        endTime: caption.endTime
      });
      
      currentPath = tempPath;
    }
    
    // Clean up temp files
    tempFiles.forEach(file => {
      if (fs.existsSync(file) && file !== outputPath) {
        fs.unlinkSync(file);
      }
    });
    
    logger.info('Auto-captions generated and applied', { outputPath, captionCount: captions.captions.length });
    return outputPath;
  } catch (error) {
    logger.error('Auto-caption generation error', { error: error.message });
    throw error;
  }
}

/**
 * Apply multiple text overlays
 */
async function applyMultipleTextOverlays(videoPath, outputPath, textOverlays) {
  let currentPath = videoPath;
  const tempFiles = [];
  
  for (let i = 0; i < textOverlays.length; i++) {
    const overlay = textOverlays[i];
    const tempPath = i === textOverlays.length - 1 
      ? outputPath 
      : path.join(path.dirname(outputPath), `temp-text-${i}.mp4`);
    
    if (i > 0) tempFiles.push(currentPath);
    
    await applyAnimatedText(currentPath, tempPath, overlay);
    currentPath = tempPath;
  }
  
  // Clean up temp files
  tempFiles.forEach(file => {
    if (fs.existsSync(file) && file !== outputPath) {
      fs.unlinkSync(file);
    }
  });
  
  return outputPath;
}

/**
 * Get text templates
 */
function getTextTemplates() {
  return {
    'title-card': {
      name: 'Title Card',
      description: 'Large centered title',
      preview: 'Title Card Preview'
    },
    'lower-third': {
      name: 'Lower Third',
      description: 'Name/title overlay at bottom',
      preview: 'Lower Third Preview'
    },
    'end-card': {
      name: 'End Card',
      description: 'Closing message',
      preview: 'End Card Preview'
    },
    'tiktok-style': {
      name: 'TikTok Style',
      description: 'Bold captions for TikTok',
      preview: 'TikTok Style Preview'
    },
    'youtube-style': {
      name: 'YouTube Style',
      description: 'Professional YouTube captions',
      preview: 'YouTube Style Preview'
    },
    'instagram-style': {
      name: 'Instagram Style',
      description: 'Clean Instagram captions',
      preview: 'Instagram Style Preview'
    }
  };
}

module.exports = {
  applyAnimatedText,
  applyTextTemplate,
  generateAutoCaptions,
  applyMultipleTextOverlays,
  getTextTemplates,
};

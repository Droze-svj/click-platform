/**
 * server/services/sovereignToolboxService.js
 * Toolbox: ten one-click editing tools, each run by an existing service.
 */

const logger = require('../utils/logger');
const aiVideoEditingService = require('./aiVideoEditingService');
const openShortsService = require('./openShortsService');
const videoCaptionService = require('./videoCaptionService');
const creativeToolsService = require('./creativeToolsService');
const visualSynthesisService = require('./visualSynthesisService');
const audioService = require('./audioService');

class SovereignToolboxService {
  constructor() {
    // Plain names and descriptions. These used to be other companies' product
    // names ("Opus Sovereign", "Descript V3"…) with invented "upgrade" claims.
    this.tools = [
      { id: 'silence-removal', name: 'Silence removal', description: 'Finds the pauses and dead air in a video so they can be cut.' },
      { id: 'viral-clips', name: 'Short clips from long videos', description: 'Turns a long video into several short, vertical clips.' },
      { id: 'auto-cut', name: 'Auto-cut', description: 'Finds silences and scene changes to suggest cut points.' },
      { id: 'bg-swap', name: 'Background swap', description: 'Removes the background behind you and replaces it.' },
      { id: 'blog-to-video', name: 'Article to video', description: 'Turns a blog post or web page into a short video script.' },
      { id: 'auto-captions', name: 'Auto captions', description: 'Adds word-by-word captions synced to speech.' },
      { id: 'text-editor', name: 'Edit by transcript', description: 'Cut the video by deleting words from its transcript.' },
      { id: 'ai-avatar', name: 'Eye-contact fix', description: 'Adjusts your gaze so you look at the camera while reading a script.' },
      { id: 'cinematic-3d', name: 'Cinematic look', description: 'Applies a stylised colour and depth look to footage.' },
      { id: 'script-to-video', name: 'Script to video', description: 'Builds a video draft from a written script.' },
    ];
  }

  getTools() {
    return this.tools;
  }

  async executeTool(toolId, videoId, options, userId) {
    logger.info(`[Toolbox] Executing tool: ${toolId}`, { videoId, userId });

    options = options || {};
    const need = (cond, what) => {
      if (!cond) { const e = new Error(`${what} is required for ${toolId}`); e.statusCode = 400; throw e; }
    };
    switch (toolId) {
    case 'silence-removal':
      need(options.path, 'options.path');
      return await aiVideoEditingService.detectSilencePeriods(options.path, options.threshold, options.minDuration);
      
    case 'viral-clips':
      need(options.topic, 'options.topic');
      return await openShortsService.generateShortContent(userId, options.topic, options.niche);

    case 'auto-captions':
      // Service method is generateAutoCaptions (generateCaptions never existed →
      // the auto-captions toolbox tool 500'd). Same (videoId, options) signature.
      return await videoCaptionService.generateAutoCaptions(videoId, options);

    case 'bg-swap':
      need(videoId, 'videoId');
      need(options.backgroundUrl || options.blurAmount, 'options.backgroundUrl or options.blurAmount');
      return await creativeToolsService.swapBackground(videoId, options.backgroundUrl, options.blurAmount, userId);

    case 'ai-avatar':
      return await creativeToolsService.generateAiAvatar(videoId, options, userId);

    case 'cinematic-3d':
      return await visualSynthesisService.initializeSynthesis(`synth-${videoId}`, options.prompt, options);

    default: {
      // Not wired to anything. This used to answer success ("upgrade
      // initialized… Processing via Click Neural Hub") while doing nothing.
      const e = new Error(`${toolId} isn't available from the toolbox yet — use it from the video editor.`);
      e.statusCode = this.tools.some((t) => t.id === toolId) ? 501 : 400;
      throw e;
    }
    }
  }
}

module.exports = new SovereignToolboxService();

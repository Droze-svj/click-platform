const { aiCallJson } = require('../utils/aiRouter');
const logger = require('../utils/logger');
const { getActiveBlueprint } = require('./continuousLearningService');
const { renderFromEditorState } = require('./videoRenderService');
const { getClickPersonalityRules } = require('./marketingKnowledge');
const Content = require('../models/Content');
const SuggestionHistory = require('../models/SuggestionHistory');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * OpenShorts Service - The "Sovereign" AI Video Engine
 * Inspired by OpenShorts philosophy: Pure AI Orchestration via Gemini.
 */

async function generateShortContent(userId, topic, niche, opts = {}) {
  try {
    // 1. Get the latest learning blueprint for this user
    const blueprint = await getActiveBlueprint(userId);
    
    // 2. Anti-Repetition: Fetch recent themes for this user
    const recentHistory = await SuggestionHistory.find({ 
      userId, 
      kind: 'openshorts-synthesis' 
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    const avoidedThemes = recentHistory.map(h => h.label).join(', ');
    
    // 2. Fetch Brand Voice for Multi-Modal Injection
    const UserStyleProfile = require('../models/UserStyleProfile');
    const profile = await UserStyleProfile.findOne({ userId });
    const brandVoice = profile?.brandVoiceCache || { tone: 'casual', style: 'conversational' };
    
    // 3. Formulate the Sovereign Prompt for Gemini
    const systemPrompt = `You are the OpenShorts Sovereign Brain (V6-Gemini).
    Your task is to generate a complete, high-fidelity short-form video script and A/B Swarm editing manifests.
    
    ${getClickPersonalityRules(userId)}
    
    USER STYLE BLUEPRINT: ${JSON.stringify(blueprint || {})}
    USER BRAND VOICE: Tone: ${brandVoice.tone}, Style: ${brandVoice.style}, Characteristics: ${brandVoice.summary || 'N/A'}
    TOPIC: "${topic}"
    NICHE: "${niche}"
    
    Rules for Sovereign Content:
    - Zero Generic Cliches: No "level up", "game-changer", etc.
    - Pattern Interrupt: The first 3 seconds MUST be disruptive.
    - High Resonance: Use emotional triggers specific to the ${niche} niche.
    - Cinematic Logic: Describe specific VFX (whip-pans, glitch, shakes) tied to the script beats.
    - ANTI-REPETITION: Avoid these recent themes/hooks: ${avoidedThemes || 'None'}.
    - BRAND SYNC: Use the user's specific tone and style characteristics in the script.
    - KINETIC INTENSITY: The user requested ${opts.editIntensity || 'CINEMATIC'} intensity. Adjust VFX, pacing, and color grading accordingly.
    
    Return a JSON manifest with 3 A/B VARIANTS:
    {
      "script": [
        { "text": "...", "startTime": 0, "endTime": 3, "style": "hook", "vfx": "camera-shake" },
        ...
      ],
      "variants": [
        {
          "variantId": "v1",
          "label": "High-Velocity Energy",
          "sovereignManifests": [{ "mode": "neural-gaze-alignment", "zoomFactor": 1.2 }],
          "colorMood": "vibrant",
          "musicStyle": "aggressive-phonk"
        },
        {
          "variantId": "v2",
          "label": "Cinematic Storytelling",
          "sovereignManifests": [{ "mode": "depth-of-field-blur", "blurSigma": 15 }],
          "colorMood": "dark",
          "musicStyle": "cinematic-orchestral"
        },
        {
          "variantId": "v3",
          "label": "Minimalist Professional",
          "sovereignManifests": [],
          "colorMood": "bleach",
          "musicStyle": "lofi-beats"
        }
      ],
      "regionId": "na" | "eu" | "as" | "sa" | "af",
      "metadata": {
        "title": "...",
        "description": "...",
        "hashtags": ["#...", "#..."]
      }
    }`;

    logger.info('Sovereign Node: Ingesting Topic for Synthesis with Brand-DNA', { userId, topic, tone: brandVoice.tone });
    
    const manifest = await aiCallJson(systemPrompt, null, {
      taskType: 'openshorts-synthesis',
      preferredProvider: 'gemini',
      temperature: 0.9
    });

    if (!manifest) throw new Error('Gemini failed to synthesize Sovereign Manifest');

    // 3. Record this synthesis to SuggestionHistory to prevent repetition
    try {
      const topicHash = crypto.createHash('sha256').update(topic + (manifest.metadata?.title || '')).digest('hex');
      await SuggestionHistory.create({
        userId,
        kind: 'openshorts-synthesis',
        payloadHash: topicHash,
        label: topic // We use the topic as the label for easier avoidance in prompts
      });
    } catch (e) {
      logger.warn('Failed to record OpenShorts history', { error: e.message });
    }

    return manifest;
  } catch (error) {
    logger.error('OpenShorts Synthesis Error', { error: error.message });
    throw error;
  }
}

/**
 * Orchestrates the rendering of a Sovereign Short
 */
async function processSovereignShort(userId, manifest, baseVideoUrl = null, variant = null, opts = {}) {
  try {
    logger.info('Sovereign Node: Initializing Kinetic Rendering', { userId, variant: variant?.variantId || 'default' });
    
    // Use variant-specific settings if provided, otherwise fallback to manifest defaults
    const activeSovereignManifests = variant?.sovereignManifests || manifest.sovereignManifests || [];
    const activeColorMood = variant?.colorMood || manifest.colorMood || 'vibrant';
    const activeMusicStyle = variant?.musicStyle || manifest.musicStyle || 'aggressive-phonk';

    // 1. Convert manifest to render options
    const textOverlays = manifest.script.map(s => ({
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
      style: s.style,
      vfx: s.vfx ? [s.vfx] : []
    }));

    // 2. Select LUT based on colorMood
    let lutId = 'none';
    if (activeColorMood === 'vibrant') lutId = 'cinematic';
    else if (activeColorMood === 'bleach') lutId = 'bleach';

    // 3. Setup render options
    const renderOptions = {
      videoUrl: baseVideoUrl || '/templates/base-cinematic.mp4', // Default template if none provided
      videoFilters: {
        lutId,
        vfx: manifest.script.flatMap(s => s.vfx ? [s.vfx] : [])
      },
      textOverlays,
      sovereignManifests: activeSovereignManifests, 
      regionId: manifest.regionId || 'na',         
      exportOptions: {
        width: 1080,
        height: 1920,
        quality: 'best',
        bitrateMbps: 12
      },
      editIntensity: opts.editIntensity || 'CINEMATIC',
      userId
    };

    // 4. Dispatch to Render Service
    const renderResult = await renderFromEditorState(renderOptions);
    
    // 5. Create Content record (or return data for pipeline)
    const contentData = {
      userId,
      title: manifest.metadata.title,
      description: manifest.metadata.description,
      type: 'video',
      platform: 'tiktok',
      status: 'ready',
      originalFile: {
        url: renderResult.url,
        path: renderResult.outputPath
      },
      metadata: {
        hashtags: manifest.metadata.hashtags,
        openshorts: true,
        sovereignManifest: manifest,
        variantId: variant?.variantId || 'default'
      }
    };

    if (!variant) {
      return await Content.create(contentData);
    }
    
    return contentData;
  } catch (error) {
    logger.error('Sovereign Render Error', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateShortContent,
  processSovereignShort
};

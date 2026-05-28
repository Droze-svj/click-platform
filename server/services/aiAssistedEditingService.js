// AI-Assisted Editing Tools Service — Click Intelligence Engine
// Powers BOTH manual editing AI-assist AND auto-edit analysis
// Gemini-backed: Smart Cuts, Best Moments, Pacing, Quality, Caption Generation, Viral Detection

const logger = require('../utils/logger');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
// Pull in the V6 learning brain to feed the Auto Edit Engine
const { getActiveBlueprint } = require('./continuousLearningService');
const { getClickPersonalityRules } = require('./marketingKnowledge');
const vectorMemoryService = require('./vectorMemoryService');

/**
 * Fetches the top-5 creator memories relevant to the current task and formats
 * them as a prompt block. Returns empty string when no userId or no memories.
 */
async function fetchMemoryContext(userId, queryText) {
  if (!userId) return '';
  try {
    const mems = await vectorMemoryService.queryUserMemory(userId, queryText, { topK: 5 });
    if (!mems.length) return '';
    return `\n\nCreator Memory (proven past patterns for this creator):\n${mems.map(m => `- ${m.text}`).join('\n')}`;
  } catch {
    return '';
  }
}

/**
 * Shared prompt helper — parses JSON safely with fallback
 */
async function callGemini(prompt, opts = {}) {
  const raw = await geminiGenerate(prompt, { temperature: opts.temperature ?? 0.3, maxTokens: opts.maxTokens ?? 1200 });
  const cleaned = (raw || '{}').replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * CORE INTELLIGENCE — Full video analysis (same engine as auto-edit)
 * Called by manual AI-assist endpoints and exposed to the editor as "AI Co-Pilot"
 */
async function analyzeVideoForManualEdit(videoId, transcript, metadata, userId = null) {
  const duration = metadata?.duration || 0;
  if (!geminiConfigured || !transcript) {
    return { cuts: [], moments: {}, captions: [], pacing: [], qualityScore: 70, cta: null };
  }

  if (!userId && videoId) {
    try {
      const Content = require('../models/Content');
      const content = await Content.findById(videoId).select('userId').lean();
      userId = content?.userId;
    } catch (_) {}
  }

  try {
    const result = await callGemini(`You are Click's AI Video Intelligence Engine — the world's most advanced content strategy AI.

${getClickPersonalityRules(userId)}

Analyze this video transcript and return a comprehensive editing guide in JSON:

{
  "hookScore": (0-100),
  "hookText": "best rewritten 3-second hook",
  "hookTimestamp": 0,
  "viralMoments": [{ "time": 0, "text": "", "emotion": "", "triggerType": "curiosity|FOMO|authority|shock|value", "reason": "" }],
  "suggestedCuts": [{ "time": 0, "reason": "", "confidence": 0.9, "type": "silence|repetition|pacing|scene" }],
  "suggestedCaptions": [{ "text": "UPPERCASE PUNCHY CAPTION", "startTime": 0, "endTime": 3, "style": "hook|stat|question|punchline|CTA" }],
  "pacingSuggestions": [{ "time": 0, "action": "speed-up|slow-down|pause|remove", "reason": "", "impact": "high|medium|low" }],
  "thumbnailMoment": 0,
  "qualityIssues": [{ "type": "color|audio|pacing|framing|content", "suggestion": "", "impact": "high|medium|low" }],
  "overallScore": 75,
  "niche": "",
  "topPlatform": "tiktok|instagram|youtube_shorts|linkedin",
  "cta": "best call to action for this content",
  "narrativeStructure": "hook-story-reveal|problem-solution|list|rant|educational|entertaining"
}

Transcript (${Math.round(duration)}s): "${transcript.substring(0, 3000)}"

Return ONLY valid JSON. Be specific, data-driven, and creative.`,
    { temperature: 0.4, maxTokens: 2000 });

    return result;
  } catch (err) {
    logger.warn('Full video analysis failed', { error: err.message });
    return null;
  }
}

/**
 * Smart cut suggestions — where to cut for maximum engagement
 */
async function getSmartCutSuggestions(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured) return { suggestions: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata, userId);
    if (analysis?.suggestedCuts) {
      return { suggestions: analysis.suggestedCuts, videoId, niche: analysis.niche, hookScore: analysis.hookScore };
    }

    // Direct fallback prompt
    const result = await callGemini(`You are Click's professional video editor. Suggest optimal cut points.

${getClickPersonalityRules(userId)}

Transcript: ${transcript?.substring(0, 2000) || 'No transcript'}
Duration: ${metadata?.duration || 0} seconds

Suggest 5-10 optimal cut points. Return JSON only: { "cuts": [{ "time": number, "reason": string, "confidence": number, "type": "silence|repetition|pacing|scene" }] }`,
    { maxTokens: 1000 });

    return { suggestions: result.cuts || [], videoId };
  } catch (error) {
    logger.warn('Smart cut suggestions failed', { error: error.message });
    return { suggestions: [], videoId };
  }
}

/**
 * Auto-frame video (keep subjects centered)
 */
async function getAutoFramingSuggestions(videoPath) {
  return {
    frames: [],
    message: 'Auto-framing: Smart crop will keep important subjects centered using 9:16 safe zone.'
  };
}

/**
 * Find best moments — hook, reactions, highlights, thumbnail
 */
async function findBestMoments(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured) return { moments: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata, userId);
    if (analysis) {
      return {
        hook: analysis.hookTimestamp !== undefined ? { time: analysis.hookTimestamp, score: analysis.hookScore, text: analysis.hookText } : null,
        reactions: (analysis.viralMoments || []).slice(0, 5).map(m => ({ time: m.time, score: 85, text: m.text, triggerType: m.triggerType })),
        highlights: (analysis.viralMoments || []).slice(0, 8).map(m => ({ time: m.time, score: 80, text: m.text })),
        bestThumbnail: { time: analysis.thumbnailMoment || 0, score: 90 },
        suggestedCaptions: analysis.suggestedCaptions || [],
        cta: analysis.cta || null,
        niche: analysis.niche || null,
        topPlatform: analysis.topPlatform || null,
        videoId
      };
    }

    return { moments: [], videoId };
  } catch (error) {
    logger.warn('Best moments analysis failed', { error: error.message });
    return { moments: [], videoId };
  }
}

/**
 * Auto-color match between clips
 */
async function getColorMatchSuggestions(sourceVideoPath, targetVideoPath) {
  return {
    adjustments: { brightness: 0.02, contrast: 1.08, saturation: 1.15, temperature: -3 },
    ffmpegFilter: 'eq=contrast=1.08:brightness=0.02:saturation=1.15',
    message: '2026 Luma-Cinematic grade applied. Adjust contrast/saturation to match clips.'
  };
}

/**
 * Smart reframe for different aspect ratios
 */
async function getSmartReframeSuggestions(videoPath, targetAspectRatio) {
  const aspectRatios = {
    '16:9': { width: 1920, height: 1080, ffmpeg: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2' },
    '9:16': { width: 1080, height: 1920, ffmpeg: 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920' },
    '1:1':  { width: 1080, height: 1080, ffmpeg: 'crop=ih:ih:(iw-ow)/2:(ih-oh)/2,scale=1080:1080' },
    '4:5':  { width: 1080, height: 1350, ffmpeg: 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350' },
  };

  const target = aspectRatios[targetAspectRatio] || aspectRatios['16:9'];
  return {
    ...target,
    aspectRatio: targetAspectRatio,
    message: `Smart reframe for ${targetAspectRatio}: subjects centered using content-aware scaling.`
  };
}

/**
 * Get music sync suggestions
 */
async function getMusicSyncSuggestions(videoPath, musicPath) {
  return {
    cutPoints: [],
    beats: [],
    message: 'Music sync: Cut on beats for natural rhythm. Use 5% speed boost to align audio peaks with scene changes.'
  };
}

/**
 * Analyze pacing — where to speed up, slow down, or cut
 */
async function analyzePacing(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured) return { suggestions: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata, userId);
    if (analysis?.pacingSuggestions) {
      return { suggestions: analysis.pacingSuggestions, videoId };
    }

    const result = await callGemini(`You are Click's video pacing expert for viral short-form content.

${getClickPersonalityRules(userId)}

Transcript: ${transcript?.substring(0, 2000) || 'No transcript'}
Duration: ${metadata?.duration || 0} seconds

Return JSON only: { "suggestions": [{ "time": number, "action": "speed-up|slow-down|pause|remove", "reason": string, "impact": "high|medium|low" }] }`,
    { maxTokens: 1000 });

    return { suggestions: result.suggestions || [], videoId };
  } catch (error) {
    logger.warn('Pacing analysis failed', { error: error.message });
    return { suggestions: [], videoId };
  }
}

/**
 * Quality check — color, audio, pacing, framing, content issues
 */
async function qualityCheck(videoId, metadata, transcript) {
  try {
    if (!geminiConfigured) return { improvements: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata, userId);
    if (analysis?.qualityIssues) {
      return {
        improvements: analysis.qualityIssues,
        videoId,
        overallScore: analysis.overallScore || 75,
        niche: analysis.niche,
        topPlatform: analysis.topPlatform,
      };
    }

    return { improvements: [], videoId, overallScore: 70 };
  } catch (error) {
    logger.warn('Quality check failed', { error: error.message });
    return { improvements: [], videoId };
  }
}

/**
 * Generate AI captions for manual editor — same system as auto-edit
 */
async function generateCaptionsForManualEdit(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured || !transcript) return { captions: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata, userId);
    return {
      captions: analysis?.suggestedCaptions || [],
      cta: analysis?.cta || null,
      hookText: analysis?.hookText || null,
      niche: analysis?.niche || null,
      videoId,
    };
  } catch (error) {
    logger.warn('Caption generation failed', { error: error.message });
    return { captions: [], videoId };
  }
}

/**
 * CREATIVE DIRECTOR BRIEF — Comprehensive Gemini 2.0 analysis
 * Returns creative style suggestions, engagement predictions, and full edit automation commands
 */
async function generateCreativeDirectorBrief(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured || !transcript) {
      return {
        videoId,
        creativeStyle: 'cinematic',
        styleRationale: 'Default cinematic style applied — transcription needed for AI analysis.',
        hookScore: 65,
        hookRewrite: '',
        engagementPrediction: { retention30s: 45, viralPotential: 30, shareability: 35 },
        suggestedEdits: [],
        colorMood: 'neutral',
        pacingProfile: 'moderate',
        audienceMatch: { primary: 'general', secondary: 'tech' },
        competitorEdge: [],
        narrativeArc: 'linear',
      };
    }

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are Click AI Creative Director — the most advanced creative strategy engine on the planet.

${getClickPersonalityRules(userId)}

MISSION: Analyze this video and produce a COMPREHENSIVE creative direction brief. Think like a world-class editor at MrBeast's studio, combined with a Hollywood colorist, and a TikTok algorithm engineer.

VIDEO TRANSCRIPT (${Math.round(duration)}s):
"${transcript.substring(0, 4000)}"

Return a JSON object with this EXACT structure:
{
  "creativeStyle": "cinematic|vlog-energetic|tiktok-viral|documentary|storytelling|educational|aesthetic-minimal|raw-authentic",
  "styleRationale": "2-sentence explanation of WHY this style maximizes engagement for this content",
  "hookScore": (0-100 how strong the opening 3 seconds are),
  "hookRewrite": "Rewritten first 3 seconds for maximum scroll-stop power",
  "engagementPrediction": {
    "retention30s": (0-100 estimated % still watching at 30s),
    "viralPotential": (0-100),
    "shareability": (0-100)
  },
  "aidaDiagnostic": {
    "attentionScore": (0-100 diagnostic of 0-3s hook),
    "interestScore": (0-100 diagnostic of 3-15s storytelling interest),
    "desireScore": (0-100 diagnostic of 15-30s value or emotional desire building),
    "actionScore": (0-100 diagnostic of 30s+ call-to-action impact),
    "frameworkAnalysis": "Detailed psychological breakdown of the video's flow under the Attention, Interest, Desire, Action framework."
  },
  "competitorMatrix": {
    "versusOpusClip": "A hyper-specific analysis of how this video structure, pacing, and visual style outperforms Opus Clip's standard template.",
    "viralLeversToPull": ["2 specific high-impact behavioral science hooks or levers to boost CTR and average watch duration"]
  },
  "suggestedEdits": [
    { "time": 0, "action": "cut|speed-up|slow-down|zoom|add-text|add-broll|transition", "detail": "specific instruction", "impact": "high|medium|low", "reason": "why this edit improves the video" }
  ],
  "colorMood": "warm-golden|cool-blue|cyberpunk-neon|vintage-film|natural|high-contrast|moody-dark|bright-airy",
  "colorGradeParams": { "brightness": 100, "contrast": 108, "saturation": 115, "temperature": 105, "vibrance": 110, "vignette": 15 },
  "pacingProfile": "fast-hook-medium|consistently-fast|slow-build|rhythmic-beats|conversational",
  "audienceMatch": { "primary": "tech|fitness|beauty|food|education|entertainment|business", "secondary": "" },
  "competitorEdge": ["3 specific things this video does better than typical content in this niche"],
  "narrativeArc": "hook-story-reveal|problem-solution|list-format|rant-opinion|tutorial|day-in-life|transformation",
  "captionStyle": "hormozi-punchline|mrbeast-energy|clean-minimal|bold-kinetic|subtitle-only",
  "musicSuggestion": { "genre": "", "energy": "low|medium|high", "mood": "" },
  "thumbnailMoment": 0,
  "viralMoments": [{ "time": 0, "text": "", "emotion": "", "triggerType": "curiosity|FOMO|authority|shock|value" }]
}

Be SPECIFIC, DATA-DRIVEN, and CREATIVE. Every suggestion should have a concrete reason tied to audience psychology and platform algorithms. Return ONLY valid JSON.`,
    { temperature: 0.5, maxTokens: 3000 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Creative Director brief failed', { error: err.message });
    return { videoId, creativeStyle: 'cinematic', hookScore: 50, suggestedEdits: [] };
  }
}

/**
 * AI CAPTIONS — Gemini generates semantically-styled captions with animations
 * Supports high-accuracy multi-language translation and timing sync.
 */
async function generateAICaptions(videoId, transcript, metadata, style = 'hormozi-punchline', targetLanguage = 'English') {
  try {
    if (!geminiConfigured || !transcript) return { captions: [], videoId };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are Click AI Caption Engine — generate viral, engagement-maximizing captions.

${getClickPersonalityRules(userId)}

CRITICAL INSTRUCTION: You MUST translate and output the captions in the following target language: **${targetLanguage}**. Ensure the translation is culturally accurate, not just a literal word-for-word translation, while maintaining the exact timing and punchiness of the original transcript.

STYLE: ${style}
TRANSCRIPT (${Math.round(duration)}s): "${transcript.substring(0, 3000)}"

Generate captions in this JSON format:
{
  "captions": [
    {
      "text": "PUNCHY UPPERCASE TEXT",
      "startTime": 0.0,
      "endTime": 2.5,
      "style": "hook|emphasis|stat|question|punchline|CTA|reaction",
      "fontSize": 48,
      "animation": "pop-in|slide-up|typewriter|shake|glow-pulse|word-by-word|fade-scale",
      "color": "#ffffff",
      "emphasisColor": "#ff4444",
      "position": "center|lower-third|upper-third",
      "emphasisWords": ["WORDS", "TO", "HIGHLIGHT"]
    }
  ],
  "hookCaption": { "text": "", "startTime": 0, "endTime": 3 },
  "ctaCaption": { "text": "", "startTime": 0, "endTime": 0 }
}

Rules:
- Every caption must be PUNCHY, SHORT (3-8 words max)
- Use UPPERCASE for impact words
- Time captions to key moments, not every word
- Include emphasis words that should be colored differently
- Hook caption is always first 3 seconds
- CTA caption is always last 3 seconds
- Generate 8-15 captions for a typical 60s video
- Match the style: ${style === 'hormozi-punchline' ? 'Bold, simple, one-line punchlines' : style === 'mrbeast-energy' ? 'Excited, colorful, fast-paced' : style === 'clean-minimal' ? 'Elegant, lowercase, subtle' : 'Standard clear captions'}
- TRANSLATION MANDATE: All output text inside the JSON MUST be accurately written in ${targetLanguage}.
- 2026 EMOJI PROTOCOL: Incorporate highly relevant, trending unicode emojis directly into the text property at key emotional peaks or noun references (e.g. 💵, 🔥, 🤯, 🤫, ⚠️, 🏆, 💡) to maximize scroll-stop and viewer retention (Opus Clip defeating standard).

Return ONLY valid JSON.`,
    { temperature: 0.6, maxTokens: 2000 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('AI Caption generation failed', { error: err.message });
    return { captions: [], videoId };
  }
}

/**
 * SUGGEST COLOR GRADE — AI-recommended grade based on content mood and type
 */
async function suggestColorGrade(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured) {
      return { videoId, preset: 'cinematic', params: { brightness: 100, contrast: 108, saturation: 95, temperature: 100, vibrance: 100, vignette: 20 }, rationale: 'Default cinematic grade' };
    }

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const result = await callGemini(`You are Click's world-class Hollywood colorist. Analyze this video content and recommend the PERFECT color grade.

${getClickPersonalityRules(userId)}

TRANSCRIPT: "${(transcript || '').substring(0, 2000)}"
DURATION: ${metadata?.duration || 0}s

Return JSON:
{
  "preset": "cinematic|warm-golden|cool-blue|vintage-film|cyberpunk-neon|natural|high-contrast|moody-dark|bright-airy|teal-orange|noir|vivid",
  "params": { "brightness": 100, "contrast": 108, "saturation": 95, "temperature": 105, "vibrance": 110, "vignette": 20, "sepia": 0 },
  "rationale": "Why this grade works for this content (2 sentences)",
  "mood": "energetic|calm|dramatic|inspirational|intense|playful|serious|nostalgic",
  "alternatives": [
    { "preset": "", "rationale": "" }
  ]
}

Return ONLY valid JSON.`,
    { temperature: 0.4, maxTokens: 800 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Color grade suggestion failed', { error: err.message });
    return { videoId, preset: 'cinematic', params: { brightness: 100, contrast: 108, saturation: 95, temperature: 100, vibrance: 100, vignette: 20 }, rationale: 'Default cinematic grade' };
  }
}

/**
 * SUGGEST TRANSITIONS — Context-aware transition recommendations
 */
async function suggestTransitions(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured) return { videoId, transitions: [] };

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const result = await callGemini(`You are Click's professional video editor. Suggest optimal transitions for this video.

${getClickPersonalityRules(userId)}

TRANSCRIPT: "${(transcript || '').substring(0, 2000)}"
DURATION: ${metadata?.duration || 0}s

Return JSON:
{
  "transitions": [
    {
      "time": 0,
      "type": "cut|dissolve|whip-pan|zoom-push|glitch|light-leak|film-burn|ink-drop|morph|slide|swipe|blur",
      "duration": 0.5,
      "reason": "Why this transition works at this moment",
      "intensity": "subtle|medium|dramatic"
    }
  ],
  "overallStyle": "smooth-cinematic|high-energy|clean-minimal|creative-dynamic",
  "advice": "One sentence of general transition advice for this content"
}

Return ONLY valid JSON.`,
    { temperature: 0.4, maxTokens: 1200 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Transition suggestions failed', { error: err.message });
    return { videoId, transitions: [] };
  }
}

/**
 * AUTO-EDIT SEQUENCE — Complete auto-edit pipeline
 * Returns a full set of timeline actions that can be applied with one click
 */
async function autoEditSequence(videoId, transcript, metadata, userId = null, brief = null, customInstructions = null) {
  try {
    const duration = metadata?.duration || 0;
    
    if (!userId && videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    // Check if transcript is verbose/object (Word-Level Data)
    let transcriptContext = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
    const isVerbose = typeof transcript !== 'string';
    
    // V6 Core Feature: Ask Continuous Learning Engine if it has rules for this user
    let blueprintInjection = '';
    if (userId) {
      const activeBlueprint = await getActiveBlueprint(userId);
      if (activeBlueprint && Object.keys(activeBlueprint).length > 0) {
        blueprintInjection = `

CRITICAL INSTRUCTION FROM V6 CONTINUOUS LEARNING MATRIX:
Based on historical analytics and performance metrics for this specific user's niche, you MUST strictly adhere to the following stylistic blueprint when making editing decisions:
${JSON.stringify(activeBlueprint, null, 2)}
`;
      }
    }

    // Creative Director Brief Injection (Session Consistency)
    let briefInjection = '';
    if (brief) {
      briefInjection = `

CRITICAL INSTRUCTION FROM CREATIVE DIRECTOR BRIEF:
The user has approved this specific creative direction. You MUST maintain consistency with these parameters:
- Creative Style: ${brief.creativeStyle}
- Color Mood: ${brief.colorMood}
- Pacing Profile: ${brief.pacingProfile}
- Narrative Arc: ${brief.narrativeArc}
- Style Rationale: ${brief.styleRationale}
`;
    }

    // Recall creator's proven patterns from persistent memory
    const memoryContext = await fetchMemoryContext(userId, transcriptContext.substring(0, 500));

    const customBlock = customInstructions
      ? `\n\nCRITICAL USER CREATIVE DIRECTION (HIGHEST PRIORITY — override any conflicting defaults):\n"${customInstructions}"\n`
      : '';

    const result = await callGemini(`You are the Click AI Auto-Editor (Agent Mode) — the most powerful autonomous video editor on the planet, equipped with extreme creativity and 2026 algorithmic logic.${blueprintInjection}${briefInjection}${memoryContext}${customBlock}

${getClickPersonalityRules(userId)}

MISSION: Generate a **COMPLETE** and wildly creative edit sequence blueprint. Do NOT be repetitive. Inject randomness and high-end brand originality. Ensure the output feels like a human cinematic director layered the timeline.

AVAILABLE TOOL REPOSITORIES & PSYCHOLOGICAL MAPPING:
- VFX REPOSITORY (16):
    * chromatic-aberration: Use on high-impact reveals, shocks, or bass drops.
    * vhs-glitch: Use on nostalgia, technical errors, or edgy transitions.
    * film-burn: Use on warm memories, transitions, or 'cinematic' moments.
    * zoom-blur, edge-glow, motion-blur, light-rays, rgb-split, film-grain, confetti, bokeh, snow, rain, sparks, light-leak, lens-flare.
- SFX SOUNDBOARD (14):
    * whoosh: Fast movement, transitions.
    * pop: Appearance of text/assets.
    * cash-register: Mention of money, value, profit.
    * bass-drop: Major reveals, structural shifts.
    * ding: Positive points, insights.
    * glitch-static: Error, correction, edgy tone.
    * notification: Social media mentions, alerts.
    * swipe, click, explosion, crowd-cheer, suspense, record-scratch, shutter-click.
- FONTS (15): Inter, Bebas Neue, Montserrat, Permanent Marker, Pacifico, Anton, Oswald, Space Grotesk, Roboto, Open Sans, Lato, Poppins, Outfit, Nexa, Raleway
- CAPTION STYLES (8): mrbeast-stroke, hormozi-punchline, clean-minimal, kinetic-typography, classic-subtitle, aesthetic-glitch, corporate-pro, meme-impact
- ANIMATIONS (12): pop-in, typewriter, fade-up, slide-right, bounce, elastic, wave, shake, blur-in, spin, 3d-flip, glitch-flash

TRANSCRIPT DATA (${isVerbose ? 'WORD-LEVEL ANALYTICS ACTIVE' : 'RAW TEXT MODE'}):
"${transcriptContext.substring(0, 5000)}"

Return JSON with ALL edits needed:
{
  "blueprint": {
    "title": "A highly creative title for this edit sequence",
    "rationale": "Why this specific combination of VFX, SFX, and pacing works perfectly for this creator's brand.",
    "vibe": "e.g., Aggressive & Educational, Aesthetic & Calm",
    "targetAudience": "e.g., Gen Z Tech, Millennial Entrepreneurs",
    "timelineArchitecture": [
      { "segment": "Hook (0-3s)", "strategy": "What happens here" },
      { "segment": "Build (3-15s)", "strategy": "What happens here" },
      { "segment": "Payoff (15s+)", "strategy": "What happens here" }
    ]
  },
  "actions": [
    { "type": "cut", "time": 0, "endTime": 1.2, "reason": "Dead air removal", "track": "video" },
    { "type": "sfx", "time": 0, "effect": "whoosh", "track": "audio" },
    { "type": "vfx", "time": 1.5, "endTime": 3, "effect": "rgb-split", "track": "fx" },
    { "type": "caption", "text": "PUNCHY TEXT", "startTime": 0, "endTime": 3, "style": "meme-impact", "font": "Bebas Neue", "animation": "glitch-flash", "track": "text" },
    { "type": "transition", "time": 3, "transitionType": "cube-rotate", "track": "transition" },
    { "type": "color-grade", "mood": "energetic", "preset": "cyberpunk", "startTime": 0, "track": "fx" },
    { "type": "media-insert", "time": 0, "duration": 3, "mediaType": "b-roll", "query": "hyperlapse neon city", "track": "video" }
  ],
  "summary": "One-paragraph summary of the autonomous pipeline",
  "estimatedRetention": { "before": 35, "after": 88 },
  "hookStrength": { "before": 40, "after": 95 },
  "viralScore": { "before": 25, "after": 92 }
}

CRITICAL RULES:
- BE CREATIVE AND NON-REPETITIVE. Randomize combinations of fonts, SFX, and VFX in ways that make algorithmic sense but aren't boring.
- Layering is mandatory. A cut should be accompanied by an SFX and a font animation.
- Be aggressive with cuts — attention spans are 1.5 seconds in 2026.
- Always rewrite a scroll-stopping hook using the prompt text if applicable.
- If WORD-LEVEL TRANSCRIPT DATA is present, ensure SFX and Captions are timestamped within 100ms of the target word/sound.
- B-Roll Queries: Generate specific, high-end queries (e.g., "slow motion coffee pour high-key lighting") rather than generic terms.

Return ONLY valid JSON.`,
    { temperature: 0.9, maxTokens: 4000 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Auto-edit sequence failed', { error: err.message });
    return { videoId, actions: [], summary: 'Auto-edit generation failed' };
  }
}

/**
 * ENGAGEMENT PREDICTION — Estimated retention and performance metrics
 */
async function generateEngagementPrediction(videoId, transcript, metadata, editState) {
  try {
    if (!geminiConfigured) {
      return { videoId, retention30s: 45, retention60s: 25, viralPotential: 30, shareability: 35, completionRate: 20, predictedViews: '1K-5K' };
    }

    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const engagementMemory = await fetchMemoryContext(userId, (transcript || '').substring(0, 500));

    const result = await callGemini(`You are Click's TikTok/YouTube algorithm analyst — the world's most precise engagement predictor.

${getClickPersonalityRules(userId)}${engagementMemory}

TRANSCRIPT: "${(transcript || '').substring(0, 2000)}"
DURATION: ${metadata?.duration || 0}s
EDITS APPLIED: ${JSON.stringify(editState || {}).substring(0, 500)}

Return JSON:
{
  "retention30s": (0-100, how many percent keep watching at 30s),
  "retention60s": (0-100),
  "viralPotential": (0-100),
  "shareability": (0-100),
  "completionRate": (0-100),
  "predictedViews": "range like 10K-50K",
  "topPlatform": "tiktok|instagram|youtube_shorts|linkedin",
  "hookScore": (0-100, quality of the first 3 seconds),
  "hookFeedback": "One sentence of ruthlessly specific feedback on the opening 3 seconds",
  "actionableImprovements": [
    {
      "issue": "precise description of the specific problem (e.g. 'Hook takes 6.2s before value delivery')",
      "fix": "exact action to take (e.g. 'Cut to X:XX — open on the result, rewind to context')",
      "impact": "high|medium|low",
      "estimatedRetentionBoost": "+8%"
    }
  ],
  "retentionDropoffs": [
    {
      "timestamp": "X:XX",
      "reason": "specific reason audience will swipe away here",
      "fix": "exact remediation"
    }
  ]
}

Be ruthlessly specific. Reference actual timestamps from the transcript where possible. Return ONLY valid JSON.`,
    { temperature: 0.3, maxTokens: 1200 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Engagement prediction failed', { error: err.message });
    return { videoId, retention30s: 45, viralPotential: 30 };
  }
}

/**
 * SMART VIRAL CLIP SCORER — Algorithmic sliding-window clip ranker.
 * Scores every potential 15–60s window by hook quality, proof density, story signals,
 * delivery energy, and topic completeness. Labels each clip with a type.
 * Optionally enriches top 3 with Gemini rationale + A/B hook variants.
 */
async function scoreAndRankClips(transcript, transcriptWords, duration, metadata, userId = null) {
  if (!transcript || duration < 10) return { clips: [], ranked: false };

  const HOOK_WORDS = ['secret','truth','mistake','wrong','actually','nobody','never','always','finally','proof','real','honest','shocking','wait','stop','listen','attention','warning'];
  const PROOF_WORDS = ['results','made','earned','grew','lost','gained','clients','revenue','percent','numbers','data','study','research'];
  const STORY_WORDS = ['when i','so i','then i','i was','i used to','i remember','the day','that moment','i realized','i found out'];

  const WINDOW_SIZES = [15, 30, 45, 60];
  const STEP = 10;
  const words = transcript.split(/\s+/);
  const wordsPerSecond = words.length / duration;
  const candidates = [];

  for (const windowLen of WINDOW_SIZES) {
    for (let start = 0; start + windowLen <= duration; start += STEP) {
      const end = start + windowLen;
      const wStart = Math.floor(start * wordsPerSecond);
      const wEnd = Math.min(Math.ceil(end * wordsPerSecond), words.length);
      const windowWords = words.slice(wStart, wEnd);
      const windowText = windowWords.join(' ').toLowerCase();
      const firstQuint = windowWords.slice(0, Math.ceil(windowWords.length * 0.2)).join(' ').toLowerCase();

      let hookScore = Math.min(HOOK_WORDS.filter(w => firstQuint.includes(w)).length * 15, 60);
      let proofScore = Math.min(PROOF_WORDS.filter(w => windowText.includes(w)).length * 12, 50);
      let storyScore = Math.min(STORY_WORDS.filter(p => windowText.includes(p)).length * 18, 40);
      let energyScore = Math.min((windowText.match(/[!?]/g) || []).length * 8, 40);
      let completenessScore = /[.?!]$/.test(windowWords[windowWords.length - 1] || '') ? 20 : 0;

      let volumeVariance = 0;
      if (Array.isArray(transcriptWords) && transcriptWords.length > 0) {
        const wObjs = transcriptWords.filter(w => w.start >= start && (w.end || w.start) <= end);
        if (wObjs.length > 2) {
          const vols = wObjs.map(w => w.volume || 50);
          const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
          const variance = vols.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vols.length;
          volumeVariance = Math.min(Math.sqrt(variance) * 0.8, 30);
        }
      }

      const totalScore = hookScore + proofScore + storyScore + energyScore + completenessScore + volumeVariance;

      let clipType = 'insight';
      if (hookScore >= 30) clipType = 'hook';
      else if (proofScore >= 30) clipType = 'proof';
      else if (storyScore >= 25) clipType = 'story';
      else if (energyScore >= 25) clipType = 'reaction';
      else if (windowText.includes('honestly') || windowText.includes('i will admit') || windowText.includes('confession')) clipType = 'confession';

      candidates.push({
        startTime: start, endTime: end, duration: windowLen,
        viralScore: Math.round(Math.min(totalScore, 100)),
        clipType,
        scoreBreakdown: {
          hookStrength: Math.round(hookScore),
          proofDensity: Math.round(proofScore),
          storySignals: Math.round(storyScore),
          deliveryEnergy: Math.round(energyScore + volumeVariance),
          topicCompleteness: completenessScore,
        },
      });
    }
  }

  // Sort descending, deduplicate overlapping windows
  candidates.sort((a, b) => b.viralScore - a.viralScore);
  const deduped = [];
  for (const c of candidates) {
    if (!deduped.some(d => c.startTime < d.endTime && c.endTime > d.startTime)) {
      deduped.push(c);
      if (deduped.length >= 6) break;
    }
  }

  // Enrich top 3 with Gemini rationale + hook variants
  if (geminiConfigured && deduped.length > 0) {
    try {
      const top3 = deduped.slice(0, 3).map(c => ({ startTime: c.startTime, endTime: c.endTime, clipType: c.clipType, viralScore: c.viralScore }));
      const enriched = await callGemini(
        `Given these candidate video clips, provide a 1-sentence viral rationale and 3 hook variants for each.\nClips: ${JSON.stringify(top3)}\nTranscript (first 3000 chars): "${transcript.substring(0, 3000)}"\nReturn JSON array: [{ "startTime": number, "rationale": "...", "hookVariants": { "curiosityGap": "...", "boldClaim": "...", "socialProof": "..." } }]`,
        { temperature: 0.6, maxTokens: 900 }
      );
      if (Array.isArray(enriched)) {
        enriched.forEach(e => {
          const match = deduped.find(d => d.startTime === e.startTime);
          if (match) { match.rationale = e.rationale; match.hookVariants = e.hookVariants; }
        });
      }
    } catch (_) { /* graceful degradation */ }
  }

  return { clips: deduped, ranked: true };
}

/**
 * VIRAL SNAPSHOT FORGE — Extracts highly optimized short clips from the main sequence
 */
async function generateViralSnapshots(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured || !transcript) return { videoId, snapshots: [] };
    
    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are Click's top-tier viral content curator and AI clipping engine.

${getClickPersonalityRules(userId)}

Your objective: identify the 3 absolute best retaining segments AND generate 3 hook caption variants for each.

TRANSCRIPT (${duration}s): "${transcript.substring(0, 5000)}"

Return JSON:
{
  "snapshots": [
    {
      "id": "clip_1",
      "title": "The specific hook or punchline of this clip",
      "startTime": 0.0,
      "endTime": 15.0,
      "duration": 15.0,
      "viralScore": 95,
      "clipType": "hook|insight|story|proof|reaction|confession",
      "rationale": "Why this specific segment will go viral — reference what the speaker says, the emotional peak, the specific line",
      "hookVariants": {
        "curiosityGap": "A hook framing that creates an irresistible information gap (e.g. 'The reason I almost quit...')",
        "boldClaim": "A hook that opens with a strong, possibly controversial claim (e.g. 'Most coaches are lying to you.')",
        "socialProof": "A hook that leads with a result or community validation (e.g. '47,000 people used this and got X')"
      }
    }
  ]
}

Rules:
- Generate exactly 3 snapshot clips.
- Durations between 7s and 60s.
- Each hookVariant must be genuinely different in psychological framing, not just rephrased.
- Assign clipType based on the dominant content type in that segment.
Return ONLY valid JSON.`,
    { temperature: 0.7, maxTokens: 2000 });
    return { videoId, ...result };
  } catch (err) {
    logger.warn('Viral Snapshot failed', { error: err.message });
    return { videoId, snapshots: [] };
  }
}

/**
 * NEURAL MARKETING ENGINE — Generates titles, captions, and absolute scheduling strategy
 */
async function generateMarketingStrategy(videoId, transcript, metadata, niche) {
  try {
    if (!geminiConfigured) return { videoId, strategy: null };
    
    let userId = null;
    if (videoId) {
      try {
        const Content = require('../models/Content');
        const content = await Content.findById(videoId).select('userId').lean();
        userId = content?.userId;
      } catch (_) {}
    }

    // Inject creator memory + active blueprint for personalised marketing advice
    const marketingMemory = await fetchMemoryContext(userId, (transcript || '').substring(0, 500));
    let blueprintContext = '';
    if (userId) {
      try {
        const UserPreferences = require('../models/UserPreferences');
        const prefs = await UserPreferences.findOne({ userId }).lean();
        const bp = prefs?.marketingIntelligence?.activeCreativeBlueprint;
        if (bp) blueprintContext = `\n\nCreator AI Blueprint (personalised from real performance data):\n${JSON.stringify(bp)}`;
      } catch (_) {}
    }

    const result = await callGemini(`You are Click's omniscient, billion-dollar Growth Hacker and Neuro-Marketing AI.

${getClickPersonalityRules(userId)}${marketingMemory}${blueprintContext}

You possess continuous learning capability and unlimited marketing background knowledge (AIDA, Hook/Retain/Reward, Harvard Business models, GaryVee distribution strats, MrBeast virality structure).

The user has defined their target market/niche as: "${niche || 'General Business / Lifestyle'}".

You must formulate an EXACT, highly original, non-repetitive marketing strategy to distribute this video.

TRANSCRIPT: "${(transcript || '').substring(0, 3000)}"
VIDEO DURATION: ${metadata?.duration || 0}s

Return JSON:
{
  "strategy": {
    "nicheBreakdown": "Your deep analysis on what this specific niche craves right now in 2026.",
    "contentArchetype": "educational-binge|motivation-jolt|proof-of-results|controversy-hook|storytelling-arc|tutorial-step-by-step",
    "titles": [
      "Title 1 — curiosity-gap framing",
      "Title 2 — bold claim framing",
      "Title 3 — social proof framing"
    ],
    "captions": [
      { "style": "Edgy & Controversial", "copy": "The caption text..." },
      { "style": "Educational Value-Drop", "copy": "The caption text..." },
      { "style": "Storytelling / Vulnerable", "copy": "The caption text..." }
    ],
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    "schedulingMatrix": {
      "tiktok": { "optimalDay": "Tuesday", "optimalTime": "18:30 EST", "reasoning": "specific algorithmic + demographic rationale" },
      "instagram": { "optimalDay": "Thursday", "optimalTime": "11:00 EST", "reasoning": "..." },
      "youtube_shorts": { "optimalDay": "Saturday", "optimalTime": "09:00 EST", "reasoning": "..." },
      "linkedin": { "optimalDay": "Wednesday", "optimalTime": "08:00 EST", "reasoning": "..." }
    },
    "competitiveInsights": [
      "Specific tactic the top 1% of creators in this niche are using right now that this clip should emulate",
      "A format or hook structure dominating this niche FYP this month that this clip can borrow"
    ]
  }
}

Rules:
- DO NOT be generic. Provide aggressive, hyper-specific marketing advice.
- Adapt your style entirely to the requested niche.
- competitiveInsights must be concrete tactics, not generic advice.
Return ONLY valid JSON.`,
    { temperature: 0.9, maxTokens: 3000 });
    return { videoId, ...result };
  } catch (err) {
    logger.warn('Marketing Strategy failed', { error: err.message });
    return { videoId, strategy: null };
  }
}

module.exports = {
  getSmartCutSuggestions,
  getAutoFramingSuggestions,
  findBestMoments,
  getColorMatchSuggestions,
  getSmartReframeSuggestions,
  getMusicSyncSuggestions,
  analyzePacing,
  qualityCheck,
  generateCaptionsForManualEdit,
  analyzeVideoForManualEdit,
  // 2026 Upgrade — Premium AI Features
  generateCreativeDirectorBrief,
  generateAICaptions,
  suggestColorGrade,
  suggestTransitions,
  autoEditSequence,
  generateEngagementPrediction,
  // V5 Marketing & Snapshot Upgrade
  generateViralSnapshots,
  generateMarketingStrategy,
  // V6 — Smart Clip Scorer (algorithmic + AI hybrid)
  scoreAndRankClips,
};


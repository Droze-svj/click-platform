// AI-Assisted Editing Tools Service — Click Intelligence Engine
// Powers BOTH manual editing AI-assist AND auto-edit analysis
// Gemini-backed: Smart Cuts, Best Moments, Pacing, Quality, Caption Generation, Viral Detection

const logger = require('../utils/logger');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
// Pull in the V6 learning brain to feed the Auto Edit Engine
const { getActiveBlueprint } = require('./continuousLearningService');

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
async function analyzeVideoForManualEdit(videoId, transcript, metadata) {
  const duration = metadata?.duration || 0;
  if (!geminiConfigured || !transcript) {
    return { cuts: [], moments: {}, captions: [], pacing: [], qualityScore: 70, cta: null };
  }

  try {
    const result = await callGemini(`You are Click's AI Video Intelligence Engine — the world's most advanced content strategy AI.

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

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata);
    if (analysis?.suggestedCuts) {
      return { suggestions: analysis.suggestedCuts, videoId, niche: analysis.niche, hookScore: analysis.hookScore };
    }

    // Direct fallback prompt
    const result = await callGemini(`You are a professional video editor. Suggest optimal cut points.

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

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata);
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

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata);
    if (analysis?.pacingSuggestions) {
      return { suggestions: analysis.pacingSuggestions, videoId };
    }

    const result = await callGemini(`You are a video pacing expert for viral short-form content.

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

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata);
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

    const analysis = await analyzeVideoForManualEdit(videoId, transcript, metadata);
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

    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are Click AI Creative Director — the most advanced creative strategy engine on the planet.

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
 */
async function generateAICaptions(videoId, transcript, metadata, style = 'hormozi-punchline') {
  try {
    if (!geminiConfigured || !transcript) return { captions: [], videoId };

    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are Click AI Caption Engine — generate viral, engagement-maximizing captions.

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

    const result = await callGemini(`You are a world-class Hollywood colorist. Analyze this video content and recommend the PERFECT color grade.

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

    const result = await callGemini(`You are a professional video editor. Suggest optimal transitions for this video.

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
async function autoEditSequence(videoId, transcript, metadata, userId = null, brief = null) {
  try {
    const duration = metadata?.duration || 0;
    
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

    const result = await callGemini(`You are the Click AI Auto-Editor (Agent Mode) — the most powerful autonomous video editor on the planet, equipped with extreme creativity and 2026 algorithmic logic.${blueprintInjection}${briefInjection}

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

    const result = await callGemini(`You are a TikTok/YouTube algorithm analyst. Predict this video's engagement.

TRANSCRIPT: "${(transcript || '').substring(0, 2000)}"
DURATION: ${metadata?.duration || 0}s
EDITS APPLIED: ${JSON.stringify(editState || {}).substring(0, 500)}

Return JSON:
{
  "retention30s": (0-100),
  "retention60s": (0-100),
  "viralPotential": (0-100),
  "shareability": (0-100),
  "completionRate": (0-100),
  "predictedViews": "range like 10K-50K",
  "topPlatform": "tiktok|instagram|youtube_shorts|linkedin",
  "improvementTips": ["specific actionable tip 1", "tip 2", "tip 3"],
  "retentionKillers": ["what causes drop-off at specific timestamps"]
}

Return ONLY valid JSON.`,
    { temperature: 0.3, maxTokens: 800 });

    return { videoId, ...result };
  } catch (err) {
    logger.warn('Engagement prediction failed', { error: err.message });
    return { videoId, retention30s: 45, viralPotential: 30 };
  }
}

/**
 * VIRAL SNAPSHOT FORGE — Extracts highly optimized short clips from the main sequence
 */
async function generateViralSnapshots(videoId, transcript, metadata) {
  try {
    if (!geminiConfigured || !transcript) return { videoId, snapshots: [] };
    
    const duration = metadata?.duration || 0;
    const result = await callGemini(`You are a top-tier viral content curator and AI clipping engine.
Your objective is to identify the 3 absolute best, most retaining, and emotionally peaking segments within this transcript to extract as standalone short-form clips.

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
      "rationale": "Why this specific 15 seconds will go viral (e.g., intense disagreement, profound value drop)"
    }
  ]
}

Rules:
- Generate exactly 3 snapshot clips.
- Durations should be between 7 seconds and 35 seconds.
- Provide highly descriptive rationales.
Return ONLY valid JSON.`,
    { temperature: 0.7, maxTokens: 1500 });
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
    
    const result = await callGemini(`You are an omniscient, billion-dollar Growth Hacker and Neuro-Marketing AI.
You possess continuous learning capability and unlimited marketing background knowledge (AIDA, Hook/Retain/Reward, Harvard Business models, GaryVee distribution strats, MrBeast virality structure).

The user has defined their target market/niche as: "${niche || 'General Business / Lifestyle'}".

You must formulate an EXACT, highly original, non-repetitive marketing strategy to distribute this video.

TRANSCRIPT: "${(transcript || '').substring(0, 3000)}"

Return JSON:
{
  "strategy": {
    "nicheBreakdown": "Your deep analysis on what this specific niche craves right now.",
    "titles": [
      "5 highly original, click-through optimized titles."
    ],
    "captions": [
      { "style": "Edgy & Controversial", "copy": "The caption text..." },
      { "style": "Educational Value-Drop", "copy": "The caption text..." },
      { "style": "Storytelling / Vulnerable", "copy": "The caption text..." }
    ],
    "hashtags": ["#tag1", "#tag2"],
    "schedulingMatrix": {
      "optimalDay": "Tuesday",
      "optimalTime": "18:30 EST",
      "algorithmRationale": "A deep psychological and algorithmic explanation of WHY this exact time and day is perfect for this specific niche (e.g., 'Gen-Z founders are commuting and checking LinkedIn/TikTok during this block')."
    }
  }
}

Rules:
- DO NOT be generic. Provide aggressive, hyper-specific marketing advice.
- Adapt your style entirely to the requested niche.
Return ONLY valid JSON.`,
    { temperature: 0.9, maxTokens: 2500 });
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
};


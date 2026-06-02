/**
 * One-Click Viral Pipeline Service
 * Orchestrates: Transcription -> Hook Analysis -> Auto-Editing -> Result Generation
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Content = require('../models/Content');
const { emitToUser } = require('./socketService');
const { generateCaptionsForContent } = require('./videoCaptionService');
const { autoEditVideo, exportMultipleFormats } = require('./aiVideoEditingService');
const { getCompetitiveBenchmarks } = require('./competitiveBenchmarkingService');
const { generateThumbnail } = require('./thumbnailService');
const { optimizeImage } = require('../utils/imageOptimizer');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');
const { toAbsolutePath } = require('../utils/pathUtils');

/**
 * Main entry point for the One-Click Viral Pipeline (Phase 2)
 * Orchestrates: Transcription -> Hook Analysis -> Performance Projection -> Multi-Format Editing
 */
async function runViralPipeline(contentId, videoPath, user, pipelineOptions = {}) {
  const userId = (user._id || user.id).toString();
  const { 
    targetPlatforms = ['tiktok', 'instagram', 'youtube'],
    aspectRatios = ['9:16'], // Default to vertical
    enableBenchmarking = true
  } = pipelineOptions;
  
  try {
    logger.info('🚀 Starting One-Click Viral Pipeline v2', { contentId, userId, pipelineOptions });
    updateProgress(userId, contentId, 'initializing', 5, 'Initializing viral conduit...');

    const content = await Content.findById(contentId);
    if (!content) throw new Error('Content not found');

    // 1. Transcription (High Accuracy)
    updateProgress(userId, contentId, 'transcribing', 10, 'Extracting transcript with AI...');
    // Use the language we transcribed in (set on Content at upload from
    // req.language). Falls back to 'en' for old content predating the
    // language field. Without this, every caption batch ran in English
    // even when the video was Spanish/French/etc.
    const contentLanguage = content.language || content.metadata?.language || 'en';
    const transcriptData = await generateCaptionsForContent(contentId, videoPath, { language: contentLanguage });
    const transcript = transcriptData.transcript;
    
    // 2. Viral Hook Analysis (niche-aware, multi-LLM via aiRouter)
    updateProgress(userId, contentId, 'analyzing_hooks', 25, 'Niche-aware hook scoring...');
    const hookAnalysis = await analyzeHooksLocally(
      transcript,
      content.originalFile.duration || 60,
      {
        niche: user.niche || content.metadata?.niche || 'business',
        platform: targetPlatforms[0] || 'tiktok',
        language: content.language || content.metadata?.language || 'en',
      },
    );
    
    content.metadata = { 
      ...content.metadata, 
      hookAnalysis,
      viralScore: hookAnalysis.viralPotential,
      isViralOptimized: true
    };
    await content.save();

    // 3. Performance Projection (New in Phase 2)
    let performanceForecast = null;
    if (enableBenchmarking) {
      updateProgress(userId, contentId, 'benchmarking', 40, 'Projecting viral performance vs industry benchmarks...');
      try {
        // Get benchmarks for the primary platform
        const benchmarks = await getCompetitiveBenchmarks(userId, targetPlatforms[0] || 'tiktok');
        
        performanceForecast = {
          projectedEngagement: Math.round(benchmarks.industry.median * (hookAnalysis.viralPotential / 70)), // Heuristic projection
          percentileRank: hookAnalysis.viralPotential > 85 ? 'Top 10%' : hookAnalysis.viralPotential > 70 ? 'Top 25%' : 'Above Median',
          recommendations: benchmarks.recommendations.slice(0, 3)
        };

        content.metadata.performanceForecast = performanceForecast;
        await content.save();
      } catch (benchErr) {
        logger.warn('Benchmarking failed in pipeline (non-critical)', { error: benchErr.message });
      }
    }

    // 4. One-Click AI Editing (Neural & Dynamic with Creator DNA & Repetition Defense)
    updateProgress(userId, contentId, 'editing', 60, 'Removing silence, auto-zooming, and applying styles...');
    
    const creatorDnaService = require('./creatorDnaService');
    const creativityEngineService = require('./creativityEngineService');

    let dna = null;
    try {
      dna = await creatorDnaService.getCreatorDNA(userId);
      logger.info('🎨 Loaded Creator DNA for dynamic edit styling', { userId, confidence: dna.confidence });
    } catch (dnaErr) {
      logger.warn('Failed to load Creator DNA, using defaults', { error: dnaErr.message });
    }

    let recentContent = [];
    try {
      const query = Content.find({ userId, status: 'completed' });
      if (query && typeof query.sort === 'function') {
        recentContent = await query
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();
      } else if (query && typeof query.then === 'function') {
        recentContent = await query;
      }
    } catch (err) {
      logger.warn('Failed to query recent content for repetition analysis', { error: err.message });
    }

    let creativityReport = null;
    let repetitionReport = null;
    let inspirationDrop = null;
    try {
      creativityReport = await creativityEngineService.analyzeCreativityScore(userId, recentContent);
      repetitionReport = await creativityEngineService.detectRepetition(userId, recentContent);
      inspirationDrop = creativityEngineService.getInspirationDrop(user.niche || content.metadata?.niche || 'business', 'video');
      logger.info('🎨 Creativity metrics evaluated', { userId, score: creativityReport.score, repetitionSeverity: repetitionReport.severity });
    } catch (creativityErr) {
      logger.warn('Creativity Engine processing failed', { error: creativityErr.message });
    }

    const editingOptions = {
      removeSilence: true,
      optimizePacing: true,
      enableAutoZoom: true,
      enableColorGrading: true,
      enableSmartCaptions: true,
      captionStyle: dna?.topCaptionStyles?.[0] || 'tiktok-pop',
      platform: targetPlatforms[0] || 'tiktok',
      prioritizeHook: true,
      pacingIntensity: dna?.weightedTopPacing?.[0] || 'aggressive',
      colorGrade: dna?.topColorGrades?.[0] || null,
      transitionStyle: dna?.topTransitions?.[0] || null,
    };

    // Auto-inject dynamic pattern interrupt if high repetition or low originality is detected
    if (repetitionReport && (repetitionReport.severity === 'high' || repetitionReport.severity === 'medium')) {
      logger.info('🔥 Scroll-Stance Repetition defense triggered: injecting custom visual pattern interrupt', { contentId });
      editingOptions.colorGrade = 'cyberpunk_neon'; // Override with a highly vivid scroll stopper
      editingOptions.pacingIntensity = 'aggressive';
      editingOptions.customInstructions = 'Pattern Interrupt Sequencing: Open with immediate high energy and contrast boost.';
    }

    // Persist creativity feedback & drops onto content model
    if (creativityReport || repetitionReport || inspirationDrop) {
      try {
        content.metadata = {
          ...content.metadata,
          creativityScore: creativityReport?.score || 100,
          creativityVerdict: creativityReport?.verdict || 'Aesthetic alignment confirmed',
          repetitionSeverity: repetitionReport?.severity || 'none',
          inspirationDrop: inspirationDrop ? {
            framework: inspirationDrop.framework,
            principle: inspirationDrop.principle,
            execution: inspirationDrop.execution,
            example: inspirationDrop.example,
            challengeForToday: inspirationDrop.challengeForToday
          } : null
        };
        await content.save();
      } catch (saveErr) {
        logger.warn('Failed to save creativity metrics to content', { error: saveErr.message });
      }
    }

    const editResult = await autoEditVideo(contentId, editingOptions, userId);
    
    if (!editResult.success) {
      logger.warn('Auto-edit semi-failed, but proceeding with current state', { contentId });
    }

    // 5. Multi-Format Rendering (New in Phase 2)
    if (aspectRatios.length > 1) {
      updateProgress(userId, contentId, 'formatting', 80, 'Generating multiple social formats (9:16, 1:1)...');
      try {
        const formats = aspectRatios.filter(a => a !== '9:16'); // We already did 9:16 in autoEdit
        if (formats.length > 0) {
          const exportResult = await exportMultipleFormats(contentId, formats);
          content.generatedContent = {
            ...content.generatedContent,
            alternates: exportResult.exports
          };
          await content.save();
        }
      } catch (formatErr) {
        logger.warn('Multi-format export failed', { error: formatErr.message });
      }
    }

    // 6. Final Formatting & Thumbnails
    updateProgress(userId, contentId, 'finalizing', 95, 'Finalizing viral assets...');
    
    const updatedContent = await Content.findById(contentId);
    const finalVideoPath = toAbsolutePath(updatedContent.originalFile.url);

    const thumbnailFilename = `viral-thumb-v2-${contentId}.jpg`;
    const thumbnailPath = toAbsolutePath(`uploads/thumbnails/${thumbnailFilename}`);
    const thumbnailsDir = path.dirname(thumbnailPath);
    
    if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

    try {
      await generateThumbnail(finalVideoPath, thumbnailPath, { width: 1280, height: 720, quality: 90 });
      await optimizeImage(thumbnailPath, thumbnailPath, { quality: 85 });
      
      updatedContent.generatedContent = {
        ...updatedContent.generatedContent,
        thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
        pipelineVersion: '2.0-neural'
      };
      updatedContent.status = 'completed';
      await updatedContent.save();
    } catch (thumbErr) {
      logger.warn('Thumbnail generation failed', { thumbErr: thumbErr.message });
    }

    updateProgress(userId, contentId, 'completed', 100, 'Viral Pipeline Complete! Your content is optimized for virality. 🚀');
    logger.info('✅ One-Click Viral Pipeline v2 finished', { contentId });

    return { success: true, contentId, forecast: performanceForecast };

  } catch (error) {
    logger.error('❌ One-Click Viral Pipeline v2 failed', { contentId, error: error.message, stack: error.stack });

    const content = await Content.findById(contentId);
    if (content) {
      content.status = 'failed';
      content.metadata = { ...content.metadata, lastError: error.message };
      await content.save();
    }

    // Best-effort cleanup of any contentId-scoped intermediates so failed
    // pipelines don't leak disk space. We scan the conventional temp
    // directories and remove anything that includes the contentId in its
    // filename. Anything outside these dirs (real source uploads) is left
    // alone.
    try {
      const tempRoots = [
        toAbsolutePath('uploads/temp'),
        toAbsolutePath('uploads/intermediates'),
        toAbsolutePath('uploads/exports'),
      ];
      for (const root of tempRoots) {
        if (!fs.existsSync(root)) continue;
        for (const name of fs.readdirSync(root)) {
          if (!name.includes(String(contentId))) continue;
          try {
            const p = path.join(root, name);
            const stat = fs.statSync(p);
            if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
            else fs.unlinkSync(p);
          } catch (rmErr) {
            logger.debug('Pipeline cleanup: could not remove', { name, error: rmErr.message });
          }
        }
      }
    } catch (cleanupErr) {
      logger.warn('Pipeline cleanup pass failed', { contentId, error: cleanupErr.message });
    }

    updateProgress(userId, contentId, 'failed', 0, `Pipeline Error: ${error.message}`);
    throw error;
  }
}

function updateProgress(userId, contentId, status, progress, message) {
  try {
    emitToUser(userId, 'video-progress', {
      contentId,
      status,
      progress,
      message,
      isViralPipeline: true
    });
  } catch (err) {
    // Non-critical
  }
}

async function analyzeHooksLocally(transcript, duration, ctx = {}) {
  // Niche-aware system prompt — tells the model to use the niche playbook
  // (voice tone, angles, emotional triggers) and the platform retention
  // curve. Replaces the generic "you are a viral expert" boilerplate so
  // outputs are platform/niche-specific instead of generic.
  const systemPrompt = buildSystemPrompt({
    persona: 'edit-suggester',
    niche: ctx.niche || 'business',
    platform: ctx.platform || 'tiktok',
    language: ctx.language || 'en',
    stage: 'analyze',
    extra: 'Score the hook against the platform\'s 3-second retention window. Output strict JSON only.',
  });

  const userPrompt = [
    `── Task ──`,
    `Analyse the following ${duration}s video transcript for viral potential on ${ctx.platform || 'tiktok'}.`,
    `Return JSON with these keys exactly:`,
    `  hookStrength    (0-100, current opener strength)`,
    `  viralPotential  (0-100, end-to-end share-likelihood)`,
    `  hookType        (one of: curiosity-gap, pattern-break, before-after, enemy-frame, problem-promise, list-tease, quote-cold-open, data-flex)`,
    `  rewrites        (array of 3 rewritten openers, each <12 words, niche-specific)`,
    `  directives      (array of 3 actionable edit directives — cuts, overlays, pacing — niche-aware)`,
    ``,
    `── Transcript ──`,
    transcript.substring(0, 4000),
  ].join('\n');

  const fallback = generateFallbackAnalysis(transcript);
  const result = await aiCallJson(userPrompt, fallback, {
    systemPrompt,
    taskType: 'viral-hook-analysis',
    maxTokens: 1024,
    temperature: 0.6,
  });
  return result || fallback;
}

function generateFallbackAnalysis() {
  return {
    hookStrength: 80,
    viralPotential: 70,
    hookType: 'pattern-interrupt',
    rewrites: ['Option 1', 'Option 2'],
    directives: [{ action: 'Fast-paced edits', impact: 'high' }],
    isFallback: true
  };
}

module.exports = {
  runViralPipeline
};

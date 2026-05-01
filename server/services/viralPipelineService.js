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
    const transcriptData = await generateCaptionsForContent(contentId, videoPath, { language: 'en' });
    const transcript = transcriptData.transcript;
    
    // 2. Viral Hook Analysis (niche-aware, multi-LLM via aiRouter)
    updateProgress(userId, contentId, 'analyzing_hooks', 25, 'Niche-aware hook scoring...');
    const hookAnalysis = await analyzeHooksLocally(
      transcript,
      content.originalFile.duration || 60,
      {
        niche: user.niche || content.metadata?.niche || 'business',
        platform: targetPlatforms[0] || 'tiktok',
        language: content.metadata?.language || 'en',
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

    // 4. One-Click AI Editing (Neural & Dynamic)
    updateProgress(userId, contentId, 'editing', 60, 'Removing silence, auto-zooming, and applying styles...');
    
    const editingOptions = {
      removeSilence: true,
      optimizePacing: true,
      enableAutoZoom: true,
      enableColorGrading: true,
      enableSmartCaptions: true,
      captionStyle: 'tiktok-pop',
      platform: targetPlatforms[0] || 'tiktok',
      prioritizeHook: true,
      pacingIntensity: 'aggressive'
    };

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
    const finalVideoUrl = updatedContent.originalFile.url;
    const finalVideoPath = finalVideoUrl.startsWith('/') 
      ? path.join(__dirname, '../..', finalVideoUrl)
      : videoPath;

    const thumbnailFilename = `viral-thumb-v2-${contentId}.jpg`;
    const thumbnailPath = path.join(__dirname, '../../uploads/thumbnails', thumbnailFilename);
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

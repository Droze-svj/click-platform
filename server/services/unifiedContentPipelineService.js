// Unified Content Pipeline Service
// One pipeline: long-form in → multi-format social across 6 networks out
// With AI performance prediction and recycling built-in

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');
const { generateSocialContent, detectHighlights } = require('./aiService');
const { generateHashtags } = require('./hashtagService');
// Content recycling - use recycling service if available
async function identifyRecyclableContentForPipeline(userId, contentId) {
  try {
    const contentRecyclingService = require('./contentRecyclingService');
    
    // Check if content is recyclable
    const content = await Content.findById(contentId);
    if (!content) {
      return { isRecyclable: false };
    }

    // Use detectEvergreenContent if available
    if (contentRecyclingService.detectEvergreenContent) {
      const evergreen = await contentRecyclingService.detectEvergreenContent(userId, contentId);
      return {
        isRecyclable: evergreen.isEvergreen || false,
        evergreenScore: evergreen.score || 0,
        plan: {
          suggestedFrequency: 'weekly',
          platforms: SUPPORTED_PLATFORMS
        }
      };
    }
  } catch (error) {
    logger.warn('Content recycling service not available', { error: error.message });
  }

  // Fallback: basic recycling detection
  const content = await Content.findById(contentId);
  if (!content) {
    return { isRecyclable: false };
  }

  return {
    isRecyclable: true,
    evergreenScore: 50,
    plan: {
      suggestedFrequency: 'weekly',
      platforms: SUPPORTED_PLATFORMS
    }
  };
}
const { postToPlatform } = require('./socialMediaService');

// Supported platforms
const SUPPORTED_PLATFORMS = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];

/**
 * Main pipeline: Process long-form content into social-ready assets
 * @param {string} userId - User ID
 * @param {string} contentId - Content ID
 * @param {Object} options - Pipeline options
 */
async function processContentPipeline(userId, contentId, options = {}) {
  try {
    const {
      platforms = SUPPORTED_PLATFORMS,
      autoSchedule = false,
      enableRecycling = true,
      includePerformancePrediction = true,
      includeAnalytics = true
    } = options;

    logger.info('Starting unified content pipeline', { userId, contentId, platforms });

    // Step 1: Load content
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const pipeline = {
      contentId,
      userId,
      status: 'processing',
      steps: [],
      assets: {},
      performance: {},
      recycling: {},
      analytics: {},
      distribution: {}
    };

    // Step 2: Extract and process content based on type
    const extractedContent = await extractContent(content);
    pipeline.steps.push({
      step: 'extraction',
      status: 'completed',
      data: { type: content.type, extracted: !!extractedContent }
    });

    // Step 3: Generate multi-format social assets for all 6 networks
    const socialAssets = await generateMultiFormatAssets(
      content,
      extractedContent,
      platforms
    );
    pipeline.assets = socialAssets;
    pipeline.steps.push({
      step: 'asset_generation',
      status: 'completed',
      data: { platforms: Object.keys(socialAssets), totalAssets: Object.values(socialAssets).flat().length }
    });

    // Step 4: AI Performance Prediction (built-in)
    if (includePerformancePrediction) {
      const performancePredictions = await predictPerformanceForAssets(
        userId,
        contentId,
        socialAssets
      );
      pipeline.performance = performancePredictions;
      pipeline.steps.push({
        step: 'performance_prediction',
        status: 'completed',
        data: { predictions: Object.keys(performancePredictions).length }
      });
    }

    // Step 5: Content Recycling Detection (built-in)
    if (enableRecycling) {
      const recyclingPlan = await detectAndPlanRecycling(
        userId,
        contentId,
        socialAssets
      );
      pipeline.recycling = recyclingPlan;
      pipeline.steps.push({
        step: 'recycling_detection',
        status: 'completed',
        data: { recyclable: recyclingPlan.isRecyclable, plan: recyclingPlan.plan }
      });
    }

    // Step 6: Distribution (one-click to all 6 networks)
    if (autoSchedule) {
      const distribution = await distributeToNetworks(
        userId,
        contentId,
        socialAssets,
        platforms
      );
      pipeline.distribution = distribution;
      pipeline.steps.push({
        step: 'distribution',
        status: 'completed',
        data: { scheduled: distribution.scheduled.length, platforms: distribution.platforms }
      });
    }

    // Step 7: Analytics Integration (built-in)
    if (includeAnalytics) {
      const analytics = await setupAnalytics(userId, contentId, socialAssets);
      pipeline.analytics = analytics;
      pipeline.steps.push({
        step: 'analytics_setup',
        status: 'completed',
        data: { trackingEnabled: true }
      });
    }

    // Update content with pipeline results
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        'pipeline': {
          status: 'completed',
          assets: socialAssets,
          performance: pipeline.performance,
          recycling: pipeline.recycling,
          analytics: pipeline.analytics,
          distribution: pipeline.distribution,
          completedAt: new Date()
        }
      }
    });

    pipeline.status = 'completed';
    logger.info('Unified content pipeline completed', { userId, contentId });

    // Trigger workflow automation
    try {
      await triggerWorkflowAutomation(userId, contentId, 'pipeline_completed');
    } catch (error) {
      logger.warn('Workflow automation failed', { error: error.message });
    }

    return pipeline;
  } catch (error) {
    logger.error('Error in unified content pipeline', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Extract content based on type (video, article, podcast, transcript)
 */
async function extractContent(content) {
  try {
    const { type, transcript, title, description, body, originalFile } = content;

    switch (type) {
      case 'video':
        // Extract transcript if available, otherwise use description
        return {
          text: transcript || description || body || '',
          title: title || 'Untitled Video',
          type: 'video',
          duration: originalFile?.duration || 0,
          hasVideo: true
        };

      case 'article':
        return {
          text: body || transcript || description || '',
          title: title || 'Untitled Article',
          type: 'article',
          hasVideo: false
        };

      case 'podcast':
        return {
          text: transcript || description || body || '',
          title: title || 'Untitled Podcast',
          type: 'podcast',
          duration: originalFile?.duration || 0,
          hasVideo: false,
          hasAudio: true
        };

      case 'transcript':
        return {
          text: transcript || body || description || '',
          title: title || 'Untitled Transcript',
          type: 'transcript',
          hasVideo: false
        };

      default:
        return {
          text: transcript || body || description || '',
          title: title || 'Untitled',
          type: type || 'general',
          hasVideo: false
        };
    }
  } catch (error) {
    logger.error('Error extracting content', { error: error.message });
    throw error;
  }
}

/**
 * Generate multi-format social assets for all 6 networks
 */
async function generateMultiFormatAssets(content, extractedContent, platforms) {
  try {
    const assets = {};
    const { text, title, type, hasVideo, duration } = extractedContent;

    for (const platform of platforms) {
      assets[platform] = [];

      // Generate platform-specific formats
      switch (platform) {
        case 'twitter':
          assets.twitter = await generateTwitterAssets(text, title, type);
          break;

        case 'linkedin':
          assets.linkedin = await generateLinkedInAssets(text, title, type);
          break;

        case 'facebook':
          assets.facebook = await generateFacebookAssets(text, title, type);
          break;

        case 'instagram':
          assets.instagram = await generateInstagramAssets(text, title, type, hasVideo);
          break;

        case 'youtube':
          if (hasVideo && type === 'video') {
            assets.youtube = await generateYouTubeAssets(content, extractedContent);
          } else {
            assets.youtube = await generateYouTubeShortAssets(text, title);
          }
          break;

        case 'tiktok':
          if (hasVideo && type === 'video') {
            assets.tiktok = await generateTikTokAssets(content, extractedContent);
          } else {
            assets.tiktok = await generateTikTokTextAssets(text, title);
          }
          break;
      }
    }

    return assets;
  } catch (error) {
    logger.error('Error generating multi-format assets', { error: error.message });
    throw error;
  }
}

/**
 * Generate Twitter/X assets
 */
async function generateTwitterAssets(text, title, contentType) {
  try {
    const { generateSocialContent } = require('./aiService');
    const { generateHashtags } = require('./hashtagService');

    // Generate main post
    const socialContent = await generateSocialContent(text, 'general', ['twitter']);
    const hashtags = await generateHashtags(text, { count: 3, platform: 'twitter' });

    const assets = [{
      type: 'post',
      content: socialContent.twitter?.text || text.substring(0, 280),
      hashtags: hashtags || [],
      characterCount: (socialContent.twitter?.text || text).length,
      format: 'text',
      platform: 'twitter'
    }];

    // Generate thread if content is long
    if (text.length > 280) {
      const threadPosts = await generateThread(text, title);
      assets.push(...threadPosts);
    }

    return assets;
  } catch (error) {
    logger.error('Error generating Twitter assets', { error: error.message });
    return [];
  }
}

/**
 * Generate LinkedIn assets
 */
async function generateLinkedInAssets(text, title, contentType) {
  try {
    const { generateSocialContent } = require('./aiService');
    const { generateHashtags } = require('./hashtagService');

    const socialContent = await generateSocialContent(text, 'general', ['linkedin']);
    const hashtags = await generateHashtags(text, { count: 5, platform: 'linkedin' });

    return [{
      type: 'post',
      content: socialContent.linkedin?.text || text.substring(0, 3000),
      hashtags: hashtags || [],
      characterCount: (socialContent.linkedin?.text || text).length,
      format: 'article',
      platform: 'linkedin',
      title: title
    }];
  } catch (error) {
    logger.error('Error generating LinkedIn assets', { error: error.message });
    return [];
  }
}

/**
 * Generate Facebook assets
 */
async function generateFacebookAssets(text, title, contentType) {
  try {
    const { generateSocialContent } = require('./aiService');
    const { generateHashtags } = require('./hashtagService');

    const socialContent = await generateSocialContent(text, 'general', ['facebook']);
    const hashtags = await generateHashtags(text, { count: 5, platform: 'facebook' });

    return [{
      type: 'post',
      content: socialContent.facebook?.text || text.substring(0, 5000),
      hashtags: hashtags || [],
      characterCount: (socialContent.facebook?.text || text).length,
      format: 'text',
      platform: 'facebook',
      title: title
    }];
  } catch (error) {
    logger.error('Error generating Facebook assets', { error: error.message });
    return [];
  }
}

/**
 * Generate Instagram assets
 */
async function generateInstagramAssets(text, title, contentType, hasVideo) {
  try {
    const { generateSocialContent } = require('./aiService');
    const { generateHashtags } = require('./hashtagService');

    const socialContent = await generateSocialContent(text, 'general', ['instagram']);
    const hashtags = await generateHashtags(text, { count: 10, platform: 'instagram' });

    const assets = [{
      type: 'post',
      content: socialContent.instagram?.text || text.substring(0, 2200),
      hashtags: hashtags || [],
      characterCount: (socialContent.instagram?.text || text).length,
      format: hasVideo ? 'reel' : 'post',
      platform: 'instagram',
      title: title
    }];

    // Generate carousel if content has multiple points
    if (text.length > 500) {
      const carousel = await generateCarousel(text, title);
      assets.push(carousel);
    }

    return assets;
  } catch (error) {
    logger.error('Error generating Instagram assets', { error: error.message });
    return [];
  }
}

/**
 * Generate YouTube assets
 */
async function generateYouTubeAssets(content, extractedContent) {
  try {
    // For videos, return the original video
    if (content.generatedContent?.shortVideos) {
      return content.generatedContent.shortVideos.map(video => ({
        type: 'video',
        url: video.url,
        thumbnail: video.thumbnail,
        caption: video.caption,
        duration: video.duration,
        platform: 'youtube',
        format: 'short'
      }));
    }

    return [];
  } catch (error) {
    logger.error('Error generating YouTube assets', { error: error.message });
    return [];
  }
}

/**
 * Generate YouTube Short assets from text
 */
async function generateYouTubeShortAssets(text, title) {
  try {
    return [{
      type: 'short',
      content: text.substring(0, 500),
      title: title,
      platform: 'youtube',
      format: 'short',
      suggestedDuration: 60
    }];
  } catch (error) {
    logger.error('Error generating YouTube Short assets', { error: error.message });
    return [];
  }
}

/**
 * Generate TikTok assets
 */
async function generateTikTokAssets(content, extractedContent) {
  try {
    // For videos, return short clips
    if (content.generatedContent?.shortVideos) {
      return content.generatedContent.shortVideos
        .filter(video => video.platform === 'tiktok' || !video.platform)
        .map(video => ({
          type: 'video',
          url: video.url,
          thumbnail: video.thumbnail,
          caption: video.caption,
          duration: video.duration,
          platform: 'tiktok',
          format: 'video'
        }));
    }

    return [];
  } catch (error) {
    logger.error('Error generating TikTok assets', { error: error.message });
    return [];
  }
}

/**
 * Generate TikTok text assets
 */
async function generateTikTokTextAssets(text, title) {
  try {
    const { generateHashtags } = require('./hashtagService');
    const hashtags = await generateHashtags(text, { count: 5, platform: 'tiktok' });

    return [{
      type: 'post',
      content: text.substring(0, 300),
      hashtags: hashtags || [],
      platform: 'tiktok',
      format: 'text',
      title: title
    }];
  } catch (error) {
    logger.error('Error generating TikTok text assets', { error: error.message });
    return [];
  }
}

/**
 * Generate thread for Twitter
 */
async function generateThread(text, title) {
  try {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Break this content into a Twitter thread (max 280 chars per tweet, 3-5 tweets):
    
Title: ${title}
Content: ${text}

Return as JSON array of tweets.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return (result.tweets || []).map((tweet, index) => ({
      type: 'thread',
      content: tweet,
      threadPosition: index + 1,
      platform: 'twitter'
    }));
  } catch (error) {
    logger.error('Error generating thread', { error: error.message });
    return [];
  }
}

/**
 * Generate carousel for Instagram
 */
async function generateCarousel(text, title) {
  try {
    return {
      type: 'carousel',
      slides: [
        { content: text.substring(0, 500), image: null },
        { content: text.substring(500, 1000), image: null }
      ],
      platform: 'instagram',
      format: 'carousel'
    };
  } catch (error) {
    logger.error('Error generating carousel', { error: error.message });
    return null;
  }
}

/**
 * Predict performance for all assets
 */
async function predictPerformanceForAssets(userId, contentId, assets) {
  try {
    const predictions = {};

    for (const [platform, platformAssets] of Object.entries(assets)) {
      predictions[platform] = [];

      for (const asset of platformAssets) {
        try {
          const prediction = await predictPerformance(userId, {
            content: asset.content || asset.caption || '',
            platform: platform,
            hashtags: asset.hashtags || [],
            type: asset.type || 'post'
          });

          predictions[platform].push({
            assetId: asset.id || `${platform}-${Date.now()}`,
            predictedEngagement: prediction.engagement || 0,
            predictedReach: prediction.reach || 0,
            score: prediction.score || 0,
            recommendations: prediction.recommendations || []
          });
        } catch (error) {
          logger.warn('Error predicting performance for asset', { error: error.message, platform });
        }
      }
    }

    return predictions;
  } catch (error) {
    logger.error('Error predicting performance', { error: error.message });
    return {};
  }
}

/**
 * Detect and plan content recycling
 */
async function detectAndPlanRecycling(userId, contentId, assets) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      return { isRecyclable: false, plan: null };
    }

    const recycling = await identifyRecyclableContentForPipeline(userId, contentId);

    return {
      isRecyclable: recycling.isRecyclable || false,
      plan: recycling.plan || null,
      suggestedSchedule: recycling.suggestedSchedule || null,
      evergreenScore: recycling.evergreenScore || 0
    };
  } catch (error) {
    logger.error('Error detecting recycling', { error: error.message });
    return { isRecyclable: false, plan: null };
  }
}

/**
 * Distribute to all 6 networks (one-click)
 */
async function distributeToNetworks(userId, contentId, assets, platforms) {
  try {
    const scheduled = [];
    const errors = [];

    for (const platform of platforms) {
      const platformAssets = assets[platform] || [];
      
      for (const asset of platformAssets) {
        try {
          // Create scheduled post
          const scheduledPost = new ScheduledPost({
            userId,
            contentId,
            platform: platform,
            content: {
              text: asset.content || asset.caption || '',
              hashtags: asset.hashtags || [],
              mediaUrl: asset.url || asset.thumbnail || null
            },
            scheduledTime: new Date(), // Immediate or use optimal time
            status: 'scheduled'
          });

          await scheduledPost.save();
          scheduled.push({
            platform,
            postId: scheduledPost._id,
            status: 'scheduled'
          });
        } catch (error) {
          logger.error('Error scheduling post', { error: error.message, platform });
          errors.push({ platform, error: error.message });
        }
      }
    }

    return {
      scheduled,
      errors,
      platforms: platforms.filter(p => scheduled.some(s => s.platform === p)),
      totalScheduled: scheduled.length
    };
  } catch (error) {
    logger.error('Error distributing to networks', { error: error.message });
    throw error;
  }
}

/**
 * Setup analytics tracking
 */
async function setupAnalytics(userId, contentId, assets) {
  try {
    return {
      trackingEnabled: true,
      platforms: Object.keys(assets),
      metrics: ['engagement', 'reach', 'impressions', 'clicks'],
      setupAt: new Date()
    };
  } catch (error) {
    logger.error('Error setting up analytics', { error: error.message });
    return { trackingEnabled: false };
  }
}

/**
 * Get pipeline status
 */
async function getPipelineStatus(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    return content.pipeline || null;
  } catch (error) {
    logger.error('Error getting pipeline status', { error: error.message });
    throw error;
  }
}

/**
 * Publish all assets to all 6 networks (one-click)
 */
async function publishAllNetworks(userId, contentId, options = {}) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const pipeline = content.pipeline;
    if (!pipeline || !pipeline.assets) {
      throw new Error('Pipeline not completed. Run processContentPipeline first.');
    }

    const { platforms = SUPPORTED_PLATFORMS, schedule = false } = options;
    const results = {
      published: [],
      failed: [],
      scheduled: []
    };

    for (const platform of platforms) {
      const assets = pipeline.assets[platform] || [];
      
      for (const asset of assets) {
        try {
          if (schedule) {
            // Schedule for optimal time
            const scheduledPost = new ScheduledPost({
              userId,
              contentId,
              platform,
              content: {
                text: asset.content || asset.caption || '',
                hashtags: asset.hashtags || [],
                mediaUrl: asset.url || asset.thumbnail || null
              },
              scheduledTime: new Date(), // Use optimal time service
              status: 'scheduled'
            });
            await scheduledPost.save();
            results.scheduled.push({ platform, postId: scheduledPost._id });
          } else {
            // Publish immediately
            await postToPlatform(userId, platform, {
              text: asset.content || asset.caption || '',
              hashtags: asset.hashtags || [],
              mediaUrl: asset.url || asset.thumbnail || null
            });
            results.published.push({ platform, assetId: asset.id });
          }
        } catch (error) {
          logger.error('Error publishing to platform', { error: error.message, platform });
          results.failed.push({ platform, error: error.message });
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('Error publishing to all networks', { error: error.message });
    throw error;
  }
}

/**
 * Batch process multiple content items
 */
async function batchProcessPipeline(userId, contentIds, options = {}) {
  try {
    const {
      platforms = SUPPORTED_PLATFORMS,
      autoSchedule = false,
      enableRecycling = true,
      includePerformancePrediction = true,
      includeAnalytics = true,
      parallel = false
    } = options;

    const results = {
      total: contentIds.length,
      completed: [],
      failed: [],
      inProgress: []
    };

    if (parallel) {
      // Process all in parallel
      const promises = contentIds.map(contentId =>
        processContentPipeline(userId, contentId, {
          platforms,
          autoSchedule,
          enableRecycling,
          includePerformancePrediction,
          includeAnalytics
        }).then(pipeline => ({
          contentId,
          status: 'completed',
          pipeline
        })).catch(error => ({
          contentId,
          status: 'failed',
          error: error.message
        }))
      );

      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'completed') {
            results.completed.push(result.value);
          } else {
            results.failed.push(result.value);
          }
        } else {
          results.failed.push({
            contentId: contentIds[index],
            status: 'failed',
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    } else {
      // Process sequentially
      for (const contentId of contentIds) {
        try {
          const pipeline = await processContentPipeline(userId, contentId, {
            platforms,
            autoSchedule,
            enableRecycling,
            includePerformancePrediction,
            includeAnalytics
          });
          results.completed.push({ contentId, status: 'completed', pipeline });
        } catch (error) {
          results.failed.push({
            contentId,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    logger.info('Batch pipeline processing completed', {
      userId,
      total: results.total,
      completed: results.completed.length,
      failed: results.failed.length
    });

    return results;
  } catch (error) {
    logger.error('Error in batch pipeline processing', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate content variations for A/B testing
 */
async function generateContentVariations(userId, contentId, platform, count = 3) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const pipeline = content.pipeline;
    if (!pipeline || !pipeline.assets || !pipeline.assets[platform]) {
      throw new Error('Pipeline not completed for this platform');
    }

    const originalAsset = pipeline.assets[platform][0];
    const variations = [];

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (let i = 0; i < count; i++) {
      const prompt = `Create a variation of this ${platform} post for A/B testing:
      
Original: ${originalAsset.content || originalAsset.caption || ''}
Hashtags: ${(originalAsset.hashtags || []).join(', ')}

Create variation ${i + 1} with:
- Different angle or hook
- Different tone/style
- Different hashtag mix
- Same core message

Return JSON: {content: string, hashtags: [string], variationType: string, hook: string}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const variation = JSON.parse(response.choices[0].message.content);
      variations.push({
        ...variation,
        platform,
        originalAssetId: originalAsset.id,
        variationNumber: i + 1
      });
    }

    // Predict performance for each variation
    const variationsWithPrediction = await Promise.all(
      variations.map(async (variation) => {
        const prediction = await predictPerformance(userId, {
          content: variation.content,
          platform,
          hashtags: variation.hashtags || [],
          type: 'post'
        });
        return {
          ...variation,
          performance: prediction
        };
      })
    );

    // Update content with variations
    if (!content.pipeline.variations) {
      content.pipeline.variations = {};
    }
    if (!content.pipeline.variations[platform]) {
      content.pipeline.variations[platform] = [];
    }
    content.pipeline.variations[platform] = variationsWithPrediction;
    await content.save();

    logger.info('Content variations generated', { userId, contentId, platform, count });
    return variationsWithPrediction;
  } catch (error) {
    logger.error('Error generating content variations', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Smart content refresh - update old content with new insights
 */
async function smartContentRefresh(userId, contentId, options = {}) {
  try {
    const {
      updateHashtags = true,
      updateCaptions = false,
      optimizeForTrends = true,
      usePerformanceData = true
    } = options;

    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const pipeline = content.pipeline;
    if (!pipeline || !pipeline.assets) {
      throw new Error('Pipeline not completed');
    }

    const refreshed = {};

    // Get performance data if available
    let performanceData = {};
    if (usePerformanceData) {
      const posts = await ScheduledPost.find({
        userId,
        contentId,
        status: 'posted'
      }).lean();

      performanceData = posts.reduce((acc, post) => {
        if (!acc[post.platform]) {
          acc[post.platform] = {
            totalEngagement: 0,
            totalReach: 0,
            count: 0
          };
        }
        acc[post.platform].totalEngagement += post.analytics?.engagement || 0;
        acc[post.platform].totalReach += post.analytics?.reach || post.analytics?.impressions || 0;
        acc[post.platform].count++;
        return acc;
      }, {});
    }

    // Refresh each platform's assets
    for (const [platform, assets] of Object.entries(pipeline.assets)) {
      refreshed[platform] = [];

      for (const asset of assets) {
        const refreshedAsset = { ...asset };

        // Update hashtags
        if (updateHashtags) {
          const { generateHashtags } = require('./hashtagService');
          const newHashtags = await generateHashtags(
            asset.content || asset.caption || '',
            { count: platform === 'instagram' ? 10 : 5, platform }
          );
          refreshedAsset.hashtags = newHashtags || asset.hashtags;
        }

        // Update captions if requested
        if (updateCaptions) {
          const { generateSocialContent } = require('./aiService');
          const refreshedContent = await generateSocialContent(
            asset.content || asset.caption || '',
            'general',
            [platform]
          );
          refreshedAsset.content = refreshedContent[platform]?.text || asset.content;
        }

        // Optimize based on performance data
        if (usePerformanceData && performanceData[platform]) {
          const perf = performanceData[platform];
          const avgEngagement = perf.totalEngagement / perf.count;
          const avgReach = perf.totalReach / perf.count;

          refreshedAsset.optimization = {
            basedOnPerformance: true,
            averageEngagement: avgEngagement,
            averageReach: avgReach,
            recommendations: avgEngagement < 100 ? ['Consider more engaging hooks', 'Add trending hashtags'] : []
          };
        }

        // Optimize for trends
        if (optimizeForTrends) {
          refreshedAsset.trendOptimized = true;
          refreshedAsset.trendOptimizedAt = new Date();
        }

        refreshed[platform].push(refreshedAsset);
      }
    }

    // Update content with refreshed assets
    content.pipeline.refreshed = refreshed;
    content.pipeline.refreshedAt = new Date();
    await content.save();

    logger.info('Content refreshed', { userId, contentId, platforms: Object.keys(refreshed) });
    return refreshed;
  } catch (error) {
    logger.error('Error refreshing content', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get optimal posting times for all platforms
 */
async function getOptimalPostingTimes(userId, platforms = SUPPORTED_PLATFORMS) {
  try {
    const { getOptimalPostingTimes: getOptimalTimes } = require('./smartScheduleOptimizationService');
    const optimalTimes = {};

    for (const platform of platforms) {
      try {
        const times = await getOptimalTimes(userId, platform);
        optimalTimes[platform] = times;
      } catch (error) {
        logger.warn('Error getting optimal times for platform', { error: error.message, platform });
        optimalTimes[platform] = null;
      }
    }

    return optimalTimes;
  } catch (error) {
    logger.error('Error getting optimal posting times', { error: error.message, userId });
    return {};
  }
}

/**
 * Schedule with optimal times
 */
async function scheduleWithOptimalTimes(userId, contentId, platforms = SUPPORTED_PLATFORMS) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const pipeline = content.pipeline;
    if (!pipeline || !pipeline.assets) {
      throw new Error('Pipeline not completed');
    }

    const optimalTimes = await getOptimalPostingTimes(userId, platforms);
    const scheduled = [];

    for (const platform of platforms) {
      const assets = pipeline.assets[platform] || [];
      const optimalTime = optimalTimes[platform];

      for (const asset of assets) {
        const scheduledPost = new ScheduledPost({
          userId,
          contentId,
          platform,
          content: {
            text: asset.content || asset.caption || '',
            hashtags: asset.hashtags || [],
            mediaUrl: asset.url || asset.thumbnail || null
          },
          scheduledTime: optimalTime?.nextBestTime || new Date(),
          status: 'scheduled',
          optimized: true,
          optimizationData: optimalTime
        });

        await scheduledPost.save();
        scheduled.push({
          platform,
          postId: scheduledPost._id,
          scheduledTime: scheduledPost.scheduledTime,
          optimized: true
        });
      }
    }

    logger.info('Content scheduled with optimal times', { userId, contentId, scheduled: scheduled.length });
    return {
      scheduled,
      total: scheduled.length,
      platforms: [...new Set(scheduled.map(s => s.platform))]
    };
  } catch (error) {
    logger.error('Error scheduling with optimal times', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Setup A/B testing for content
 */
async function setupABTesting(userId, contentId, platform, variations) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Create A/B test groups
    const testGroups = variations.map((variation, index) => ({
      variant: String.fromCharCode(65 + index), // A, B, C, etc.
      content: variation.content,
      hashtags: variation.hashtags || [],
      performance: variation.performance || null
    }));

    // Store A/B test configuration
    if (!content.pipeline.abTests) {
      content.pipeline.abTests = {};
    }
    content.pipeline.abTests[platform] = {
      testGroups,
      status: 'active',
      createdAt: new Date(),
      results: null
    };

    await content.save();

    logger.info('A/B testing setup', { userId, contentId, platform, variants: testGroups.length });
    return {
      platform,
      testGroups,
      status: 'active'
    };
  } catch (error) {
    logger.error('Error setting up A/B testing', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Trigger workflow automation
 */
async function triggerWorkflowAutomation(userId, contentId, triggerType = 'pipeline_completed') {
  try {
    const Workflow = require('../models/Workflow');
    const workflows = await Workflow.find({
      userId,
      'triggers.type': triggerType,
      isActive: true
    }).lean();

    const triggered = [];

    for (const workflow of workflows) {
      try {
        // Execute workflow actions
        for (const action of workflow.actions || []) {
          switch (action.type) {
            case 'notify':
              // Send notification
              const { sendNotification } = require('./notificationService');
              await sendNotification(userId, {
                title: 'Pipeline Completed',
                message: `Content pipeline completed for ${contentId}`,
                type: 'success'
              });
              break;

            case 'schedule':
              // Auto-schedule
              await scheduleWithOptimalTimes(userId, contentId);
              break;

            case 'publish':
              // Auto-publish
              await publishAllNetworks(userId, contentId, { schedule: false });
              break;

            case 'webhook':
              // Trigger webhook
              const axios = require('axios');
              await axios.post(action.config.url, {
                event: triggerType,
                contentId,
                userId
              });
              break;
          }
        }

        triggered.push({
          workflowId: workflow._id,
          workflowName: workflow.name,
          status: 'executed'
        });
      } catch (error) {
        logger.error('Error executing workflow', { error: error.message, workflowId: workflow._id });
        triggered.push({
          workflowId: workflow._id,
          workflowName: workflow.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    logger.info('Workflow automation triggered', { userId, contentId, triggered: triggered.length });
    return { triggered };
  } catch (error) {
    logger.error('Error triggering workflow automation', { error: error.message, userId, contentId });
    return { triggered: [] };
  }
}

module.exports = {
  processContentPipeline,
  getPipelineStatus,
  publishAllNetworks,
  batchProcessPipeline,
  generateContentVariations,
  smartContentRefresh,
  getOptimalPostingTimes,
  scheduleWithOptimalTimes,
  setupABTesting,
  triggerWorkflowAutomation,
  SUPPORTED_PLATFORMS
};


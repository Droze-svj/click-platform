const express = require('express');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const cron = require('node-cron');
const router = express.Router();

// Schedule a post
router.post('/schedule', auth, async (req, res) => {
  try {
    const { contentId, platform, content, scheduledTime, mediaUrl, hashtags } = req.body;

    if (!platform || !scheduledTime) {
      return res.status(400).json({ error: 'Platform and scheduled time are required' });
    }

    const scheduledPost = new ScheduledPost({
      userId: req.user._id,
      contentId: contentId || null,
      platform,
      content: {
        text: content || '',
        mediaUrl: mediaUrl || '',
        hashtags: hashtags || []
      },
      scheduledTime: new Date(scheduledTime),
      status: 'scheduled'
    });

    await scheduledPost.save();

    // Update usage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'usage.postsScheduled': 1 }
    });

    // Trigger webhook
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook(req.user._id, 'post.scheduled', {
      postId: scheduledPost._id,
      contentId: contentId || null,
      platform,
      scheduledTime: scheduledPost.scheduledTime
    }).catch(err => console.warn('Webhook trigger failed', err));

    res.json({
      message: 'Post scheduled successfully',
      post: scheduledPost
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduled posts
router.get('/', auth, async (req, res) => {
  try {
    const { platform, status, startDate, endDate } = req.query;
    
    const query = { userId: req.user._id };
    if (platform) query.platform = platform;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    const posts = await ScheduledPost.find(query)
      .sort({ scheduledTime: 1 })
      .limit(100);

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update scheduled post
router.put('/:postId', auth, async (req, res) => {
  try {
    const post = await ScheduledPost.findOne({
      _id: req.params.postId,
      userId: req.user._id
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { content, scheduledTime, status } = req.body;
    
    if (content) post.content = { ...post.content, ...content };
    if (scheduledTime) post.scheduledTime = new Date(scheduledTime);
    if (status) post.status = status;

    await post.save();

    res.json({
      message: 'Post updated',
      post
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete scheduled post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await ScheduledPost.findOne({
      _id: req.params.postId,
      userId: req.user._id
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postId = post._id;
    await post.deleteOne();

    // Trigger webhook
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook(req.user._id, 'post.cancelled', {
      postId: postId.toString(),
      platform: post.platform
    }).catch(err => console.warn('Webhook trigger failed', err));

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get calendar view
router.get('/calendar', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth(), 0);

    const posts = await ScheduledPost.find({
      userId: req.user._id,
      scheduledTime: { $gte: startDate, $lte: endDate }
    }).sort({ scheduledTime: 1 });

    // Group by date
    const calendar = {};
    posts.forEach(post => {
      const date = post.scheduledTime.toISOString().split('T')[0];
      if (!calendar[date]) calendar[date] = [];
      calendar[date].push(post);
    });

    res.json(calendar);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process scheduled posts (runs every minute)
const logger = require('../utils/logger');

cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const posts = await ScheduledPost.find({
      status: 'scheduled',
      scheduledTime: { $lte: now }
    });

    const { postToSocialMedia } = require('../services/socialMediaService');

    for (const post of posts) {
      try {
        // Check if user has connected the platform
        const connection = await require('../models/SocialConnection').findOne({
          userId: post.userId,
          platform: post.platform,
          isActive: true
        });

        if (connection) {
          // Post directly to platform
          try {
            const result = await postToSocialMedia(
              post.userId,
              post.platform,
              {
                text: post.content.text,
                mediaUrl: post.content.mediaUrl || '',
                hashtags: post.content.hashtags || []
              }
            );

            post.status = 'posted';
            post.platformPostId = result.platformPostId || result._id?.toString() || `post-${Date.now()}`;
            await post.save();

            logger.info('Post published', {
              postId: post._id,
              platform: post.platform,
              userId: post.userId
            });
          } catch (postError) {
            logger.error('Error posting to platform', {
              postId: post._id,
              platform: post.platform,
              error: postError.message
            });
            post.status = 'failed';
            await post.save();
          }
        } else {
          // No connection - mark as posted (mock for now)
          post.status = 'posted';
          post.platformPostId = `mock-${Date.now()}`;
          await post.save();

          logger.info('Post marked as posted (no connection)', {
            postId: post._id,
            platform: post.platform,
            userId: post.userId
          });
        }
      } catch (error) {
        logger.error('Error publishing post', {
          postId: post._id,
          error: error.message
        });
        post.status = 'failed';
        await post.save();
      }
    }
  } catch (error) {
    logger.error('Scheduler cron error', { error: error.message });
  }
});

/**
 * @swagger
 * /api/scheduler/posts/{postId}:
 *   put:
 *     summary: Update scheduled post (reschedule)
 *     tags: [Scheduler]
 *     security:
 *       - bearerAuth: []
 */
router.put('/posts/:postId', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { scheduledTime, content, platform, status } = req.body;

  const post = await ScheduledPost.findOne({
    _id: postId,
    userId: req.user._id
  });

  if (!post) {
    return sendError(res, 'Post not found', 404);
  }

  if (scheduledTime) {
    post.scheduledTime = new Date(scheduledTime);
  }
  if (content) {
    post.content = { ...post.content, ...content };
  }
  if (platform) {
    post.platform = platform;
  }
  if (status) {
    post.status = status;
  }

  await post.save();
  sendSuccess(res, 'Post updated successfully', 200, post);
}));

module.exports = router;


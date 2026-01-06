const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/posts
 * Get user's posts with pagination and filtering
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      platform,
      scheduled_after,
      scheduled_before
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        excerpt,
        slug,
        status,
        featured_image,
        thumbnail,
        tags,
        categories,
        published_at,
        scheduled_at,
        created_at,
        updated_at,
        author_id
      `, { count: 'exact' })
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (scheduled_after) {
      query = query.gte('scheduled_at', scheduled_after);
    }

    if (scheduled_before) {
      query = query.lte('scheduled_at', scheduled_before);
    }

    const { data: posts, error, count } = await query;

    if (error) {
      console.error('Posts fetch error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }

    res.json({
      success: true,
      posts: posts || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * POST /api/posts
 * Create a new post
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      status = 'draft',
      featured_image,
      thumbnail,
      tags = [],
      categories = [],
      scheduled_at,
      platforms = []
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create post
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        excerpt,
        slug,
        status,
        featured_image,
        thumbnail,
        tags,
        categories,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
        author_id: req.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Post creation error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create post' });
    }

    // If scheduled, we could trigger scheduling logic here
    if (scheduled_at && status === 'scheduled') {
      // TODO: Implement scheduling logic
      logger.info('Post scheduled', { postId: post.id, scheduledAt: scheduled_at });
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * GET /api/posts/:id
 * Get a specific post
 */
router.get('/:id', auth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        excerpt,
        slug,
        status,
        featured_image,
        thumbnail,
        tags,
        categories,
        published_at,
        scheduled_at,
        created_at,
        updated_at,
        author_id
      `)
      .eq('id', id)
      .eq('author_id', req.user.id) // Ensure user owns the post
      .single();

    if (error || !post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, post });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * PUT /api/posts/:id
 * Update a post
 */
router.put('/:id', auth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      status,
      featured_image,
      thumbnail,
      tags,
      categories,
      scheduled_at
    } = req.body;

    // Generate new slug if title changed
    let slug;
    if (title) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (slug) updateData.slug = slug;
    if (status !== undefined) updateData.status = status;
    if (featured_image !== undefined) updateData.featured_image = featured_image;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (tags !== undefined) updateData.tags = tags;
    if (categories !== undefined) updateData.categories = categories;
    if (scheduled_at !== undefined) {
      updateData.scheduled_at = scheduled_at ? new Date(scheduled_at).toISOString() : null;
    }

    const { data: post, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .eq('author_id', req.user.id) // Ensure user owns the post
      .select()
      .single();

    if (error) {
      console.error('Post update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update post' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({
      success: true,
      message: 'Post updated successfully',
      post
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * DELETE /api/posts/:id
 * Delete a post
 */
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('author_id', req.user.id) // Ensure user owns the post
      .select()
      .single();

    if (error) {
      console.error('Post deletion error:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete post' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * POST /api/posts/:id/publish
 * Publish a draft post immediately
 */
router.post('/:id/publish', auth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const { data: post, error } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('author_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Post publish error:', error);
      return res.status(500).json({ success: false, error: 'Failed to publish post' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({
      success: true,
      message: 'Post published successfully',
      post
    });

  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

/**
 * POST /api/posts/:id/schedule
 * Schedule a post for future publishing
 */
router.post('/:id/schedule', auth, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at } = req.body;

    if (!scheduled_at) {
      return res.status(400).json({ success: false, error: 'Scheduled date is required' });
    }

    const scheduledDate = new Date(scheduled_at);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, error: 'Scheduled date must be in the future' });
    }

    const { data: post, error } = await supabase
      .from('posts')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString()
      })
      .eq('id', id)
      .eq('author_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Post schedule error:', error);
      return res.status(500).json({ success: false, error: 'Failed to schedule post' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // TODO: Implement actual scheduling logic (queue job, etc.)

    res.json({
      success: true,
      message: 'Post scheduled successfully',
      post
    });

  } catch (error) {
    console.error('Schedule post error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

module.exports = router;

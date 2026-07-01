const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// Supabase client will be created in route handlers to avoid loading issues
const createSupabaseClient = () => {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

/**
 * GET /api/posts
 * Get user's posts with pagination and filtering
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  // Dev users + supabase-less stacks: return empty list so the Posts page
  // renders "No posts yet" instead of 500ing.
  const userId = req.user._id || req.user.id;
  // Canonical dev detection (also catches the dev ObjectId form 000…001, which a
  // bare startsWith('dev-') misses since req.user._id is an ObjectId at runtime).
  const isDevUser = require('../utils/devUser').isDevUser(userId);
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (isDevUser || !supabaseConfigured) {
    return res.json({
      success: true,
      posts: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      isEmpty: true,
    });
  }

  try {
    const {
      page = 1,
      limit = 20,
      status,
      scheduled_after,
      scheduled_before
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Lazy publish: a scheduled post whose scheduled_at has passed becomes
    // 'published' on the next fetch. /api/posts scheduling previously enqueued to
    // a consumer-less BullMQ queue (SCHEDULED_POSTS has no worker) so a scheduled
    // blog post NEVER went live; this makes it actually publish without needing a
    // dedicated cron. Best-effort — the listing proceeds regardless.
    try {
      const nowIso = new Date().toISOString();
      await createSupabaseClient()
        .from('posts')
        .update({ status: 'published', published_at: nowIso })
        .eq('author_id', req.user.id)
        .eq('status', 'scheduled')
        .lte('scheduled_at', nowIso);
    } catch (_) { /* best effort; listing still returns current state */ }

    let query = createSupabaseClient()
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
      .range(offset, offset + parseInt(limit, 10) - 1);

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
      // Supabase schema/RLS errors used to bubble up as a 500 to a brand-new
      // user with no posts (the dashboard would render the angry "Failed
      // to fetch posts" toast). Fall through to an honest empty list +
      // isFallback flag so the UI renders the cold-start state.
      const logger = require('../utils/logger');
      logger.warn('[posts] Supabase query failed; returning empty list', { error: error.message, code: error.code });
      return res.json({
        success: true,
        posts: [],
        pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: 0, pages: 0 },
        isFallback: true,
      });
    }

    res.json({
      success: true,
      posts: posts || [],
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit, 10))
      }
    });

  } catch (error) {
    
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
      scheduled_at
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create post
    const { data: post, error } = await createSupabaseClient()
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
      
      return res.status(500).json({ success: false, error: 'Failed to create post' });
    }

    // Scheduled posts are stored with status:'scheduled' + scheduled_at and are
    // auto-published lazily on the next GET /api/posts once their time passes
    // (see the lazy-publish step there). No background job is enqueued — the
    // SCHEDULED_POSTS queue this used to target has no worker, so the job never
    // ran and the post never published.
    if (scheduled_at && status === 'scheduled') {
      logger.info('Post scheduled (auto-publishes on/after scheduled_at)', { postId: post.id, scheduledAt: scheduled_at });
    }

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    
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

    const { data: post, error } = await createSupabaseClient()
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

    const { data: post, error } = await createSupabaseClient()
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .eq('author_id', req.user.id) // Ensure user owns the post
      .select()
      .single();

    if (error) {
      
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

    const { data: post, error } = await createSupabaseClient()
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('author_id', req.user.id) // Ensure user owns the post
      .select()
      .single();

    if (error) {
      
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

    const { data: post, error } = await createSupabaseClient()
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

    const { data: post, error } = await createSupabaseClient()
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
      
      return res.status(500).json({ success: false, error: 'Failed to schedule post' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Auto-publishes lazily on the next GET /api/posts once scheduled_at passes
    // (the SCHEDULED_POSTS queue has no worker — no job is enqueued).
    logger.info('Post scheduled (auto-publishes on/after scheduled_at)', { postId: post.id, scheduledAt: post.scheduled_at });

    res.json({
      success: true,
      message: 'Post scheduled successfully',
      post
    });

  } catch (error) {
    
    res.status(500).json({ success: false, error: 'Server error' });
  }
}));

module.exports = router;

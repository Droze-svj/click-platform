const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const router = express.Router();

// ── MongoDB store (production has no Supabase) ──────────────────────────────
// Every handler below this block is Supabase-only; on a MongoDB deployment
// they answered "empty" / 503 "Blog post store is not configured", so the
// Posts page could never save a post. These handlers serve the same paths and
// response shapes from models/BlogPost when Supabase isn't configured.
const supabaseConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const mongoPosts = express.Router();
const { objectIdOrSkip, getPagination } = require('../middleware/validateObjectId');
const POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'];
const slugify = (title) => String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 30) : []);

/** Validated BlogPost fields from a create/update body (only keys present). */
function postFields(body, { creating }) {
  const out = {};
  const { title, content, excerpt, status, featured_image, thumbnail, tags, categories, platforms, scheduled_at } = body || {};
  if (title !== undefined || creating) {
    if (typeof title !== 'string' || !title.trim()) return { error: 'title is required' };
    out.title = title.trim();
    out.slug = slugify(out.title);
  }
  if (content !== undefined) out.content = typeof content === 'string' ? content : '';
  if (excerpt !== undefined) out.excerpt = typeof excerpt === 'string' ? excerpt.trim() : '';
  if (status !== undefined) {
    if (!POST_STATUSES.includes(status)) return { error: `status must be one of: ${POST_STATUSES.join(', ')}` };
    out.status = status;
    if (status === 'published') out.publishedAt = new Date();
  }
  if (featured_image !== undefined) out.featuredImage = typeof featured_image === 'string' ? featured_image : undefined;
  if (thumbnail !== undefined) out.thumbnail = typeof thumbnail === 'string' ? thumbnail : undefined;
  if (tags !== undefined) out.tags = strList(tags);
  if (categories !== undefined) out.categories = strList(categories);
  if (platforms !== undefined) out.platforms = strList(platforms);
  if (scheduled_at !== undefined) {
    const d = scheduled_at ? new Date(scheduled_at) : null;
    if (d && Number.isNaN(d.getTime())) return { error: 'scheduled_at is not a valid date' };
    out.scheduledAt = d;
  }
  return { fields: out };
}

// Scheduled posts go live once their time passes (checked on each listing,
// as the Supabase path does — there is no queue worker for these).
async function publishDue(userId) {
  const BlogPost = require('../models/BlogPost');
  const now = new Date();
  await BlogPost.updateMany(
    { userId, status: 'scheduled', scheduledAt: { $lte: now } },
    [{ $set: { status: 'published', publishedAt: '$scheduledAt' } }],
  );
}

mongoPosts.get('/', auth, asyncHandler(async (req, res) => {
  const BlogPost = require('../models/BlogPost');
  const { page, limit, skip } = getPagination(req.query);
  await publishDue(req.user._id).catch((e) => logger.warn('[posts] publishDue failed', { error: e.message }));
  const q = { userId: req.user._id };
  if (POST_STATUSES.includes(req.query.status)) q.status = req.query.status;
  const range = {};
  if (req.query.scheduled_after && !Number.isNaN(new Date(req.query.scheduled_after).getTime())) range.$gte = new Date(req.query.scheduled_after);
  if (req.query.scheduled_before && !Number.isNaN(new Date(req.query.scheduled_before).getTime())) range.$lte = new Date(req.query.scheduled_before);
  if (Object.keys(range).length) q.scheduledAt = range;
  const [docs, total] = await Promise.all([
    BlogPost.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    BlogPost.countDocuments(q),
  ]);
  res.json({ success: true, posts: docs.map((d) => d.toApi()), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

mongoPosts.post('/', auth, asyncHandler(async (req, res) => {
  const BlogPost = require('../models/BlogPost');
  const { fields, error } = postFields(req.body, { creating: true });
  if (error) return res.status(400).json({ success: false, error });
  if (fields.status === 'scheduled' && !(fields.scheduledAt && fields.scheduledAt > new Date())) {
    return res.status(400).json({ success: false, error: 'Scheduled date must be in the future' });
  }
  const post = await BlogPost.create({ ...fields, userId: req.user._id });
  res.status(201).json({ success: true, message: 'Post created successfully', post: post.toApi() });
}));

async function ownedPost(req) {
  const BlogPost = require('../models/BlogPost');
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return null;
  return BlogPost.findOne({ _id: req.params.id, userId: req.user._id });
}

mongoPosts.get('/:id', objectIdOrSkip('id'), auth, asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
  res.json({ success: true, post: post.toApi() });
}));

mongoPosts.put('/:id', objectIdOrSkip('id'), auth, asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
  const { fields, error } = postFields(req.body, { creating: false });
  if (error) return res.status(400).json({ success: false, error });
  if (fields.status === 'published' && post.publishedAt) delete fields.publishedAt; // keep the first publish date
  post.set(fields);
  await post.save();
  res.json({ success: true, message: 'Post updated successfully', post: post.toApi() });
}));

mongoPosts.delete('/:id', objectIdOrSkip('id'), auth, asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
  await post.deleteOne();
  res.json({ success: true, message: 'Post deleted successfully' });
}));

mongoPosts.post('/:id/publish', objectIdOrSkip('id'), auth, asyncHandler(async (req, res) => {
  const post = await ownedPost(req);
  if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
  post.set({ status: 'published', publishedAt: new Date() });
  await post.save();
  res.json({ success: true, message: 'Post published successfully', post: post.toApi() });
}));

mongoPosts.post('/:id/schedule', objectIdOrSkip('id'), auth, asyncHandler(async (req, res) => {
  const when = new Date(req.body && req.body.scheduled_at);
  if (!req.body || !req.body.scheduled_at || Number.isNaN(when.getTime())) {
    return res.status(400).json({ success: false, error: 'Scheduled date is required' });
  }
  if (when <= new Date()) return res.status(400).json({ success: false, error: 'Scheduled date must be in the future' });
  const post = await ownedPost(req);
  if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
  post.set({ status: 'scheduled', scheduledAt: when });
  await post.save();
  res.json({ success: true, message: 'Post scheduled successfully', post: post.toApi() });
}));

router.use((req, res, next) => (supabaseConfigured() ? next() : mongoPosts(req, res, next)));

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

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    // The blog-post store is Supabase-only; without it (dev/Mongoose-mode) a post
    // can't be persisted — honest 503 instead of a createClient('','') 500.
    const isDevUser = require('../utils/devUser').isDevUser(req.user._id || req.user.id);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(503).json({ success: false, error: 'Blog post store is not configured' });
    }

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

    // Same guard as the list route: with no Supabase posts store (dev user or
    // supabase-less stack) no post can exist — honest 404, not a 500 from
    // createClient('', '') throwing.
    const userId = req.user._id || req.user.id;
    const isDevUser = require('../utils/devUser').isDevUser(userId);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

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
    const isDevUser = require('../utils/devUser').isDevUser(req.user._id || req.user.id);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
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
    const isDevUser = require('../utils/devUser').isDevUser(req.user._id || req.user.id);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

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

    // Same guard the sibling handlers use: with no Supabase configured (or a
    // dev user, whose id is not a Supabase author_id) createSupabaseClient()
    // returns null and `.from()` throws, which the outer catch turned into an
    // opaque 500. The blog-post store simply holds nothing for this caller.
    const isDevUser = require('../utils/devUser').isDevUser(req.user._id || req.user.id);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

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

    // Same guard the sibling handlers use: with no Supabase configured (or a
    // dev user, whose id is not a Supabase author_id) createSupabaseClient()
    // returns null and `.from()` throws, which the outer catch turned into an
    // opaque 500. The blog-post store simply holds nothing for this caller.
    const isDevUser = require('../utils/devUser').isDevUser(req.user._id || req.user.id);
    const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (isDevUser || !supabaseConfigured) {
      return res.status(404).json({ success: false, error: 'Post not found' });
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

// Content Ops API Routes
// Developer-friendly API for CMS, DAM, CRM integrations

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentApproval = require('../models/ContentApproval');
const ApiKey = require('../models/ApiKey');
const ApiUsage = require('../models/ApiUsage');
const { triggerWebhook } = require('../services/webhookService');
const logger = require('../utils/logger');
const { createRateLimiter } = require('../middleware/enhancedRateLimiter');

const router = express.Router();

// API versioning middleware
const apiVersion = (req, res, next) => {
  const version = req.headers['api-version'] || req.query.version || 'v1';
  req.apiVersion = version;
  next();
};

router.use(apiVersion);

// Track API usage middleware
const trackApiUsage = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Track usage asynchronously (don't block response)
    if (req.apiKey) {
      ApiUsage.create({
        apiKeyId: req.apiKey._id,
        userId: req.user._id,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        requestSize: JSON.stringify(req.body).length,
        responseSize: data ? data.length : 0,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }).catch(err => logger.warn('Failed to track API usage', { error: err.message }));
    }

    originalSend.call(this, data);
  };

  next();
};

router.use(trackApiUsage);

/**
 * API Key authentication middleware
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const keyHash = ApiKey.hashKey(apiKey);
    const key = await ApiKey.findOne({ keyHash, isActive: true }).populate('userId');

    if (!key) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Update last used
    key.lastUsedAt = new Date();
    await key.save();

    // Attach user and scopes to request
    req.user = key.userId;
    req.apiKey = key;
    req.scopes = key.scopes;

    next();
  } catch (error) {
    logger.error('API key authentication error', { error: error.message });
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Check if API key has required scope
 */
const requireScope = (...scopes) => {
  return (req, res, next) => {
    if (!req.scopes || !scopes.some(scope => req.scopes.includes(scope))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Support both JWT auth and API key auth
router.use((req, res, next) => {
  const apiKey = req.header('X-API-Key') || req.header('Authorization')?.startsWith('ck_');
  if (apiKey) {
    return apiKeyAuth(req, res, next);
  } else {
    return auth(req, res, next);
  }
});

/**
 * GET /api/content-ops/content
 * List content (CMS/DAM compatible)
 */
router.get('/content', auth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type = null,
    status = null,
    platform = null,
    tags = null,
    search = null
  } = req.query;

  const query = { userId: req.user._id };

  if (type) query.type = type;
  if (status) query.status = status;
  if (platform) query.platforms = platform;
  if (tags) query.tags = { $in: tags.split(',') };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { 'content.text': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [content, total] = await Promise.all([
    Content.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .maxTimeMS(8000)
      .lean(),
    Content.countDocuments(query).maxTimeMS(8000)
  ]);

  sendSuccess(res, 'Content retrieved', 200, {
    content,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/content-ops/content/:id
 * Get single content item
 */
router.get('/content/:id', auth, asyncHandler(async (req, res) => {
  const content = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id
  }).lean();

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  sendSuccess(res, 'Content retrieved', 200, content);
}));

/**
 * POST /api/content-ops/content
 * Create content (CMS/DAM compatible)
 */
router.post('/content', auth, asyncHandler(async (req, res) => {
  const {
    title,
    type = 'post',
    content: contentData,
    platforms = [],
    tags = [],
    metadata = {}
  } = req.body;

  const newContent = new Content({
    userId: req.user._id,
    title,
    type,
    content: contentData || {},
    platforms: Array.isArray(platforms) ? platforms : [platforms],
    tags: Array.isArray(tags) ? tags : tags.split(','),
    metadata
  });

  await newContent.save();

  // Trigger webhook
  await triggerWebhook(req.user._id, 'content.created', {
    contentId: newContent._id,
    title,
    type,
    platforms,
    createdAt: newContent.createdAt
  });

  sendSuccess(res, 'Content created', 201, newContent);
}));

/**
 * PUT /api/content-ops/content/:id
 * Update content
 */
router.put('/content/:id', auth, asyncHandler(async (req, res) => {
  const content = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  Object.assign(content, req.body);
  await content.save();

  // Trigger webhook
  await triggerWebhook(req.user._id, 'content.updated', {
    contentId: content._id,
    changes: req.body
  });

  sendSuccess(res, 'Content updated', 200, content);
}));

/**
 * DELETE /api/content-ops/content/:id
 * Delete content
 */
router.delete('/content/:id', auth, asyncHandler(async (req, res) => {
  const content = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  await content.deleteOne();

  // Trigger webhook
  await triggerWebhook(req.user._id, 'content.deleted', {
    contentId: req.params.id
  });

  sendSuccess(res, 'Content deleted', 200, { id: req.params.id });
}));

/**
 * GET /api/content-ops/assets
 * List assets (DAM compatible)
 */
router.get('/assets', auth, asyncHandler(async (req, res) => {
  const {
    type = null,
    page = 1,
    limit = 20
  } = req.query;

  const query = { userId: req.user._id };
  if (type) {
    query['content.images'] = { $exists: type === 'image' };
    query['content.videos'] = { $exists: type === 'video' };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const content = await Content.find(query)
    .select('title content.images content.videos metadata createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const assets = [];
  content.forEach(item => {
    if (item.content?.images) {
      item.content.images.forEach(img => {
        assets.push({
          id: `${item._id}_img_${assets.length}`,
          type: 'image',
          url: img,
          contentId: item._id,
          title: item.title,
          createdAt: item.createdAt
        });
      });
    }
    if (item.content?.videos) {
      item.content.videos.forEach(vid => {
        assets.push({
          id: `${item._id}_vid_${assets.length}`,
          type: 'video',
          url: vid,
          contentId: item._id,
          title: item.title,
          createdAt: item.createdAt
        });
      });
    }
  });

  sendSuccess(res, 'Assets retrieved', 200, { assets });
}));

/**
 * GET /api/content-ops/posts
 * List posts (published/scheduled)
 */
router.get('/posts', auth, asyncHandler(async (req, res) => {
  const {
    status = null,
    platform = null,
    startDate = null,
    endDate = null,
    page = 1,
    limit = 20
  } = req.query;

  const query = { userId: req.user._id };
  if (status) query.status = status;
  if (platform) query.platform = platform;
  if (startDate || endDate) {
    query.postedAt = {};
    if (startDate) query.postedAt.$gte = new Date(startDate);
    if (endDate) query.postedAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [posts, total] = await Promise.all([
    ScheduledPost.find(query)
      .populate('contentId', 'title type')
      .sort({ postedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    ScheduledPost.countDocuments(query)
  ]);

  sendSuccess(res, 'Posts retrieved', 200, {
    posts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/content-ops/analytics
 * Get analytics (data warehouse compatible)
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    platform = null,
    groupBy = 'day' // day, week, month
  } = req.query;

  const query = {
    userId: req.user._id,
    status: 'posted'
  };

  if (platform) query.platform = platform;
  if (startDate || endDate) {
    query.postedAt = {};
    if (startDate) query.postedAt.$gte = new Date(startDate);
    if (endDate) query.postedAt.$lte = new Date(endDate);
  }

  const posts = await ScheduledPost.find(query).lean();

  const analytics = {
    totalPosts: posts.length,
    totalEngagement: 0,
    totalImpressions: 0,
    totalClicks: 0,
    byPlatform: {},
    byDate: {}
  };

  posts.forEach(post => {
    const engagement = post.analytics?.engagement || 0;
    const impressions = post.analytics?.impressions || 0;
    const clicks = post.analytics?.clicks || 0;

    analytics.totalEngagement += engagement;
    analytics.totalImpressions += impressions;
    analytics.totalClicks += clicks;

    // By platform
    if (!analytics.byPlatform[post.platform]) {
      analytics.byPlatform[post.platform] = {
        posts: 0,
        engagement: 0,
        impressions: 0,
        clicks: 0
      };
    }
    analytics.byPlatform[post.platform].posts++;
    analytics.byPlatform[post.platform].engagement += engagement;
    analytics.byPlatform[post.platform].impressions += impressions;
    analytics.byPlatform[post.platform].clicks += clicks;

    // By date
    const date = new Date(post.postedAt);
    let dateKey;
    if (groupBy === 'day') {
      dateKey = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const week = Math.floor(date.getDate() / 7);
      dateKey = `${date.getFullYear()}-W${week}`;
    } else {
      dateKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    }

    if (!analytics.byDate[dateKey]) {
      analytics.byDate[dateKey] = {
        posts: 0,
        engagement: 0,
        impressions: 0,
        clicks: 0
      };
    }
    analytics.byDate[dateKey].posts++;
    analytics.byDate[dateKey].engagement += engagement;
    analytics.byDate[dateKey].impressions += impressions;
    analytics.byDate[dateKey].clicks += clicks;
  });

  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * GET /api/content-ops/approvals
 * List approvals (CRM compatible)
 */
router.get('/approvals', requireScope('approvals.read'), asyncHandler(async (req, res) => {
  const {
    status = null,
    page = 1,
    limit = 20
  } = req.query;

  const query = { createdBy: req.user._id };
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [approvals, total] = await Promise.all([
    ContentApproval.find(query)
      .populate('contentId', 'title type')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    ContentApproval.countDocuments(query)
  ]);

  sendSuccess(res, 'Approvals retrieved', 200, {
    approvals,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * POST /api/content-ops/content/batch
 * Batch create/update/delete content
 */
router.post('/content/batch', requireScope('content.write'), asyncHandler(async (req, res) => {
  const { operations } = req.body;

  if (!Array.isArray(operations) || operations.length === 0) {
    return sendError(res, 'Operations array is required', 400);
  }

  if (operations.length > 100) {
    return sendError(res, 'Maximum 100 operations per batch', 400);
  }

  const results = {
    created: [],
    updated: [],
    deleted: [],
    errors: []
  };

  for (const op of operations) {
    try {
      if (op.action === 'create') {
        const content = new Content({
          userId: req.user._id,
          ...op.data
        });
        await content.save();
        results.created.push({ id: content._id, operation: op.id });
        
        await triggerWebhook(req.user._id, 'content.created', {
          contentId: content._id,
          title: content.title,
          type: content.type
        });
      } else if (op.action === 'update') {
        const content = await Content.findOne({
          _id: op.id,
          userId: req.user._id
        });
        if (!content) {
          results.errors.push({ operation: op.id, error: 'Content not found' });
          continue;
        }
        Object.assign(content, op.data);
        await content.save();
        results.updated.push({ id: content._id, operation: op.id });
        
        await triggerWebhook(req.user._id, 'content.updated', {
          contentId: content._id,
          changes: op.data
        });
      } else if (op.action === 'delete') {
        const content = await Content.findOne({
          _id: op.id,
          userId: req.user._id
        });
        if (!content) {
          results.errors.push({ operation: op.id, error: 'Content not found' });
          continue;
        }
        await content.deleteOne();
        results.deleted.push({ id: op.id, operation: op.id });
        
        await triggerWebhook(req.user._id, 'content.deleted', {
          contentId: op.id
        });
      }
    } catch (error) {
      results.errors.push({ operation: op.id, error: error.message });
    }
  }

  sendSuccess(res, 'Batch operations completed', 200, results);
}));

/**
 * POST /api/content-ops/api-keys
 * Create API key
 */
router.post('/api-keys', auth, asyncHandler(async (req, res) => {
  const { name, scopes, expiresInDays, workspaceId } = req.body;

  if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
    return sendError(res, 'Name and scopes are required', 400);
  }

  const key = ApiKey.generateKey();
  const keyHash = ApiKey.hashKey(key);
  const keyPrefix = key.substring(0, 7);

  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = new ApiKey({
    userId: req.user._id,
    workspaceId: workspaceId || null,
    name,
    keyPrefix,
    keyHash,
    scopes,
    expiresAt
  });

  await apiKey.save();

  // Return key only once
  sendSuccess(res, 'API key created', 201, {
    id: apiKey._id,
    name: apiKey.name,
    key: key, // Only returned on creation
    keyPrefix: apiKey.keyPrefix,
    scopes: apiKey.scopes,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt
  });
}));

/**
 * GET /api/content-ops/api-keys
 * List API keys
 */
router.get('/api-keys', auth, asyncHandler(async (req, res) => {
  const apiKeys = await ApiKey.find({ userId: req.user._id })
    .select('-keyHash')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'API keys retrieved', 200, { apiKeys });
}));

/**
 * DELETE /api/content-ops/api-keys/:id
 * Revoke API key
 */
router.delete('/api-keys/:id', auth, asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!apiKey) {
    return sendError(res, 'API key not found', 404);
  }

  apiKey.isActive = false;
  await apiKey.save();

  sendSuccess(res, 'API key revoked', 200, { id: req.params.id });
}));

/**
 * GET /api/content-ops/webhooks
 * List webhooks (for API key management)
 */
router.get('/webhooks', requireScope('webhooks.read'), asyncHandler(async (req, res) => {
  const Webhook = require('../models/Webhook');
  const webhooks = await Webhook.find({ userId: req.user._id })
    .select('-secret')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Webhooks retrieved', 200, { webhooks });
}));

/**
 * POST /api/content-ops/webhooks
 * Create webhook
 */
router.post('/webhooks', requireScope('webhooks.write'), asyncHandler(async (req, res) => {
  const { createWebhook } = require('../services/webhookService');
  const webhook = await createWebhook(req.user._id, req.body);
  
  // Don't send secret in response
  const response = webhook.toObject();
  delete response.secret;

  sendSuccess(res, 'Webhook created', 201, response);
}));

/**
 * GET /api/content-ops/usage
 * Get API usage analytics
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;
  const query = { userId: req.user._id };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  const usage = await ApiUsage.find(query).sort({ timestamp: -1 }).lean();

  const analytics = {
    totalRequests: usage.length,
    totalErrors: usage.filter(u => u.statusCode >= 400).length,
    averageResponseTime: usage.length > 0
      ? Math.round(usage.reduce((sum, u) => sum + (u.responseTime || 0), 0) / usage.length)
      : 0,
    byEndpoint: {},
    byStatusCode: {},
    byDate: {}
  };

  usage.forEach(record => {
    // By endpoint
    if (!analytics.byEndpoint[record.endpoint]) {
      analytics.byEndpoint[record.endpoint] = { count: 0, avgResponseTime: 0, errors: 0 };
    }
    analytics.byEndpoint[record.endpoint].count++;
    analytics.byEndpoint[record.endpoint].avgResponseTime += record.responseTime || 0;
    if (record.statusCode >= 400) analytics.byEndpoint[record.endpoint].errors++;

    // By status code
    if (!analytics.byStatusCode[record.statusCode]) {
      analytics.byStatusCode[record.statusCode] = 0;
    }
    analytics.byStatusCode[record.statusCode]++;

    // By date
    const date = new Date(record.timestamp);
    let dateKey;
    if (groupBy === 'day') {
      dateKey = date.toISOString().split('T')[0];
    } else if (groupBy === 'hour') {
      dateKey = `${date.toISOString().split('T')[0]}T${String(date.getHours()).padStart(2, '0')}:00:00Z`;
    } else {
      dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!analytics.byDate[dateKey]) {
      analytics.byDate[dateKey] = { requests: 0, errors: 0, avgResponseTime: 0 };
    }
    analytics.byDate[dateKey].requests++;
    if (record.statusCode >= 400) analytics.byDate[dateKey].errors++;
    analytics.byDate[dateKey].avgResponseTime += record.responseTime || 0;
  });

  // Calculate averages
  Object.keys(analytics.byEndpoint).forEach(endpoint => {
    const ep = analytics.byEndpoint[endpoint];
    ep.avgResponseTime = Math.round(ep.avgResponseTime / ep.count);
  });

  Object.keys(analytics.byDate).forEach(date => {
    const d = analytics.byDate[date];
    d.avgResponseTime = Math.round(d.avgResponseTime / d.requests);
  });

  sendSuccess(res, 'API usage analytics retrieved', 200, analytics);
}));

/**
 * POST /api/content-ops/content/export
 * Export content in various formats
 */
router.post('/content/export', requireScope('content.read'), asyncHandler(async (req, res) => {
  const { format = 'json', contentIds = [], filters = {} } = req.body;

  const query = { userId: req.user._id };
  if (contentIds.length > 0) {
    query._id = { $in: contentIds };
  }
  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.tags) query.tags = { $in: filters.tags };

  const content = await Content.find(query).lean();

  let exportData;
  let contentType;
  let filename;

  switch (format) {
    case 'json':
      exportData = JSON.stringify(content, null, 2);
      contentType = 'application/json';
      filename = `content-export-${Date.now()}.json`;
      break;
    case 'csv':
      // Convert to CSV
      const headers = ['id', 'title', 'type', 'status', 'createdAt', 'tags'];
      const rows = content.map(c => [
        c._id,
        c.title || '',
        c.type || '',
        c.status || '',
        c.createdAt || '',
        (c.tags || []).join(';')
      ]);
      exportData = [headers, ...rows].map(row => row.join(',')).join('\n');
      contentType = 'text/csv';
      filename = `content-export-${Date.now()}.csv`;
      break;
    default:
      return sendError(res, 'Unsupported export format', 400);
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(exportData);
}));

/**
 * POST /api/content-ops/content/import
 * Import content from various formats
 */
router.post('/content/import', requireScope('content.write'), asyncHandler(async (req, res) => {
  const { format = 'json', data } = req.body;

  if (!data) {
    return sendError(res, 'Import data is required', 400);
  }

  let contentArray = [];

  try {
    if (format === 'json') {
      contentArray = typeof data === 'string' ? JSON.parse(data) : data;
    } else if (format === 'csv') {
      // Simple CSV parsing (in production, use a proper CSV parser)
      const lines = data.split('\n');
      const headers = lines[0].split(',');
      contentArray = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim() || '';
        });
        return obj;
      });
    } else {
      return sendError(res, 'Unsupported import format', 400);
    }

    if (!Array.isArray(contentArray)) {
      return sendError(res, 'Import data must be an array', 400);
    }

    if (contentArray.length > 100) {
      return sendError(res, 'Maximum 100 items per import', 400);
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < contentArray.length; i++) {
      try {
        const item = contentArray[i];
        const content = new Content({
          userId: req.user._id,
          title: item.title || 'Imported Content',
          type: item.type || 'article',
          description: item.description || '',
          tags: item.tags ? (Array.isArray(item.tags) ? item.tags : item.tags.split(';')) : [],
          status: 'completed',
          metadata: {
            imported: true,
            importDate: new Date()
          }
        });
        await content.save();
        imported.push({ index: i, id: content._id });

        await triggerWebhook(req.user._id, 'content.created', {
          contentId: content._id,
          title: content.title,
          type: content.type,
          imported: true
        });
      } catch (error) {
        errors.push({ index: i, error: error.message });
      }
    }

    sendSuccess(res, 'Content imported', 200, {
      imported: imported.length,
      errors: errors.length,
      details: { imported, errors }
    });
  } catch (error) {
    logger.error('Error importing content', { error: error.message });
    return sendError(res, 'Import failed: ' + error.message, 500);
  }
}));

/**
 * GET /api/content-ops/search
 * Advanced content search
 */
router.get('/search', requireScope('content.read'), asyncHandler(async (req, res) => {
  const {
    q,
    type,
    status,
    tags,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = req.query;

  const query = { userId: req.user._id };

  if (q) {
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } }
    ];
  }
  if (type) query.type = type;
  if (status) query.status = status;
  if (tags) query.tags = { $in: tags.split(',') };
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [results, total] = await Promise.all([
    Content.find(query).sort(sort).limit(parseInt(limit)).skip(skip).maxTimeMS(8000).lean(),
    Content.countDocuments(query).maxTimeMS(8000)
  ]);

  sendSuccess(res, 'Search completed', 200, {
    results,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

module.exports = router;


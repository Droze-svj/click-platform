// CDN & Edge Caching Service

const { getOrSet, set, del } = require('./cacheService');
const { recordCacheHit, recordCacheMiss, recordPurge } = require('./cdnAnalyticsService');
const logger = require('../utils/logger');

// CDN providers
const CDN_PROVIDERS = {
  CLOUDFRONT: 'cloudfront',
  CLOUDFLARE: 'cloudflare',
  FASTLY: 'fastly',
};

let cdnProvider = null;
let cdnClient = null;

/**
 * Initialize CDN
 */
async function initCDN() {
  try {
    const provider = process.env.CDN_PROVIDER || 'cloudflare';

    switch (provider) {
      case 'cloudfront':
        await initCloudFront();
        break;
      case 'cloudflare':
        await initCloudflare();
        break;
      default:
        logger.warn('CDN provider not configured, using cache fallback');
        cdnProvider = null;
    }
  } catch (error) {
    logger.warn('CDN initialization failed, using cache fallback', {
      error: error.message,
    });
    cdnProvider = null;
  }
}

/**
 * Initialize AWS CloudFront
 */
async function initCloudFront() {
  try {
    const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
    
    cdnClient = new CloudFrontClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    cdnProvider = CDN_PROVIDERS.CLOUDFRONT;
    logger.info('CloudFront CDN initialized');
  } catch (error) {
    logger.warn('CloudFront initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Initialize Cloudflare
 */
async function initCloudflare() {
  try {
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiKey || !zoneId) {
      throw new Error('Cloudflare API key and zone ID required');
    }

    cdnProvider = CDN_PROVIDERS.CLOUDFLARE;
    logger.info('Cloudflare CDN initialized');
  } catch (error) {
    logger.warn('Cloudflare initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Purge CDN cache
 */
async function purgeCache(paths) {
  try {
    if (!cdnProvider) {
      // Fallback to local cache invalidation
      for (const path of paths) {
        await del(path);
      }
      return { success: true, method: 'local' };
    }

    switch (cdnProvider) {
      case CDN_PROVIDERS.CLOUDFRONT:
        return await purgeCloudFront(paths);
      case CDN_PROVIDERS.CLOUDFLARE:
        return await purgeCloudflare(paths);
      default:
        return { success: false, error: 'Unknown CDN provider' };
    }
  } catch (error) {
    logger.error('Purge CDN cache error', { error: error.message, paths });
    throw error;
  }
}

/**
 * Purge CloudFront cache
 */
async function purgeCloudFront(paths) {
  try {
    const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
    const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

    if (!distributionId) {
      throw new Error('CloudFront distribution ID required');
    }

    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
        CallerReference: `invalidation-${Date.now()}`,
      },
    });

    const response = await cdnClient.send(command);

    logger.info('CloudFront cache purged', {
      paths: paths.length,
      invalidationId: response.Invalidation?.Id,
    });

    // Record purge in analytics
    recordPurge(paths);

    return {
      success: true,
      method: 'cloudfront',
      invalidationId: response.Invalidation?.Id,
    };
  } catch (error) {
    logger.error('Purge CloudFront error', { error: error.message });
    throw error;
  }
}

/**
 * Purge Cloudflare cache
 */
async function purgeCloudflare(paths) {
  try {
    const axios = require('axios');
    const apiKey = process.env.CLOUDFLARE_API_KEY;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        files: paths,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Cloudflare cache purged', {
      paths: paths.length,
      success: response.data.success,
    });

    // Record purge in analytics
    recordPurge(paths);

    return {
      success: response.data.success,
      method: 'cloudflare',
    };
  } catch (error) {
    logger.error('Purge Cloudflare error', { error: error.message });
    throw error;
  }
}

/**
 * Get CDN URL for asset
 */
function getCDNUrl(path) {
  if (!cdnProvider) {
    return path; // Return original path if no CDN
  }

  const cdnDomain = process.env.CDN_DOMAIN;
  if (!cdnDomain) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `https://${cdnDomain}${normalizedPath}`;
}

/**
 * Cache at edge
 */
async function cacheAtEdge(key, value, ttl = 3600) {
  try {
    // Store in local cache (which can be replicated to edge)
    await set(key, value, ttl);

    // If CDN is configured, the cache will be distributed
    return { success: true };
  } catch (error) {
    logger.error('Cache at edge error', { error: error.message, key });
    throw error;
  }
}

/**
 * Get edge cache status
 */
function getCDNStatus() {
  return {
    enabled: cdnProvider !== null,
    provider: cdnProvider,
    domain: process.env.CDN_DOMAIN || null,
  };
}

module.exports = {
  initCDN,
  purgeCache,
  getCDNUrl,
  cacheAtEdge,
  getCDNStatus,
};


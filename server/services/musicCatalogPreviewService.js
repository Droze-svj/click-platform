// Music Catalog Preview Service
// Handles preview streaming and temporary downloads respecting provider limits

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const { getSignedUrlForFile, uploadFile } = require('./storageService');

/**
 * Preview cache configuration
 */
const PREVIEW_CACHE_TTL = 3600000; // 1 hour
const previewCache = new Map(); // In-memory cache for preview URLs

/**
 * Get preview URL for track
 */
async function getPreviewUrl(trackId, source, userId) {
  try {
    // Check cache
    const cacheKey = `${source}:${trackId}`;
    const cached = previewCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < PREVIEW_CACHE_TTL) {
      return cached.url;
    }

    let previewUrl;

    if (source === 'licensed') {
      const MusicLicense = require('../models/MusicLicense');
      const track = await MusicLicense.findById(trackId).lean();
      if (!track) throw new Error('Track not found');
      previewUrl = track.previewUrl;
    } else if (source === 'ai_generated' || source === 'user_upload') {
      const Music = require('../models/Music');
      const track = await Music.findById(trackId).lean();
      if (!track) throw new Error('Track not found');
      previewUrl = track.file?.url;
    } else {
      throw new Error('Invalid source');
    }

    // Cache preview URL
    if (previewUrl) {
      previewCache.set(cacheKey, {
        url: previewUrl,
        timestamp: Date.now()
      });
    }

    return previewUrl;
  } catch (error) {
    logger.error('Error getting preview URL', { error: error.message, trackId, source });
    throw error;
  }
}

/**
 * Stream preview audio (respects provider caching limits)
 */
async function streamPreview(trackId, source, userId, req, res) {
  try {
    const previewUrl = await getPreviewUrl(trackId, source, userId);

    if (!previewUrl) {
      return res.status(404).json({ error: 'Preview not available' });
    }

    // For external URLs, proxy the request
    if (previewUrl.startsWith('http')) {
      const response = await axios.get(previewUrl, {
        responseType: 'stream',
        headers: {
          'Range': req.headers.range || undefined
        }
      });

      // Set appropriate headers
      res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
      }

      // Stream the response
      response.data.pipe(res);
    } else {
      // Local file
      const filePath = path.join(__dirname, '../../uploads', previewUrl.replace(/^\/uploads\//, ''));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Preview file not found' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/mpeg',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'audio/mpeg',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    }
  } catch (error) {
    logger.error('Error streaming preview', { error: error.message, trackId, source });
    res.status(500).json({ error: 'Failed to stream preview' });
  }
}

/**
 * Download track for editing (temporary, respects provider limits)
 */
async function downloadTrackForEditing(trackId, source, userId) {
  try {
    // Check if we can download (some providers don't allow)
    if (source === 'licensed') {
      const MusicLicense = require('../models/MusicLicense');
      const track = await MusicLicense.findById(trackId).lean();
      
      if (!track) throw new Error('Track not found');
      
      // Check if download is allowed (many licensed tracks only allow streaming)
      // For editing, we might need to use preview or request download permission
      if (!track.downloadUrl) {
        // Use preview URL if download not available
        return {
          url: track.previewUrl,
          temporary: true,
          expiresAt: new Date(Date.now() + 3600000) // 1 hour
        };
      }
    }

    // For AI-generated and user uploads, return file URL
    if (source === 'ai_generated' || source === 'user_upload') {
      const Music = require('../models/Music');
      const track = await Music.findById(trackId).lean();
      
      if (!track) throw new Error('Track not found');
      
      return {
        url: track.file?.url,
        temporary: false,
        storage: track.file?.storage || 'local'
      };
    }

    throw new Error('Unsupported source for download');
  } catch (error) {
    logger.error('Error downloading track for editing', {
      error: error.message,
      trackId,
      source,
      userId
    });
    throw error;
  }
}

/**
 * Clear preview cache
 */
function clearPreviewCache() {
  previewCache.clear();
  logger.info('Preview cache cleared');
}

/**
 * Get preview cache stats
 */
function getPreviewCacheStats() {
  const now = Date.now();
  let valid = 0;
  let expired = 0;

  previewCache.forEach((value, key) => {
    if (now - value.timestamp < PREVIEW_CACHE_TTL) {
      valid++;
    } else {
      expired++;
    }
  });

  return {
    total: previewCache.size,
    valid,
    expired
  };
}

module.exports = {
  getPreviewUrl,
  streamPreview,
  downloadTrackForEditing,
  clearPreviewCache,
  getPreviewCacheStats
};








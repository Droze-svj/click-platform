/**
 * TikTok Social Media Service
 * Handles posting videos to TikTok via the Content Posting API
 */

const axios = require('axios');
const logger = require('../utils/logger');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const downloadUtils = require('../utils/downloadUtils');

const API_BASE = 'https://open.tiktokapis.com/v2';
const TIKTOK_MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024; // 300 MB
const TIKTOK_MAX_CHUNK_BYTES = 64 * 1024 * 1024;     // 64 MB — TikTok chunk_size ceiling
const TIKTOK_TITLE_MAX = 2200;                        // TikTok caption length cap

/**
 * Upload + publish a local video file to TikTok via the Content Posting API.
 * Spec-correct chunked upload: init declares chunk_size + total_chunk_count, then
 * each chunk is PUT to upload_url with the REQUIRED `Content-Range` header.
 *   - size ≤ 64MB  → one chunk (chunk_size = size)
 *   - size  > 64MB → 64MB chunks; total = floor(size/64MB); the LAST chunk runs
 *     to EOF (TikTok permits the final chunk up to 2× chunk_size).
 * Honest return: status:'processing', url:null (TikTok processes asynchronously).
 * @param {string} accessToken
 * @param {string} videoPath  local file path
 * @param {{caption?: string}} [opts]
 */
async function uploadVideoToTikTok(accessToken, videoPath, opts = {}) {
  try {
    if (!accessToken) {
      throw new Error('No TikTok access token provided');
    }

    const title = (typeof opts.caption === 'string' ? opts.caption : '').slice(0, TIKTOK_TITLE_MAX);
    const size = fs.statSync(videoPath).size;
    if (!size) throw new Error('TikTok upload: video file is empty');

    const chunkSize = size <= TIKTOK_MAX_CHUNK_BYTES ? size : TIKTOK_MAX_CHUNK_BYTES;
    const totalChunks = size <= TIKTOK_MAX_CHUNK_BYTES ? 1 : Math.floor(size / chunkSize);

    logger.info('TikTok: initializing upload', { size, chunkSize, totalChunks });

    // Phase 1: initialize the upload.
    const initResponse = await axios.post(`${API_BASE}/post/publish/video/init/`, {
      post_info: {
        title,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_ad_tag: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks,
      },
    }, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const { publish_id, upload_url } = initResponse.data.data;
    logger.info('TikTok: upload initialized', { publish_id });

    // Phase 2: PUT each chunk with the REQUIRED Content-Range header.
    const videoData = fs.readFileSync(videoPath);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = (i === totalChunks - 1) ? size - 1 : start + chunkSize - 1; // last chunk → EOF
      const chunk = videoData.subarray(start, end + 1);
      await axios.put(upload_url, chunk, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': chunk.length,
          'Content-Range': `bytes ${start}-${end}/${size}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    }

    logger.info('TikTok: video uploaded; TikTok is processing it (not live yet)', { publish_id, totalChunks });
    return {
      id: publish_id,
      postId: publish_id,
      publishId: publish_id,
      status: 'processing',
      url: null,
    };
  } catch (error) {
    logger.error('TikTok: Upload failed', { error: error.response?.data || error.message });
    throw error;
  }
}

/**
 * Build the TikTok caption from the dispatch contentData: the post text
 * (title/description/caption) plus normalized hashtags from `tags`.
 */
function buildPostCaption(contentData) {
  const d = contentData || {};
  const base = String(d.title || d.description || d.caption || d.text || '').trim();
  const tags = Array.isArray(d.tags)
    ? d.tags.filter(Boolean).map((t) => `#${String(t).replace(/^#/, '').replace(/\s+/g, '')}`)
    : [];
  return [base, tags.join(' ')].filter(Boolean).join(' ').trim().slice(0, TIKTOK_TITLE_MAX);
}

async function postToTikTok(authData, contentData) {
  const accessToken = authData?.accessToken;
  if (!accessToken || accessToken === 'dev-token') {
    logger.info('[DevMode] Mocking TikTok publish');
    return {
      id: `mock-tiktok-${Date.now()}`,
      url: `https://tiktok.com/mock-post-${Date.now()}`
    };
  }

  const { videoPath, mediaUrl } = contentData || {};
  const caption = buildPostCaption(contentData);
  const isRemote = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);

  // 1. A local file already on disk → upload it directly.
  const local = videoPath || mediaUrl;
  if (local && !isRemote(local) && fs.existsSync(local)) {
    return uploadVideoToTikTok(accessToken, local, { caption });
  }

  // 2. A remote URL → download it to a temp file, upload, then clean up.
  const remote = isRemote(mediaUrl) ? mediaUrl : (isRemote(videoPath) ? videoPath : null);
  if (remote) {
    const tmpPath = path.join(os.tmpdir(), `tiktok-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.mp4`);
    try {
      await downloadUtils.streamDownload(remote, tmpPath, { maxBytes: TIKTOK_MAX_DOWNLOAD_BYTES });
      logger.info('TikTok: source downloaded for upload', { tmpPath });
      return await uploadVideoToTikTok(accessToken, tmpPath, { caption });
    } finally {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* already gone */ }
    }
  }

  throw new Error('TikTok requires a local video file or a downloadable mediaUrl for publishing');
}

/**
 * TikTok's Content Posting API does NOT support deleting a published video, so we
 * report this HONESTLY rather than crash the caller (socialMediaService's delete
 * switch calls this) or fake a success. The creator removes it in the TikTok app.
 */
async function deletePost(_authData, externalId) {
  logger.info('TikTok: delete requested — not supported by the TikTok API', { externalId });
  return {
    success: false,
    platform: 'tiktok',
    unsupported: true,
    externalId: externalId || null,
    message: 'TikTok does not support deleting posts via its API. Remove the video in the TikTok app.',
  };
}

/**
 * Returns the structured available status.
 */
function getTikTokStatus() {
  return {
    available: true,
    status: 'available',
    userMessage: 'TikTok publishing is fully active.',
    eta: null,
  };
}

/**
 * Fetch account-level profile insights (follower count, profile stats).
 *
 * Uses the real TikTok Display API `user/info` endpoint. This requires the
 * `user.info.stats` (and `user.info.profile`) scopes, which TikTok only grants
 * after app review — sandbox/unapproved apps get a scope error here.
 *
 * Honesty contract: on ANY failure (missing token, missing scope, network)
 * we return `{ available: false, reason }` with NO fabricated numbers, so the
 * insights sync records "TikTok data unavailable" rather than fake followers.
 * On success we return the real, normalized stats.
 */
async function getProfileInsights(authData) {
  const accessToken = authData?.accessToken;
  if (!accessToken || accessToken === 'dev-token') {
    return { available: false, platform: 'tiktok', reason: 'No TikTok access token available' };
  }

  try {
    const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'follower_count,following_count,likes_count,video_count',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const user = response.data?.data?.user || {};
    // Guard: if the API responded but returned no usable stats, stay honest.
    if (user.follower_count == null) {
      return {
        available: false,
        platform: 'tiktok',
        reason: 'TikTok returned no profile stats (likely missing user.info.stats scope)',
      };
    }

    return {
      available: true,
      platform: 'tiktok',
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      likesCount: user.likes_count || 0,
      videoCount: user.video_count || 0,
      // TikTok's Display API does not expose audience demographics; omit
      // rather than invent.
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    const reason = error.response?.data?.error?.message || error.message;
    logger.warn('[TikTok] getProfileInsights unavailable', { reason });
    return { available: false, platform: 'tiktok', reason };
  }
}

module.exports = {
  postToTikTok,
  uploadVideoToTikTok,
  deletePost,
  getTikTokStatus,
  getProfileInsights,
};

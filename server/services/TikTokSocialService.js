/**
 * TikTok Social Media Service
 * Handles posting videos to TikTok via the Content Posting API (Direct Post).
 *
 * Flow (TikTok's Direct Post spec):
 *   1. POST /v2/post/publish/creator_info/query/ — REQUIRED before every post.
 *      Returns the privacy levels this creator may use, whether comments /
 *      duets / stitches are disabled on their account, and the longest video
 *      they may post.
 *   2. POST /v2/post/publish/video/init/ (source FILE_UPLOAD) → publish_id + upload_url.
 *   3. PUT each chunk to upload_url with Content-Range.
 *   4. POST /v2/post/publish/status/fetch/ (bounded poll) → the public video id
 *      once TikTok has published it. Analytics needs that id: a publish_id is
 *      not a video id, so /v2/video/query/ can never find it. Anything not
 *      resolved here is resolved lazily by platformAnalyticsService.
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
const TIKTOK_MAX_CHUNK_BYTES = 64 * 1024 * 1024;      // 64 MB — chunk_size ceiling (floor is 5 MB)
const TIKTOK_MAX_CHUNKS = 1000;                       // total_chunk_count ceiling
const TIKTOK_TITLE_MAX = 2200;                        // TikTok caption length cap
const REQUEST_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
// Bounded status poll right after the upload (~14 s worst case).
const DEFAULT_STATUS_POLL_DELAYS_MS = [2000, 4000, 8000];

const PRIVACY_PUBLIC = 'PUBLIC_TO_EVERYONE';
const PRIVACY_SELF_ONLY = 'SELF_ONLY';

/**
 * A TikTok video id is a numeric string; a Direct Post publish_id is not
 * (e.g. "v_pub_file~v2-1.7…"). Used to tell what platformPostId holds.
 */
function isTikTokVideoId(value) {
  return typeof value === 'string' && /^\d{6,}$/.test(value);
}

function isTikTokPublishId(value) {
  return typeof value === 'string'
    && value.length > 0
    && !isTikTokVideoId(value)
    && !/^(mock-|dryrun-|post-\d+$)/.test(value);
}

function jsonHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' };
}

/** Parse a TikTok body that may arrive as a raw string (see fetchPublishStatus). */
function parseBody(data) {
  if (data == null) return {};
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return data;
}

/**
 * Turn a TikTok API failure into an Error that says what TikTok said
 * (error.code + error.message) instead of axios' "Request failed with status
 * code 400". The original `response` is kept so the dispatcher's 401 → token
 * refresh recovery still works.
 */
function tiktokError(step, err) {
  if (!err || !err.response) return err;
  const body = parseBody(err.response.data);
  const code = body?.error?.code;
  const msg = body?.error?.message;
  if (!code && !msg) return err;
  const wrapped = new Error(`TikTok ${step} failed: ${[code, msg].filter(Boolean).join(' — ')}`);
  wrapped.response = err.response;
  wrapped.tiktokCode = code || null;
  return wrapped;
}

/** TikTok can answer with HTTP 200 and error.code !== 'ok'. */
function assertOk(step, body) {
  const code = body?.error?.code;
  if (code && code !== 'ok') {
    const e = new Error(`TikTok ${step} failed: ${[code, body.error.message].filter(Boolean).join(' — ')}`);
    e.tiktokCode = code;
    throw e;
  }
}

/**
 * Query the creator's posting constraints — REQUIRED by TikTok before a Direct Post.
 * @returns {Promise<{privacyLevelOptions: string[], commentDisabled: boolean,
 *   duetDisabled: boolean, stitchDisabled: boolean,
 *   maxVideoPostDurationSec: number|null, username: string|null}>}
 */
async function queryCreatorInfo(accessToken) {
  let res;
  try {
    res = await axios.post(`${API_BASE}/post/publish/creator_info/query/`, {}, {
      headers: jsonHeaders(accessToken),
      timeout: REQUEST_TIMEOUT_MS,
    });
  } catch (err) {
    throw tiktokError('creator info query', err);
  }
  const body = parseBody(res?.data);
  assertOk('creator info query', body);
  const d = body.data || {};
  const max = Number(d.max_video_post_duration_sec);
  return {
    privacyLevelOptions: Array.isArray(d.privacy_level_options) ? d.privacy_level_options.map(String) : [],
    commentDisabled: d.comment_disabled === true,
    duetDisabled: d.duet_disabled === true,
    stitchDisabled: d.stitch_disabled === true,
    maxVideoPostDurationSec: Number.isFinite(max) && max > 0 ? max : null,
    username: d.creator_username || null,
  };
}

/**
 * Pick the privacy level for a Direct Post:
 *   1. TIKTOK_PRIVACY_LEVEL, when set and offered by creator_info;
 *   2. PUBLIC_TO_EVERYONE, only when TIKTOK_APP_AUDITED=true and it is offered —
 *      TikTok rejects public posts from clients that haven't passed its audit;
 *   3. SELF_ONLY otherwise (the only level an unaudited client may use).
 * @param {string[]} options  creator_info.privacy_level_options
 */
function choosePrivacyLevel(options, env = process.env) {
  const offered = Array.isArray(options) ? options : [];
  const allowed = (level) => offered.length === 0 || offered.includes(level);

  const override = typeof env.TIKTOK_PRIVACY_LEVEL === 'string' ? env.TIKTOK_PRIVACY_LEVEL.trim().toUpperCase() : '';
  if (override) {
    if (allowed(override)) return override;
    logger.warn('TikTok: TIKTOK_PRIVACY_LEVEL is not offered for this creator; ignoring it', { override, offered });
  }

  if (String(env.TIKTOK_APP_AUDITED || '').trim().toLowerCase() === 'true' && offered.includes(PRIVACY_PUBLIC)) {
    return PRIVACY_PUBLIC;
  }

  if (allowed(PRIVACY_SELF_ONLY)) return PRIVACY_SELF_ONLY;
  throw new Error(`TikTok offers no usable privacy level for this account (offered: ${offered.join(', ')})`);
}

/** Video length in seconds via ffprobe; null when it can't be measured. */
async function probeDurationSec(videoPath) {
  try {
    const { ffprobe } = require('../utils/ffmpegRunner');
    const meta = await ffprobe(videoPath, { label: 'tiktok-duration', timeoutMs: 20000 });
    const d = Number(meta?.format?.duration);
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch (err) {
    logger.warn('TikTok: could not measure the video duration; TikTok will validate it', { error: err.message });
    return null;
  }
}

/**
 * Chunk plan for FILE_UPLOAD. TikTok rules: chunk_size 5–64 MB, except that a
 * file up to 64 MB (and any file under 5 MB) goes as ONE chunk with
 * chunk_size = video_size; total_chunk_count = floor(video_size / chunk_size);
 * the final chunk carries the remainder (so it may be up to 128 MB).
 */
function planChunks(size) {
  if (size <= TIKTOK_MAX_CHUNK_BYTES) return { chunkSize: size, totalChunks: 1 };
  const chunkSize = TIKTOK_MAX_CHUNK_BYTES;
  const totalChunks = Math.floor(size / chunkSize);
  if (totalChunks > TIKTOK_MAX_CHUNKS) throw new Error('TikTok upload: the video file is too large');
  return { chunkSize, totalChunks };
}

/** Read [start, start+length) from an open file — one chunk in memory, not the whole video. */
function readChunk(fd, start, length) {
  const buf = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const n = fs.readSync(fd, buf, read, length - read, start + read);
    if (!n) break;
    read += n;
  }
  if (read !== length) throw new Error('TikTok upload: the video file changed while uploading');
  return buf;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One status/fetch call. TikTok returns `publicaly_available_post_id` (its
 * spelling) as an array of int64 NUMBERS — a 19-digit video id loses precision
 * in JSON.parse, so the ids are read from the raw response text as strings.
 * @returns {Promise<{status: string|null, failReason: string|null, videoId: string|null}>}
 */
async function fetchPublishStatus(accessToken, publishId) {
  let res;
  try {
    res = await axios.post(`${API_BASE}/post/publish/status/fetch/`, { publish_id: publishId }, {
      headers: jsonHeaders(accessToken),
      timeout: REQUEST_TIMEOUT_MS,
      transformResponse: [(raw) => raw], // keep the raw text: exact int64 ids
    });
  } catch (err) {
    throw tiktokError('publish status fetch', err);
  }
  const raw = typeof res?.data === 'string' ? res.data : JSON.stringify(res?.data ?? {});
  const body = parseBody(raw);
  assertOk('publish status fetch', body);
  const d = body.data || {};
  let videoId = null;
  const m = raw.match(/"publicaly_available_post_id"\s*:\s*\[([^\]]*)\]/);
  if (m) {
    const ids = m[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter((s) => /^\d+$/.test(s));
    videoId = ids[0] || null;
  }
  return { status: d.status || null, failReason: d.fail_reason || null, videoId };
}

/**
 * Poll status/fetch a bounded number of times. Throws only when TikTok says the
 * post FAILED. Any other outcome (still processing, a private post with no
 * public id, the status call erroring) returns what is known: the upload has
 * already happened, so a throw here would make the dispatcher retry and post
 * the video twice.
 */
async function pollPublishStatus(accessToken, publishId, delaysMs = DEFAULT_STATUS_POLL_DELAYS_MS) {
  let last = { status: null, failReason: null, videoId: null };
  for (const delay of delaysMs) {
    if (delay > 0) await sleep(delay);
    try {
      last = await fetchPublishStatus(accessToken, publishId);
    } catch (err) {
      logger.warn('TikTok: publish status check failed; the analytics sync will resolve it', { publishId, error: err.message });
      return last;
    }
    if (last.status === 'FAILED') {
      const e = new Error(`TikTok could not publish the video: ${last.failReason || 'unknown reason'}`);
      e.tiktokFailReason = last.failReason || null;
      throw e;
    }
    if (last.videoId || last.status === 'PUBLISH_COMPLETE') return last;
  }
  return last;
}

function statusPollDelays(opts) {
  if (Array.isArray(opts.statusPollDelaysMs)) return opts.statusPollDelaysMs;
  const env = process.env.TIKTOK_STATUS_POLL_DELAYS_MS;
  if (typeof env === 'string' && env.trim()) {
    const parsed = env.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0);
    if (parsed.length) return parsed;
  }
  return DEFAULT_STATUS_POLL_DELAYS_MS;
}

/**
 * Upload + publish a local video file to TikTok via Direct Post (FILE_UPLOAD).
 * @param {string} accessToken
 * @param {string} videoPath  local file path
 * @param {{caption?: string, durationSec?: number, statusPollDelaysMs?: number[]}} [opts]
 * @returns {Promise<{id: string, postId: string, publishId: string, videoId: string|null,
 *   status: 'published'|'processing', privacyLevel: string, url: string|null}>}
 *   `id` is the TikTok video id when TikTok has already published it, else the
 *   publish_id (resolved to a video id later by the analytics sync).
 */
async function uploadVideoToTikTok(accessToken, videoPath, opts = {}) {
  try {
    if (!accessToken) {
      throw new Error('No TikTok access token provided');
    }

    const title = (typeof opts.caption === 'string' ? opts.caption : '').slice(0, TIKTOK_TITLE_MAX);
    const size = fs.statSync(videoPath).size;
    if (!size) throw new Error('TikTok upload: video file is empty');

    // Phase 0: creator_info — required, and decides privacy / interactions / max length.
    const creator = await queryCreatorInfo(accessToken);
    const privacyLevel = choosePrivacyLevel(creator.privacyLevelOptions);

    if (creator.maxVideoPostDurationSec) {
      const durationSec = Number.isFinite(opts.durationSec) ? opts.durationSec : await probeDurationSec(videoPath);
      if (durationSec && durationSec > creator.maxVideoPostDurationSec) {
        throw new Error(
          `This video is ${Math.round(durationSec)}s long, but this TikTok account can post at most `
          + `${creator.maxVideoPostDurationSec}s. Trim the video and try again.`
        );
      }
    }

    const { chunkSize, totalChunks } = planChunks(size);
    logger.info('TikTok: initializing upload', { size, chunkSize, totalChunks, privacyLevel });

    // Phase 1: initialize the upload.
    let initResponse;
    try {
      initResponse = await axios.post(`${API_BASE}/post/publish/video/init/`, {
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_duet: creator.duetDisabled,
          disable_comment: creator.commentDisabled,
          disable_stitch: creator.stitchDisabled,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: size,
          chunk_size: chunkSize,
          total_chunk_count: totalChunks,
        },
      }, {
        headers: jsonHeaders(accessToken),
        timeout: REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      throw tiktokError('upload init', err);
    }

    const initBody = parseBody(initResponse?.data);
    assertOk('upload init', initBody);
    const { publish_id, upload_url } = initBody.data || {};
    if (!publish_id || !upload_url) throw new Error('TikTok upload init returned no publish_id / upload_url');
    logger.info('TikTok: upload initialized', { publish_id });

    // Phase 2: PUT each chunk with the REQUIRED Content-Range header.
    const fd = fs.openSync(videoPath, 'r');
    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = (i === totalChunks - 1) ? size - 1 : start + chunkSize - 1; // last chunk → EOF
        const chunk = readChunk(fd, start, end - start + 1);
        try {
          await axios.put(upload_url, chunk, {
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': chunk.length,
              'Content-Range': `bytes ${start}-${end}/${size}`,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: UPLOAD_TIMEOUT_MS,
          });
        } catch (err) {
          throw tiktokError(`chunk ${i + 1}/${totalChunks} upload`, err);
        }
      }
    } finally {
      try { fs.closeSync(fd); } catch { /* already closed */ }
    }

    // Phase 3: resolve the public video id (bounded). FAILED → throws.
    const status = await pollPublishStatus(accessToken, publish_id, statusPollDelays(opts));
    const videoId = status.videoId || null;
    const url = videoId && creator.username
      ? `https://www.tiktok.com/@${creator.username}/video/${videoId}`
      : null;

    logger.info('TikTok: video uploaded', { publish_id, videoId, tiktokStatus: status.status, privacyLevel });
    return {
      id: videoId || publish_id,
      postId: videoId || publish_id,
      publishId: publish_id,
      videoId,
      status: videoId ? 'published' : 'processing',
      privacyLevel,
      url,
    };
  } catch (error) {
    logger.error('TikTok: Upload failed', { error: error.response?.data || error.message });
    throw error;
  }
}

/**
 * Build the TikTok caption from the dispatch contentData: the post text
 * (title/description/caption/text) plus normalized hashtags from `tags`
 * (or `hashtags`, which is what the scheduler sends).
 */
function buildPostCaption(contentData) {
  const d = contentData || {};
  const base = String(d.title || d.description || d.caption || d.text || '').trim();
  const rawTags = Array.isArray(d.tags) && d.tags.length ? d.tags : (Array.isArray(d.hashtags) ? d.hashtags : []);
  const inText = new Set(base.toLowerCase().split(/\s+/));
  const tags = rawTags.filter(Boolean).map((t) => `#${String(t).replace(/^#/, '').replace(/\s+/g, '')}`)
    .filter((t) => t !== '#' && !inText.has(t.toLowerCase()));
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
  queryCreatorInfo,
  choosePrivacyLevel,
  planChunks,
  fetchPublishStatus,
  pollPublishStatus,
  isTikTokVideoId,
  isTikTokPublishId,
};

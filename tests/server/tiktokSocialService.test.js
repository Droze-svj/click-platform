// Canonical TikTok publisher (services/TikTokSocialService) — the LIVE path.
// Locks in TikTok's Direct Post contract:
//   - creator_info/query is called BEFORE init, and its answer decides the
//     privacy level (SELF_ONLY unless the app is audited / overridden), the
//     disable_comment/duet/stitch flags, and the max video length;
//   - spec-correct chunked FILE_UPLOAD with the REQUIRED Content-Range header;
//   - status/fetch resolves the real video id (exact int64, not a rounded
//     float) so analytics can find the post; FAILED surfaces as a failure;
//   - SSRF-guarded remote download + cleanup, honest "delete not supported".
// All TikTok HTTP is mocked — nothing here talks to TikTok.

jest.mock('axios');
jest.mock('../../server/utils/downloadUtils', () => ({ streamDownload: jest.fn().mockResolvedValue({ bytes: 1 }) }));
jest.mock('../../server/utils/ffmpegRunner', () => ({ ffprobe: jest.fn() }));

const axios = require('axios');
const fs = require('fs');
const downloadUtils = require('../../server/utils/downloadUtils');
const { ffprobe } = require('../../server/utils/ffmpegRunner');
const TikTok = require('../../server/services/TikTokSocialService');

const MB = 1024 * 1024;
const BIG_VIDEO_ID = '7296688264532561153'; // > Number.MAX_SAFE_INTEGER

const CREATOR_URL = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

let creatorInfo;
let statusBodies;

function creatorResponse() {
  return { data: { data: creatorInfo, error: { code: 'ok', message: '' } } };
}

function installAxios() {
  axios.post.mockReset().mockImplementation(async (url) => {
    if (url === CREATOR_URL) return creatorResponse();
    if (url === INIT_URL) {
      return { data: { data: { publish_id: 'v_pub_file~v2-1.123', upload_url: 'https://open-upload.tiktokapis.com/x' }, error: { code: 'ok' } } };
    }
    if (url === STATUS_URL) {
      // status/fetch is read as RAW text (transformResponse identity).
      const next = statusBodies.length > 1 ? statusBodies.shift() : statusBodies[0];
      return { data: next };
    }
    throw new Error(`unexpected POST ${url}`);
  });
  axios.put.mockReset().mockResolvedValue({ data: {} });
}

const callsTo = (url) => axios.post.mock.calls.filter((c) => c[0] === url);
const initBody = () => callsTo(INIT_URL)[0][1];

beforeEach(() => {
  delete process.env.TIKTOK_PRIVACY_LEVEL;
  delete process.env.TIKTOK_APP_AUDITED;
  creatorInfo = {
    creator_username: 'maker',
    privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
    comment_disabled: false,
    duet_disabled: false,
    stitch_disabled: false,
    max_video_post_duration_sec: 600,
  };
  statusBodies = [`{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[${BIG_VIDEO_ID}],"uploaded_bytes":1000},"error":{"code":"ok","message":""}}`];
  installAxios();
  downloadUtils.streamDownload.mockClear();
  ffprobe.mockReset().mockResolvedValue({ format: { duration: 30 } });
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  jest.spyOn(fs, 'openSync').mockReturnValue(42);
  jest.spyOn(fs, 'readSync').mockImplementation((_fd, _buf, _off, len) => len);
  jest.spyOn(fs, 'closeSync').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.TIKTOK_PRIVACY_LEVEL;
  delete process.env.TIKTOK_APP_AUDITED;
});

const upload = (opts = {}) => TikTok.uploadVideoToTikTok('tok', '/tmp/v.mp4', { caption: 'My caption', statusPollDelaysMs: [0, 0, 0], ...opts });

describe('creator_info + privacy level', () => {
  beforeEach(() => jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 }));

  it('calls creator_info BEFORE init', async () => {
    await upload();
    const urls = axios.post.mock.calls.map((c) => c[0]);
    expect(urls.indexOf(CREATOR_URL)).toBeGreaterThanOrEqual(0);
    expect(urls.indexOf(CREATOR_URL)).toBeLessThan(urls.indexOf(INIT_URL));
  });

  it('unaudited app → SELF_ONLY even when PUBLIC is offered', async () => {
    await upload();
    expect(initBody().post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('TIKTOK_APP_AUDITED=true + PUBLIC offered → PUBLIC_TO_EVERYONE', async () => {
    process.env.TIKTOK_APP_AUDITED = 'true';
    await upload();
    expect(initBody().post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE');
  });

  it('TIKTOK_APP_AUDITED=true but PUBLIC not offered → SELF_ONLY', async () => {
    process.env.TIKTOK_APP_AUDITED = 'true';
    creatorInfo.privacy_level_options = ['FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
    await upload();
    expect(initBody().post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('TIKTOK_PRIVACY_LEVEL override wins when offered, is ignored when not', async () => {
    process.env.TIKTOK_PRIVACY_LEVEL = 'MUTUAL_FOLLOW_FRIENDS';
    await upload();
    expect(initBody().post_info.privacy_level).toBe('MUTUAL_FOLLOW_FRIENDS');

    installAxios();
    process.env.TIKTOK_PRIVACY_LEVEL = 'FOLLOWER_OF_CREATOR'; // not in options
    await upload();
    expect(initBody().post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('choosePrivacyLevel: pure selection rules', () => {
    const all = ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'];
    expect(TikTok.choosePrivacyLevel(all, {})).toBe('SELF_ONLY');
    expect(TikTok.choosePrivacyLevel(all, { TIKTOK_APP_AUDITED: 'true' })).toBe('PUBLIC_TO_EVERYONE');
    expect(TikTok.choosePrivacyLevel(all, { TIKTOK_APP_AUDITED: 'false' })).toBe('SELF_ONLY');
    expect(TikTok.choosePrivacyLevel(all, { TIKTOK_PRIVACY_LEVEL: 'public_to_everyone' })).toBe('PUBLIC_TO_EVERYONE');
    expect(() => TikTok.choosePrivacyLevel(['PUBLIC_TO_EVERYONE'], {})).toThrow(/no usable privacy level/i);
  });

  it('interactions disabled on the account → disable_* flags true', async () => {
    creatorInfo.comment_disabled = true;
    creatorInfo.duet_disabled = true;
    creatorInfo.stitch_disabled = true;
    await upload();
    expect(initBody().post_info).toMatchObject({ disable_comment: true, disable_duet: true, disable_stitch: true });
  });

  it('interactions allowed → disable_* flags false', async () => {
    await upload();
    expect(initBody().post_info).toMatchObject({ disable_comment: false, disable_duet: false, disable_stitch: false });
  });

  it('video longer than max_video_post_duration_sec → clear error, nothing uploaded', async () => {
    creatorInfo.max_video_post_duration_sec = 60;
    ffprobe.mockResolvedValue({ format: { duration: 95.4 } });
    await expect(upload()).rejects.toThrow(/95s long.*at most 60s/);
    expect(callsTo(INIT_URL)).toHaveLength(0);
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('duration unmeasurable (no ffprobe) → still posts; TikTok validates', async () => {
    ffprobe.mockRejectedValue(new Error('ffprobe not found'));
    await upload();
    expect(callsTo(INIT_URL)).toHaveLength(1);
  });

  it('creator_info error → TikTok code/message in the error, no init', async () => {
    axios.post.mockImplementation(async (url) => {
      if (url === CREATOR_URL) {
        const e = new Error('Request failed with status code 403');
        e.response = { status: 403, data: { error: { code: 'scope_not_authorized', message: 'The user did not authorize the scope' } } };
        throw e;
      }
      throw new Error(`unexpected POST ${url}`);
    });
    await expect(upload()).rejects.toThrow(/creator info query failed: scope_not_authorized/);
    expect(callsTo(INIT_URL)).toHaveLength(0);
  });
});

describe('chunked upload + Content-Range', () => {
  it('≤64MB → ONE chunk, Content-Range bytes 0-(size-1)/size, caption as title', async () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 });
    await upload();

    expect(initBody().source_info).toEqual({ source: 'FILE_UPLOAD', video_size: 1000, chunk_size: 1000, total_chunk_count: 1 });
    expect(initBody().post_info.title).toBe('My caption');
    expect(axios.put).toHaveBeenCalledTimes(1);
    const headers = axios.put.mock.calls[0][2].headers;
    expect(headers['Content-Range']).toBe('bytes 0-999/1000');
    expect(headers['Content-Type']).toBe('video/mp4');
    expect(headers['Content-Length']).toBe(1000);
  });

  it('>64MB → 64MB chunks, total = floor(size/chunk), last chunk runs to EOF', async () => {
    const size = 130 * MB;
    jest.spyOn(fs, 'statSync').mockReturnValue({ size });
    await upload();

    expect(initBody().source_info.chunk_size).toBe(64 * MB);
    expect(initBody().source_info.total_chunk_count).toBe(2);
    expect(axios.put).toHaveBeenCalledTimes(2);
    const ranges = axios.put.mock.calls.map((c) => c[2].headers['Content-Range']);
    expect(ranges[0]).toBe(`bytes 0-${64 * MB - 1}/${size}`);
    expect(ranges[1]).toBe(`bytes ${64 * MB}-${size - 1}/${size}`);
    expect(axios.put.mock.calls[1][1].length).toBe(size - 64 * MB);
  });

  it('planChunks: every byte covered, chunk sizes inside TikTok limits', () => {
    for (const size of [1, 4 * MB, 5 * MB, 64 * MB, 64 * MB + 1, 127 * MB, 128 * MB, 299 * MB]) {
      const { chunkSize, totalChunks } = TikTok.planChunks(size);
      expect(totalChunks).toBe(size <= 64 * MB ? 1 : Math.floor(size / chunkSize));
      if (size > 64 * MB) {
        // (64MB, 128MB) → ONE chunk_size=64MB chunk that runs to EOF — allowed:
        // only the final chunk may exceed chunk_size (up to 128MB).
        expect(chunkSize).toBeGreaterThanOrEqual(5 * MB);
        expect(chunkSize).toBeLessThanOrEqual(64 * MB);
        const last = size - (totalChunks - 1) * chunkSize;
        expect(last).toBeGreaterThanOrEqual(chunkSize);
        expect(last).toBeLessThan(2 * chunkSize);
      } else {
        expect(chunkSize).toBe(size);
      }
    }
  });
});

describe('publish → video id resolution', () => {
  beforeEach(() => jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 }));

  it('PUBLISH_COMPLETE with a public id → id is the EXACT video id (no float rounding)', async () => {
    const res = await upload();
    expect(callsTo(STATUS_URL)[0][1]).toEqual({ publish_id: 'v_pub_file~v2-1.123' });
    expect(res.videoId).toBe(BIG_VIDEO_ID);
    expect(res.id).toBe(BIG_VIDEO_ID);
    expect(res.publishId).toBe('v_pub_file~v2-1.123');
    expect(res.status).toBe('published');
    expect(res.url).toBe(`https://www.tiktok.com/@maker/video/${BIG_VIDEO_ID}`);
  });

  it('polls while processing, stops once the id appears', async () => {
    statusBodies = [
      '{"data":{"status":"PROCESSING_UPLOAD"},"error":{"code":"ok"}}',
      `{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[${BIG_VIDEO_ID}]},"error":{"code":"ok"}}`,
    ];
    const res = await upload();
    expect(callsTo(STATUS_URL)).toHaveLength(2);
    expect(res.videoId).toBe(BIG_VIDEO_ID);
  });

  it('SELF_ONLY post completes with no public id → returns the publish_id, status processing', async () => {
    statusBodies = ['{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[]},"error":{"code":"ok"}}'];
    const res = await upload();
    expect(callsTo(STATUS_URL)).toHaveLength(1);
    expect(res.id).toBe('v_pub_file~v2-1.123');
    expect(res.videoId).toBeNull();
    expect(res.status).toBe('processing');
    expect(res.url).toBeNull();
  });

  it('still processing after the bounded poll → publish_id, no throw', async () => {
    statusBodies = ['{"data":{"status":"PROCESSING_UPLOAD"},"error":{"code":"ok"}}'];
    const res = await upload();
    expect(callsTo(STATUS_URL)).toHaveLength(3);
    expect(res.id).toBe('v_pub_file~v2-1.123');
  });

  it('status call errors → publish_id (upload already happened; never throw → no double post)', async () => {
    axios.post.mockImplementation(async (url) => {
      if (url === CREATOR_URL) return creatorResponse();
      if (url === INIT_URL) return { data: { data: { publish_id: 'v_pub_file~v2-1.123', upload_url: 'https://u' } } };
      throw new Error('socket hang up');
    });
    const res = await upload();
    expect(res.id).toBe('v_pub_file~v2-1.123');
  });

  it('TikTok reports FAILED → the publish fails with the fail_reason', async () => {
    statusBodies = ['{"data":{"status":"FAILED","fail_reason":"duration_check_failed"},"error":{"code":"ok"}}'];
    await expect(upload()).rejects.toThrow(/could not publish the video: duration_check_failed/);
  });

  it('id helpers tell a video id from a publish_id', () => {
    expect(TikTok.isTikTokVideoId(BIG_VIDEO_ID)).toBe(true);
    expect(TikTok.isTikTokVideoId('v_pub_file~v2-1.123')).toBe(false);
    expect(TikTok.isTikTokPublishId('v_pub_file~v2-1.123')).toBe(true);
    expect(TikTok.isTikTokPublishId(BIG_VIDEO_ID)).toBe(false);
    expect(TikTok.isTikTokPublishId('mock-tiktok-1')).toBe(false);
    expect(TikTok.isTikTokPublishId('post-1731500000000')).toBe(false);
  });
});

describe('postToTikTok', () => {
  beforeEach(() => jest.spyOn(fs, 'statSync').mockReturnValue({ size: 500 }));

  it('builds the caption from title + hashtags and uploads a LOCAL file (no download)', async () => {
    process.env.TIKTOK_STATUS_POLL_DELAYS_MS = '0';
    try {
      await TikTok.postToTikTok({ accessToken: 'tok' }, { videoPath: '/tmp/v.mp4', title: 'Go viral', tags: ['fun', 'tiktok'] });
    } finally {
      delete process.env.TIKTOK_STATUS_POLL_DELAYS_MS;
    }
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(initBody().post_info.title).toBe('Go viral #fun #tiktok');
  });

  it('scheduler shape { text, hashtags } → hashtags appended, not duplicated', async () => {
    process.env.TIKTOK_STATUS_POLL_DELAYS_MS = '0';
    try {
      await TikTok.postToTikTok({ accessToken: 'tok' }, { mediaUrl: '/tmp/v.mp4', text: 'New drop #fun', hashtags: ['#fun', 'launch'] });
    } finally {
      delete process.env.TIKTOK_STATUS_POLL_DELAYS_MS;
    }
    expect(initBody().post_info.title).toBe('New drop #fun #launch');
  });

  it('downloads a REMOTE mediaUrl (SSRF-guarded), uploads, then cleans up', async () => {
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    process.env.TIKTOK_STATUS_POLL_DELAYS_MS = '0';
    try {
      await TikTok.postToTikTok({ accessToken: 'tok' }, { mediaUrl: 'https://cdn.example.com/v.mp4', title: 'hi' });
    } finally {
      delete process.env.TIKTOK_STATUS_POLL_DELAYS_MS;
    }
    expect(downloadUtils.streamDownload).toHaveBeenCalledTimes(1);
    expect(axios.put).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('dev-token → mock, no real API call', async () => {
    const res = await TikTok.postToTikTok({ accessToken: 'dev-token' }, { videoPath: '/tmp/v.mp4' });
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.id).toMatch(/^mock-tiktok-/);
  });

  it('no usable video → clear error (never fake success)', async () => {
    fs.existsSync.mockReturnValue(false);
    await expect(TikTok.postToTikTok({ accessToken: 'tok' }, {})).rejects.toThrow(/local video file or a downloadable mediaUrl/i);
  });
});

describe('deletePost', () => {
  it('honestly reports unsupported (no throw, no fake success)', async () => {
    const res = await TikTok.deletePost({ accessToken: 'tok' }, 'pub_1');
    expect(res.success).toBe(false);
    expect(res.unsupported).toBe(true);
    expect(res.message).toMatch(/does not support deleting/i);
  });
});

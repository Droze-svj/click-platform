// Canonical TikTok publisher (services/TikTokSocialService) — the LIVE path.
// Locks in: spec-correct chunked upload with the REQUIRED Content-Range header,
// the creator's caption used as post_info.title (not the old hardcoded string),
// SSRF-guarded remote download + cleanup, honest 'processing' result, and an
// honest "delete not supported" (TikTok's API can't delete videos).
// The real TikTok HTTP calls are mocked — the owner's live smoke confirms the
// actual publish.

jest.mock('axios');
jest.mock('../../server/utils/downloadUtils', () => ({ streamDownload: jest.fn().mockResolvedValue({ bytes: 1 }) }));

const axios = require('axios');
const fs = require('fs');
const downloadUtils = require('../../server/utils/downloadUtils');
const TikTok = require('../../server/services/TikTokSocialService');

const MB = 1024 * 1024;

beforeEach(() => {
  axios.post.mockReset().mockResolvedValue({ data: { data: { publish_id: 'pub_1', upload_url: 'https://upload.tiktokapis.com/x' } } });
  axios.put.mockReset().mockResolvedValue({ data: {} });
  downloadUtils.streamDownload.mockClear();
  jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.alloc(16));
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('uploadVideoToTikTok — chunked upload + Content-Range', () => {
  it('≤64MB → ONE chunk, Content-Range bytes 0-(size-1)/size, caption as title', async () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1000 });
    const res = await TikTok.uploadVideoToTikTok('tok', '/tmp/v.mp4', { caption: 'My caption' });

    const initBody = axios.post.mock.calls[0][1];
    expect(initBody.source_info).toMatchObject({ video_size: 1000, chunk_size: 1000, total_chunk_count: 1 });
    expect(initBody.post_info.title).toBe('My caption'); // NOT "Uploaded from Sovereign"
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][2].headers['Content-Range']).toBe('bytes 0-999/1000');
    expect(res.status).toBe('processing');
    expect(res.url).toBeNull();
  });

  it('>64MB → multiple chunks covering the whole file, contiguous Content-Ranges', async () => {
    const size = 130 * MB;
    jest.spyOn(fs, 'statSync').mockReturnValue({ size });
    await TikTok.uploadVideoToTikTok('tok', '/tmp/big.mp4', { caption: 'c' });

    const initBody = axios.post.mock.calls[0][1];
    expect(initBody.source_info.chunk_size).toBe(64 * MB);
    expect(initBody.source_info.total_chunk_count).toBe(2);
    expect(axios.put).toHaveBeenCalledTimes(2);
    const ranges = axios.put.mock.calls.map((c) => c[2].headers['Content-Range']);
    expect(ranges[0]).toBe(`bytes 0-${64 * MB - 1}/${size}`);
    expect(ranges[1]).toBe(`bytes ${64 * MB}-${size - 1}/${size}`); // last chunk → EOF
  });
});

describe('postToTikTok', () => {
  it('builds the caption from title + hashtags and uploads a LOCAL file (no download)', async () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 500 });
    await TikTok.postToTikTok({ accessToken: 'tok' }, { videoPath: '/tmp/v.mp4', title: 'Go viral', tags: ['fun', 'tiktok'] });
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(axios.post.mock.calls[0][1].post_info.title).toBe('Go viral #fun #tiktok');
  });

  it('downloads a REMOTE mediaUrl (SSRF-guarded), uploads, then cleans up', async () => {
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 500 });
    jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    await TikTok.postToTikTok({ accessToken: 'tok' }, { mediaUrl: 'https://cdn.example.com/v.mp4', title: 'hi' });
    expect(downloadUtils.streamDownload).toHaveBeenCalledTimes(1);
    expect(axios.put).toHaveBeenCalled();        // uploaded
    expect(fs.unlinkSync).toHaveBeenCalled();    // temp cleaned up
  });

  it('dev-token → mock, no real API call', async () => {
    const res = await TikTok.postToTikTok({ accessToken: 'dev-token' }, { videoPath: '/tmp/v.mp4' });
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.id).toMatch(/^mock-tiktok-/);
  });

  it('no usable video → clear error (never fake success)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
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

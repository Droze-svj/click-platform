// TikTok publish — remote-URL → guarded download → upload → cleanup.
//
// The live TikTok Content Posting API needs the video BYTES, not a URL. These
// lock in the new download step in tiktokOAuthService.postToTikTok:
//   - a remote mediaUrl is downloaded (via the SSRF-guarded downloadUtils.streamDownload)
//     to a temp file, uploaded, and the temp file is ALWAYS cleaned up;
//   - a local file path uploads directly (no download);
//   - download / upload failures propagate honestly AND still clean up;
//   - no usable input → a clear error (never a fake success).
// The actual TikTok HTTP upload is stubbed (uploadVideoToTikTok) — it needs real
// app creds + a live video, which is the user's live smoke.

jest.mock('../../server/utils/downloadUtils', () => ({ streamDownload: jest.fn() }));

const fs = require('fs');
const downloadUtils = require('../../server/utils/downloadUtils');
const tiktok = require('../../server/services/tiktokOAuthService');

describe('tiktokOAuthService.postToTikTok — remote download + cleanup', () => {
  let uploadSpy, existsSpy, unlinkSpy;

  beforeEach(() => {
    downloadUtils.streamDownload.mockReset().mockResolvedValue({ bytes: 1024 });
    uploadSpy = jest.spyOn(tiktok, 'uploadVideoToTikTok')
      .mockResolvedValue({ id: 'pub_1', status: 'published', url: 'https://www.tiktok.com/@u/video/pub_1' });
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('downloads a remote mediaUrl to a temp file, uploads THAT file, then cleans it up', async () => {
    const res = await tiktok.postToTikTok('user-1', { mediaUrl: 'https://cdn.example.com/clip.mp4' });

    // downloaded the remote URL to a temp .mp4
    expect(downloadUtils.streamDownload).toHaveBeenCalledTimes(1);
    const [url, dest, opts] = downloadUtils.streamDownload.mock.calls[0];
    expect(url).toBe('https://cdn.example.com/clip.mp4');
    expect(dest).toMatch(/tiktok-.*\.mp4$/);
    expect(opts.maxBytes).toBeGreaterThan(0);

    // uploaded the SAME temp file (not the URL)
    expect(uploadSpy).toHaveBeenCalledWith('user-1', dest);
    // cleaned up the temp file
    expect(unlinkSpy).toHaveBeenCalledWith(dest);
    expect(res.id).toBe('pub_1');
  });

  it('uploads a local file directly — no download', async () => {
    const res = await tiktok.postToTikTok('user-1', { videoPath: '/tmp/local-clip.mp4' });
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(uploadSpy).toHaveBeenCalledWith('user-1', '/tmp/local-clip.mp4');
    expect(res.id).toBe('pub_1');
  });

  it('cleans up the temp file even when the upload throws (honest failure)', async () => {
    uploadSpy.mockRejectedValueOnce(new Error('TikTok API 401'));
    await expect(tiktok.postToTikTok('user-1', { mediaUrl: 'https://cdn.example.com/clip.mp4' }))
      .rejects.toThrow('TikTok API 401');
    const dest = downloadUtils.streamDownload.mock.calls[0][1];
    expect(unlinkSpy).toHaveBeenCalledWith(dest); // cleanup still ran
  });

  it('propagates an SSRF/download failure honestly and never uploads', async () => {
    downloadUtils.streamDownload.mockRejectedValueOnce(new Error('Blocked private IP (SSRF guard)'));
    await expect(tiktok.postToTikTok('user-1', { mediaUrl: 'https://169.254.169.254/clip.mp4' }))
      .rejects.toThrow(/Blocked private IP/);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('throws a clear error (never fake success) when there is no usable video', async () => {
    existsSpy.mockReturnValue(false);
    await expect(tiktok.postToTikTok('user-1', {}))
      .rejects.toThrow(/local video file or a downloadable mediaUrl/i);
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
  });
});

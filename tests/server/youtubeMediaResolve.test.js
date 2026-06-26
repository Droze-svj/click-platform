// YouTubeSocialService media resolution — SSRF-safe.
// Our own "/uploads/..." reads straight off disk (no HTTP). A remote URL goes
// through the SSRF-hardened downloadUtils.streamDownload (not a raw axios GET).
// Path traversal out of uploads/ is rejected.

jest.mock('../../server/utils/downloadUtils', () => ({ streamDownload: jest.fn() }));

const fs = require('fs');
const downloadUtils = require('../../server/utils/downloadUtils');
const YouTubeSocialService = require('../../server/services/YouTubeSocialService');

describe('YouTubeSocialService._resolveUploadBody', () => {
  beforeEach(() => {
    downloadUtils.streamDownload.mockReset().mockResolvedValue({ bytes: 1 });
    jest.spyOn(fs, 'createReadStream').mockReturnValue('STREAM');
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('reads our own /uploads media from disk — NO http download (no SSRF)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const res = await YouTubeSocialService._resolveUploadBody({ mediaUrl: '/uploads/clip.mp4' });
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(fs.createReadStream).toHaveBeenCalledWith(expect.stringContaining(`uploads${require('path').sep}clip.mp4`));
    expect(res.stream).toBe('STREAM');
  });

  it('rejects path traversal out of uploads/', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    await expect(YouTubeSocialService._resolveUploadBody({ mediaUrl: '/uploads/../../etc/passwd' }))
      .rejects.toThrow(/media file not found/i);
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
  });

  it('downloads a REMOTE url via the SSRF-guarded streamDownload (not raw axios)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true); // tmpDir exists
    const res = await YouTubeSocialService._resolveUploadBody({ mediaUrl: 'https://cdn.example.com/v.mp4' });
    expect(downloadUtils.streamDownload).toHaveBeenCalledTimes(1);
    const [url, dest] = downloadUtils.streamDownload.mock.calls[0];
    expect(url).toBe('https://cdn.example.com/v.mp4');
    expect(dest).toMatch(/yt-upload-.*\.mp4$/);
    expect(typeof res.cleanup).toBe('function');
  });

  it('mediaPath that exists is used directly (fast path)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const res = await YouTubeSocialService._resolveUploadBody({ mediaPath: '/tmp/local.mp4' });
    expect(downloadUtils.streamDownload).not.toHaveBeenCalled();
    expect(res.stream).toBe('STREAM');
  });
});

/**
 * Editor → YouTube / TikTok publishing resolves the media URL the editor plays.
 *
 * The editor posts the URL of its render (a signed /uploads link or a cloud
 * URL). /oauth/youtube/upload and /oauth/tiktok/upload passed it straight to
 * fs.existsSync as a filesystem path, so every publish from the editor failed.
 * Bare server paths must still be refused (they would let a request upload any
 * server file to the caller's channel).
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const youtubeService = require('../../../server/services/youtubeOAuthService');
const tiktokService = require('../../../server/services/tiktokOAuthService');
const { signMediaUrl } = require('../../../server/utils/mediaUrlSigner');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('editor publish media resolution', () => {
  let user, token, ytSpy, ttSpy;
  const name = `publish-src-${Date.now()}.mp4`;
  const rel = `/uploads/${name}`;
  const abs = path.join(process.cwd(), 'uploads', name);

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.alloc(16));
    user = await new User({
      email: 'publish-src@example.com', password: 'password123', name: 'Pub', emailVerified: true,
    }).save();
    token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '1h' });
    ytSpy = jest.spyOn(youtubeService, 'uploadVideoToYouTube').mockResolvedValue({ id: 'yt1', status: 'uploaded' });
    ttSpy = jest.spyOn(tiktokService, 'postToTikTok').mockResolvedValue({ id: 'tt1' });
  });

  afterAll(async () => {
    ytSpy.mockRestore();
    ttSpy.mockRestore();
    try { fs.unlinkSync(abs); } catch (_) { /* gone */ }
    await User.deleteOne({ _id: user._id });
  });

  beforeEach(() => { ytSpy.mockClear(); ttSpy.mockClear(); });

  const post = (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

  it('YouTube: a signed /uploads render is uploaded from disk', async () => {
    const res = await post('/api/oauth/youtube/upload', { videoFile: signMediaUrl(rel), title: 'My video' });
    expect(res.status).toBe(200);
    expect(ytSpy).toHaveBeenCalledTimes(1);
    expect(ytSpy.mock.calls[0][1]).toBe(abs);
    expect(ytSpy.mock.calls[0][2].title).toBe('My video');
  });

  it('YouTube: the same render as an absolute URL on our host also resolves', async () => {
    const res = await post('/api/oauth/youtube/upload', { videoFile: `https://app.example.com${signMediaUrl(rel)}`, title: 'T' });
    expect(res.status).toBe(200);
    expect(ytSpy.mock.calls[0][1]).toBe(abs);
  });

  it('YouTube: an unsigned /uploads path or a bare server path is refused', async () => {
    for (const videoFile of [rel, '/etc/passwd', abs]) {
      const res = await post('/api/oauth/youtube/upload', { videoFile, title: 'T' });
      expect(res.status).toBe(400);
    }
    expect(ytSpy).not.toHaveBeenCalled();
  });

  it('TikTok /post: our own media is handed over as a local file', async () => {
    const res = await post('/api/oauth/tiktok/post', { videoUrl: signMediaUrl(rel), caption: 'cap' });
    expect(res.status).toBe(200);
    expect(ttSpy.mock.calls[0][1]).toEqual({ videoPath: abs, caption: 'cap' });
  });

  it('TikTok /post: a remote URL is passed through for the guarded download', async () => {
    const res = await post('/api/oauth/tiktok/post', { videoUrl: 'https://cdn.example.com/v.mp4', caption: 'cap' });
    expect(res.status).toBe(200);
    expect(ttSpy.mock.calls[0][1]).toEqual({ mediaUrl: 'https://cdn.example.com/v.mp4', caption: 'cap' });
  });
});

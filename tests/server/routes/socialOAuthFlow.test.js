// Connect → callback → publish for TikTok, YouTube, Facebook and Instagram,
// through the REAL routers and models (only the providers' HTTP is mocked).
//
// Bugs this guards (found 2026-11-14, before any developer app existed):
//  - authorize sent redirect_uri=http://localhost:5001/... for tiktok/youtube/
//    instagram, and every exchange got a different (default) redirect_uri;
//  - youtube/facebook/google had their own GET /callback that shadowed the
//    shared one and never finished the connection;
//  - Facebook Page tokens were never stored, so nothing could post to a Page;
//  - Instagram used the Basic Display API (shut down Dec 2024) and the
//    scheduler read an igUserId that was never stored.

process.env.TIKTOK_CLIENT_KEY = 'tt-key';
process.env.TIKTOK_CLIENT_SECRET = 'tt-secret';
process.env.YOUTUBE_CLIENT_ID = 'yt-id.apps.googleusercontent.com';
process.env.YOUTUBE_CLIENT_SECRET = 'yt-secret';
process.env.FACEBOOK_APP_ID = '1234567890';
process.env.FACEBOOK_APP_SECRET = 'fb-secret';
process.env.APP_URL = 'https://click.example.com';
process.env.FRONTEND_URL = 'https://click.example.com';
// Set EMPTY, not deleted: dotenv refills deleted keys from the local .env
// (which has API_URL=http://localhost:5001 and an old INSTAGRAM_CLIENT_ID).
for (const k of ['API_URL', 'BACKEND_URL']) process.env[k] = '';
for (const k of ['TIKTOK_CALLBACK_URL', 'TIKTOK_REDIRECT_URI', 'YOUTUBE_CALLBACK_URL', 'YOUTUBE_REDIRECT_URI',
  'FACEBOOK_CALLBACK_URL', 'FACEBOOK_REDIRECT_URI', 'INSTAGRAM_CALLBACK_URL', 'INSTAGRAM_REDIRECT_URI',
  'INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET', 'FACEBOOK_SCOPE', 'INSTAGRAM_SCOPE', 'OAUTH_SERVER_SIDE_EXCHANGE',
  'TIKTOK_SCOPE', 'YOUTUBE_SCOPE']) {
  process.env[k] = '';
}

// The SSRF guard resolves the media host via DNS; click.example.com doesn't
// resolve in CI. Stub only that check (its real behaviour is covered by the
// urlGuard tests).
jest.mock('../../../server/utils/urlGuard', () => ({
  ...jest.requireActual('../../../server/utils/urlGuard'),
  assertPublicUrl: jest.fn().mockResolvedValue(true),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const tiktokService = require('../../../server/services/tiktokOAuthService');
const youtubeService = require('../../../server/services/youtubeOAuthService');
const oauthService = require('../../../server/services/oauthService');
const facebookService = require('../../../server/services/facebookOAuthService');
const instagramService = require('../../../server/services/instagramOAuthService');
const MetaSocialService = require('../../../server/services/MetaSocialService');

const PUBLIC = { 'X-Forwarded-Host': 'click.example.com', 'X-Forwarded-Proto': 'https' };
const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('social OAuth connect → callback → publish', () => {
  let user; let token;
  const connect = (platform) => request(app).get(`/api/oauth/${platform}/connect`)
    .set('Authorization', `Bearer ${token}`).set(PUBLIC);
  const authorizeParams = (res) => new URL(res.body.auth_url).searchParams;

  beforeAll(async () => {
    await User.deleteMany({ email: 'oauth-flow@example.com' });
    // Agency tier so the connected-account cap doesn't block the 4 platforms.
    user = await new User({
      email: 'oauth-flow@example.com', password: 'password123', name: 'Flow', emailVerified: true,
      subscription: { plan: 'agency', status: 'active', endDate: new Date(Date.now() + 30 * 86400000) },
    }).save();
    token = sign(user);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends the public callback URL — never localhost — for every platform', async () => {
    for (const platform of ['tiktok', 'youtube', 'facebook', 'instagram']) {
      const res = await connect(platform);
      expect(res.status).toBe(200);
      const redirect = authorizeParams(res).get('redirect_uri');
      expect(redirect).toBe(`https://click.example.com/api/oauth/${platform}/callback`);
    }
  });

  it('TikTok: the exchange uses the exact redirect_uri from authorize, then lands on the dashboard', async () => {
    const res = await connect('tiktok');
    const state = authorizeParams(res).get('state');
    const exchange = jest.spyOn(tiktokService, 'exchangeCodeForToken').mockResolvedValue({ access_token: 'tt-at', refresh_token: 'tt-rt', expires_in: 86400 });
    jest.spyOn(tiktokService, 'getUserProfile').mockResolvedValue({ id: 'tt-open-id', username: 'creator', display_name: 'creator' });
    const save = jest.spyOn(tiktokService, 'connectAccount').mockResolvedValue({ success: true });

    const cb = await request(app).get('/api/oauth/tiktok/callback').query({ code: 'tt-code', state }).set(PUBLIC);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('https://click.example.com/dashboard/social?success=true&platform=tiktok');
    expect(exchange).toHaveBeenCalledWith('tt-code', 'https://click.example.com/api/oauth/tiktok/callback');
    expect(save).toHaveBeenCalled();
  });

  it('YouTube: the callback completes the connection instead of showing the code on a page', async () => {
    const res = await connect('youtube');
    const params = authorizeParams(res);
    expect(params.get('scope')).toContain('yt-analytics.readonly');
    const exchange = jest.spyOn(youtubeService, 'exchangeCodeForToken').mockResolvedValue({ access_token: 'yt-at', refresh_token: 'yt-rt' });
    jest.spyOn(youtubeService, 'getUserProfile').mockResolvedValue({ id: 'UC123', username: 'chan' });
    jest.spyOn(youtubeService, 'connectAccount').mockResolvedValue({ success: true });

    const cb = await request(app).get('/api/oauth/youtube/callback').query({ code: 'yt-code', state: params.get('state') }).set(PUBLIC);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toContain('/dashboard/social?success=true&platform=youtube');
    expect(exchange).toHaveBeenCalledWith('yt-code', 'https://click.example.com/api/oauth/youtube/callback');
  });

  it('a creator who cancels on the consent screen is sent back with a message, not a 400 page', async () => {
    const cb = await request(app).get('/api/oauth/facebook/callback').query({ error: 'access_denied' }).set(PUBLIC);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('https://click.example.com/dashboard/social?error=access_denied');
  });

  it('Facebook: stores the Pages with ENCRYPTED page tokens and posts a video to the Page', async () => {
    const res = await connect('facebook');
    const params = authorizeParams(res);
    expect(new URL(res.body.auth_url).pathname).toMatch(/^\/v\d+\.\d+\/dialog\/oauth$/);
    expect(params.get('scope')).toContain('pages_manage_posts');

    jest.spyOn(axios, 'get').mockImplementation(async (url, cfg = {}) => {
      if (url.endsWith('/oauth/access_token') && cfg.params?.code) {
        expect(cfg.params.redirect_uri).toBe('https://click.example.com/api/oauth/facebook/callback');
        return { data: { access_token: 'short' } };
      }
      if (url.endsWith('/oauth/access_token')) return { data: { access_token: 'long-user-token', expires_in: 5184000 } };
      if (url.endsWith('/me')) return { data: { id: 'fb-user-1', name: 'Flow Creator' } };
      if (url.endsWith('/me/accounts')) {
        return { data: { data: [{ id: 'page-1', name: 'My Page', access_token: 'PAGE-TOKEN-1', instagram_business_account: { id: 'ig-9' } }] } };
      }
      throw new Error(`unexpected GET ${url}`);
    });

    const cb = await request(app).get('/api/oauth/facebook/callback').query({ code: 'fb-code', state: params.get('state') }).set(PUBLIC);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toContain('success=true&platform=facebook');

    const raw = await User.collection.findOne({ _id: user._id });
    const storedPage = raw.oauth.facebook.pages[0];
    expect(storedPage).toMatchObject({ id: 'page-1', name: 'My Page', instagramBusinessId: 'ig-9' });
    expect(storedPage.accessToken).not.toBe('PAGE-TOKEN-1'); // encrypted at rest
    const creds = await oauthService.getSocialCredentials(String(user._id), 'facebook');
    expect(creds.pages[0].accessToken).toBe('PAGE-TOKEN-1');
    expect(await facebookService.resolvePage(String(user._id))).toMatchObject({ pageId: 'page-1', accessToken: 'PAGE-TOKEN-1' });

    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'vid-77' } });
    const out = await MetaSocialService.postToFacebookPage(creds, { description: 'New video', mediaUrl: '/uploads/clips/a.mp4' });
    expect(out.id).toBe('vid-77');
    const [url, , cfg] = post.mock.calls[0];
    expect(url).toMatch(/\/page-1\/videos$/);
    expect(cfg.params.access_token).toBe('PAGE-TOKEN-1');
    expect(cfg.params.file_url).toMatch(/^https:\/\/click\.example\.com\/uploads\/clips\/a\.mp4\?exp=\d+&sig=[0-9a-f]+$/);
  });

  it('Instagram: connects through Facebook Login and publishes a Reel from a public signed URL', async () => {
    const res = await connect('instagram');
    const authUrl = new URL(res.body.auth_url);
    expect(authUrl.hostname).toBe('www.facebook.com'); // not the retired api.instagram.com
    const params = authUrl.searchParams;
    expect(params.get('client_id')).toBe('1234567890');
    expect(params.get('scope')).toContain('instagram_content_publish');

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/oauth/access_token') && u.includes('code=ig-code')) {
        expect(u).toContain(encodeURIComponent('https://click.example.com/api/oauth/instagram/callback'));
        return jsonResponse({ access_token: 'short-ig' });
      }
      if (u.includes('/oauth/access_token')) return jsonResponse({ access_token: 'long-ig-user', expires_in: 5184000 });
      if (u.includes('/me/accounts')) {
        return jsonResponse({ data: [{ id: 'page-1', name: 'My Page', access_token: 'PAGE-TOKEN-IG', instagram_business_account: { id: 'ig-9', username: 'flowcreator' } }] });
      }
      throw new Error(`unexpected fetch ${u}`);
    });

    const cb = await request(app).get('/api/oauth/instagram/callback').query({ code: 'ig-code', state: params.get('state') }).set(PUBLIC);
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toContain('success=true&platform=instagram');
    fetchMock.mockRestore();

    const creds = await oauthService.getSocialCredentials(String(user._id), 'instagram');
    expect(creds).toMatchObject({ accessToken: 'PAGE-TOKEN-IG', platformUserId: 'ig-9', platformUsername: 'flowcreator' });
    expect(creds.metadata).toMatchObject({ igUserId: 'ig-9', pageId: 'page-1' });

    const calls = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init = {}) => {
      const u = String(url);
      calls.push({ u, method: init.method || 'GET' });
      if (u.includes('/ig-9/media?')) return jsonResponse({ id: 'container-1' });
      if (u.includes('/container-1?fields=status_code')) return jsonResponse({ status_code: 'FINISHED' });
      if (u.includes('/ig-9/media_publish')) return jsonResponse({ id: 'media-5' });
      if (u.includes('/media-5?fields=permalink')) return jsonResponse({ permalink: 'https://www.instagram.com/reel/abc/' });
      throw new Error(`unexpected fetch ${u}`);
    });

    const out = await MetaSocialService.postToInstagram(creds, { description: 'Watch this', mediaUrl: '/uploads/clips/reel.mp4' });
    expect(out).toMatchObject({ id: 'media-5', url: 'https://www.instagram.com/reel/abc/' });
    const container = new URL(calls[0].u).searchParams;
    expect(container.get('media_type')).toBe('REELS');
    expect(container.get('access_token')).toBe('PAGE-TOKEN-IG');
    expect(container.get('video_url')).toMatch(/^https:\/\/click\.example\.com\/uploads\/clips\/reel\.mp4\?exp=\d+&sig=[0-9a-f]+$/);
    expect(container.get('image_url')).toBeNull();
  });
});

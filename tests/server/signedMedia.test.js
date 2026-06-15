// Signed media capability URLs (Option A backend): the signer round-trips, is
// tamper-evident + expiry-checked, passes non-/uploads URLs through; and the
// gate middleware is OFF by default, enforces when flagged, and honors the
// public-prefix allowlist.

const { signMediaUrl, verifyMediaUrl, signMediaUrls } = require('../../server/utils/mediaUrlSigner');
const requireSignedMedia = require('../../server/middleware/requireSignedMedia');

const ORIG = process.env.REQUIRE_SIGNED_MEDIA;
const ORIG_PREFIX = process.env.PUBLIC_MEDIA_PREFIXES;
afterEach(() => {
  if (ORIG === undefined) delete process.env.REQUIRE_SIGNED_MEDIA; else process.env.REQUIRE_SIGNED_MEDIA = ORIG;
  if (ORIG_PREFIX === undefined) delete process.env.PUBLIC_MEDIA_PREFIXES; else process.env.PUBLIC_MEDIA_PREFIXES = ORIG_PREFIX;
});

describe('mediaUrlSigner', () => {
  test('signs an /uploads path and round-trips through verify', () => {
    const signed = signMediaUrl('/uploads/videos/abc123.mp4');
    expect(signed).toMatch(/^\/uploads\/videos\/abc123\.mp4\?exp=\d+&sig=[0-9a-f]{64}$/);
    const u = new URLSearchParams(signed.split('?')[1]);
    expect(verifyMediaUrl('/uploads/videos/abc123.mp4', u.get('exp'), u.get('sig'))).toBe(true);
  });

  test('rejects a tampered path, tampered sig, missing sig, and expiry', () => {
    const signed = signMediaUrl('/uploads/videos/abc123.mp4');
    const u = new URLSearchParams(signed.split('?')[1]);
    const exp = u.get('exp'); const sig = u.get('sig');
    expect(verifyMediaUrl('/uploads/videos/OTHER.mp4', exp, sig)).toBe(false); // different path
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === '0' ? '1' : '0'); // guaranteed-different last hex char
    expect(verifyMediaUrl('/uploads/videos/abc123.mp4', exp, tamperedSig)).toBe(false); // tampered sig
    expect(verifyMediaUrl('/uploads/videos/abc123.mp4', exp, undefined)).toBe(false); // missing
    expect(verifyMediaUrl('/uploads/videos/abc123.mp4', String(Math.floor(Date.now() / 1000) - 10), sig)).toBe(false); // expired
  });

  test('passes non-/uploads URLs through unchanged (external/CDN/data)', () => {
    expect(signMediaUrl('https://cdn.example.com/x.mp4')).toBe('https://cdn.example.com/x.mp4');
    expect(signMediaUrl('data:image/png;base64,xxxx')).toBe('data:image/png;base64,xxxx');
    expect(signMediaUrl('')).toBe('');
  });
});

describe('signMediaUrls (deep response signer)', () => {
  test('signs nested /uploads strings in arrays + objects, leaves others alone', () => {
    const input = {
      tracks: [
        { id: 1, file: { url: '/uploads/user-music/abc.mp3', size: 10 }, isPublic: false },
        { id: 2, file: { url: 'https://cdn.example.com/x.mp3' } }, // external → unchanged
      ],
      cover: '/uploads/thumbnails/c.png',
      note: 'not a url',
    };
    const out = signMediaUrls(input);
    expect(out.tracks[0].file.url).toMatch(/^\/uploads\/user-music\/abc\.mp3\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(out.tracks[1].file.url).toBe('https://cdn.example.com/x.mp3'); // external untouched
    expect(out.cover).toMatch(/^\/uploads\/thumbnails\/c\.png\?exp=/);
    expect(out.tracks[0].file.size).toBe(10); // non-url fields preserved
    expect(out.note).toBe('not a url');
    // each signed url verifies
    const u = new URLSearchParams(out.tracks[0].file.url.split('?')[1]);
    expect(verifyMediaUrl('/uploads/user-music/abc.mp3', u.get('exp'), u.get('sig'))).toBe(true);
  });

  test('converts a Mongoose-like doc (toObject) and does not mutate the input', () => {
    const doc = { toObject: () => ({ file: { url: '/uploads/music/m.mp3' } }) };
    const out = signMediaUrls(doc);
    expect(out.file.url).toMatch(/\?exp=\d+&sig=/);
  });

  test('signs a full response envelope (content/video shape), preserving non-url fields', () => {
    // Mirrors the video.js router-level signer + content.js GET /:contentId usage:
    // sign the whole { success, data } body; only /uploads strings change.
    const body = {
      success: true,
      data: {
        status: 'completed',
        originalFile: { url: '/uploads/videos/src.mp4', size: 99 },
        generatedContent: {
          shortVideos: [
            { url: '/uploads/users/x/clips/c1.mp4', thumbnail: '/uploads/thumbnails/t1.jpg', platform: 'tiktok' },
          ],
        },
      },
    };
    const out = signMediaUrls(body);
    expect(out.success).toBe(true); // boolean preserved
    expect(out.data.status).toBe('completed'); // plain string preserved
    expect(out.data.originalFile.size).toBe(99); // number preserved
    expect(out.data.originalFile.url).toMatch(/^\/uploads\/videos\/src\.mp4\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect(out.data.generatedContent.shortVideos[0].url).toMatch(/^\/uploads\/users\/x\/clips\/c1\.mp4\?exp=/);
    expect(out.data.generatedContent.shortVideos[0].thumbnail).toMatch(/^\/uploads\/thumbnails\/t1\.jpg\?exp=/);
    // re-signing an already-signed url stays valid (idempotent: query is stripped before signing)
    const resigned = signMediaUrls(out.data.originalFile.url);
    const u = new URLSearchParams(resigned.split('?')[1]);
    expect(verifyMediaUrl('/uploads/videos/src.mp4', u.get('exp'), u.get('sig'))).toBe(true);
  });
});

describe('requireSignedMedia gate', () => {
  function mock(path, query = {}) {
    const req = { path, baseUrl: '/uploads', query };
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    let nextCalled = false;
    requireSignedMedia(req, res, () => { nextCalled = true; });
    return { res, nextCalled };
  }

  test('OFF by default → serves (next) regardless of signature', () => {
    delete process.env.REQUIRE_SIGNED_MEDIA;
    expect(mock('/videos/abc.mp4').nextCalled).toBe(true);
  });

  test('ON → 403 without a valid signature', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const { res, nextCalled } = mock('/videos/abc.mp4', {});
    expect(nextCalled).toBe(false);
    expect(res.code).toBe(403);
  });

  test('ON → serves with a valid signature', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const signed = signMediaUrl('/uploads/videos/abc.mp4');
    const u = new URLSearchParams(signed.split('?')[1]);
    expect(mock('/videos/abc.mp4', { exp: u.get('exp'), sig: u.get('sig') }).nextCalled).toBe(true);
  });

  test('ON → public-prefix (fonts/) bypasses the signature', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    expect(mock('/fonts/Inter.woff2', {}).nextCalled).toBe(true);
  });
});

// RUNNING-APP smoke for the /uploads signed-media gate.
//
// The sibling unit test (requireSignedMedia.test.js) calls the middleware with a
// mock req/res. This boots a REAL express app mounted exactly like server/index.js
// (`app.use('/uploads', requireSignedMedia)` then `express.static(uploadsDir)`)
// and drives it over actual HTTP with supertest — so it exercises the real mount
// order, real static file serving, and the real signer end-to-end. Zero DB / prod
// contact: the middleware only pulls in utils/mediaUrlSigner (crypto).
//
// This is the pre-flight that the enablement runbook (docs/signed-media-enablement-
// runbook.md) asks for before flipping REQUIRE_SIGNED_MEDIA in prod.

process.env.MEDIA_URL_SECRET = process.env.MEDIA_URL_SECRET || 'test-media-secret';

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { signMediaUrl } = require('../../server/utils/mediaUrlSigner');
const requireSignedMedia = require('../../server/middleware/requireSignedMedia');

let uploadsDir;
const VIDEO_BYTES = Buffer.from('FAKE-MP4-BYTES-private-clip');
const MUSIC_BYTES = Buffer.from('FAKE-MP3-BYTES-catalog-track');
const FONT_BYTES = Buffer.from('FAKE-WOFF2-BYTES');

function buildApp() {
  // Mirror server/index.js:1867-1868 exactly.
  const app = express();
  app.use('/uploads', requireSignedMedia);
  app.use('/uploads', express.static(uploadsDir));
  return app;
}

function sign(uploadsPath) {
  // signMediaUrl returns "/uploads/...?exp=..&sig=.." — hand the whole query back.
  const u = new URL('http://x' + signMediaUrl(uploadsPath));
  return u.search; // "?exp=..&sig=.."
}

beforeAll(() => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signed-media-smoke-'));
  fs.mkdirSync(path.join(uploadsDir, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'music'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, 'videos', 'private.mp4'), VIDEO_BYTES);
  fs.writeFileSync(path.join(uploadsDir, 'music', 'catalog.mp3'), MUSIC_BYTES);
  fs.writeFileSync(path.join(uploadsDir, 'fonts', 'Inter.woff2'), FONT_BYTES);
});

afterAll(() => {
  try { fs.rmSync(uploadsDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
});

const ORIG_FLAG = process.env.REQUIRE_SIGNED_MEDIA;
const ORIG_PREFIXES = process.env.PUBLIC_MEDIA_PREFIXES;
afterEach(() => {
  if (ORIG_FLAG === undefined) delete process.env.REQUIRE_SIGNED_MEDIA; else process.env.REQUIRE_SIGNED_MEDIA = ORIG_FLAG;
  if (ORIG_PREFIXES === undefined) delete process.env.PUBLIC_MEDIA_PREFIXES; else process.env.PUBLIC_MEDIA_PREFIXES = ORIG_PREFIXES;
});

describe('signed-media gate — running-app smoke (real HTTP + static serving)', () => {
  it('flag explicitly OFF (=false): unsigned private video serves (legacy path)', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'false';
    const res = await request(buildApp()).get('/uploads/videos/private.mp4');
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body)).toEqual(VIDEO_BYTES);
  });

  it('flag ON: UNSIGNED private video → 403 (the whole point of the gate)', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const res = await request(buildApp()).get('/uploads/videos/private.mp4');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  it('flag ON: VALIDLY-SIGNED private video → 200 and serves the real bytes', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const res = await request(buildApp()).get('/uploads/videos/private.mp4' + sign('/uploads/videos/private.mp4'));
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body)).toEqual(VIDEO_BYTES);
  });

  it('flag ON: TAMPERED signature → 403', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const q = sign('/uploads/videos/private.mp4').replace(/sig=[a-f0-9]+/, 'sig=deadbeef');
    const res = await request(buildApp()).get('/uploads/videos/private.mp4' + q);
    expect(res.status).toBe(403);
  });

  it('flag ON: a signature minted for ANOTHER path does NOT unlock this one → 403', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    // sign a different file, then try to reuse its exp/sig on private.mp4
    const otherQ = sign('/uploads/videos/other.mp4');
    const res = await request(buildApp()).get('/uploads/videos/private.mp4' + otherQ);
    expect(res.status).toBe(403);
  });

  it('flag ON + default prefixes: fonts/ (referenced from CSS) serves unsigned', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    delete process.env.PUBLIC_MEDIA_PREFIXES; // default = fonts/
    const res = await request(buildApp()).get('/uploads/fonts/Inter.woff2');
    expect(res.status).toBe(200);
  });

  it('flag ON: the runbook public allowlist (music/) lets the catalog serve unsigned, while videos/ stay gated', async () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    process.env.PUBLIC_MEDIA_PREFIXES = 'fonts/,music/';
    const app = buildApp();
    const music = await request(app).get('/uploads/music/catalog.mp3');
    expect(music.status).toBe(200);
    expect(Buffer.from(music.body)).toEqual(MUSIC_BYTES);
    // videos/ is NOT in the allowlist → still 403 unsigned
    const video = await request(app).get('/uploads/videos/private.mp4');
    expect(video.status).toBe(403);
  });
});

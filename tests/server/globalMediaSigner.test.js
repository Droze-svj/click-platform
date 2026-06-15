// The global /api response signer (server/index.js) must sign /uploads URLs even
// when the response comes from a router mounted SEPARATELY under /api/* (which is
// how the video sub-routes — creative, clips, advanced, manual-editing… — are
// mounted). This locks the Express behavior the design relies on: a res.json
// wrapper installed by an earlier `app.use('/api', …)` middleware persists onto
// the response object and still wraps a later sub-router's res.json call. Without
// that, those routes would emit UNSIGNED media and break under REQUIRE_SIGNED_MEDIA.

const express = require('express');
const request = require('supertest');
const { signMediaUrls, verifyMediaUrl } = require('../../server/utils/mediaUrlSigner');

function makeApp() {
  const app = express();
  // Exactly the global signer from index.js.
  app.use('/api', (req, res, next) => {
    const _json = res.json.bind(res);
    res.json = (body) => _json(signMediaUrls(body));
    next();
  });
  // A sub-router mounted directly under /api/x — analogous to /api/video/creative.
  const sub = express.Router();
  sub.get('/clip', (req, res) => res.json({
    success: true,
    data: { url: '/uploads/processed/c.mp4', external: 'https://cdn.example.com/x.mp4', note: 'keep' },
  }));
  app.use('/api/x', sub);
  return app;
}

test('signs /uploads URLs from a separately-mounted sub-router; leaves the rest intact', async () => {
  const res = await request(makeApp()).get('/api/x/clip');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.data.note).toBe('keep');                       // non-url preserved
  expect(res.body.data.external).toBe('https://cdn.example.com/x.mp4'); // external untouched

  const url = res.body.data.url;
  expect(url).toMatch(/^\/uploads\/processed\/c\.mp4\?exp=\d+&sig=[0-9a-f]{64}$/);
  const u = new URLSearchParams(url.split('?')[1]);
  expect(verifyMediaUrl('/uploads/processed/c.mp4', u.get('exp'), u.get('sig'))).toBe(true);
});

test('non-media responses pass through unchanged', async () => {
  const app = express();
  app.use('/api', (req, res, next) => {
    const _json = res.json.bind(res);
    res.json = (body) => _json(signMediaUrls(body));
    next();
  });
  app.get('/api/ping', (req, res) => res.json({ ok: true, n: 42, msg: 'no media here' }));
  const res = await request(app).get('/api/ping');
  expect(res.body).toEqual({ ok: true, n: 42, msg: 'no media here' });
});

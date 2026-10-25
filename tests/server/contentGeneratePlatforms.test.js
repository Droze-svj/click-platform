/**
 * POST /api/content/generate validator vs the content page.
 *
 * The content page offers TikTok, Instagram, YouTube, X and LinkedIn. The
 * validator only allowed twitter/linkedin/instagram/facebook/tiktok, so any
 * selection that included YouTube came back 400.
 */
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { validateContentGenerate } = require('../../server/validators/contentValidator');

function appWithValidator() {
  const app = express();
  app.use(express.json());
  app.post('/generate', validateContentGenerate, (req, res) => res.json({ ok: true }));
  return app;
}

const text = 'A long enough source text for the content generator to accept it as input.';

describe('content generate platform validation', () => {
  it('accepts every platform the content page offers', async () => {
    const page = fs.readFileSync(path.join(__dirname, '../../client/app/dashboard/content/page.tsx'), 'utf8');
    const block = page.slice(page.indexOf('const RESONANCE_NODES'), page.indexOf(']', page.indexOf('const RESONANCE_NODES')));
    const offered = [...block.matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1]);
    expect(offered).toContain('youtube');

    const res = await request(appWithValidator()).post('/generate').send({ text, platforms: offered });
    expect(res.status).toBe(200);
  });

  it('still rejects an unknown platform', async () => {
    const res = await request(appWithValidator()).post('/generate').send({ text, platforms: ['myspace'] });
    expect(res.status).toBe(400);
  });
});

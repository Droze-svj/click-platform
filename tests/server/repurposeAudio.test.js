// The multi-platform Repurpose fan-out must carry the master audio mix so every
// variant renders with it (the render side — runFfmpegRender — already forwards
// tree.audio; this locks in the route→orchestrate handoff that was the missing link).

jest.mock('../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: '6a3500000000000000000aaa', niche: 'finance' }; next(); });
jest.mock('../../server/middleware/enhancedRateLimiter', () => ({ renderLimiter: (req, res, next) => next() }));
jest.mock('../../server/middleware/tierGate', () => ({ requireFeature: () => (req, res, next) => next(), checkExportQuota: (req, res, next) => next() }));
jest.mock('../../server/services/repurposeService', () => ({ orchestrate: jest.fn() }));

const request = require('supertest');
const express = require('express');
const repurposeService = require('../../server/services/repurposeService');
const router = require('../../server/routes/video/repurpose');

function app() { const a = express(); a.use(express.json()); a.use('/api/video', router); return a; }

describe('POST /api/video/repurpose — carries the audio mix', () => {
  beforeEach(() => repurposeService.orchestrate.mockReset());

  it('forwards tree.audio into orchestrate so every variant renders with the mix', async () => {
    repurposeService.orchestrate.mockResolvedValue({ ok: true, variants: [] });
    const audio = { musicVolume: 0.7, duckingAmount: -18, audioPreset: 'voice-boost' };
    const res = await request(app()).post('/api/video/repurpose').send({
      videoUrl: 'https://example.com/v.mp4', audio, targets: ['9:16', '1:1'], duration: 30,
    });
    expect(res.status).toBe(200);
    expect(repurposeService.orchestrate).toHaveBeenCalledTimes(1);
    const arg = repurposeService.orchestrate.mock.calls[0][0];
    expect(arg.tree.audio).toEqual(audio); // the mix reaches the orchestrator → each variant's render
  });

  it('still works (no audio) when the editor has no mix set', async () => {
    repurposeService.orchestrate.mockResolvedValue({ ok: true, variants: [] });
    const res = await request(app()).post('/api/video/repurpose').send({ videoUrl: 'https://example.com/v.mp4', targets: ['9:16'] });
    expect(res.status).toBe(200);
    expect(repurposeService.orchestrate.mock.calls[0][0].tree.audio).toBeUndefined();
  });
});

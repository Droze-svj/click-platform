/**
 * A failed inline render must report `failed`.
 *
 * Production has no Redis, so renders run inline. A failure was recorded only
 * on an in-memory object; GET /render/:jobId/status answered 'unknown' forever
 * and the Repurpose panel spun forever.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'render-fail-'));
process.env.RENDER_OUTPUT_DIR = TMP;


const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const render = require('../../../server/routes/video/render');
const videoRenderService = require('../../../server/services/videoRenderService');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('render status reports failures', () => {
  let user, token;

  beforeAll(async () => {
    user = await new User({ email: 'render-fail@example.com', password: 'password123', name: 'R', emailVerified: true }).save();
    token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '1h' });
  });

  afterAll(async () => {
    await User.deleteOne({ _id: user._id });
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* noop */ }
  });

  const status = (jobId) => request(app)
    .get(`/api/video/render/${jobId}/status`)
    .set('Authorization', `Bearer ${token}`);

  it('a render that throws is reported as failed, with the reason', async () => {
    const jobId = 'f0f0f0f0-0000-4000-8000-000000000001';
    const spy = jest.spyOn(videoRenderService, 'renderFromEditorState').mockRejectedValue(new Error('ffmpeg exited with code 1'));
    try {
      await expect(render.runRender({ tree: { duration: 5, videoUrl: '/uploads/x.mp4' }, ratio: '9:16', jobId, userId: String(user._id) }))
        .rejects.toThrow('ffmpeg exited with code 1');
    } finally {
      spy.mockRestore();
    }
    const res = await status(jobId);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.error).toMatch(/ffmpeg exited/);
  });

  it('a started render with no output yet is processing, not unknown', async () => {
    const jobId = 'f0f0f0f0-0000-4000-8000-000000000002';
    render._writeRenderOwner(jobId, String(user._id));
    const res = await status(jobId);
    expect(res.body.data.status).toBe('processing');
  });

  it('a render that started long ago and never finished is reported as interrupted', async () => {
    const jobId = 'f0f0f0f0-0000-4000-8000-000000000003';
    render._writeRenderOwner(jobId, String(user._id));
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
    fs.utimesSync(path.join(TMP, `${jobId}.owner`), old, old);
    const res = await status(jobId);
    expect(res.body.data.status).toBe('failed');
  });

  it("does not reveal another user's failure", async () => {
    const jobId = 'f0f0f0f0-0000-4000-8000-000000000004';
    render._writeRenderOwner(jobId, 'someone-else');
    render.markRenderFailed(jobId, 'secret');
    const res = await status(jobId);
    expect(res.status).toBe(404);
  });

  it('a Repurpose variant whose reframe fails is reported as failed', async () => {
    // The reframe runs before runRender, so its failure was only logged and
    // the variant's status poll said "unknown" forever.
    const smartReframe = require('../../../server/services/smartReframeService');
    const { runVariants } = require('../../../server/services/repurposeService');
    const jobId = 'f0f0f0f0-0000-4000-8000-000000000005';
    const reframeSpy = jest.spyOn(smartReframe, 'reframe').mockRejectedValue(new Error('no video stream'));
    const renderSpy = jest.spyOn(render, 'runRender');
    try {
      await runVariants({
        sourcePath: '/nonexistent/source.mp4',
        baseTree: { duration: 5 },
        variants: [{ jobId, ratio: '9:16', platform: 'tiktok' }],
        tier: 'pro',
        userId: String(user._id),
      });
    } finally {
      reframeSpy.mockRestore();
      renderSpy.mockRestore();
    }
    expect(renderSpy).not.toHaveBeenCalled();
    const res = await status(jobId);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.error).toMatch(/reframe.*9:16.*no video stream/);
  });
});

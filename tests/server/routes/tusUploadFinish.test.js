/**
 * Resumable (tus) upload completion.
 *
 * - Production has no Redis, so enqueueing the processing job always fails.
 *   That used to be logged and ignored, leaving the Content on 'processing'
 *   forever. It now runs the same in-process fallback as POST /video/upload.
 * - A failed Content save was swallowed and the upload "completed" with no
 *   video record. It now fails the request.
 */

jest.mock('../../../server/queues', () => ({
  addVideoProcessingJob: jest.fn(() => Promise.reject(new Error('Redis unavailable'))),
}));
jest.mock('../../../server/routes/video', () => ({
  startInProcessVideoProcessing: jest.fn(() => true),
}));

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Content = require('../../../server/models/Content');
const { tusServer, TUS_DIR } = require('../../../server/routes/upload-tus');
const { startInProcessVideoProcessing } = require('../../../server/routes/video');

const onUploadFinish = tusServer.options.onUploadFinish;

function fakeRes() {
  const headers = {};
  return { setHeader: (k, v) => { headers[k] = v; }, headers };
}

describe('tus onUploadFinish', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const req = { user: { _id: userId, email: 'tus@example.com', name: 'Tus' } };

  const stage = (id) => {
    fs.mkdirSync(TUS_DIR, { recursive: true });
    fs.writeFileSync(path.join(TUS_DIR, id), Buffer.alloc(64));
    return { id, size: 64, metadata: { filename: 'clip.mp4', title: 'My clip' } };
  };

  afterEach(async () => {
    startInProcessVideoProcessing.mockClear();
    await Content.deleteMany({ userId });
  });

  it('processes in-process when the queue is unavailable', async () => {
    const upload = stage(`tus-test-${Date.now()}-a`);
    const res = fakeRes();
    await onUploadFinish(req, res, upload);
    const content = await Content.findOne({ userId }).lean();
    expect(content).toBeTruthy();
    expect(res.headers['X-Content-Id']).toBe(String(content._id));
    expect(startInProcessVideoProcessing).toHaveBeenCalledTimes(1);
    const arg = startInProcessVideoProcessing.mock.calls[0][0];
    expect(arg.contentId).toBe(String(content._id));
    expect(fs.existsSync(arg.videoPath)).toBe(true);
    fs.unlinkSync(arg.videoPath);
  });

  it('marks the video failed when the server is too busy to process it', async () => {
    startInProcessVideoProcessing.mockReturnValueOnce(false);
    const upload = stage(`tus-test-${Date.now()}-b`);
    await onUploadFinish(req, fakeRes(), upload);
    const content = await Content.findOne({ userId }).lean();
    expect(content.status).toBe('failed');
    expect(content.errorMessage).toMatch(/too busy/);
    try { fs.unlinkSync(path.join(process.cwd(), content.originalFile.url)); } catch (_) { /* gone */ }
  });

  it('fails the request (and leaves no orphan file) when the Content cannot be saved', async () => {
    const spy = jest.spyOn(Content.prototype, 'save').mockRejectedValueOnce(new Error('db down'));
    const upload = stage(`tus-test-${Date.now()}-c`);
    const videosBefore = new Set(fs.readdirSync(path.join(process.cwd(), 'uploads', 'videos')));
    try {
      await expect(onUploadFinish(req, fakeRes(), upload)).rejects.toMatchObject({ status_code: 500 });
    } finally {
      spy.mockRestore();
    }
    const videosAfter = fs.readdirSync(path.join(process.cwd(), 'uploads', 'videos')).filter((f) => !videosBefore.has(f));
    expect(videosAfter).toEqual([]);
    expect(startInProcessVideoProcessing).not.toHaveBeenCalled();
  });
});

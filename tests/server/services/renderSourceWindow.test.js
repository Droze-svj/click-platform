const fs = require('fs');
const path = require('path');
const {
  needsStitch,
  primarySourceStart,
  resolveInputPath,
} = require('../../../server/services/videoRenderService');

// The export must cut the same footage the editor preview shows
// (client utils/timelinePlayback sourceStartOf).
describe('render source windows', () => {
  it('a main clip without a window starts at its own timeline position', () => {
    expect(primarySourceStart({ startTime: 4, endTime: 12 })).toBe(4);
    expect(primarySourceStart({ startTime: 4, endTime: 12, sourceStartTime: 1 })).toBe(1);
    expect(primarySourceStart({ startTime: 4, endTime: 12, sourceStartTime: 0 })).toBe(0);
  });

  it('a single clip that no longer starts at the top of the source is stitched', () => {
    // e.g. split at 4s and the first half deleted — used to export the full source.
    expect(needsStitch([{ type: 'video', track: 0, startTime: 4, endTime: 12 }])).toBe(true);
    expect(needsStitch([{ type: 'video', track: 0, startTime: 0, endTime: 12, sourceStartTime: 0 }])).toBe(false);
  });
});

describe('own /uploads URLs are read from disk', () => {
  const rel = `uploads/render-src-test-${process.pid}.mp4`;
  const abs = path.resolve(process.cwd(), rel);

  beforeAll(() => {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
  });
  afterAll(() => { fs.rmSync(abs, { force: true }); });

  it('maps a signed self URL to the local file instead of fetching it', async () => {
    const url = `http://localhost:5001/${rel}?exp=1&sig=abc`;
    await expect(resolveInputPath(null, url)).resolves.toBe(abs);
  });

  it('still SSRF-blocks loopback URLs that are not one of our uploads', async () => {
    await expect(resolveInputPath(null, 'http://localhost:5001/uploads/does-not-exist.mp4')).rejects.toThrow(/blocked address/);
    await expect(resolveInputPath(null, 'http://127.0.0.1/admin')).rejects.toThrow(/blocked address/);
  });
});

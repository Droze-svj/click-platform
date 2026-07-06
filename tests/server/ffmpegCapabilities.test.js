// The ffmpeg capability probe must never throw/reject (callers fall back to
// software on any failure) and must cache the result.

jest.mock('fluent-ffmpeg', () => ({ getAvailableEncoders: jest.fn() }));
const ffmpeg = require('fluent-ffmpeg');
const { getAvailableEncoders, _resetCache } = require('../../server/utils/ffmpegCapabilities');

describe('ffmpegCapabilities.getAvailableEncoders', () => {
  beforeEach(() => { _resetCache(); ffmpeg.getAvailableEncoders.mockReset(); });

  it('returns the encoder map and caches it (probes once)', async () => {
    ffmpeg.getAvailableEncoders.mockImplementation((cb) => cb(null, { h264_nvenc: {}, libx264: {} }));
    const first = await getAvailableEncoders();
    expect(first).toHaveProperty('h264_nvenc');
    const second = await getAvailableEncoders();
    expect(second).toBe(first); // cached
    expect(ffmpeg.getAvailableEncoders).toHaveBeenCalledTimes(1);
  });

  it('resolves to {} when the probe errors (→ software fallback), never rejects', async () => {
    ffmpeg.getAvailableEncoders.mockImplementation((cb) => cb(new Error('ffmpeg missing')));
    await expect(getAvailableEncoders()).resolves.toEqual({});
  });

  it('resolves to {} when the probe throws synchronously', async () => {
    ffmpeg.getAvailableEncoders.mockImplementation(() => { throw new Error('boom'); });
    await expect(getAvailableEncoders()).resolves.toEqual({});
  });
});

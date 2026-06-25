const { splitAndMergeVideo } = require('../../../server/services/enhancedVideoProcessingService');

// These reject during validation BEFORE any ffmpeg invocation, so no real
// render is needed — they verify invalid segments can't reach the filter graph.
describe('splitAndMergeVideo segment validation', () => {
  it('rejects when there are no segments', async () => {
    await expect(splitAndMergeVideo('/tmp/x.mp4', [])).rejects.toThrow(/valid segments/i);
  });

  it('rejects start>=end / negative / non-numeric segments', async () => {
    await expect(splitAndMergeVideo('/tmp/x.mp4', [{ start: 5, end: 2 }])).rejects.toThrow(/valid segments/i);
    await expect(splitAndMergeVideo('/tmp/x.mp4', [{ start: -1, end: 3 }])).rejects.toThrow(/valid segments/i);
    await expect(splitAndMergeVideo('/tmp/x.mp4', [{ start: 'a', end: 'b' }])).rejects.toThrow(/valid segments/i);
  });

  it('attaches statusCode 400 to the validation error', async () => {
    await splitAndMergeVideo('/tmp/x.mp4', []).catch((e) => {
      expect(e.statusCode).toBe(400);
    });
  });
});

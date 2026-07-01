// Regression guard for video/advanced.js access-control + ffmpeg-arg fixes
// (exhaustive per-route audit, batch 1, 3/3 adversarially confirmed).

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/video/advanced.js'), 'utf8');

function guardedBefore(marker, guardRe, within = 10) {
  const lines = src.split('\n');
  const idx = lines.findIndex((l) => l.includes(marker));
  if (idx < 0) return { found: false };
  const start = Math.max(0, idx - within);
  return { found: true, guarded: lines.slice(start, idx).some((l) => guardRe.test(l)) };
}

describe('video/advanced.js audit fixes', () => {
  it('roi-prediction is ownership-gated on videoId', () => {
    const r = guardedBefore('predictContentROI(videoId', /guardOwnership\(req, res, videoId\)/);
    expect(r.found).toBe(true);
    expect(r.guarded).toBe(true);
  });

  it('ingest-metrics + analyze-pivots verify workspace membership (no trusted body workspaceId)', () => {
    expect(src).not.toMatch(/ingestPostMetrics\(workspaceId \|\| req\.user\.workspaceId\)/);
    expect(src).not.toMatch(/analyzeStrategicPivots\(workspaceId \|\| req\.user\.workspaceId/);
    const ingest = guardedBefore('ingestPostMetrics(workspaceId)', /verifyWorkspaceAccess\(req\.user\._id, workspaceId\)/);
    const pivots = guardedBefore('analyzeStrategicPivots(workspaceId, niche)', /verifyWorkspaceAccess\(req\.user\._id, workspaceId\)/);
    expect(ingest.guarded).toBe(true);
    expect(pivots.guarded).toBe(true);
  });

  it('remove-silence validates ffmpeg-bound params (no raw interpolation)', () => {
    expect(src).not.toMatch(/silencedetect=noise=\$\{silenceThreshold\}:d=\$\{minSilenceDuration\}/);
    expect(src).toMatch(/silencedetect=noise=\$\{safeThreshold\}:d=\$\{safeMinSilence\}/);
    expect(src).toMatch(/const safeThreshold = \/\^-\?\\d/);
  });
});

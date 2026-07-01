// Regression guards for the exhaustive per-route audit (batch 2, self-verified —
// the workflow's adversarial-verify stage was rate-limited, so these were
// confirmed by hand against the source before fixing).

const fs = require('fs');
const path = require('path');
const readServer = (p) => fs.readFileSync(path.join(__dirname, '../../server', p), 'utf8');

function guardedBefore(src, marker, within = 12) {
  const lines = src.split('\n');
  const idx = lines.findIndex((l) => l.includes(marker));
  if (idx < 0) return { found: false };
  const start = Math.max(0, idx - within);
  return { found: true, guarded: lines.slice(start, idx).some((l) => /guardOwnership\(req, res,/.test(l)) };
}
const expectGuarded = (src, marker) => {
  const r = guardedBefore(src, marker);
  expect(r.found).toBe(true);
  expect(r.guarded).toBe(true);
};

describe('audit batch-2 security fixes', () => {
  it('ai-enhanced.js: confidence routes are ownership-gated (contentId → Content owner)', () => {
    const src = readServer('routes/ai-enhanced.js');
    expect(src).toMatch(/require\(['"]\.\.\/utils\/ownership['"]\)/);
    expectGuarded(src, 'updateConfidenceRealTime(contentId');
    expectGuarded(src, 'getConfidenceHistory(contentId');
    expectGuarded(src, 'getConfidenceRecommendations(contentId');
    expectGuarded(src, 'setConfidenceThresholds(contentId');
    expectGuarded(src, 'batchAnalyzeConfidence(contentIds');
    // history limit is clamped (was raw parseInt → unbounded find())
    expect(src).toMatch(/getConfidenceHistory\(contentId, clampInt\(/);
  });

  it('aiFoleyService.js: client videoId is sanitized before it becomes a filename (no path traversal)', () => {
    const src = readServer('services/aiFoleyService.js');
    // raw interpolation of the client videoId into the path is gone
    expect(src).not.toMatch(/foley_\$\{videoId\}_/);
    // a sanitized token (strips path separators / dots) is used instead
    expect(src).toMatch(/replace\(\/\[\^a-zA-Z0-9_-\]\/g, ''\)/);
    expect(src).toMatch(/foley_\$\{safeVideoId\}_/);
  });
});

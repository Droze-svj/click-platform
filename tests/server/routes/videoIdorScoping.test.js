// Regression guard for the video/* cross-tenant IDOR fixes (exhaustive per-route
// audit, batch 1). These handlers fetched/mutated Content by a client-supplied
// videoId/contentId with NO ownership scoping, letting any authenticated user
// read or overwrite another tenant's video project. Each now calls guardOwnership
// (utils/ownership.js) before touching the resource. Lock that in.

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes/video', p), 'utf8');

// True iff EVERY line containing `marker` is ownership-gated: a
// guardOwnership(req, res, ...) appears between it and the start of the route
// handler it sits in. (Checking only the first occurrence within a fixed
// window missed later calls and broke on long handlers.)
function guardedBefore(src, marker) {
  const lines = src.split('\n');
  const hits = lines.map((l, i) => (l.includes(marker) ? i : -1)).filter((i) => i >= 0);
  if (!hits.length) return { found: false };
  const guarded = hits.every((idx) => {
    for (let i = idx - 1; i >= 0; i--) {
      if (/guardOwnership\(req, res,/.test(lines[i])) return true;
      if (/^router\.(get|post|put|patch|delete|all)\(/.test(lines[i])) return false;
    }
    return false;
  });
  return { found: true, guarded };
}
const expectGuarded = (src, marker) => {
  const r = guardedBefore(src, marker);
  expect(r.found).toBe(true); // marker still present (fix targets the right code)
  expect(r.guarded).toBe(true); // and it is ownership-gated
};

describe('video IDOR scoping guards', () => {
  it('ai-editing.js: cross-tenant write + read routes are ownership-gated', () => {
    const src = read('ai-editing.js');
    expect(src).toMatch(/require\(['"]\.\.\/\.\.\/utils\/ownership['"]\)/);
    // critical writes
    expectGuarded(src, 'saveEditVersion(videoId');
    expectGuarded(src, 'restoreEditVersion(videoId');
    expectGuarded(src, 'batchAutoEdit(videoIds');
    // cross-tenant reads
    expectGuarded(src, 'computeVideoScore(videoId');
    expectGuarded(src, 'detectScenes(videoId');
    expectGuarded(src, 'detectSmartCuts(videoId');
    expectGuarded(src, 'generateEditPreview(videoId');
    expectGuarded(src, 'createComparisonVideo(videoId');
    expectGuarded(src, 'getEditPerformanceAnalytics(videoId');
    expectGuarded(src, 'exportMultipleFormats(videoId');
    expectGuarded(src, 'exportAspectRatios(videoId');
  });

  it('manual-editing.js: history / keyframes / timeline / cloud routes are ownership-gated', () => {
    const src = read('manual-editing.js');
    expectGuarded(src, 'editHistoryService.saveEditState(videoId');
    expectGuarded(src, 'editHistoryService.undoEdit(videoId');
    expectGuarded(src, 'editHistoryService.redoEdit(videoId');
    expectGuarded(src, 'editHistoryService.getEditHistory(videoId');
    expectGuarded(src, 'keyframeService.saveKeyframeAnimation(videoId');
    expectGuarded(src, 'multiTrackService.getTimelineConfig(videoId');
    expectGuarded(src, 'multiTrackService.addTrack(videoId');
    expectGuarded(src, 'multiTrackService.removeTrack(videoId');
    expectGuarded(src, 'multiTrackService.addClipToTrack(videoId');
    expectGuarded(src, 'cloudSyncService.saveProjectToCloud(videoId');
    expectGuarded(src, 'cloudSyncService.getProjectFromCloud(videoId');
    expectGuarded(src, 'cloudSyncService.getVersionHistory(videoId');
    expectGuarded(src, 'cloudSyncService.restoreProjectVersion(videoId');
  });

  it('creative.js: /thumbnail source-video render is ownership-gated', () => {
    const src = read('creative.js');
    expectGuarded(src, 'aiThumbnailService.autoGenerateViralThumbnails(');
  });

  it('thumbnails.js: /ai-viral imports + uses guardOwnership', () => {
    const src = read('thumbnails.js');
    expect(src).toMatch(/require\(['"]\.\.\/\.\.\/utils\/ownership['"]\)/);
    expectGuarded(src, 'autoGenerateViralThumbnails(videoId, timelineData');
  });
});

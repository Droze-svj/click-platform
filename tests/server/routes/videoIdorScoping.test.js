// Regression guard for the video/* cross-tenant IDOR fixes (exhaustive per-route
// audit, batch 1). These handlers fetched/mutated Content by a client-supplied
// videoId/contentId with NO ownership scoping, letting any authenticated user
// read or overwrite another tenant's video project. Each now calls guardOwnership
// (utils/ownership.js) before touching the resource. Lock that in.

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes/video', p), 'utf8');

// True iff a guardOwnership(req, res, ...) appears within `within` lines BEFORE
// the first line containing `marker` (i.e. the resource op is ownership-gated).
function guardedBefore(src, marker, within = 14) {
  const lines = src.split('\n');
  const idx = lines.findIndex((l) => l.includes(marker));
  if (idx < 0) return { found: false };
  const start = Math.max(0, idx - within);
  const guarded = lines.slice(start, idx).some((l) => /guardOwnership\(req, res,/.test(l));
  return { found: true, guarded };
}
const expectGuarded = (src, marker, within) => {
  const r = guardedBefore(src, marker, within);
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

// Render-fidelity suite (NON-GATING — own jest project `render-fidelity`, run
// via `npm run test:fidelity`). Renders KNOWN editor states through the real
// videoRenderService + system ffmpeg, then probes the OUTPUT with ffprobe to
// prove the edit actually took effect. This is the safety net for every change
// to the render compiler. Skips automatically where ffmpeg is absent.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { hasFfmpeg, ffprobe, makeSource } = require('./probe');
const renderService = require('../../server/services/videoRenderService');

const FFMPEG = hasFfmpeg();
const d = FFMPEG ? describe : describe.skip;

const TMP = path.join(os.tmpdir(), 'click-fidelity');
let SRC;
const outputs = [];

async function render(state) {
  // Mirror the route's stitch pre-pass (server/routes/video/manual-editing.js):
  // trim / per-segment speed / reverse / transitions are materialized into one
  // intermediate clip BEFORE the main render, then renderFromEditorState runs on
  // top. Calling renderFromEditorState alone (no pre-pass) would skip them.
  const segs = Array.isArray(state.timelineSegments) ? state.timelineSegments : [];
  let videoUrl = SRC;
  if (renderService.needsStitch(segs)) {
    const ex = state.exportOptions || {};
    const stitched = await renderService.stitchSegments(SRC, segs, {
      width: ex.width ?? 1920, height: ex.height ?? 1080, fps: ex.fps ?? 30,
    });
    if (stitched) { videoUrl = stitched; outputs.push(stitched); }
  }
  const res = await renderService.renderFromEditorState({
    videoId: 'fidelity', videoUrl, userId: 'fidelity-user', ...state,
  });
  if (res && res.outputPath) outputs.push(res.outputPath);
  return res;
}

d('render fidelity', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP, { recursive: true });
    SRC = path.join(TMP, 'src.mp4');
    makeSource(SRC, { duration: 4, size: '640x480', rate: 25 });
  }, 60000);

  afterAll(() => {
    for (const o of outputs) { try { fs.unlinkSync(o); } catch { /* ignore */ } }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('baseline → valid mp4, video+audio, target dimensions', async () => {
    const { outputPath } = await render({ exportOptions: { width: 1280, height: 720, duration: 4 } });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.hasAudio).toBe(true);
    expect(p.width).toBe(1280);
    expect(p.height).toBe(720);
    expect(p.duration).toBeGreaterThan(3);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);

  it('vertical export → output is 1080x1920', async () => {
    const { outputPath } = await render({ exportOptions: { width: 1080, height: 1920, duration: 4 } });
    const p = ffprobe(outputPath);
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
  }, 90000);

  it('2x speed → output duration ~halved', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 640, height: 480, duration: 4 },
      playbackSpeed: 2,
    });
    const p = ffprobe(outputPath);
    expect(p.duration).toBeGreaterThan(1.4);
    expect(p.duration).toBeLessThan(2.7);
  }, 90000);

  it('trim via timelineSegments → duration matches trimmed window', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 640, height: 480, duration: 4 },
      timelineSegments: [{ id: 's1', type: 'video', startTime: 0, sourceStartTime: 1, sourceEndTime: 3 }],
    });
    const p = ffprobe(outputPath);
    expect(p.duration).toBeGreaterThan(1.4);
    expect(p.duration).toBeLessThan(2.7);
  }, 90000);

  it('text overlay → render succeeds, output valid', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 1280, height: 720, duration: 4 },
      textOverlays: [{ id: 't1', text: 'FIDELITY', x: 10, y: 10, fontSize: 48, startTime: 0, endTime: 4, color: '#ffffff' }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);
});

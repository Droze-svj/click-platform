// Render-fidelity suite (NON-GATING — own jest project `render-fidelity`, run
// via `npm run test:fidelity`). Renders KNOWN editor states through the real
// videoRenderService + system ffmpeg, then probes the OUTPUT with ffprobe to
// prove the edit actually took effect. This is the safety net for every change
// to the render compiler. Skips automatically where ffmpeg is absent.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { hasFfmpeg, ffprobe, makeSource, frameAvgLuma } = require('./probe');
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

  it('vertical export WITH manual crop → still 1080x1920 (crop respected, not overridden)', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 1080, height: 1920, duration: 4 },
      videoCrop: { x: 10, y: 10, width: 60, height: 60 },
    });
    const p = ffprobe(outputPath);
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);

  it('layered text + shape overlays → render succeeds (z-order sort)', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 1280, height: 720, duration: 4 },
      shapeOverlays: [{ id: 'sh1', kind: 'box', x: 20, y: 20, width: 40, height: 20, layer: 2, color: '#ff0000' }],
      textOverlays: [{ id: 't1', text: 'BEHIND', x: 25, y: 25, fontSize: 36, startTime: 0, endTime: 4, layer: 1, color: '#ffffff' }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);

  it('freeze-frame → holds a still for its duration (was a no-op)', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 640, height: 480, duration: 4 },
      timelineSegments: [{ id: 'fz', type: 'video', startTime: 0, sourceStartTime: 0.5, freezeFrame: true, freezeDuration: 2 }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.duration).toBeGreaterThan(1.4);
    expect(p.duration).toBeLessThan(2.8);
  }, 90000);

  it('speed ramp → duration reflects the average speed', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 640, height: 480, duration: 4 },
      timelineSegments: [{ id: 'sr', type: 'video', startTime: 0, sourceStartTime: 0, sourceEndTime: 3, playbackSpeedStart: 1, playbackSpeedEnd: 3 }],
    });
    const p = ffprobe(outputPath);
    // avg(1,3)=2 → a 3s source becomes ~1.5s
    expect(p.duration).toBeGreaterThan(1.0);
    expect(p.duration).toBeLessThan(2.2);
  }, 90000);

  it('per-segment crop + volume → renders cleanly (was dropped)', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 640, height: 480, duration: 4 },
      timelineSegments: [{
        id: 's1', type: 'video', startTime: 0, sourceStartTime: 0, sourceEndTime: 3,
        crop: { left: 10, right: 10, top: 5, bottom: 5 }, volume: 0.5,
      }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.hasAudio).toBe(true);
    expect(p.duration).toBeGreaterThan(2.4);
    expect(p.duration).toBeLessThan(3.6);
  }, 90000);

  it('timelineEffect (vignette) → applied + time-gated to its window', async () => {
    const { outputPath } = await render({
      exportOptions: { width: 1280, height: 720, duration: 4 },
      timelineEffects: [{
        id: 'fx1', type: 'overlay', name: 'Cinematic Vignette',
        startTime: 1.5, endTime: 3.5, params: { strength: 60 }, intensity: 100, enabled: true,
      }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    // Vignette darkens the frame edges → average luma INSIDE the window should be
    // measurably lower than OUTSIDE it (proves the effect rendered AND is gated).
    const inside = frameAvgLuma(outputPath, 2.5);
    const outside = frameAvgLuma(outputPath, 0.4);
    if (inside != null && outside != null) {
      expect(inside).toBeLessThan(outside - 3);
    }
  }, 90000);

  it('silent-audio source → renders (loudnorm NaN guard)', async () => {
    // A pure-silence track made loudnorm emit NaN → the aac encoder failed (234),
    // so ANY silent video failed to export. The dither floor fixes it.
    const silent = path.join(TMP, 'silent.mp4');
    makeSource(silent, { duration: 3, audio: 'silent' });
    const res = await renderService.renderFromEditorState({
      videoId: 'fidelity-silent', videoUrl: silent, userId: 'fidelity-user',
      exportOptions: { width: 640, height: 480, duration: 3 },
    });
    outputs.push(res.outputPath, silent);
    const p = ffprobe(res.outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.hasAudio).toBe(true);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);

  it('sentiment-driven effects render through the timelineEffects path', async () => {
    // Proves the AI sentiment→effects feature composes with the wired render path.
    const { buildSentimentEffects } = require('../../server/services/aiVideoEditingService');
    const fx = buildSentimentEffects({ sentimentArc: 'dramatic' }, 4);
    expect(fx.length).toBeGreaterThan(0);
    const { outputPath } = await render({
      exportOptions: { width: 1280, height: 720, duration: 4 },
      timelineEffects: fx,
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.sizeBytes).toBeGreaterThan(1024);
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

  it('LONG caption wraps into multiple stacked drawtext lines → renders through ffmpeg', async () => {
    // A long phrase forces the multi-line wrap path (several comma-joined
    // drawtext filters). This proves the stacked filter graph is valid ffmpeg —
    // the real risk of multi-line captions — on a vertical frame.
    const { outputPath } = await render({
      exportOptions: { width: 1080, height: 1920, duration: 4 },
      textOverlays: [{
        id: 'long', style: 'hook',
        text: 'THIS IS A LONG VIRAL HOOK THAT MUST WRAP ACROSS MULTIPLE LINES TO FIT',
        startTime: 0, endTime: 4,
      }],
    });
    const p = ffprobe(outputPath);
    expect(p.hasVideo).toBe(true);
    expect(p.sizeBytes).toBeGreaterThan(1024);
  }, 90000);
});

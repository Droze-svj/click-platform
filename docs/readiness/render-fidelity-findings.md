# Render-Fidelity Findings & Ledger

Drives the editor-upgrade phases. Backed by the new **render-fidelity harness**
(`tests/render/fidelity.test.js`, `npm run test:fidelity`) — it renders known editor states
through the real `videoRenderService` + system ffmpeg and probes the OUTPUT with ffprobe, so
every render change is verifiable. Non-gating (needs an ffmpeg binary; auto-skips without one).

## 🔴 CRITICAL — found + FIXED in Phase 1

**Every export was force-rescaled to 1920×1080, destroying non-landscape exports.**
`videoEnhancer.getEnhancementFilters()` ([server/utils/videoEnhancer.js]) appended a hardcoded
`scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080` for any source under
1080px wide — running AFTER the render's correct `scale=${exportWidth}:${exportHeight}`. Result:
a **vertical 1080×1920 export came out 1920×1080 landscape with the content letterboxed**, and
every chosen export size (1280×720, etc.) was overridden. The render already scales the source to
the target dims, so the block was redundant + destructive. **Removed.** The harness now asserts
vertical → 1080×1920 (green).

## Outcomes (Phases 2–5, all merged + fidelity-tested)

- **Vertical force-rescale** → fixed (Phase 1, above).
- **timelineEffects** (vignette/grain/chromatic/glow/flash/color) → wired end-to-end,
  time-gated; proven by a luma test.
- **Per-segment crop + volume** → applied in the stitch pre-pass.
- **Manual vertical crop** → respected (no longer overridden).
- **Overlay z-order** → text+shape sorted by layer.
- **freeze-frame** + **speed-ramp** (avg) → implemented; J/L-cut still deferred (needs
  cross-segment audio mixing).
- **Silent-audio loudnorm NaN** → fixed (any silent video failed to export; dither floor).
- **atempo final-factor clamp** → fixed.
- **commerce-inlay corruption** + **resurrection-hook dead input** → disabled safely.
- **style-profile create race** → atomic upsert (stabilized the double-run).
- **Filler-word removal** (Phase 5a) → `detectFillerWords` via word timings (conservative).

Harness grew to **12 fidelity tests** (all green ×2) + 4 filler unit tests. Double-run is
clean per-project (`test:unit` 498 ×2, `test:fidelity` 12/12 ×2, `smoke:full` ×2); the bare
`npx jest` all-projects-concurrent run can flake on a CPU-contention timeout (ffmpeg + the
984-endpoint sweep) — a test-infra artifact, not a product bug (CI runs them separately).

**Remaining AI features (scoped follow-up):** auto-chaptering, AI b-roll suggestions,
sentiment-driven effects (the last now easy via the wired timelineEffects path).

## Verification status of the audit's reported bugs (historical — now mostly resolved above)

VERIFIED real (confirmed against code):
- **timelineEffects dropped** — `ExportView.tsx` POST body omits it; no render param. (Phase 2)
- **Per-segment** transform/crop/volume/stabilization ignored in `stitchSegments`. (Phase 2)
- **Overlay z-order** not preserved — text drawn before shapes; images/svg always on top
  (`videoRenderService.js` ~901–915). (Phase 2)
- **Vertical manual crop overridden** by the center-crop unless `smartReframe` (~989). (Phase 2)
- **freezeFrame / J-cut / L-cut / speed-ramps** `TODO(deferred)`. (Phase 3)
- **commerce-inlay** hardcoded input index (`hasMusic ? 2 : 1`, not `+i`) — multiple inlays
  scramble (~1155). (Phase 4)
- **resurrection-hook** input added but never wired into the graph (~1161). (Phase 4)

TO-VERIFY during their phase (may be partial/false — prior audits over-claimed):
- atempo final-factor clamp (the while-loops are mathematically bounded; only a float edge).
- audio sidechain order / amix duration AV-sync.
- image scale-keyframe dropped under rotation.
- output-file integrity (ffprobe) validation (currently size-only).
- keyframe `lt()` vs `le()` at exact times; gradient radial radius; progress-bar duration clamp.

## Harness coverage (current, green)
baseline (dims + streams) · vertical 1080×1920 · 2× speed halves duration · single-clip trim via
stitch pre-pass · text overlay renders. Grows with each phase (z-order, per-segment, effects,
freeze/J-L-cut, the fixed correctness bugs).

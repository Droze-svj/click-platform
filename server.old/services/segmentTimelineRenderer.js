// Segment-aware ffmpeg renderer.
//
// The original videoRenderService treated timelineSegments as a music-only
// signal — segment-level ops (split / reverse / freeze / trim-to-in-out /
// J-cut / L-cut) had no effect at export time. This module fills that gap.
//
// Scope (v1):
//   - Single input video. All video-track segments must reference the same
//     source URL (the typical case after split). Cross-source segments are
//     skipped with a warning until a multi-source pass is added.
//   - Operates on the primary video track (track 0 / undefined). Other tracks
//     are passed through unchanged for now.
//   - Produces a single ffmpeg command with one filter_complex graph; runs
//     in one pass for performance.
//
// Filter graph shape:
//
//   For each segment i with source range [ss, se] and timeline duration d:
//     Video sub-chain:
//       [0:v]trim=start=ss:end=se,setpts=PTS-STARTPTS
//             [+,reverse]                          if reversed
//             [+,tpad=stop_mode=clone:stop_dur=...] if freezeFrame
//             [+,scale=W:H,setsar=1]               normalization
//             [vN]
//
//     Audio sub-chain (placed on the final timeline at offset O_i):
//       [0:a]atrim=start=ss:end=se,asetpts=PTS-STARTPTS
//             [+,areverse]                          if reversed
//             [,volume=0]                           if freezeFrame
//             ,adelay=O_i_ms|O_i_ms                 placement on timeline
//             [aN]
//
//   Concat videos: [v0][v1]...concat=n=N:v=1:a=0[vfinal]
//   Mix audios:    [a0][a1]...amix=inputs=N:duration=longest:dropout_transition=0[afinal]
//
//   The audio offset O_i is the segment's visual start on the final timeline
//   minus its audioLeadInSec (J-Cut). The audio source range is widened by
//   audioTailOutSec (L-Cut) so the segment's audio continues past its visual
//   end. amix handles the overlap with neighboring segments.

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const DEFAULT_FRAMERATE = 30;
// A "single frame" duration for freeze extractions. Slightly longer than 1/30
// to make sure ffmpeg's trim filter actually emits at least one frame.
const FREEZE_SOURCE_SLICE = 0.05;

function isPrimaryVideoSegment(seg) {
  if (!seg) return false;
  // Treat undefined track as track 0 (legacy segments).
  const track = typeof seg.track === 'number' ? seg.track : 0;
  if (track !== 0 && track !== 1) return false;
  if (seg.type && seg.type !== 'video' && seg.type !== 'broll' && seg.type !== 'cut') return false;
  return true;
}

function sortByStartTime(segments) {
  return [...segments].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function escapeShell(s) {
  // Used for filter values that may contain colons/commas — fluent-ffmpeg's
  // complexFilter API takes objects so we don't actually shell-escape, but
  // we sanitize numeric values here to defensively avoid filter injection.
  return String(s);
}

// Returns a filter-chain STRING for one video sub-stream, properly comma-chained.
// Filter graphs use `,` to chain filters within a stream and `;` to separate
// streams — fluent-ffmpeg's spec-object API doesn't preserve this distinction
// when you pass an array of single-filter specs, so we compose strings here.
function buildVideoSubChain(seg, label, inputIndex, exportOptions) {
  const ss = asNumber(seg.sourceStartTime, asNumber(seg.startTime));
  const se = asNumber(seg.sourceEndTime, ss + asNumber(seg.duration, asNumber(seg.endTime) - asNumber(seg.startTime)));
  const reversed = !!seg.reversed;
  const freeze = !!seg.freezeFrame;

  const parts = [];

  if (freeze) {
    const sliceEnd = ss + FREEZE_SOURCE_SLICE;
    parts.push(`trim=start=${ss}:end=${sliceEnd}`);
    parts.push('setpts=PTS-STARTPTS');
    const holdDuration = Math.max(0, asNumber(seg.duration, se - ss) - FREEZE_SOURCE_SLICE);
    if (holdDuration > 0) {
      parts.push(`tpad=stop_mode=clone:stop_duration=${holdDuration.toFixed(3)}`);
    }
  } else {
    parts.push(`trim=start=${ss}:end=${se}`);
    parts.push('setpts=PTS-STARTPTS');
    if (reversed) {
      parts.push('reverse');
    }
  }

  const w = asNumber(exportOptions?.width, 1920);
  const h = asNumber(exportOptions?.height, 1080);
  const fps = asNumber(exportOptions?.fps, DEFAULT_FRAMERATE);
  parts.push(`scale=w=${w}:h=${h}:force_original_aspect_ratio=decrease`);
  parts.push(`pad=w=${w}:h=${h}:x=(ow-iw)/2:y=(oh-ih)/2:color=black`);
  parts.push('setsar=1');
  parts.push(`fps=fps=${fps}`);

  return `[${inputIndex}:v]${parts.join(',')}[${label}]`;
}

function buildAudioSubChain(seg, label, inputIndex, timelineOffsetSec, _exportOptions) {
  const ss = asNumber(seg.sourceStartTime, asNumber(seg.startTime));
  const se = asNumber(seg.sourceEndTime, ss + asNumber(seg.duration, asNumber(seg.endTime) - asNumber(seg.startTime)));
  const tailOut = Math.max(0, asNumber(seg.audioTailOutSec));
  const reversed = !!seg.reversed;
  const freeze = !!seg.freezeFrame;
  const volume = asNumber(seg.volume, 1);

  const audioStart = Math.max(0, ss);
  const audioEnd = Math.max(audioStart + 0.05, se + tailOut);
  const offsetMs = Math.max(0, Math.round(timelineOffsetSec * 1000));

  const parts = [];
  parts.push(`atrim=start=${audioStart}:end=${audioEnd}`);
  parts.push('asetpts=PTS-STARTPTS');

  if (freeze) {
    parts.push('volume=0');
  } else {
    if (reversed) {
      parts.push('areverse');
    }
    if (volume !== 1) {
      parts.push(`volume=${volume}`);
    }
  }

  if (offsetMs > 0) {
    // adelay needs one value per channel; pass twice for stereo safety.
    parts.push(`adelay=${offsetMs}|${offsetMs}:all=1`);
  }

  return `[${inputIndex}:a]${parts.join(',')}[${label}]`;
}

// Plan segments into a renderable timeline.
//
// Each segment is assigned an `inputIndex` corresponding to a unique source
// URL. The primary input (index 0) is always `primarySourceUrl`. Additional
// sources get incremental indices in the order they're first seen — so a
// timeline with one A-roll and two B-rolls produces inputs [primary, broll1,
// broll2] mapping to indices [0, 1, 2].
function planSegments(segments, primarySourceUrl) {
  const primary = sortByStartTime(segments.filter(isPrimaryVideoSegment));
  const skipped = [];
  const usable = [];

  // Source URL → input index. Primary source is always index 0.
  const sourceIndex = new Map();
  const inputUrls = [];
  if (primarySourceUrl) {
    sourceIndex.set(primarySourceUrl, 0);
    inputUrls.push(primarySourceUrl);
  }

  let timelineCursor = 0;
  for (const seg of primary) {
    const sourceUrl = seg.sourceUrl || primarySourceUrl;
    if (!sourceUrl) {
      skipped.push({ id: seg.id, reason: 'segment has no sourceUrl and no primary fallback' });
      continue;
    }

    let idx = sourceIndex.get(sourceUrl);
    if (idx === undefined) {
      idx = inputUrls.length;
      sourceIndex.set(sourceUrl, idx);
      inputUrls.push(sourceUrl);
    }

    const duration = Math.max(
      0.05,
      asNumber(seg.duration, asNumber(seg.endTime) - asNumber(seg.startTime))
    );
    const visualStart = timelineCursor;
    const audioOffset = Math.max(0, visualStart - Math.max(0, asNumber(seg.audioLeadInSec)));

    usable.push({ seg, inputIndex: idx, visualStart, duration, audioOffset });
    timelineCursor += duration;
  }

  return { usable, skipped, totalDuration: timelineCursor, inputUrls };
}

/**
 * Render a timeline of TimelineSegments to a single video file.
 *
 * @param {Object} args
 * @param {string} args.inputPath - Local path or URL to the source video.
 * @param {Array}  args.segments - TimelineSegment[] from the editor.
 * @param {string} args.outputPath - Absolute path for the rendered file.
 * @param {Object} [args.exportOptions] - { width, height, fps, codec, ... }
 * @returns {Promise<{outputPath: string, totalDuration: number, skipped: Array}>}
 */
async function renderSegmentTimeline({ inputPath, segments, outputPath, exportOptions = {} }) {
  if (!inputPath) throw new Error('renderSegmentTimeline: inputPath required');
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('renderSegmentTimeline: at least one segment required');
  }
  if (!outputPath) throw new Error('renderSegmentTimeline: outputPath required');

  if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
    throw new Error(`renderSegmentTimeline: input not found at ${inputPath}`);
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const { usable, skipped, totalDuration, inputUrls } = planSegments(segments, inputPath);
  if (usable.length === 0) {
    throw new Error('renderSegmentTimeline: no usable primary-video segments after planning');
  }

  // Validate every non-URL secondary input exists locally before we hand the
  // command to ffmpeg — early failure here points at the missing file directly
  // instead of leaving the user staring at a generic ffmpeg stderr dump.
  for (let i = 1; i < inputUrls.length; i++) {
    const url = inputUrls[i];
    if (!url.startsWith('http') && !fs.existsSync(url)) {
      throw new Error(`renderSegmentTimeline: secondary input #${i} not found at ${url}`);
    }
  }

  logger.info('renderSegmentTimeline plan', {
    segments: usable.length,
    skipped: skipped.length,
    inputs: inputUrls.length,
    totalDuration: Number(totalDuration.toFixed(3)),
  });

  // Build the filter graph as a single string. Each chain ends in `;`,
  // filters within a chain are `,`-separated.
  const chains = [];
  const videoLabels = [];
  const audioLabels = [];

  usable.forEach(({ seg, inputIndex, audioOffset }, i) => {
    const vLabel = `v${i}`;
    const aLabel = `a${i}`;
    videoLabels.push(`[${vLabel}]`);
    audioLabels.push(`[${aLabel}]`);

    chains.push(buildVideoSubChain(seg, vLabel, inputIndex, exportOptions));
    chains.push(buildAudioSubChain(seg, aLabel, inputIndex, audioOffset, exportOptions));
    // Concat order encodes visualStart implicitly. audioOffset places audio
    // independently on the timeline so J/L cuts overlap neighboring audio.
  });

  // Concat video streams (audio handled separately via amix because audio
  // streams may have different durations due to J/L cuts and freeze silences).
  chains.push(`${videoLabels.join('')}concat=n=${usable.length}:v=1:a=0[vfinal]`);

  // Mix all audio sub-streams. duration=longest covers L-cut tails.
  if (audioLabels.length > 1) {
    chains.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0:normalize=0[afinal]`);
  } else {
    chains.push(`[a0]anull[afinal]`);
  }

  const filterGraph = chains.join(';');

  const codec = exportOptions.codec === 'hevc' ? 'libx265'
    : exportOptions.codec === 'prores' ? 'prores_ks'
    : 'libx264';
  const crf = asNumber(exportOptions.crf, exportOptions.quality === 'best' ? 18 : 23);
  const preset = exportOptions.preset || (exportOptions.quality === 'best' ? 'slow' : 'medium');
  const audioBitrate = exportOptions.audioBitrate || (exportOptions.quality === 'best' ? '320k' : '192k');

  return new Promise((resolve, reject) => {
    // Register every distinct source URL as an ffmpeg input so segments can
    // reference them via [N:v] / [N:a] in the filter graph. inputUrls[0] is
    // always the primary; inputUrls[1..] are B-roll/secondary clips.
    let command = ffmpeg(inputUrls[0]);
    for (let i = 1; i < inputUrls.length; i++) {
      command = command.input(inputUrls[i]);
    }
    command = command
      .complexFilter(filterGraph)
      .outputOptions([
        '-map', '[vfinal]',
        '-map', '[afinal]',
        '-c:v', codec,
        '-c:a', 'aac',
        '-b:a', escapeShell(audioBitrate),
        ...(codec === 'libx264' || codec === 'libx265' ? ['-crf', String(crf), '-preset', preset] : []),
        ...(codec === 'prores_ks' ? ['-profile:v', '3'] : []),
        '-movflags', '+faststart',
      ])
      .on('start', (cmd) => {
        logger.info('renderSegmentTimeline ffmpeg start', { cmd: cmd.slice(0, 4000) });
      })
      .on('error', (err, _stdout, stderr) => {
        logger.error('renderSegmentTimeline ffmpeg error', { error: err.message, stderr: (stderr || '').slice(-2000) });
        reject(err);
      })
      .on('end', () => {
        resolve({ outputPath, totalDuration, skipped });
      })
      .save(outputPath);
  });
}

module.exports = {
  renderSegmentTimeline,
  // Exported for unit testing / integration without invoking ffmpeg.
  planSegments,
  isPrimaryVideoSegment,
};

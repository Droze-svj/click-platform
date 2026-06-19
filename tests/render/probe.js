// ffmpeg/ffprobe helpers for the render-fidelity suite. These shell out to the
// system ffmpeg/ffprobe (the same binaries the render service uses), so the
// suite only runs where ffmpeg is installed.

const { spawnSync } = require('child_process');

function hasFfmpeg() {
  try {
    return spawnSync('ffprobe', ['-version'], { encoding: 'utf8' }).status === 0
      && spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;
  } catch {
    return false;
  }
}

/** Probe a media file → { duration, width, height, hasVideo, hasAudio, sizeBytes, nbFrames }. */
function ffprobe(file) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffprobe failed for ${file}: ${r.stderr}`);
  const data = JSON.parse(r.stdout);
  const v = (data.streams || []).find((s) => s.codec_type === 'video');
  const a = (data.streams || []).find((s) => s.codec_type === 'audio');
  return {
    duration: parseFloat((data.format && data.format.duration) || (v && v.duration) || 0),
    width: v ? Number(v.width) : 0,
    height: v ? Number(v.height) : 0,
    hasVideo: !!v,
    hasAudio: !!a,
    sizeBytes: parseInt((data.format && data.format.size) || 0, 10),
    nbFrames: v ? Number(v.nb_frames || 0) : 0,
  };
}

/** Generate a tiny synthetic source clip (color bars + tone) for deterministic
 *  tests. `audio:'silent'` makes a pure-silence track (exercises the loudnorm
 *  NaN guard); `audio:'tone'` (default) makes a 440Hz sine. */
function makeSource(file, { duration = 4, size = '640x480', rate = 25, audio = 'tone' } = {}) {
  const aIn = audio === 'silent'
    ? `anullsrc=r=44100:cl=stereo`
    : `sine=frequency=440:duration=${duration}`;
  const r = spawnSync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${size}:rate=${rate}`,
    '-f', 'lavfi', '-i', aIn,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg source gen failed: ${r.stderr}`);
  return file;
}

/** Extract the average luma of a single frame at time t (0-255). Lets a test
 *  assert that an overlay/effect actually changed pixels vs. the baseline. */
function frameAvgLuma(file, t) {
  const r = spawnSync('ffmpeg', [
    '-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1',
    '-vf', 'format=gray,scale=8:8', '-f', 'rawvideo', '-',
  ], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) return null;
  const buf = r.stdout;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i];
  return sum / buf.length;
}

module.exports = { hasFfmpeg, ffprobe, makeSource, frameAvgLuma };

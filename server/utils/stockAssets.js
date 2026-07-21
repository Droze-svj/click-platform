// Same-origin stock audio (SFX one-shots + music beds).
//
// The old stock library pointed every SFX at a full 3-minute SoundHelix SONG (and
// horse.mp3) on external hosts — so they were mislabeled (wrong durations, not
// one-shots) AND blocked by the page CSP `media-src 'self'` in the preview, i.e.
// silent. Here we SYNTHESIZE small, correctly-labelled one-shots + music beds in
// pure Node (no ffmpeg dependency) and serve them from /uploads/stock, so they
// play in the preview (same-origin) and mix into the export (see
// videoRenderService audio graph + pathUtils /uploads resolution).

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const SR = 22050; // sample rate
const STOCK_DIR = path.join(__dirname, '../../uploads/stock');

// Write a mono 16-bit PCM WAV from a Float32 sample array in [-1, 1].
function writeWav(filePath, samples) {
  const n = samples.length;
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) {
    let s = samples[i];
    if (s > 1) s = 1; else if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

// A deterministic-enough noise (Math.random is fine here — generation happens once
// at boot, not in any realtime/resume-sensitive path).
const noise = () => Math.random() * 2 - 1;
// short fade in/out to avoid click artifacts at the very start/end.
const edgeFade = (t, dur) => Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.02);

// Each generator returns a Float32 array of samples for its duration.
function gen(durSec, fn) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  let lp = 0; // 1-pole lowpass state for band-limited noise
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = fn(t, i, (x, k) => (lp += (x - lp) * k)) * 0.85 * edgeFade(t, durSec);
  }
  return out;
}

// ── SFX definitions ─────────────────────────────────────────────────────────
const SFX_DEFS = [
  { id: 'sfx-whoosh', title: 'Whoosh', tags: ['transition', 'swipe', 'whoosh'], dur: 0.7,
    fn: (t, i, lp) => lp(noise(), 0.08) * Math.sin(Math.PI * t / 0.7) * (1 - t / 0.7 * 0.3) },
  { id: 'sfx-swoosh', title: 'Swoosh', tags: ['transition', 'swipe'], dur: 0.5,
    fn: (t, i, lp) => lp(noise(), 0.03 + 0.15 * (t / 0.5)) * Math.pow(Math.sin(Math.PI * t / 0.5), 2) },
  { id: 'sfx-pop', title: 'Pop', tags: ['bubble', 'click', 'ui'], dur: 0.16,
    fn: (t) => Math.sin(2 * Math.PI * (520 - 200 * t / 0.16) * t) * Math.exp(-t * 42) },
  { id: 'sfx-ding', title: 'Ding', tags: ['success', 'chime', 'bell'], dur: 0.9,
    fn: (t) => (Math.sin(2 * Math.PI * 1397 * t) + 0.4 * Math.sin(2 * Math.PI * 2794 * t)) * Math.exp(-t * 5) },
  { id: 'sfx-impact', title: 'Impact Hit', tags: ['hit', 'punch', 'boom'], dur: 0.45,
    fn: (t, i, lp) => Math.sin(2 * Math.PI * 88 * t) * Math.exp(-t * 12) + lp(noise(), 0.5) * Math.exp(-t * 34) * 0.5 },
  { id: 'sfx-riser', title: 'Riser Build', tags: ['transition', 'build', 'riser'], dur: 1.3,
    fn: (t) => Math.sin(2 * Math.PI * (180 + 1100 * Math.pow(t / 1.3, 1.6)) * t) * (0.2 + 0.8 * t / 1.3) },
  { id: 'sfx-tada', title: 'Tada Reveal', tags: ['celebration', 'reveal', 'success'], dur: 0.9,
    fn: (t) => {
      const f = t < 0.28 ? 784 : t < 0.5 ? 988 : 1319; // G5 -> B5 -> E6 arpeggio
      const local = t < 0.28 ? t : t < 0.5 ? t - 0.28 : t - 0.5;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-local * 6);
    } },
  { id: 'sfx-tick', title: 'Tick', tags: ['clock', 'countdown', 'ui'], dur: 0.08,
    fn: (t, i, lp) => lp(noise(), 0.6) * Math.exp(-t * 90) },
  { id: 'sfx-click', title: 'Click', tags: ['ui', 'button', 'click'], dur: 0.07,
    fn: (t) => Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 110) },
  { id: 'sfx-notify', title: 'Notification', tags: ['alert', 'attention', 'chime'], dur: 0.6,
    fn: (t) => { const f = t < 0.18 ? 880 : 1175; const l = t < 0.18 ? t : t - 0.22; return l < 0 ? 0 : Math.sin(2 * Math.PI * f * t) * Math.exp(-l * 9); } },
];

// ── Music beds (looping tones w/ tremolo — pleasant, same-origin, exportable) ──
const MUSIC_DEFS = [
  { id: 'stock-music-upbeat', title: 'Upbeat Creative', genre: 'electronic', mood: 'energetic', dur: 16, freq: 523.25 },
  { id: 'stock-music-calm', title: 'Calm Focus', genre: 'ambient', mood: 'calm', dur: 16, freq: 392.0 },
  { id: 'stock-music-corporate', title: 'Corporate Pulse', genre: 'corporate', mood: 'professional', dur: 16, freq: 440.0 },
  { id: 'stock-music-cinematic', title: 'Dramatic Build', genre: 'cinematic', mood: 'dramatic', dur: 16, freq: 329.63 },
  { id: 'stock-music-lofi', title: 'Lo-fi Chill', genre: 'lofi', mood: 'relaxed', dur: 16, freq: 293.66 },
  { id: 'stock-music-tech', title: 'Tech Innovation', genre: 'electronic', mood: 'futuristic', dur: 16, freq: 587.33 },
];

function musicSamples(durSec, freq) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const trem = 0.72 + 0.28 * Math.sin(2 * Math.PI * 2 * t);
    // root + a fifth for a fuller, less "beep" bed
    const s = (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 1.5 * t)) * 0.4;
    out[i] = s * trem * Math.min(1, t / 1) * Math.min(1, (durSec - t) / 1);
  }
  return out;
}

let ensured = false;
// Generate the WAVs to disk once (idempotent; files persist). Returns the URL maps.
function ensureStockAssets() {
  try {
    fs.mkdirSync(STOCK_DIR, { recursive: true });
    for (const d of SFX_DEFS) {
      const fp = path.join(STOCK_DIR, `${d.id}.wav`);
      if (!fs.existsSync(fp)) writeWav(fp, gen(d.dur, d.fn));
    }
    for (const m of MUSIC_DEFS) {
      const fp = path.join(STOCK_DIR, `${m.id}.wav`);
      if (!fs.existsSync(fp)) writeWav(fp, musicSamples(m.dur, m.freq));
    }
    if (!ensured) { logger.info('[stock-assets] same-origin SFX + music beds ready', { sfx: SFX_DEFS.length, music: MUSIC_DEFS.length }); ensured = true; }
  } catch (e) {
    logger.warn('[stock-assets] generation failed (stock list still returned)', { error: e.message });
  }
}

const STOCK_SFX = SFX_DEFS.map((d) => ({ id: d.id, url: `/uploads/stock/${d.id}.wav`, title: d.title, tags: d.tags, duration: Math.round(d.dur * 100) / 100 }));
const STOCK_MUSIC = MUSIC_DEFS.map((m) => ({ id: m.id, url: `/uploads/stock/${m.id}.wav`, title: m.title, genre: m.genre, mood: m.mood, duration: m.dur }));

module.exports = { ensureStockAssets, STOCK_SFX, STOCK_MUSIC, STOCK_DIR };

// Dev-only demo music seed. Inserts a small, fully-CATEGORIZED public catalog so the
// in-editor Music browser/picker isn't empty on a fresh in-memory boot. Each track is
// a short real (ffmpeg-generated) tone clip so preview / "Use" / export all work.
//
// SAFETY: only ever invoked from database.js startInMemory() — i.e. the isolated
// in-memory MongoDB. It NEVER runs against a real database. Best-effort: any failure
// is logged and ignored so it can't break boot.

'use strict';

const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Fixed demo "owner" id (a valid ObjectId) — the tracks are public, so browse shows
// them to everyone regardless of this.
const DEMO_OWNER_ID = '000000000000000000000009';

// genre/mood are within the Music enums; energy/usageContext/bpm are the new facets.
const DEMO_TRACKS = [
  { title: 'Sunrise Lo-Fi',    genre: 'ambient',    mood: 'calm',       energy: 'low',    usageContext: ['background', 'intro'],       bpm: 70,  freq: 330, dur: 14 },
  { title: 'Hype Trap Loop',   genre: 'hip-hop',    mood: 'energetic',  energy: 'high',   usageContext: ['hook', 'highlight'],         bpm: 140, freq: 110, dur: 12 },
  { title: 'Corporate Clean',  genre: 'electronic', mood: 'inspiring',  energy: 'medium', usageContext: ['background'],                 bpm: 110, freq: 440, dur: 13 },
  { title: 'Cinematic Swell',  genre: 'classical',  mood: 'dramatic',   energy: 'medium', usageContext: ['intro', 'outro'],            bpm: 90,  freq: 220, dur: 15 },
  { title: 'Upbeat Pop',       genre: 'pop',        mood: 'happy',      energy: 'high',   usageContext: ['background', 'transition'],   bpm: 128, freq: 523, dur: 12 },
  { title: 'Chill Jazz Café',  genre: 'jazz',       mood: 'calm',       energy: 'low',    usageContext: ['background'],                 bpm: 85,  freq: 392, dur: 14 },
];

// Synthesize a short playable WAV tone in PURE NODE (no ffmpeg dependency — this
// build's ffmpeg lacks the lavfi device). 16-bit mono PCM, gentle fade + tremolo so
// it's a pleasant bed rather than a flat sine. Real WAV → preview/use/export all work.
function writeWavTone(filePath, freq, durSec) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durSec);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  const amp = 0.38 * 32767;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / 0.5) * Math.min(1, (durSec - t) / 0.5);
    const trem = 0.7 + 0.3 * Math.sin(2 * Math.PI * 4 * t);
    const s = Math.sin(2 * Math.PI * freq * t) * amp * fade * trem;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s))), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
  return true;
}

async function seedDemoMusic() {
  try {
    const Music = require('../models/Music');
    // Idempotent: skip if the demo catalog already exists (persistent-DB case).
    const existing = await Music.findOne({ artist: 'Click Demo' }).select('_id').lean();
    if (existing) return;

    const dir = path.join(__dirname, '../../uploads/music/demo');
    fs.mkdirSync(dir, { recursive: true });

    let inserted = 0;
    for (const t of DEMO_TRACKS) {
      const fname = `demo-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`;
      const filePath = path.join(dir, fname);
      // Generate the clip once (files persist on disk across in-memory reboots).
      try {
        if (!fs.existsSync(filePath)) writeWavTone(filePath, t.freq, t.dur);
      } catch (e) {
        logger.warn('[seed-music] tone generation failed (track still listed)', { title: t.title, error: e.message });
      }
      await Music.create({
        userId: DEMO_OWNER_ID,
        title: t.title,
        artist: 'Click Demo',
        genre: t.genre,
        mood: t.mood,
        energy: t.energy,
        usageContext: t.usageContext,
        bpm: t.bpm,
        vocals: 'instrumental',
        file: { url: `/uploads/music/demo/${fname}`, filename: fname, duration: t.dur },
        // provider/license keep the pre-save hook from forcing isPublic:false, so the
        // demo catalog is PUBLIC (visible to every browser, incl. the dev user).
        license: 'royalty-free',
        provider: 'soundstripe',
        isPublic: true,
        tags: ['demo', t.genre, t.mood, t.energy],
      });
      inserted += 1;
    }
    logger.info('[seed-music] demo music catalog seeded', { inserted });
  } catch (e) {
    logger.warn('[seed-music] seed failed (non-fatal)', { error: e.message });
  }
}

module.exports = { seedDemoMusic };

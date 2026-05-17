/**
 * aiTranscriptionService — primary path: json2video; fallback: Gemini.
 *
 * Why this shape:
 *   - json2video is the primary transcription engine because it has a
 *     generous render-time quota and exposes a clean speech-to-subtitles
 *     pipeline (audio → ASS file with timestamped events).
 *   - Gemini is the fallback so we degrade gracefully when json2video is
 *     rate-limited, returns a transient error, or times out. We use the
 *     same gemini-2.5-flash that powers caption/hook/edit-suggestion
 *     copy elsewhere in the codebase.
 *
 * json2video pipeline:
 *   1. ffmpeg-extract video → 16kHz mono mp3 in os.tmpdir()
 *   2. POST /v2/uploads { name, contentType } → presigned S3 PUT URL
 *   3. PUT mp3 bytes to that URL
 *   4. POST /v2/movies with a 1-scene movie containing the audio plus a
 *      `subtitles` element. json2video renders the movie AND emits an
 *      .ass (SubStation Alpha) sidecar with the transcript.
 *   5. Poll GET /v2/movies?project=<id> until status === 'done'.
 *   6. Fetch movie.ass, parse the [Events] section into
 *      [{ start, end, text }] segments.
 *   7. Word-level interpolation + sentiment/volume enrichment to keep
 *      the public return shape identical to the old Whisper-era one.
 *
 * Public API kept identical:
 *   transcribeVideo(userId, videoId, videoPath, opts)
 *     → { success, text, words, language }
 *
 * So every caller (server/routes/video.js, server/routes/video/transcription.js,
 * server/services/agenticWorkflowService.js, server/services/videoTranscriptionService.js)
 * works unchanged.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager, FileState } = require('@google/generative-ai/server');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const JSON2VIDEO_BASE = 'https://api.json2video.com/v2';
const JSON2VIDEO_POLL_MS = 1500;
const JSON2VIDEO_TIMEOUT_MS = 180_000; // 3 min per render

// ── Lazy Gemini client (used only on fallback) ──────────────────────────────

let geminiState = null;
function getGemini() {
  if (geminiState) return geminiState;
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    geminiState = { model, fileManager };
    return geminiState;
  } catch (err) {
    logger.warn('Gemini transcription init failed (fallback path)', { error: err.message });
    return null;
  }
}

function isTranscriptionConfigured() {
  return !!(process.env.JSON2VIDEO_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * ffmpeg → mp3 16kHz mono in OS tmp dir. Mono + 16kHz keeps the upload
 * tiny without losing speech intelligibility (every ASR engine
 * downsamples to 16kHz internally anyway).
 */
function extractAudioToMp3(videoPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(os.tmpdir(), `click-tx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp3`);
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate('48k')
      .format('mp3')
      .on('error', (err) => reject(new Error(`ffmpeg audio extract failed: ${err.message}`)))
      .on('end', () => resolve(tmpPath))
      .save(tmpPath);
  });
}

/** Distribute each segment's words evenly across its duration. */
function synthesizeWords(segments) {
  const out = [];
  for (const seg of segments) {
    const words = String(seg?.text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const segStart = Number(seg.start) || 0;
    const segEnd = Number(seg.end) || segStart;
    const dur = Math.max(0, segEnd - segStart);
    if (dur === 0) {
      for (const w of words) out.push({ word: w, start: segStart, end: segStart });
      continue;
    }
    const per = dur / words.length;
    for (let i = 0; i < words.length; i++) {
      out.push({
        word: words[i],
        start: segStart + i * per,
        end: segStart + (i + 1) * per,
      });
    }
  }
  return out;
}

function enrichWord(wordObj) {
  const lowerWord = wordObj.word.toLowerCase();
  let sentiment = 'neutral';
  let volume = 50;
  if (['amazing', 'wow', 'incredible', 'best'].includes(lowerWord)) {
    sentiment = 'positive';
    volume = 90;
  } else if (['terrible', 'worst', 'angry', 'stop'].includes(lowerWord)) {
    sentiment = 'negative';
    volume = 85;
  } else if (wordObj.word === wordObj.word.toUpperCase() && wordObj.word.length > 1) {
    volume = 95;
  }
  return { ...wordObj, sentiment, volume };
}

// ── json2video path ─────────────────────────────────────────────────────────

/**
 * SubStation Alpha "Dialogue:" timestamps look like "0:00:01.23" =
 * H:MM:SS.cc where the .cc field is CENTISECONDS (1/100 sec), not
 * decimal seconds. json2video sometimes emits a single-digit
 * centisecond field ("0:00:00.8") which strict JS Number() would
 * misread as 0.8s rather than 0.08s. We pad to 2 digits before
 * dividing.
 */
function assTimeToSeconds(t) {
  if (!t) return 0;
  const s = String(t).trim();
  const m = s.match(/^(\d+):(\d+):(\d+)(?:\.(\d{1,3}))?$/);
  if (m) {
    const [, h, mm, ss, cs] = m;
    const csPadded = cs ? cs.padEnd(2, '0').slice(0, 2) : '0';
    return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(csPadded) / 100;
  }
  // Fallback for malformed inputs — match historical behaviour
  const parts = s.split(':');
  let h = 0, mm = 0, ss = 0;
  if (parts.length === 3) { [h, mm, ss] = parts; }
  else if (parts.length === 2) { [mm, ss] = parts; }
  else { [ss] = parts; }
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss);
}

/** Strip ASS inline override blocks like `{\an8}` or `{\fad(200,200)}`. */
function stripAssOverrides(text) {
  return String(text || '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N/g, ' ')
    .replace(/\\h/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a SubStation Alpha file (json2video's `ass` sidecar) into
 * { language, segments: [{ start, end, text }] }. Adjacent dialogues
 * within 200ms are merged so the segments roughly line up with spoken
 * phrases instead of single-word events.
 */
function parseAssToSegments(assText) {
  const lines = String(assText || '').split(/\r?\n/);
  let inEvents = false;
  let format = null;
  const raw = [];
  for (const line of lines) {
    if (line.startsWith('[Events]')) { inEvents = true; continue; }
    if (line.startsWith('[') && inEvents && !line.startsWith('[Events]')) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (line.startsWith('Format:')) {
      format = line.slice(7).split(',').map((k) => k.trim().toLowerCase());
      continue;
    }
    if (!line.startsWith('Dialogue:')) continue;
    if (!format) continue;
    // Dialogue lines are comma-separated up to the Text column, but Text
    // itself may contain commas — split with a limit to preserve them.
    const cols = line.slice(9).split(',');
    const textIdx = format.indexOf('text');
    if (textIdx < 0) continue;
    const head = cols.slice(0, textIdx);
    const text = cols.slice(textIdx).join(',').trim();
    const startIdx = format.indexOf('start');
    const endIdx = format.indexOf('end');
    if (startIdx < 0 || endIdx < 0) continue;
    const start = assTimeToSeconds(head[startIdx]);
    const end = assTimeToSeconds(head[endIdx]);
    const cleaned = stripAssOverrides(text);
    if (!cleaned) continue;
    raw.push({ start, end, text: cleaned });
  }

  // json2video emits karaoke-style captions: the same phrase repeats
  // multiple times with progressive word highlighting (e.g. "Know
  // what's so crazy," appears 4× — once per word being marked active).
  // After stripping the `{\rWord}…{\r}` overrides, those duplicates
  // collapse to identical text. Dedupe by extending the previous
  // segment's end-time and dropping the duplicate row.
  //
  // After dedupe, run the original 200ms-gap merge so adjacent unique
  // fragments collapse into spoken phrases.
  const dedup = [];
  for (const r of raw) {
    const tail = dedup[dedup.length - 1];
    if (tail && tail.text === r.text) {
      tail.end = Math.max(tail.end, r.end);
      tail.start = Math.min(tail.start, r.start);
    } else {
      dedup.push({ ...r });
    }
  }
  const merged = [];
  for (const r of dedup) {
    const tail = merged[merged.length - 1];
    if (tail && r.start - tail.end <= 0.2) {
      tail.end = r.end;
      tail.text = `${tail.text} ${r.text}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

async function json2videoUploadAudio(audioPath) {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) throw new Error('JSON2VIDEO_API_KEY not configured');
  const name = path.basename(audioPath);
  const init = await axios.post(`${JSON2VIDEO_BASE}/uploads`, {
    name,
    contentType: 'audio/mpeg',
  }, { headers: { 'x-api-key': apiKey }, timeout: 30_000 });
  if (!init.data?.success) {
    throw new Error(`json2video upload init failed: ${init.data?.message || 'unknown'}`);
  }
  const signedUrl = init.data.signedUrl;
  const finalUrl = init.data.finalUrl;
  const buf = fs.readFileSync(audioPath);
  await axios.put(signedUrl, buf, {
    headers: { 'Content-Type': 'audio/mpeg' },
    timeout: 60_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return finalUrl;
}

async function json2videoStartTranscribeJob(audioUrl, language) {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  // Minimum-cost render: 240p, low quality, audio-only with subtitles.
  // We don't care about the rendered video — we only consume the .ass
  // sidecar — but json2video bundles transcription with rendering.
  const subtitlesEl = { type: 'subtitles', model: 'default' };
  if (language && language !== 'auto') subtitlesEl.language = language;
  else subtitlesEl.language = 'auto';

  const body = {
    resolution: 'sd',
    quality: 'low',
    scenes: [{ elements: [{ type: 'audio', src: audioUrl }] }],
    elements: [subtitlesEl],
  };
  const r = await axios.post(`${JSON2VIDEO_BASE}/movies`, body, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
  if (!r.data?.success || !r.data?.project) {
    throw new Error(`json2video movie create failed: ${r.data?.message || JSON.stringify(r.data).slice(0, 200)}`);
  }
  return r.data.project;
}

async function json2videoPollUntilDone(projectId) {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  const start = Date.now();
  while (Date.now() - start < JSON2VIDEO_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, JSON2VIDEO_POLL_MS));
    const r = await axios.get(`${JSON2VIDEO_BASE}/movies?project=${projectId}`, {
      headers: { 'x-api-key': apiKey },
      timeout: 15_000,
    });
    const movie = r.data?.movie;
    if (!movie) continue;
    if (movie.status === 'done') return movie;
    if (movie.status === 'error') {
      throw new Error(`json2video render error: ${movie.message || 'unknown'}`);
    }
  }
  throw new Error(`json2video render timed out after ${JSON2VIDEO_TIMEOUT_MS}ms`);
}

async function transcribeViaJson2Video(videoPath, opts = {}) {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) throw new Error('JSON2VIDEO_API_KEY not configured');

  let audioPath = null;
  try {
    audioPath = await extractAudioToMp3(videoPath);
    const audioUrl = await json2videoUploadAudio(audioPath);
    const projectId = await json2videoStartTranscribeJob(audioUrl, opts.language);
    const movie = await json2videoPollUntilDone(projectId);
    if (!movie?.ass) {
      // Render finished but no subtitles file — usually means the audio
      // had no detectable speech. Return an empty transcript instead of
      // erroring so the caller's UI shows "no captions" cleanly.
      return { language: opts.language && opts.language !== 'auto' ? opts.language : 'en', segments: [] };
    }
    const assResp = await axios.get(movie.ass, { responseType: 'text', timeout: 30_000 });
    const segments = parseAssToSegments(assResp.data);
    return {
      language: opts.language && opts.language !== 'auto' ? opts.language : 'en',
      segments,
    };
  } finally {
    if (audioPath) { try { fs.unlinkSync(audioPath); } catch (_) { /* best effort */ } }
  }
}

// ── Gemini fallback path ────────────────────────────────────────────────────

const GEMINI_PROMPT_BASE = `You are a speech-to-text engine. Transcribe the audio I'm sending and return ONLY a JSON object — no markdown fences, no commentary, no preamble.

Schema:
{
  "language": "<ISO 639-1 code, your best guess from the audio>",
  "segments": [
    { "start": <seconds, number>, "end": <seconds, number>, "text": "<the spoken words>" }
  ]
}

Rules:
- Each segment must be a continuous spoken phrase, typically 2–8 seconds long.
- Timestamps must be in SECONDS (decimals allowed, never minutes).
- Preserve the speaker's casing and punctuation as they would write it.
- If multiple speakers appear, do not label them — concatenate naturally.
- If you cannot hear anything intelligible, return { "language": "en", "segments": [] }.`;

function parseJsonLoose(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); }
  catch (_) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch (_) { /* fall through */ } }
    return null;
  }
}

async function geminiWaitForFileActive(fm, name, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const f = await fm.getFile(name);
    if (f.state === FileState.ACTIVE) return f;
    if (f.state === FileState.FAILED) throw new Error(`Gemini file processing failed for ${name}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for Gemini file ${name} to become ACTIVE`);
}

async function transcribeViaGemini(videoPath, opts = {}) {
  const ctx = getGemini();
  if (!ctx) throw new Error('Gemini fallback unavailable: GOOGLE_AI_API_KEY not configured');
  const { model, fileManager: fm } = ctx;

  let audioPath = null;
  let uploadedFile = null;
  try {
    audioPath = await extractAudioToMp3(videoPath);
    const uploadRes = await fm.uploadFile(audioPath, {
      mimeType: 'audio/mp3',
      displayName: `click-tx-fallback-${Date.now()}`,
    });
    uploadedFile = uploadRes.file;
    if (uploadedFile.state === FileState.PROCESSING) {
      uploadedFile = await geminiWaitForFileActive(fm, uploadedFile.name);
    }
    if (uploadedFile.state !== FileState.ACTIVE) {
      throw new Error(`Gemini file is not ACTIVE (state=${uploadedFile.state})`);
    }
    let prompt = GEMINI_PROMPT_BASE;
    if (opts.language && opts.language !== 'auto') {
      prompt += `\n\nThe audio is in ${opts.language}; use that as the language code.`;
    }
    if (opts.prompt) {
      prompt += `\n\nDomain vocabulary hint (apply only when the audio actually uses these words): ${opts.prompt}`;
    }
    const result = await model.generateContent([
      { fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType } },
      { text: prompt },
    ]);
    const rawText = (result?.response?.text?.() || '').trim();
    const parsed = parseJsonLoose(rawText);
    if (parsed && Array.isArray(parsed.segments)) {
      return {
        language: typeof parsed.language === 'string' && parsed.language.trim()
          ? parsed.language.trim()
          : (opts.language && opts.language !== 'auto' ? opts.language : 'en'),
        segments: parsed.segments.filter((s) => s && typeof s === 'object' && typeof s.text === 'string'),
      };
    }
    // Gemini returned text but not JSON — at least surface the raw text
    // so callers get something useful rather than an empty transcript.
    return {
      language: opts.language && opts.language !== 'auto' ? opts.language : 'en',
      segments: rawText ? [{ start: 0, end: 0, text: rawText }] : [],
    };
  } finally {
    if (audioPath) { try { fs.unlinkSync(audioPath); } catch (_) { /* best effort */ } }
    if (uploadedFile?.name) {
      try { await fm.deleteFile(uploadedFile.name); } catch (_) { /* best effort */ }
    }
  }
}

// ── Public surface ──────────────────────────────────────────────────────────

/**
 * Generate a transcript for a video file.
 * Tries json2video first; on any failure (timeout, quota, network,
 * unexpected response), falls back to Gemini and logs which path won.
 *
 * @param {string} userId
 * @param {string} videoId
 * @param {string} videoPath - absolute path or project-root-relative
 * @param {object} [opts]
 * @param {string} [opts.language='auto']
 * @param {string} [opts.prompt]  - Gemini-only vocab hint
 * @returns {Promise<{success:boolean, text:string, words:Array, language:string, provider:string}>}
 */
async function transcribeVideo(userId, videoId, videoPath, opts = {}) {
  const fullPath = videoPath.startsWith('/')
    ? videoPath
    : path.join(__dirname, '../..', videoPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Video file not found for transcription: ' + fullPath);
  }

  const language = opts.language || 'auto';
  logger.info('Starting transcription', {
    videoId, userId, language, hasPrompt: !!opts.prompt,
    primary: process.env.JSON2VIDEO_API_KEY ? 'json2video' : 'gemini',
  });

  const providers = [];
  if (process.env.JSON2VIDEO_API_KEY) providers.push({ name: 'json2video', fn: transcribeViaJson2Video });
  if (process.env.GOOGLE_AI_API_KEY) providers.push({ name: 'gemini',     fn: transcribeViaGemini });
  if (providers.length === 0) {
    throw new Error('No transcription provider configured. Set JSON2VIDEO_API_KEY or GOOGLE_AI_API_KEY.');
  }

  const failures = [];
  for (const p of providers) {
    try {
      const t0 = Date.now();
      const { language: detectedLanguage, segments } = await p.fn(fullPath, opts);
      const fullText = (segments || []).map((s) => s.text).filter(Boolean).join(' ').trim();
      const words = synthesizeWords(segments || []).map(enrichWord);
      logger.info('Transcription succeeded', {
        videoId, provider: p.name, segments: segments?.length || 0,
        chars: fullText.length, ms: Date.now() - t0,
      });
      return {
        success: true,
        text: fullText,
        words,
        language: detectedLanguage || (language === 'auto' ? 'en' : language),
        provider: p.name,
      };
    } catch (err) {
      const msg = (err?.message || '').slice(0, 240);
      failures.push({ provider: p.name, error: msg });
      const isQuota = /429|RESOURCE_EXHAUSTED|quota|rate ?limit|exceeded/i.test(msg);
      logger[isQuota ? 'warn' : 'error']('Transcription provider failed; falling through', {
        videoId, provider: p.name, error: msg, isQuota,
      });
    }
  }

  // All providers exhausted. Surface the first failure with a hint
  // about where to look.
  const summary = failures.map((f) => `${f.provider}: ${f.error}`).join(' | ');
  const err = new Error(`Transcription failed across all providers — ${summary}`);
  err.code = 'TRANSCRIPTION_ALL_PROVIDERS_FAILED';
  err.failures = failures;
  throw err;
}

module.exports = {
  transcribeVideo,
  isTranscriptionConfigured,
  // Exported for unit testing only
  _internal: { parseAssToSegments, assTimeToSeconds, synthesizeWords },
};

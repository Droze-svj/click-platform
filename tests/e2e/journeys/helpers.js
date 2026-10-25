// Shared helpers for the journey suite. Kept dependency-free (Playwright +
// Node only) so the suite runs anywhere the app runs.
const { expect } = require('@playwright/test');
const { execFileSync } = require('child_process');

const API = (process.env.E2E_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '');
const PASSWORD = 'Journey!Pass2026';

let seq = 0;
/** A unique, valid email per call (per run, per test) so journeys never collide. */
function uniqueEmail(tag = 'user') {
  seq += 1;
  const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}${seq}`;
  return `journey.${tag}.${stamp}@example.com`;
}

/**
 * Dismiss the cookie banner before any page script runs (it otherwise overlays
 * the bottom of every page and can swallow clicks).
 */
async function acceptCookies(page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('click.cookieConsent.v1', 'accepted'); } catch { /* storage blocked */ }
  });
}

/** Create an account through the real API (the UI sign-up has its own journey). */
async function registerViaApi(request, { firstName = 'Journey', lastName = 'Tester', email = uniqueEmail(), password = PASSWORD } = {}) {
  const res = await request.post(`${API}/auth/register`, {
    data: { firstName, lastName, email, password },
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), `register ${email}: ${JSON.stringify(body).slice(0, 300)}`).toBeLessThan(300);
  const data = body.data || body;
  expect(data.token, 'register returns an access token (AUTO_VERIFY_EMAIL / test mode)').toBeTruthy();
  return { email, password, firstName, lastName, token: data.token, refreshToken: data.refreshToken, user: data.user };
}

/**
 * Put a session in the browser exactly like a real sign-in does (lib/api
 * setTokens → localStorage), without paying for the login UI in every test.
 */
async function useSession(page, account) {
  await page.addInitScript(([token, refreshToken]) => {
    try {
      if (!window.sessionStorage.getItem('__journeySessionSeeded')) {
        window.localStorage.setItem('token', token);
        if (refreshToken) window.localStorage.setItem('refreshToken', refreshToken);
        window.sessionStorage.setItem('__journeySessionSeeded', '1');
      }
    } catch { /* storage blocked */ }
  }, [account.token, account.refreshToken || '']);
}

/** Authenticated JSON call to the API as `account`. */
async function api(request, account, method, path, data) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${account.token}` },
    ...(data !== undefined ? { data } : {}),
  });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { status: res.status(), body };
}

// Console noise that is not an app bug: the AI health probe legitimately
// answers 503 when no AI provider key is configured (the keyless CI/test case),
// and the browser logs that failed fetch as a console error.
const KNOWN_CONSOLE_NOISE = [
  /\/health\/ai\b/,
  /\/api\/health(\?|$|\b)/,
  // React dev-only hydration / DevTools hints (never present in a prod build).
  /Download the React DevTools/,
];

/**
 * Record everything that would mean "this page is broken" while a test drives
 * it: uncaught exceptions, console errors, and 5xx answers from our API.
 */
function watchPage(page) {
  const seen = { pageErrors: [], consoleErrors: [], serverErrors: [], apiCalls: new Map() };
  page.on('request', (req) => {
    const url = req.url();
    if (!/\/api\//.test(url)) return;
    const key = `${req.method()} ${new URL(url).pathname}`;
    seen.apiCalls.set(key, (seen.apiCalls.get(key) || 0) + 1);
  });
  page.on('pageerror', (err) => {
    seen.pageErrors.push(`${err.name}: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const where = (msg.location() && msg.location().url) || '';
    const line = `${msg.text()}${where ? ` @ ${where}` : ''}`;
    if (KNOWN_CONSOLE_NOISE.some((re) => re.test(line))) return;
    seen.consoleErrors.push(line);
  });
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() < 500) return;
    if (!/\/api\//.test(url)) return;
    if (/\/health\/ai\b/.test(url) && res.status() === 503) return;
    seen.serverErrors.push(`${res.status()} ${res.request().method()} ${url}`);
  });
  return seen;
}

function resetWatch(seen) {
  seen.pageErrors.length = 0;
  seen.consoleErrors.length = 0;
  seen.serverErrors.length = 0;
  seen.apiCalls.clear();
}

/**
 * Endpoints the page called more than `max` times — a render/effect loop
 * hammering the API (the settings page once fired ~150 GETs a second).
 */
function requestStorms(seen, max = 20) {
  return [...seen.apiCalls.entries()].filter(([, n]) => n > max).map(([k, n]) => `${k} ×${n}`);
}

/** ffprobe a local file or URL; null when ffprobe isn't installed. */
function probe(target) {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      target,
    ], { encoding: 'utf8', timeout: 30000 });
    const json = JSON.parse(out);
    return {
      duration: Number(json.format && json.format.duration),
      streams: (json.streams || []).map((s) => s.codec_type),
      video: (json.streams || []).find((s) => s.codec_type === 'video') || null,
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw new Error(`ffprobe failed on ${target}: ${err.stderr || err.message}`);
  }
}

/**
 * Silent stretches in a media file's audio (ffmpeg silencedetect), as
 * [{ start, end }] in seconds; null when ffmpeg isn't installed.
 */
function silences(file, { noiseDb = -40, minSeconds = 0.3 } = {}) {
  let stderr;
  try {
    const r = require('child_process').spawnSync('ffmpeg', [
      '-hide_banner', '-nostats', '-i', file,
      '-af', `silencedetect=n=${noiseDb}dB:d=${minSeconds}`, '-f', 'null', '-',
    ], { encoding: 'utf8', timeout: 60000 });
    if (r.error && r.error.code === 'ENOENT') return null;
    stderr = r.stderr || '';
  } catch {
    return null;
  }
  const out = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: ([\d.]+)/);
    if (s) start = Number(s[1]);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== null) { out.push({ start, end: Number(e[1]) }); start = null; }
  }
  return out;
}

function hasFfprobe() {
  try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/** Origin of the API (http://host:port) — media URLs are served from it. */
const API_ORIGIN = API.replace(/\/api$/, '');

/** Make a server-returned media path absolute against the API origin. */
function absoluteMediaUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

module.exports = {
  API,
  API_ORIGIN,
  PASSWORD,
  uniqueEmail,
  acceptCookies,
  registerViaApi,
  useSession,
  api,
  watchPage,
  resetWatch,
  requestStorms,
  probe,
  silences,
  hasFfprobe,
  absoluteMediaUrl,
};

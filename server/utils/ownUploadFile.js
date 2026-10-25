// Resolve a media reference the API itself handed out — a signed
// "/uploads/x.mp4?exp=…&sig=…" path, or the same thing as an absolute URL on
// our own host — to the file on disk.
//
// Publishing and export routes receive the URL the browser plays. Opening it as
// a filesystem path fails (it is a URL), and fetching it over HTTP from
// ourselves trips the SSRF guard locally and breaks once the signature
// expires. Reading the file directly is both correct and cheaper.
//
// The signature is checked by default: it is the proof that this caller was
// given access to the file (the /uploads tree is private, see
// middleware/requireSignedMedia). toAbsolutePath keeps the result contained in
// <root>/uploads, so a crafted path can never reach any other local file.

const fs = require('fs');
const { toAbsolutePath } = require('./pathUtils');
const { verifyMediaUrl } = require('./mediaUrlSigner');

/**
 * @param {string} ref  "/uploads/…" path or absolute http(s) URL
 * @param {{ requireSignature?: boolean }} [opts]
 * @returns {string|null} absolute path of an existing file, or null when the
 *   reference is not one of our uploads, is unsigned/expired, or is missing.
 */
function ownUploadFile(ref, { requireSignature = true } = {}) {
  if (!ref || typeof ref !== 'string') return null;
  const raw = ref.trim();
  let url;
  try {
    if (/^https?:\/\//i.test(raw)) url = new URL(raw);
    else if (raw.startsWith('/uploads/')) url = new URL(raw, 'http://local.invalid');
    else return null;
  } catch (_) {
    return null;
  }
  if (!/^\/uploads\//i.test(url.pathname)) return null;

  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch (_) { return null; }

  if (requireSignature) {
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    if (!verifyMediaUrl(url.pathname, exp, sig) && !verifyMediaUrl(decoded, exp, sig)) return null;
  }

  const local = toAbsolutePath(decoded);
  return local && fs.existsSync(local) ? local : null;
}

/**
 * Turn a video reference from a publish request into a local file the
 * platform uploader can stream: our own signed /uploads media is read from
 * disk; any other http(s) URL is downloaded to a temp file through the
 * SSRF-guarded streamDownload (checked on every redirect hop). Bare local
 * paths are refused — a request must never point an uploader at an arbitrary
 * server file.
 *
 * @returns {Promise<{ path: string, cleanup: () => void }>}
 * @throws {Error & { statusCode: 400 }} when the reference cannot be used
 */
async function materializeVideoSource(ref, { maxBytes = 1024 * 1024 * 1024, prefix = 'publish' } = {}) {
  const local = ownUploadFile(ref);
  if (local) return { path: local, cleanup: () => {} };

  const raw = typeof ref === 'string' ? ref.trim() : '';
  const isRemote = /^https?:\/\//i.test(raw);
  // Our own /uploads media without a valid signature (expired link, or a
  // guessed path) is not downloadable either — say so instead of 500ing.
  let ownPath = false;
  try { ownPath = /^\/uploads\//i.test(new URL(raw, 'http://local.invalid').pathname); } catch (_) { ownPath = false; }
  if (!isRemote) {
    const e = new Error(ownPath
      ? 'This video link has expired. Render or open the video again, then retry.'
      : 'A rendered video URL is required');
    e.statusCode = 400;
    throw e;
  }

  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');
  const { streamDownload } = require('./downloadUtils');
  const tmpPath = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.mp4`);
  const cleanup = () => { try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) { /* already gone */ } };
  try {
    await streamDownload(raw, tmpPath, { maxBytes });
  } catch (err) {
    cleanup();
    const e = new Error(`Could not fetch the video to publish: ${err.message}`);
    e.statusCode = 400;
    throw e;
  }
  return { path: tmpPath, cleanup };
}

module.exports = { ownUploadFile, materializeVideoSource };

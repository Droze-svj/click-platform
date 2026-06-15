const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');
const logger = require('./logger');
const urlGuard = require('./urlGuard');

const BINARY_DIR = path.join(process.cwd(), 'bin');
const BINARY_PATH = path.join(BINARY_DIR, 'yt-dlp');

// yt-dlp-wrap is an optional dependency. Loading it lazily keeps this module
// (and everything that requires it) importable even when the package isn't
// installed — direct file-URL downloads via streamDownload() still work; only
// the platform-download path (YouTube/TikTok/etc.) degrades to "unavailable".
let _YTDlpWrap = null;
let _ytDlp = null;
let _ytDlpLoadFailed = false;

function getYtDlpWrap() {
  if (_YTDlpWrap || _ytDlpLoadFailed) return _YTDlpWrap;
  try {
    _YTDlpWrap = require('yt-dlp-wrap').default;
  } catch (e) {
    _ytDlpLoadFailed = true;
    logger.warn('yt-dlp-wrap not installed — platform video downloads are unavailable; direct file URLs still work', { error: e.message });
    return null;
  }
  return _YTDlpWrap;
}

function getYtDlp() {
  if (_ytDlp) return _ytDlp;
  const Wrap = getYtDlpWrap();
  if (!Wrap) return null;
  try { fs.mkdirSync(BINARY_DIR, { recursive: true }); } catch { /* already exists */ }
  _ytDlp = new Wrap(fs.existsSync(BINARY_PATH) ? BINARY_PATH : 'yt-dlp');
  return _ytDlp;
}

const DIRECT_VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.m4v', '.mkv'];
// Each platform is a list of EXACT registrable domains. Matching is anchored to
// the host being that domain or a subdomain of it (host === d || endsWith('.'+d))
// — NOT a substring regex. An unanchored /youtube\.com/ test matched
// `youtube.com.evil.com` and even `notyoutube.com`, which let an attacker-
// controlled domain (with attacker-controlled DNS) reach the yt-dlp download
// path → SSRF. Anchoring means only the real platforms (whose DNS the attacker
// can't control) are ever handed to yt-dlp.
const PLATFORM_DOMAINS = [
  { name: 'youtube',   domains: ['youtube.com', 'youtu.be'] },
  { name: 'tiktok',    domains: ['tiktok.com'] },
  { name: 'instagram', domains: ['instagram.com'] },
  { name: 'twitter',   domains: ['twitter.com', 'x.com'] },
  { name: 'facebook',  domains: ['facebook.com', 'fb.watch'] },
  { name: 'vimeo',     domains: ['vimeo.com'] },
];

function hostMatchesDomain(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function classifyUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return { kind: 'invalid' }; }
  if (!/^https?:$/.test(u.protocol)) return { kind: 'invalid' };

  const ext = path.extname(u.pathname).toLowerCase();
  if (DIRECT_VIDEO_EXTS.includes(ext)) return { kind: 'direct', ext };

  const host = u.hostname.toLowerCase();
  for (const p of PLATFORM_DOMAINS) {
    if (p.domains.some((d) => hostMatchesDomain(host, d))) return { kind: 'platform', platform: p.name };
  }
  return { kind: 'unknown' };
}

function streamDownload(url, destPath, { maxBytes = 500 * 1024 * 1024, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => { try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch { /* file already gone */ } };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const get = (currentUrl, hopsLeft) => {
      // SSRF guard on EVERY hop (anti DNS-rebind): a hostname that resolved
      // public on the previous hop can resolve to a private IP on this one, so
      // we re-validate the resolved IP of each URL we actually connect to.
      urlGuard.assertPublicUrl(currentUrl).then(() => {
        const lib = currentUrl.startsWith('https:') ? https : http;
        const request = lib.get(currentUrl, (res) => {
        // Follow redirects
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hopsLeft > 0) {
            res.resume();
            const next = new URL(res.headers.location, currentUrl).toString();
            return get(next, hopsLeft - 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return fail(new Error(`Source returned HTTP ${res.statusCode}`));
          }
          const ct = (res.headers['content-type'] || '').toLowerCase();
          if (ct && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream')) {
            res.resume();
            return fail(new Error(`Source is not a video (content-type: ${ct})`));
          }
          const cl = parseInt(res.headers['content-length'] || '0', 10);
          if (cl && cl > maxBytes) {
            res.resume();
            return fail(new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB cap`));
          }
          let received = 0;
          const file = fs.createWriteStream(destPath);
          res.on('data', (chunk) => {
            received += chunk.length;
            if (received > maxBytes) {
              res.destroy();
              file.destroy();
              return fail(new Error(`Stream exceeded ${Math.round(maxBytes / 1024 / 1024)}MB cap`));
            }
          });
          res.on('error', fail);
          res.pipe(file);
          file.on('finish', () => file.close(() => succeed({ bytes: received })));
          file.on('error', fail);
        });
        request.on('error', fail);
        request.setTimeout(45_000, () => {
        // Destroy without an error arg (so we don't double-settle via the
        // 'error' listener), then reject the promise explicitly.
          request.destroy();
          fail(new Error('Download timed out'));
        });
      }).catch(fail); // blocked/invalid URL (SSRF guard) or DNS failure
    };
    get(url, redirects);
  });
}

async function ensureYtDlp() {
  const ytDlp = getYtDlp();
  if (!ytDlp) {
    throw new Error('YT_DLP_UNAVAILABLE');
  }
  if (fs.existsSync(BINARY_PATH)) {
    return BINARY_PATH;
  }

  // Try system first
  try {
    await ytDlp.getVersion();
    return 'yt-dlp';
  } catch (e) {
    logger.info('yt-dlp binary not found in PATH, downloading to bin/yt-dlp...');
    try {
      const Wrap = getYtDlpWrap();
      await Wrap.downloadFromGithub(BINARY_PATH);
      fs.chmodSync(BINARY_PATH, '755');
      ytDlp.setBinaryPath(BINARY_PATH);
      return BINARY_PATH;
    } catch (dlError) {
      logger.error('Failed to download yt-dlp from GitHub', { error: dlError.message });
      throw new Error('YT_DLP_MISSING_AND_DOWNLOAD_FAILED');
    }
  }
}

function ytDlpAvailable() {
  return new Promise((resolve) => {
    ensureYtDlp().then(() => resolve(true)).catch(() => resolve(false));
  });
}

async function ytDlpDownload(url, destPath) {
  await ensureYtDlp();
  const ytDlp = getYtDlp();

  // Limit to <= 1080p so we don't pull 4K masters from creators' channels.
  const args = [
    url,
    '-f', 'bv*[height<=1080]+ba/b[height<=1080]',
    '--merge-output-format', 'mp4',
    '--max-filesize', '500M',
    '--no-playlist',
    '-o', destPath,
  ];

  return ytDlp.execPromise(args);
}

module.exports = {
  classifyUrl,
  streamDownload,
  ytDlpAvailable,
  ytDlpDownload,
  DIRECT_VIDEO_EXTS,
  PLATFORM_DOMAINS,
  classifyUrlHostMatches: hostMatchesDomain,
};

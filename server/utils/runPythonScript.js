// Safe wrapper for spawning the local Python helper scripts (edge-tts, OpenCV
// eye-contact, avatar sync, object removal, background removal).
//
// Why this exists: a bare `spawn('python3', …)` with only an `on('close')`
// listener CRASHES the process when the binary/deps are missing — spawn emits an
// `'error'` (ENOENT) event, and a ChildProcess with no 'error' listener throws it
// as an uncaught exception (which, in production, exits the server). The local AI
// features are OPTIONAL fallbacks, so a missing python/dep must degrade to a clean
// rejection the caller can catch — never take the server down. This also enforces
// a hard timeout so a wedged Python process can't hang a render request forever.
//
// Inputs are passed as an argv ARRAY (no shell), so values can't inject commands.

const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Run a Python (or CLI) helper. Resolves { stdout, stderr } on exit 0; rejects
 * (never throws asynchronously) on spawn failure, non-zero exit, or timeout.
 *
 * @param {string} cmd     executable (venv python / 'python3' / a CLI like edge-tts)
 * @param {string[]} args  argv array (NOT a shell string)
 * @param {object} [opts]  { timeoutMs = 300000, label = 'python', captureStdout = false }
 */
function runPythonScript(cmd, args = [], opts = {}) {
  const { timeoutMs = 5 * 60 * 1000, label = 'python', captureStdout = false } = opts;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn(arg);
    };

    let proc;
    try {
      proc = spawn(cmd, args);
    } catch (e) {
      // Synchronous spawn failure (e.g. bad cmd type) — reject, don't throw.
      return reject(new Error(`${label}: failed to spawn (${e.message})`));
    }

    timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) { /* already gone */ }
      logger.warn(`[runPython] ${label} timed out — killed`, { timeoutMs });
      finish(reject, new Error(`${label}: timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stderr = '';
    let stdout = '';
    if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d.toString(); });
    if (captureStdout && proc.stdout) proc.stdout.on('data', (d) => { stdout += d.toString(); });

    // THE fix: without this listener, a missing binary (ENOENT) is an unhandled
    // 'error' event → uncaught exception → prod exit. Turn it into a rejection.
    proc.on('error', (err) => {
      const why = err.code === 'ENOENT' ? `${cmd} not found (is it installed?)` : err.message;
      finish(reject, new Error(`${label}: ${why}`));
    });

    proc.on('close', (code) => {
      if (code === 0) finish(resolve, { stdout, stderr });
      else finish(reject, new Error(`${label}: exited ${code}: ${stderr.slice(0, 800)}`));
    });
  });
}

module.exports = { runPythonScript };

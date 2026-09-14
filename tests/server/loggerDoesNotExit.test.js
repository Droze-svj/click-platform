// An unhandled promise rejection must not kill the server.
//
// server/index.js owns that decision and is explicit about it: exit on an
// UNCAUGHT EXCEPTION only in production, and never on an unhandled rejection —
// "server will continue".
//
// winston silently overrode it. Registering exceptionHandlers/rejectionHandlers
// activates its default `exitOnError: true`, and winston's rejection handler
// calls process.exit(1) after writing the log entry. So ANY unhandled rejection,
// in ANY environment, took the whole process down.
//
// Seen live rather than theorised: a transient
// "ERR Your database has been temporarily rate-limited" from the Redis client
// killed a server one second after it had logged "🚀 Server running on port …".
// A cache blip should degrade the cache, not end the process.
//
// Behavioural, in a child process: the only way to prove a process does not exit
// is to run one and check it is still there.

const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '../..');

/** Run a snippet in a fresh node process; return { code, stdout }. */
function run(snippet) {
  try {
    const stdout = execFileSync(process.execPath, ['-e', snippet], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: String(err.stdout || '') };
  }
}

describe('logging never decides to exit', () => {
  it('the logger is configured not to exit the process', () => {
    // eslint-disable-next-line global-require
    const logger = require('../../server/utils/logger');
    expect(logger.exitOnError).toBe(false);
  });

  it('a process that loads the logger survives an unhandled rejection', () => {
    const snippet = `
      process.on('unhandledRejection', () => {});
      require(${JSON.stringify(path.join(REPO, 'server/utils/logger'))});
      Promise.reject(new Error('ERR Your database has been temporarily rate-limited'));
      setTimeout(() => { console.log('STILL_ALIVE'); process.exit(0); }, 1200);
    `;
    const { code, stdout } = run(snippet);

    // If this fails, winston is exiting again — check exitOnError on the logger.
    expect(stdout).toContain('STILL_ALIVE');
    expect(code).toBe(0);
  });
});

// The Python-helper spawn wrapper must turn EVERY failure mode into a clean
// Promise REJECTION — never an uncaught 'error' event (which, unhandled, crashes
// the process / exits prod on ENOENT) and never a hang.

const { runPythonScript } = require('../../server/utils/runPythonScript');

describe('runPythonScript', () => {
  it('a MISSING binary rejects (does not throw/crash) — the core prod-safety fix', async () => {
    await expect(
      runPythonScript('definitely-not-a-real-binary-xyz', ['--x'], { label: 'edge-tts' }),
    ).rejects.toThrow(/edge-tts: .*not found|not found/i);
  });

  it('resolves on exit code 0', async () => {
    await expect(runPythonScript('sh', ['-c', 'exit 0'], { label: 'ok' })).resolves.toMatchObject({});
  });

  it('rejects on a non-zero exit, surfacing stderr', async () => {
    await expect(
      runPythonScript('sh', ['-c', 'echo boom 1>&2; exit 3'], { label: 'obj-removal' }),
    ).rejects.toThrow(/obj-removal: exited 3.*boom/s);
  });

  it('kills and rejects a run that exceeds the timeout (no hang)', async () => {
    await expect(
      runPythonScript('sh', ['-c', 'sleep 5'], { label: 'avatar', timeoutMs: 120 }),
    ).rejects.toThrow(/avatar: timed out after 120ms/);
  });

  it('captures stdout when asked', async () => {
    const { stdout } = await runPythonScript('sh', ['-c', 'echo hello'], { captureStdout: true });
    expect(stdout.trim()).toBe('hello');
  });
});

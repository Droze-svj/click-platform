const { RenderQueue } = require('../../server/services/performanceOptimizationService');

// Helper: a job whose execute() resolves after `ms`, tracking live concurrency.
function makeQueue(maxConcurrent) {
  const q = new RenderQueue();
  q.maxConcurrent = maxConcurrent; // override the cores/2 default for determinism
  q.activeJobs = 0;
  q.queue = [];
  return q;
}

describe('RenderQueue — parallel execution', () => {
  it('runs jobs in PARALLEL up to maxConcurrent (not serially)', async () => {
    const q = makeQueue(3);
    let live = 0;
    let peak = 0;
    const completed = [];

    const makeJob = (id) => ({
      execute: () => new Promise((resolve) => {
        live += 1;
        peak = Math.max(peak, live);
        setTimeout(() => { live -= 1; resolve(`out-${id}`); }, 30);
      }),
      onComplete: (r) => completed.push(r),
      onError: () => {},
    });

    for (let i = 0; i < 7; i++) q.add(makeJob(i));

    // Wait for the whole queue to drain.
    await new Promise((r) => setTimeout(r, 300));

    expect(peak).toBe(3); // exactly maxConcurrent ran at once (was 1 before the fix)
    expect(completed.length).toBe(7); // every job finished
    expect(completed).toEqual(expect.arrayContaining(['out-0', 'out-6']));
    expect(q.activeJobs).toBe(0); // all slots released
    expect(q.queue.length).toBe(0); // queue drained
  });

  it('never exceeds maxConcurrent', async () => {
    const q = makeQueue(2);
    let live = 0;
    let peak = 0;
    const job = () => ({
      execute: () => new Promise((resolve) => {
        live += 1; peak = Math.max(peak, live);
        setTimeout(() => { live -= 1; resolve('ok'); }, 20);
      }),
      onComplete: () => {},
      onError: () => {},
    });
    for (let i = 0; i < 6; i++) q.add(job());
    await new Promise((r) => setTimeout(r, 250));
    expect(peak).toBeLessThanOrEqual(2);
    expect(q.activeJobs).toBe(0);
  });

  it('a failing job calls onError, frees its slot, and does not block others', async () => {
    const q = makeQueue(2);
    const results = [];
    const errors = [];
    const ok = (id) => ({
      execute: () => Promise.resolve(`ok-${id}`),
      onComplete: (r) => results.push(r),
      onError: (e) => errors.push(e.message),
    });
    const bad = () => ({
      execute: () => Promise.reject(new Error('boom')),
      onComplete: (r) => results.push(r),
      onError: (e) => errors.push(e.message),
    });
    q.add(bad());
    q.add(ok('a'));
    q.add(ok('b'));
    await new Promise((r) => setTimeout(r, 100));
    expect(errors).toContain('boom');
    expect(results).toEqual(expect.arrayContaining(['ok-a', 'ok-b']));
    expect(q.activeJobs).toBe(0);
  });

  it('times out a hung job, frees the slot, and keeps draining', async () => {
    const prev = process.env.RENDER_JOB_TIMEOUT_MS;
    process.env.RENDER_JOB_TIMEOUT_MS = '50'; // tiny timeout for the test
    try {
      const q = makeQueue(1); // single slot so the hung job would block everything if not timed out
      const errors = [];
      const results = [];
      const hung = () => ({
        execute: () => new Promise(() => {}), // never resolves
        onComplete: () => {},
        onError: (e) => errors.push(e.message),
      });
      const ok = () => ({
        execute: () => Promise.resolve('after'),
        onComplete: (r) => results.push(r),
        onError: () => {},
      });
      q.add(hung());
      q.add(ok());
      await new Promise((r) => setTimeout(r, 250));
      expect(errors.some((m) => /timed out/i.test(m))).toBe(true);
      expect(results).toContain('after'); // the next job ran after the slot freed
      expect(q.activeJobs).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.RENDER_JOB_TIMEOUT_MS;
      else process.env.RENDER_JOB_TIMEOUT_MS = prev;
    }
  });
});

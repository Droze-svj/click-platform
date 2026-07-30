// Cross-call generation history — server-side dedup memory per (userId, kind).
// Redis is not connected in the test env, so these exercise the in-memory
// fail-open fallback path (the same contract Redis would honor).

const gh = require('../../server/services/generationHistoryService');

describe('generationHistoryService (in-memory fallback)', () => {
  beforeEach(() => gh._resetMemory());

  it('records emitted texts and recalls them (accepts strings or {text})', async () => {
    await gh.recordOutputs('u1', 'hooks', [{ text: 'Hook A' }, 'Hook B']);
    expect(await gh.recentExclude('u1', 'hooks')).toEqual(['Hook A', 'Hook B']);
  });

  it('dedupes case/space-insensitively and keeps newest first', async () => {
    await gh.recordOutputs('u1', 'hooks', ['Hook A', 'Hook B']);
    await gh.recordOutputs('u1', 'hooks', ['  hook a ', 'Hook C']); // "hook a" ≡ "Hook A"
    const recalled = await gh.recentExclude('u1', 'hooks');
    // Newest batch first; the repeated hook collapses to one entry.
    expect(recalled).toEqual(['hook a', 'Hook C', 'Hook B']);
  });

  it('isolates by kind and by user', async () => {
    await gh.recordOutputs('u1', 'hooks', ['H']);
    expect(await gh.recentExclude('u1', 'captions')).toEqual([]);
    expect(await gh.recentExclude('u2', 'hooks')).toEqual([]);
  });

  it('caps stored history at MAX_PER_KEY', async () => {
    const many = Array.from({ length: gh.MAX_PER_KEY + 25 }, (_, i) => `hook-${i}`);
    await gh.recordOutputs('u1', 'hooks', many);
    const recalled = await gh.recentExclude('u1', 'hooks', 1000);
    expect(recalled.length).toBe(gh.MAX_PER_KEY);
  });

  it('is fail-open: missing user/kind/items never throws and returns []', async () => {
    await expect(gh.recordOutputs(null, 'hooks', ['x'])).resolves.toBeUndefined();
    await expect(gh.recordOutputs('u1', 'hooks', [])).resolves.toBeUndefined();
    expect(await gh.recentExclude(null, 'hooks')).toEqual([]);
    expect(await gh.recentExclude('u1', null)).toEqual([]);
  });

  it('respects the recall limit', async () => {
    await gh.recordOutputs('u1', 'hooks', ['a', 'b', 'c', 'd', 'e']);
    expect(await gh.recentExclude('u1', 'hooks', 2)).toEqual(['a', 'b']);
  });
});

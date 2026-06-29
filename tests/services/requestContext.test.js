const { runWithContext, getContext } = require('../../server/utils/requestContext');

describe('requestContext (AsyncLocalStorage request tracing)', () => {
  it('exposes the context to code running inside runWithContext', () => {
    runWithContext({ requestId: 'r1', userId: 'u1' }, () => {
      expect(getContext().requestId).toBe('r1');
      expect(getContext().userId).toBe('u1');
    });
  });

  it('returns {} outside any context', () => {
    expect(getContext()).toEqual({});
  });

  it('propagates across async boundaries', async () => {
    await runWithContext({ requestId: 'r2' }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      expect(getContext().requestId).toBe('r2');
    });
  });

  it('isolates concurrent contexts', async () => {
    const seen = [];
    await Promise.all([
      runWithContext({ requestId: 'A' }, async () => { await new Promise((r) => setTimeout(r, 10)); seen.push(getContext().requestId); }),
      runWithContext({ requestId: 'B' }, async () => { await new Promise((r) => setTimeout(r, 1)); seen.push(getContext().requestId); }),
    ]);
    expect(seen.sort()).toEqual(['A', 'B']);
  });

  it('logger stamps the requestId from context (smoke — does not throw)', () => {
    const logger = require('../../server/utils/logger');
    expect(() => runWithContext({ requestId: 'log-1' }, () => logger.info('hello'))).not.toThrow();
    expect(() => logger.info('no-context')).not.toThrow();
  });
});

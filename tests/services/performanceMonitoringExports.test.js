// Regression guard: the /api/monitoring/performance/{slow-queries,recent-errors}
// routes import getSlowQueries + getRecentErrors from this service. They were
// referenced but never defined/exported, so both admin routes 500'd with
// "getSlowQueries is not a function". Keep them exported + behaving.

const perf = require('../../server/services/performanceMonitoringService');

describe('performanceMonitoringService — slow-queries / recent-errors exports', () => {
  afterEach(() => perf.resetMetrics && perf.resetMetrics());

  it('exports getSlowQueries and getRecentErrors as functions', () => {
    expect(typeof perf.getSlowQueries).toBe('function');
    expect(typeof perf.getRecentErrors).toBe('function');
  });

  it('getSlowQueries returns an array (empty when no queries tracked)', () => {
    const out = perf.getSlowQueries(10);
    expect(Array.isArray(out)).toBe(true);
  });

  it('getSlowQueries surfaces tracked query types ranked by avg time, honoring limit', () => {
    perf.trackDatabaseQuery('fast', 5);
    perf.trackDatabaseQuery('slow', 900);
    perf.trackDatabaseQuery('slow', 1100);
    const top = perf.getSlowQueries(1);
    expect(top).toHaveLength(1);
    expect(top[0].type).toBe('slow');
    expect(top[0].count).toBe(2);
    expect(top[0].avgTime).toBe(1000);
  });

  it('getRecentErrors returns an array and captures 5xx events most-recent-first', () => {
    expect(perf.getRecentErrors()).toEqual([]);
    perf.trackAPIRequest('/a', 'GET', 12, 200); // not an error
    perf.trackAPIRequest('/b', 'GET', 34, 500); // captured
    perf.trackAPIRequest('/c', 'POST', 56, 503); // captured
    const errs = perf.getRecentErrors(10);
    expect(errs).toHaveLength(2);
    expect(errs[0].endpoint).toBe('/c'); // most recent first
    expect(errs[0].statusCode).toBe(503);
    expect(errs[1].endpoint).toBe('/b');
  });

  it('getRecentErrors respects the limit', () => {
    for (let i = 0; i < 5; i += 1) perf.trackAPIRequest(`/e${i}`, 'GET', 10, 500);
    expect(perf.getRecentErrors(3)).toHaveLength(3);
  });
});

// Regression guards for a small crash-safety + input-hardening sweep.
//   1. video/advanced download fetch is bounded by a timeout (no infinite hang).
//   2. workflows PUT guards steps with Array.isArray before .map (no crash-500
//      when a client sends a non-array `steps`).
//   3. list-filter query params are String()-cast so a `?field[$ne]=x` value
//      (parsed by qs into an object) can't inject a Mongo operator.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../server', rel), 'utf8');

describe('crash-safety + input hardening', () => {
  it('video/advanced: the download fetch has an abort timeout', () => {
    const src = read('routes/video/advanced.js');
    expect(src).toMatch(/fetchOpts\.signal\s*=\s*AbortSignal\.timeout\(/);
  });

  it('workflows: steps update is Array.isArray-guarded before .map', () => {
    const src = read('routes/workflows.js');
    expect(src).toMatch(/if \(Array\.isArray\(req\.body\.steps\)\)/);
    expect(src).not.toMatch(/if \(req\.body\.steps\) \{\s*\n\s*workflow\.steps = req\.body\.steps\.map/);
  });

  it('integrations: query-param filters are String()-cast (no operator injection)', () => {
    const src = read('routes/integrations.js');
    expect(src).toMatch(/query\.type = String\(type\)/);
    expect(src).toMatch(/query\.status = String\(status\)/);
    expect(src).toMatch(/query\.workspaceId = String\(workspaceId\)/);
  });

  it('content: type/status filters are String()-cast', () => {
    const src = read('routes/content.js');
    expect(src).toMatch(/query\.type = String\(type\)/);
    expect(src).toMatch(/query\.status = String\(status\)/);
  });

  it('scheduler: platform/status filters are String()-cast', () => {
    const src = read('routes/scheduler.js');
    expect(src).toMatch(/query\.platform = String\(platform\)/);
    expect(src).toMatch(/query\.status = String\(status\)/);
  });
});

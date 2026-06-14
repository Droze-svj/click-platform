// Unit tests for the render ownership ACL (IDOR guard). We point
// RENDER_OUTPUT_DIR at a temp dir BEFORE requiring the route so the sidecar
// writes/reads happen there.

const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'render-acl-'));
process.env.RENDER_OUTPUT_DIR = TMP;

const render = require('../../server/routes/video/render');

describe('render ownership ACL (mayAccessRender / writeRenderOwner)', () => {
  const JOB = 'abc123de-0000-4000-8000-000000000001';

  beforeAll(() => render._writeRenderOwner(JOB, 'userA'));
  afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* noop */ } });

  it('allows the owner (matched via _id or id)', () => {
    expect(render._mayAccessRender(JOB, { user: { _id: 'userA' } })).toBe(true);
    expect(render._mayAccessRender(JOB, { user: { id: 'userA' } })).toBe(true);
  });

  it('blocks a different authenticated user (the IDOR case)', () => {
    expect(render._mayAccessRender(JOB, { user: { _id: 'userB' } })).toBe(false);
    expect(render._mayAccessRender(JOB, { user: { _id: 'userB', id: 'userB' } })).toBe(false);
  });

  it('fails OPEN when there is no owner sidecar (legacy renders never break)', () => {
    expect(render._mayAccessRender('no-such-job-0000', { user: { _id: 'anyone' } })).toBe(true);
  });

  it('fails OPEN when the requester cannot be identified', () => {
    expect(render._mayAccessRender(JOB, { user: {} })).toBe(true);
    expect(render._mayAccessRender(JOB, {})).toBe(true);
  });
});

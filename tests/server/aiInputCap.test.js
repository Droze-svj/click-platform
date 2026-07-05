// AI input-size cap (M1): oversized free-text is rejected BEFORE it reaches a model,
// so one huge transcript/content/prompt can't burn a user's AI budget.

const aiInputCap = require('../../server/middleware/aiInputCap');

function mockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
function run(body) {
  const res = mockRes();
  let nexted = false;
  aiInputCap({ body }, res, () => { nexted = true; });
  return { res, nexted };
}

describe('aiInputCap middleware', () => {
  it('rejects an oversized text field with 413 AI_INPUT_TOO_LARGE (no next)', () => {
    const big = 'a '.repeat(150_000); // ~300k chars ≈ 75k tokens > 60k ceiling
    const { res, nexted } = run({ content: big });
    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe('AI_INPUT_TOO_LARGE');
    expect(nexted).toBe(false);
  });

  it('passes a normal-sized prompt through', () => {
    const { res, nexted } = run({ prompt: 'write a viral hook about cold brew coffee' });
    expect(nexted).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('checks every known text field (transcript too)', () => {
    const { res, nexted } = run({ transcript: 'x'.repeat(300_000) });
    expect(res.statusCode).toBe(413);
    expect(nexted).toBe(false);
  });

  it('ignores non-string / missing bodies (never blocks a normal request)', () => {
    expect(run({ content: { nested: 1 }, count: 5 }).nexted).toBe(true);
    expect(run(null).nexted).toBe(true);
    expect(run({}).nexted).toBe(true);
  });

  it('caps the `topic` field (primary input on ideation/intelligence surfaces)', () => {
    const { res, nexted } = run({ topic: 'x'.repeat(300_000) });
    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe('AI_INPUT_TOO_LARGE');
    expect(nexted).toBe(false);
    // a normal topic passes
    expect(run({ topic: 'cold brew for beginners' }).nexted).toBe(true);
  });

  it('is mounted on the /api/intelligence surface (uncapped LLM prompt/topic path)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../server/index.js'), 'utf8');
    const mountLine = src.split('\n').find((l) => l.includes("require('./middleware/aiInputCap')"));
    expect(mountLine).toBeTruthy();
    for (const p of ['/api/ai', '/api/creative', '/api/intelligence']) {
      expect(mountLine).toContain(p);
    }
  });
});

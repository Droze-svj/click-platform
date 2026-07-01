// Regression guard for the AI cost/fan-out hardening (exhaustive per-route audit,
// batch 1). These video AI routers called paid LLMs / renders with no dedicated
// aiLimiter or costGuard; each now attaches the established guard pattern.

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes/video', p), 'utf8');

const AI_ROUTERS = ['captions.js', 'chapters.js', 'hook-analysis.js', 'neural.js', 'tools.js', 'transcription.js'];

describe('video AI cost/fan-out guards', () => {
  it.each(AI_ROUTERS)('%s attaches aiLimiter (POST/PUT) + costGuard at the router level', (file) => {
    const src = read(file);
    expect(src).toMatch(/require\(['"]\.\.\/\.\.\/middleware\/enhancedRateLimiter['"]\)/);
    expect(src).toMatch(/require\(['"]\.\.\/\.\.\/middleware\/costGuard['"]\)/);
    expect(src).toMatch(/\['POST', 'PUT'\]\.includes\(req\.method\) \? aiLimiter\(req, res, next\)/);
    expect(src).toMatch(/router\.use\(costGuard\(\)\)/);
  });

  it('captions: translate-overlays caps the fan-out array', () => {
    const src = read('captions.js');
    expect(src).toMatch(/overlays\.length > 200/);
  });

  it('hook-analysis: the OpenAI client has an explicit timeout (no 10-min default hang)', () => {
    const src = read('hook-analysis.js');
    expect(src).toMatch(/new OpenAI\(\{ apiKey: process\.env\.OPENAI_API_KEY, timeout: 90000, maxRetries: 1 \}\)/);
  });
});

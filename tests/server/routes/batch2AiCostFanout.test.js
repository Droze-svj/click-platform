// Regression guards for the Batch-2 AI cost/fan-out residuals
// (audit-b2-ai-costfanout).

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-2 AI cost/fan-out regressions', () => {
  test('adaptContent caps + de-dupes the per-platform fan-out', () => {
    const src = read('server/services/contentAdaptationService.js');
    expect(src).toMatch(/const MAX_ADAPT_PLATFORMS = \d+/);
    expect(src).toMatch(/\[\.\.\.new Set\(Array\.isArray\(platforms\) \? platforms : \[\]\)\]\.slice\(0, MAX_ADAPT_PLATFORMS\)/);
    // The loop iterates the capped list, not the raw input.
    expect(src).toMatch(/for \(const platform of safePlatforms\)/);
  });

  test('recommendations /personalized clamps limit', () => {
    const src = read('server/routes/ai/recommendations.js');
    expect(src).toMatch(/limit: clampInt\(limit, 10, 50, 1\)/);
  });

  test('multiModelAIService no longer mutates process-global provider/model', () => {
    const src = read('server/services/multiModelAIService.js');
    // No more mutable per-request global DECLARATIONS (anchored to line start so
    // the explanatory comment mentioning the old names doesn't trip this).
    expect(src).not.toMatch(/^let currentProvider/m);
    expect(src).not.toMatch(/^let currentModel/m);
    expect(src).toMatch(/const DEFAULT_PROVIDER = 'google'/);
    expect(src).toMatch(/const DEFAULT_MODEL = 'gemini-2\.5-flash'/);
    // initAIProvider must not assign to a shared var.
    expect(src).not.toMatch(/currentProvider = provider/);
  });
});

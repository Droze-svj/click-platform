// When the model returns nothing usable (quota spent / blocked / prose), the
// creator-tools generators used to answer 200 with an empty list — and caption
// critique shaped null into a fabricated all-1 "1/10" scorecard. They now throw
// a 503 the routes pass through, the same contract memo-script already had.

const { generateHooks } = require('../../server/services/hookGeneratorService');
const { generateCaptions } = require('../../server/services/captionAnglesService');
const { generateHashtags } = require('../../server/services/hashtagStrategistService');
const { composeSlides } = require('../../server/services/carouselComposerService');
const { generateFirstComments } = require('../../server/services/firstCommentService');
const { generateSeries } = require('../../server/services/contentSeriesService');
const { critiquePost } = require('../../server/services/captionCritiqueService');

const depsReturning = (out) => ({
  sanitize: (t, cap) => String(t || '').slice(0, cap || 5000),
  generate: async () => out,
  assertBudget: async () => {},
  recordUsage: async () => {},
});

describe.each([null, ''])('model output %p', (out) => {
  const deps = depsReturning(out);
  test.each([
    ['hooks', () => generateHooks({ platform: 'tiktok', topic: 'coffee', count: 3 }, deps)],
    ['captions', () => generateCaptions({ platform: 'instagram', topic: 'coffee', count: 2 }, deps)],
    ['carousel', () => composeSlides({ format: 'thread', topic: 'coffee', count: 3 }, deps)],
    ['first comment', () => generateFirstComments({ platform: 'x', sourceText: 'coffee post' }, deps)],
    ['series', () => generateSeries({ theme: 'coffee', parts: 3 }, deps)],
    ['critique', () => critiquePost({ platform: 'x', text: 'my caption' }, deps)],
  ])('%s → 503, not an empty/fabricated 200', async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ statusCode: 503 });
  });
});

test('hashtags: empty model output → 503', async () => {
  await expect(generateHashtags({ platform: 'instagram', topic: 'coffee', count: 5 }, depsReturning(null)))
    .rejects.toMatchObject({ statusCode: 503 });
});

test('critique: prose with no scores is a 503, not an all-1 scorecard', async () => {
  await expect(critiquePost({ platform: 'x', text: 'my caption' }, depsReturning('Sorry, I cannot help with that.')))
    .rejects.toMatchObject({ statusCode: 503 });
});

test('critique with real scores still works', async () => {
  const out = await critiquePost({ platform: 'x', text: 'my caption' }, depsReturning(JSON.stringify({ scores: { hook: 7 }, overall: 6 })));
  expect(out.scores.hook).toBe(7);
  expect(out.overall).toBe(6);
});

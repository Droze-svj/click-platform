// The list generators' line-split fallback turned a prose refusal or one
// paragraph of advice into a single generated "item". They now return nothing
// for those, so the generator throws aiUnavailable (503). No AI is called.
const { splitListFallback, looksLikeRefusal } = require('../../server/utils/aiListFallback');
const { shapeHooks, generateHooks } = require('../../server/services/hookGeneratorService');
const { shapeCaptions } = require('../../server/services/captionAnglesService');
const { shapeTags } = require('../../server/services/hashtagStrategistService');
const { shapeSlides } = require('../../server/services/carouselComposerService');
const { shapeOptions } = require('../../server/services/firstCommentService');

const REFUSALS = [
  "I'm sorry, but I can't help with that request.",
  'As an AI language model, I cannot create content like this.',
  'I cannot generate that content.\nPlease try a different topic.',
  '"I apologize, but I am unable to assist with this."',
  'Unfortunately, I am not able to write hooks for this topic.',
];
const PARAGRAPH = 'Great hooks start with a bold claim. They create a curiosity gap the viewer wants closed. '
  + 'You should also keep them under ten words. Finally, test several variations and keep the winners.';

describe('looksLikeRefusal', () => {
  it.each(REFUSALS)('flags %s', (t) => expect(looksLikeRefusal(t)).toBe(true));

  it.each([
    "I can't believe nobody talks about this",
    'Sorry, but your morning routine is wrong',
    'Unfortunately, most people quit too early',
    'As an AI engineer, here is what I learned',
    "I don't do mornings anymore. Here's why",
  ])('does not flag a real hook: %s', (t) => expect(looksLikeRefusal(t)).toBe(false));
});

describe('splitListFallback', () => {
  it('keeps a real list and drops a "Here are…:" preamble', () => {
    expect(splitListFallback('Sure! Here are 3 hooks:\n1. One\n2. Two\n3. Three', { requested: 3 }))
      .toEqual(['1. One', '2. Two', '3. Three']);
  });
  it('keeps a list-tease hook that ends in a colon', () => {
    expect(splitListFallback('3 things nobody tells you:\nStop scrolling', { requested: 3 }))
      .toEqual(['3 things nobody tells you:', 'Stop scrolling']);
  });
  it('rejects one paragraph when several items were asked for', () => {
    expect(splitListFallback(PARAGRAPH, { requested: 5 })).toEqual([]);
    expect(splitListFallback(PARAGRAPH, { separator: /[\n,]/, requested: 5 })).toEqual([]);
  });
});

describe('every list generator returns nothing for a refusal or a paragraph', () => {
  const shapers = {
    hooks: (raw) => shapeHooks(raw, 'mix', 5),
    captions: (raw) => shapeCaptions(raw, 3),
    hashtags: (raw) => shapeTags(raw, 10),
    slides: (raw) => shapeSlides(raw, 5),
    firstComments: (raw) => shapeOptions(raw, 'engagement'),
  };
  for (const [name, shape] of Object.entries(shapers)) {
    it(`${name}`, () => {
      for (const r of REFUSALS) expect(shape(r)).toEqual([]);
      expect(shape(PARAGRAPH)).toEqual([]);
    });
  }

  it('hashtags still parse a comma list', () => {
    expect(shapeTags('#fitness, #gymtok, home workouts', 10).map((t) => t.tag))
      .toEqual(['#fitness', '#gymtok', '#homeworkouts']);
  });

  it('generateHooks answers a refusal with 503, not a one-item list', async () => {
    const deps = {
      sanitize: (t, cap) => String(t || '').slice(0, cap),
      generate: async () => "I'm sorry, but I can't help with that request.",
    };
    await expect(generateHooks({ platform: 'tiktok', topic: 'morning routines' }, deps))
      .rejects.toMatchObject({ statusCode: 503 });
  });
});

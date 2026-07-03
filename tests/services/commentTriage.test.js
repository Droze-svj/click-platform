// Behavioral tests for Comment Triage (pure, deterministic).

const {
  classifyIntent,
  scoreComment,
  triageComments,
} = require('../../server/services/commentTriageService');

describe('commentTriage.classifyIntent', () => {
  test('detects spam (links / follow-back / promo)', () => {
    expect(classifyIntent('check my profile for free followers')).toBe('spam');
    expect(classifyIntent('great tips! visit https://spam.example now')).toBe('spam');
    expect(classifyIntent('F4F?')).toBe('spam');
  });
  test('detects complaints (takes precedence over a question mark)', () => {
    expect(classifyIntent('this is broken, can I get a refund?')).toBe('complaint');
    expect(classifyIntent('worst product ever')).toBe('complaint');
  });
  test('detects buying-intent leads', () => {
    expect(classifyIntent('how much is your coaching?')).toBe('lead'); // "how much" beats generic question
    expect(classifyIntent('where can i get this')).toBe('lead');
  });
  test('detects genuine questions', () => {
    expect(classifyIntent('what camera do you use?')).toBe('question');
    expect(classifyIntent('How do you edit these')).toBe('question');
  });
  test('detects praise', () => {
    expect(classifyIntent('this is amazing 🔥')).toBe('praise');
    expect(classifyIntent('thank you, so helpful')).toBe('praise');
  });
  test('everything else is other; empty is other', () => {
    expect(classifyIntent('first')).toBe('other');
    expect(classifyIntent('')).toBe('other');
    expect(classifyIntent(null)).toBe('other');
  });
});

describe('commentTriage.scoreComment', () => {
  test('priority buckets follow intent', () => {
    expect(scoreComment('can I get a refund').priority).toBe('high');   // complaint
    expect(scoreComment('what lens is that?').priority).toBe('high');   // question
    expect(scoreComment('love it').priority).toBe('low');               // praise
    expect(scoreComment('follow back f4f').priority).toBe('ignore');    // spam
  });
  test('likes give a small, capped engagement boost (never for spam)', () => {
    const low = scoreComment('what lens?', { likes: 0 }).score;
    const high = scoreComment('what lens?', { likes: 10000 }).score;
    expect(high).toBeGreaterThan(low);
    expect(high - low).toBeLessThanOrEqual(10);
    expect(scoreComment('free followers click link', { likes: 10000 }).score).toBe(0); // spam stays 0
  });
});

describe('commentTriage.triageComments', () => {
  test('ranks complaints/leads/questions above praise, spam last; returns counts', () => {
    const { ranked, counts, total } = triageComments([
      { id: 'a', text: 'love this!' },                 // praise
      { id: 'b', text: 'this is broken, refund?' },    // complaint
      { id: 'c', text: 'free followers, follow back' },// spam
      { id: 'd', text: 'how much is coaching?' },      // lead
      { id: 'e', text: 'what mic do you use?' },       // question
    ]);
    expect(total).toBe(5);
    expect(ranked[0].id).toBe('b');            // complaint first
    expect(ranked[ranked.length - 1].id).toBe('c'); // spam last
    expect(ranked.map((r) => r.id).slice(0, 3)).toEqual(['b', 'd', 'e']); // complaint > lead > question
    expect(counts.high).toBe(3);
    expect(counts.ignore).toBe(1);
  });

  test('stable ordering on ties (preserves input order)', () => {
    const { ranked } = triageComments([
      { id: 'x', text: 'love it' },
      { id: 'y', text: 'amazing' },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['x', 'y']);
  });

  test('non-array input → empty result', () => {
    expect(triageComments(null)).toEqual({ ranked: [], counts: {}, total: 0 });
  });
});

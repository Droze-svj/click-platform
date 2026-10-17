// Behavioral tests for the Voice Memo → Script core (pure prompt/parse/QA + injected AI).

const {
  FORMATS,
  HOOK_MAX_WORDS,
  normalizeFormat,
  countWords,
  buildPrompt,
  shapeScript,
  qaCheck,
  toMarkdown,
  toScriptDoc,
  generateMemoScript,
} = require('../../server/services/memoScriptService');

const GOOD = {
  title: 'Why nobody buys',
  hook: 'You post every day. Nobody buys. Here is why.',
  body: [
    'Your first three seconds sell the whole video.',
    'Most creators open with a greeting, and the viewer is already gone.',
    'Lead with the problem your buyer has, in their words.',
    'Then show one proof, not five.',
  ],
  cta: 'Comment HOOK and I will send you my three openers.',
  brollCues: ['beat 1: phone screen with zero sales'],
  claims: [],
};

// ~30 words/beat of filler so a short-form script lands in its runtime window.
const pad = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('memoScript.normalizeFormat / countWords', () => {
  test('unknown format falls back to short', () => {
    expect(normalizeFormat('nope')).toBe('short');
    expect(normalizeFormat('long')).toBe('long');
    expect(normalizeFormat(undefined)).toBe('short');
  });
  test('counts whitespace-separated words, empty is 0', () => {
    expect(countWords('  one two   three ')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
  });
});

describe('memoScript.buildPrompt', () => {
  test('embeds memo, platform, format runtime, hook cap and the JSON contract', () => {
    const p = buildPrompt({ memo: 'hook idea - coffee shops', platform: 'youtube', format: 'long' });
    expect(p).toContain('hook idea - coffee shops');
    expect(p).toContain('youtube');
    expect(p).toContain(`${FORMATS.long.minSec}-${FORMATS.long.maxSec} seconds`);
    expect(p).toContain(`max ${HOOK_MAX_WORDS} words`);
    expect(p).toMatch(/Return ONLY JSON/);
    expect(p).toMatch(/Do not add new claims/);
    expect(p).toMatch(/creator's own words/);
    expect(p).toMatch(/Never write placeholders/);
  });
});

describe('memoScript.shapeScript', () => {
  test('parses clean JSON', () => {
    const s = shapeScript(JSON.stringify(GOOD));
    expect(s).toEqual(GOOD);
  });
  test('extracts JSON wrapped in prose/code fences', () => {
    const s = shapeScript('Here you go:\n```json\n' + JSON.stringify(GOOD) + '\n```');
    expect(s.hook).toBe(GOOD.hook);
    expect(s.body).toHaveLength(4);
  });
  test('accepts body beats as objects and drops blanks; title falls back to hook', () => {
    const s = shapeScript(JSON.stringify({ hook: 'H', body: [{ text: 'a' }, '', '  ', 'b'], cta: 'C' }));
    expect(s.body).toEqual(['a', 'b']);
    expect(s.title).toBe('H');
    expect(s.brollCues).toEqual([]);
    expect(s.claims).toEqual([]);
  });
  test.each([
    ['unparsable prose', 'Sorry, I cannot help with that.'],
    ['missing hook', JSON.stringify({ body: ['a'], cta: 'c' })],
    ['empty body', JSON.stringify({ hook: 'h', body: [], cta: 'c' })],
    ['missing cta', JSON.stringify({ hook: 'h', body: ['a'] })],
    ['array instead of object', '["h","b","c"]'],
    ['null', null],
  ])('returns null for %s (no canned template)', (_label, raw) => {
    expect(shapeScript(raw)).toBeNull();
  });
});

describe('memoScript.qaCheck', () => {
  const byId = (qa, id) => qa.checks.find((c) => c.id === id);
  const sized = { ...GOOD, body: [pad(25), pad(25), pad(25)] }; // ~95 words ≈ 38s

  test('a well-formed short script passes every gating check', () => {
    const qa = qaCheck(sized, { format: 'short', banned: ['synergy'] });
    expect(qa.passed).toBe(true);
    expect(qa.estimatedSeconds).toBeGreaterThanOrEqual(FORMATS.short.minSec);
    expect(qa.estimatedSeconds).toBeLessThanOrEqual(FORMATS.short.maxSec);
    expect(byId(qa, 'fact-check').ok).toBe(true);
  });

  test('flags a hook that cannot land in 3 seconds', () => {
    const qa = qaCheck({ ...sized, hook: pad(HOOK_MAX_WORDS + 3) }, { format: 'short' });
    expect(qa.passed).toBe(false);
    expect(byId(qa, 'hook-length')).toMatchObject({ ok: false });
    expect(byId(qa, 'hook-length').message).toMatch(/15 words/);
  });

  test('flags banned words case-insensitively on word boundaries only', () => {
    const script = { ...sized, cta: 'Unlock this GAME-CHANGER today.' };
    const qa = qaCheck(script, { format: 'short', banned: ['game-changer', 'lock'] });
    expect(byId(qa, 'banned-words').ok).toBe(false);
    expect(byId(qa, 'banned-words').message).toContain('game-changer');
    // "lock" only appears inside "Unlock" — not a hit.
    expect(byId(qa, 'banned-words').message).not.toMatch(/\block\b/);
  });

  test('flags unfilled placeholders the creator would read out loud', () => {
    const script = { ...sized, body: [...sized.body, 'Try our new XYZ before noon.'], cta: 'Grab the [product] today.' };
    const qa = qaCheck(script, { format: 'short' });
    expect(qa.passed).toBe(false);
    expect(byId(qa, 'placeholders').ok).toBe(false);
    expect(byId(qa, 'placeholders').message).toContain('XYZ');
    expect(byId(qa, 'placeholders').message).toContain('[product]');
    expect(byId(qaCheck(sized, { format: 'short' }), 'placeholders').ok).toBe(true);
  });

  test('runtime outside the format window fails', () => {
    const qa = qaCheck(GOOD, { format: 'long' });
    expect(byId(qa, 'runtime').ok).toBe(false);
    expect(qa.passed).toBe(false);
  });

  test('numbers and flagged claims are surfaced for fact-checking without failing QA', () => {
    const script = { ...sized, body: [...sized.body, 'This tripled sales by 300% and made $4,182.'], claims: ['tripled sales'] };
    const qa = qaCheck(script, { format: 'short' });
    const fc = byId(qa, 'fact-check');
    expect(fc.ok).toBe(false);
    expect(fc.message).toContain('1 flagged claim');
    expect(fc.message).toContain('300%');
    expect(fc.message).toContain('$4,182');
    expect(qa.passed).toBe(true);
  });
});

describe('memoScript.toMarkdown', () => {
  test('renders # Hook / # Body / # CTA plus cues and a claims checklist', () => {
    const md = toMarkdown({ ...GOOD, claims: ['3x more sales'] });
    expect(md).toMatch(/^# Hook\n\nYou post every day/);
    expect(md).toContain('# Body\n\n- Your first three seconds');
    expect(md).toContain('# CTA\n\nComment HOOK');
    expect(md).toContain('## B-roll cues\n\n- beat 1');
    expect(md).toContain('## Claims to verify\n\n- [ ] 3x more sales');
  });
  test('omits empty optional sections', () => {
    const md = toMarkdown({ ...GOOD, brollCues: [] });
    expect(md).not.toContain('B-roll');
    expect(md).not.toContain('Claims to verify');
  });
});

describe('memoScript.toScriptDoc', () => {
  test('maps onto the Script model: markdown body, structure, type by format, draft status', () => {
    const doc = toScriptDoc(GOOD, { format: 'short', userId: 'u1' });
    expect(doc).toMatchObject({ userId: 'u1', title: GOOD.title, type: 'social-media', tone: 'casual', status: 'draft' });
    expect(doc.script).toBe(toMarkdown(GOOD));
    expect(doc.structure.introduction).toBe(GOOD.hook);
    expect(doc.structure.mainPoints).toEqual(GOOD.body.map((content, i) => ({ title: `Beat ${i + 1}`, content })));
    expect(doc.structure.callToAction).toBe(GOOD.cta);
    expect(doc.metadata.hooks).toEqual([GOOD.hook]);
    expect(doc.wordCount).toBe(countWords([GOOD.hook, ...GOOD.body, GOOD.cta].join(' ')));
    expect(toScriptDoc(GOOD, { format: 'long', userId: 'u1' }).type).toBe('youtube');
  });
});

describe('memoScript.generateMemoScript', () => {
  const baseDeps = (raw) => ({
    sanitize: (s, max) => String(s || '').slice(0, max),
    generate: jest.fn().mockResolvedValue(raw),
    assertBudget: jest.fn().mockResolvedValue(),
    recordUsage: jest.fn().mockResolvedValue(),
  });

  test('400 on empty memo, without calling the model', async () => {
    const deps = baseDeps('{}');
    await expect(generateMemoScript({ memo: '   ' }, deps)).rejects.toMatchObject({ statusCode: 400 });
    expect(deps.generate).not.toHaveBeenCalled();
  });

  test('returns script + qa + markdown and meters the call', async () => {
    const deps = { ...baseDeps(JSON.stringify(GOOD)), getBannedWords: jest.fn().mockResolvedValue(['greeting']) };
    const out = await generateMemoScript({ memo: 'raw thoughts', platform: 'youtube', format: 'short', userId: 'u1' }, deps);
    expect(out.platform).toBe('youtube');
    expect(out.format).toBe('short');
    expect(out.script.hook).toBe(GOOD.hook);
    expect(out.markdown).toContain('# Hook');
    expect(out.qa.checks.find((c) => c.id === 'banned-words').message).toContain('greeting');
    expect(deps.assertBudget).toHaveBeenCalledWith(expect.objectContaining({ expectedOutputTokens: 1200 }));
    expect(deps.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ taskType: 'memo-script' }));
    expect(deps.getBannedWords).toHaveBeenCalledWith('u1');
  });

  test('long format gets a bigger token budget', async () => {
    const deps = baseDeps(JSON.stringify(GOOD));
    await generateMemoScript({ memo: 'm', format: 'long' }, deps);
    expect(deps.generate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ maxTokens: 3000 }));
  });

  test('prepends the creator persona with the JSON-safe script-writer role', async () => {
    const deps = { ...baseDeps(JSON.stringify(GOOD)), buildSystemPrompt: jest.fn().mockResolvedValue('PERSONA') };
    await generateMemoScript({ memo: 'm', userId: 'u1', platform: 'tiktok' }, deps);
    expect(deps.buildSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({ role: 'script-writer', userId: 'u1' }));
    expect(deps.generate.mock.calls[0][0]).toMatch(/^PERSONA\n\n── Task ──/);
  });

  test('returns null when the model reply is unusable', async () => {
    const out = await generateMemoScript({ memo: 'm' }, baseDeps('no json here'));
    expect(out).toBeNull();
  });

  test('a failing banned-word lookup never blocks the script', async () => {
    const deps = { ...baseDeps(JSON.stringify(GOOD)), getBannedWords: jest.fn().mockRejectedValue(new Error('db down')) };
    const out = await generateMemoScript({ memo: 'm', userId: 'u1' }, deps);
    expect(out.script).toBeTruthy();
  });
});

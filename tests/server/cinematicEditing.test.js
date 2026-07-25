const { buildEditingPrinciples, EDITING_PRINCIPLES } = require('../../server/services/cinematicEditing');
const { buildPrompts } = require('../../server/services/aiDirectorService');

describe('cinematicEditing — craft principles', () => {
  it('exposes a non-trivial, uniquely-numbered set of principles', () => {
    expect(EDITING_PRINCIPLES.length).toBeGreaterThanOrEqual(10);
    const ids = EDITING_PRINCIPLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
    EDITING_PRINCIPLES.forEach((p) => {
      expect(typeof p.text).toBe('string');
      expect(p.text.length).toBeGreaterThan(20);
    });
  });

  it('renders a compact, headed prompt block', () => {
    const block = buildEditingPrinciples();
    expect(block).toMatch(/CINEMATIC EDITING PRINCIPLES/);
    // Covers the core transferable axes: rhythm, sound, structure.
    expect(block).toMatch(/R1\./);
    expect(block).toMatch(/S1\./);
    expect(block).toMatch(/P4\./);
    // Stays terse enough to live inside a prompt.
    expect(block.length).toBeLessThan(6000);
  });
});

describe('aiDirector — cinematic principles reach the prompt', () => {
  it('injects the editing principles into the generated user prompt', () => {
    const { userPrompt } = buildPrompts({
      duration: 30, resolution: '1080x1920', niche: 'finance', platform: 'tiktok', language: 'en',
      transcriptExcerpt: 'hello world', wordCount: 2, silenceRanges: [], sceneTimes: [],
      styleSection: '', blueprintSection: '', avoidSection: '', goals: {}, constraints: {},
    });
    expect(userPrompt).toMatch(/CINEMATIC EDITING PRINCIPLES/);
    expect(userPrompt).toMatch(/breathe/);      // R1 rhythm rule present
    // Principles must appear BEFORE the HARD RULES block so the model reads craft first.
    expect(userPrompt.indexOf('CINEMATIC EDITING PRINCIPLES')).toBeLessThan(userPrompt.indexOf('HARD RULES'));
  });
});

// AI Director creativity + safety: its color vocabulary now spans the full shared
// registry (26 grades, not 6), and validateDirections keeps only RENDERABLE steps —
// an out-of-registry grade or unknown pacing strategy is dropped (so the AI can never
// emit a no-op edit), while alias grades normalize to the canonical id.

const { validateDirections } = require('../../server/services/aiDirectorService');
const reg = require('../../server/services/colorGradeRegistry');

function steps(arr) {
  const dirs = validateDirections({ directions: [{ id: 'd1', title: 'T', steps: arr }] }, 60);
  return dirs[0] ? dirs[0].steps : [];
}

describe('aiDirector vocabulary + validation', () => {
  it('keeps a new registry grade and normalizes an alias; drops an unknown grade', () => {
    const s = steps([
      { type: 'color', time: 0, params: { grade: 'teal-orange' } },
      { type: 'color', time: 1, params: { grade: 'moody-dark' } },      // alias → moody
      { type: 'color', time: 2, params: { grade: 'not-a-real-grade' } }, // dropped
    ]);
    const colors = s.filter((x) => x.type === 'color');
    expect(colors).toHaveLength(2);
    const grades = colors.map((c) => c.params.grade);
    expect(grades).toContain('teal-orange');
    expect(grades).toContain('moody');          // normalized, not 'moody-dark'
    expect(grades).not.toContain('not-a-real-grade');
  });

  it('drops a pacing step with an unknown strategy, keeps a valid one', () => {
    const s = steps([
      { type: 'pacing', time: 0, params: { strategy: 'punchy' } },
      { type: 'pacing', time: 1, params: { strategy: 'nonsense' } },
    ]);
    const pacing = s.filter((x) => x.type === 'pacing');
    expect(pacing).toHaveLength(1);
    expect(pacing[0].params.strategy).toBe('punchy');
  });

  it('the Director color vocabulary is the full registry (far more than the legacy 6)', () => {
    expect(reg.gradeIds().length).toBeGreaterThanOrEqual(20);
    // Every grade the Director may suggest resolves (so it always renders).
    for (const id of reg.gradeIds()) {
      const s = steps([{ type: 'color', time: 0, params: { grade: id } }]);
      expect(s.filter((x) => x.type === 'color')).toHaveLength(1);
    }
  });
});

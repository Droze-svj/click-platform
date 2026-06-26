// The color-grade registry is the single source of truth for named grades. These
// lock in: every grade actually renders (non-empty FFmpeg chain via the real
// buildVideoFilterChain), aliases resolve, warm vs cool render DISTINCTLY (the bug
// the keystone fixes), and unknown ids degrade safely.

const fs = require('fs');
const path = require('path');
const reg = require('../../server/services/colorGradeRegistry');
const { buildVideoFilterChain } = require('../../server/services/videoRenderService');

describe('colorGradeRegistry', () => {
  it('every grade resolves and (except natural) renders to a non-empty chain', () => {
    const ids = reg.gradeIds();
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const def = reg.resolveGrade(id);
      expect(def).toBeTruthy();
      const chain = buildVideoFilterChain(reg.gradeToVideoFilter(id));
      if (id === 'natural') continue;       // neutral grade intentionally no-ops
      expect(chain.length).toBeGreaterThan(0);
    }
  });

  it('resolves legacy aliases to the canonical grade', () => {
    expect(reg.resolveGrade('moody-dark').id).toBe('moody');
    expect(reg.resolveGrade('hyper_pop').id).toBe('hyper-pop');
    expect(reg.resolveGrade('cyberpunk_neon').id).toBe('cyberpunk');
    expect(reg.resolveGrade('vintage_film').id).toBe('vintage');
    expect(reg.resolveGrade('mono').id).toBe('bw');
  });

  it('warm and cool now render DISTINCTLY (temperature is honored in the export)', () => {
    const warm = buildVideoFilterChain(reg.gradeToVideoFilter('warm')).join(';');
    const cool = buildVideoFilterChain(reg.gradeToVideoFilter('cool')).join(';');
    expect(warm).toMatch(/colorbalance/);
    expect(cool).toMatch(/colorbalance/);
    expect(warm).not.toEqual(cool);
  });

  it('carries vfx tags into the filter object (e.g. cyberpunk → chromatic-aberration)', () => {
    const cyber = reg.gradeToVideoFilter('cyberpunk');
    expect(Array.isArray(cyber.vfx)).toBe(true);
    expect(cyber.vfx).toContain('chromatic-aberration');
    const chain = buildVideoFilterChain(cyber);
    expect(chain.some((p) => p.includes('rgbashift'))).toBe(true);  // vfx actually renders
  });

  it('unknown grade id degrades safely', () => {
    expect(reg.resolveGrade('does-not-exist')).toBeNull();
    expect(reg.gradeToVideoFilter('does-not-exist')).toEqual({});
  });

  // The client mirror (lib/colorGrades.ts) MUST list the same grade ids as the
  // server, or the editor preview won't match the exported MP4. Text-compare the
  // ids so drift fails CI without needing to compile the client TS here.
  it('client mirror lib/colorGrades.ts is in id-parity with the server registry', () => {
    const mirrorPath = path.join(__dirname, '../../client/lib/colorGrades.ts');
    const src = fs.readFileSync(mirrorPath, 'utf8');
    // Only ids inside the COLOR_GRADES array entries (lines starting with `{ id:`).
    const clientIds = src
      .split('\n')
      .filter((l) => /^\s*\{\s*id:/.test(l))
      .map((l) => (l.match(/id:\s*'([^']+)'/) || [])[1])
      .filter(Boolean);
    expect(new Set(clientIds)).toEqual(new Set(reg.gradeIds()));
  });

  // Every grade a clip style preset references must resolve, or that preset renders
  // a no-op grade. Catches typos + keeps presets and the registry in lockstep.
  it('every colorGrade referenced by clipStylePresets resolves in the registry', () => {
    const presetsPath = path.join(__dirname, '../../server/services/clipStylePresets.js');
    const src = fs.readFileSync(presetsPath, 'utf8');
    const referenced = [...src.matchAll(/colorGrade:\s*'([^']+)'/g)].map((m) => m[1]);
    const unresolved = [...new Set(referenced)].filter((g) => !reg.resolveGrade(g));
    expect(unresolved).toEqual([]);
  });
});

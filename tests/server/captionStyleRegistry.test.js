// The caption-style registry is the single source of truth for named caption
// styles. These lock in: every style resolves and produces a valid ASS style
// line, every legacy vocabulary still resolves (the bug this registry fixes was
// ~40 advertised style names silently rendering as `default`), the client mirror
// stays in id-parity, and unknown ids degrade safely.

const fs = require('fs');
const path = require('path');
const reg = require('../../server/services/captionStyleRegistry');

describe('captionStyleRegistry', () => {
  it('every style resolves and produces a complete ASS style line', () => {
    const ids = reg.captionStyleIds();
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const def = reg.resolveCaptionStyle(id);
      expect(def).toBeTruthy();

      const s = reg.toAssStyle(id, { width: 1080, height: 1920 });
      expect(s.Fontsize).toBeGreaterThan(0);
      expect(s.Fontname).toBeTruthy();
      // ASS colours are &HAABBGGRR — assert the shape, not a literal.
      expect(s.PrimaryColour).toMatch(/^&H[0-9A-F]{8}$/);
      expect(s.OutlineColour).toMatch(/^&H[0-9A-F]{8}$/);
      // BorderStyle 1 = outline+shadow, 3 = opaque box. Nothing else is valid.
      expect([1, 3]).toContain(s.BorderStyle);
      // MarginV must be derived from the frame, never a fixed pixel offset —
      // a fixed offset lands mid-frame on a different aspect ratio.
      expect(s.MarginV).toBeGreaterThan(0);
      expect(s.MarginV).toBeLessThan(1920);
    }
  });

  it('scales font size and margins to the output frame', () => {
    const tall = reg.toAssStyle('hormozi', { width: 1080, height: 1920 });
    const small = reg.toAssStyle('hormozi', { width: 540, height: 960 });
    // Half the width → half the type, so captions are the same PROPORTION on
    // every aspect (the drawtext path's convention, preserved).
    expect(small.Fontsize).toBe(Math.round(tall.Fontsize / 2));
    expect(small.MarginV).toBe(Math.round(tall.MarginV / 2));
  });

  it('converts hex to ASS BGR (not RGB) — the classic format trap', () => {
    // #FFD700 is R=FF G=D7 B=00 → &H00 00 D7 FF
    expect(reg.hexToAssColor('#FFD700')).toBe('&H0000D7FF');
    expect(reg.hexToAssColor('#000000')).toBe('&H00000000');
    expect(reg.hexToAssColor('#FFFFFF')).toBe('&H00FFFFFF');
    // Alpha is a leading byte and is INVERTED (00 = opaque).
    expect(reg.hexToAssColor('#FFFFFF', 128)).toBe('&H80FFFFFF');
  });

  it('resolves every legacy vocabulary to a real style', () => {
    // clipStylePresets strings
    expect(reg.resolveCaptionStyle('bold-kinetic').id).toBe('hormozi');
    expect(reg.resolveCaptionStyle('tiktok').id).toBe('hormozi');
    expect(reg.resolveCaptionStyle('minimal').id).toBe('clean-minimal');
    expect(reg.resolveCaptionStyle('professional').id).toBe('serif-doc');
    // aiDirectorService vocabulary
    expect(reg.resolveCaptionStyle('karaoke').id).toBe('karaoke-fill');
    expect(reg.resolveCaptionStyle('bubble').id).toBe('pill');
    // viralPipelineService's otherwise-unmatched default
    expect(reg.resolveCaptionStyle('tiktok-pop').id).toBe('hormozi');
    // Case-insensitive, so a stored `CTA` still resolves.
    expect(reg.resolveCaptionStyle('CTA').id).toBe('cta');
  });

  it('unknown style id degrades safely', () => {
    expect(reg.resolveCaptionStyle('does-not-exist')).toBeNull();
    // ...but the render path always gets a usable record.
    expect(reg.resolveCaptionStyleOrDefault('does-not-exist').id).toBe('default');
    expect(reg.toAssStyle('does-not-exist', {}).Fontsize).toBeGreaterThan(0);
  });

  // The client mirror MUST list the same ids as the server, or the editor
  // preview won't match the exported MP4. Text-compare the ids so drift fails
  // CI without needing to compile the client TS here. (Same guard as
  // colorGradeRegistry.test.js — the pattern that has kept grades in sync.)
  it('client mirror lib/captionStyles.ts is in id-parity with the server registry', () => {
    const mirrorPath = path.join(__dirname, '../../client/lib/captionStyles.ts');
    const src = fs.readFileSync(mirrorPath, 'utf8');
    const clientIds = src
      .split('\n')
      .filter((l) => /^\s*\{\s*id:/.test(l))
      .map((l) => (l.match(/id:\s*'([^']+)'/) || [])[1])
      .filter(Boolean);
    expect(new Set(clientIds)).toEqual(new Set(reg.captionStyleIds()));
  });

  it('client mirror aliases match the server aliases', () => {
    const mirrorPath = path.join(__dirname, '../../client/lib/captionStyles.ts');
    const src = fs.readFileSync(mirrorPath, 'utf8');
    const block = src.slice(src.indexOf('CAPTION_STYLE_ALIASES'));
    const clientAliases = [...block.matchAll(/'([^']+)':\s*'([^']+)',/g)]
      .reduce((acc, m) => { acc[m[1]] = m[2]; return acc; }, {});
    expect(clientAliases).toEqual(reg.ALIASES);
  });

  // Every captionStyle a clip-style preset references must resolve, or that
  // preset silently renders the default look — exactly the class of bug this
  // registry exists to end. Mirrors the colorGrade guard.
  it('every captionStyle referenced by clipStylePresets resolves', () => {
    const presetsPath = path.join(__dirname, '../../server/services/clipStylePresets.js');
    const src = fs.readFileSync(presetsPath, 'utf8');
    const referenced = [...src.matchAll(/captionStyle:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    const unresolved = [...new Set(referenced)].filter((s) => !reg.resolveCaptionStyle(s));
    expect(unresolved).toEqual([]);
  });

  describe('preferredStyleFrom', () => {
    it('picks the most-used style from learned counters', () => {
      expect(reg.preferredStyleFrom([
        { key: 'clean-minimal', count: 2 },
        { key: 'hormozi', count: 9 },
        { key: 'neon', count: 4 },
      ])).toBe('hormozi');
    });

    it('resolves legacy counter keys through the alias map', () => {
      // Counters hold whatever id the editor wrote at the time. A literal
      // comparison would miss every pre-registry pick the creator ever made.
      expect(reg.preferredStyleFrom([{ key: 'bold-kinetic', count: 5 }])).toBe('hormozi');
      expect(reg.preferredStyleFrom([{ key: 'karaoke', count: 3 }])).toBe('karaoke-fill');
    });

    it('returns null when nothing has been learned, rather than inventing a preference', () => {
      expect(reg.preferredStyleFrom([])).toBeNull();
      expect(reg.preferredStyleFrom(null)).toBeNull();
      expect(reg.preferredStyleFrom([{ key: 'hormozi', count: 0 }])).toBeNull();
      expect(reg.preferredStyleFrom([{ key: 'not-a-style', count: 99 }])).toBeNull();
    });

    it('ignores unresolvable keys but still honours the rest', () => {
      expect(reg.preferredStyleFrom([
        { key: 'not-a-style', count: 99 },
        { key: 'neon', count: 1 },
      ])).toBe('neon');
    });
  });

  it('every caption style the AI Director can emit resolves', () => {
    const directorPath = path.join(__dirname, '../../server/services/aiDirectorService.js');
    const src = fs.readFileSync(directorPath, 'utf8');
    // The Director advertises its caption vocabulary as a literal string array.
    const m = src.match(/\[(?:\s*'(?:bold|bold-kinetic)'[^\]]*)\]/);
    if (!m) return; // vocabulary moved — the registry guard above still applies
    const names = [...m[0].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const unresolved = names.filter((n) => !reg.resolveCaptionStyle(n));
    expect(unresolved).toEqual([]);
  });
});

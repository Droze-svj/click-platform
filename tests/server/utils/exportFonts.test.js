const fs = require('fs');
const path = require('path');
const { resolveExportFont, overlayFontSpec, bundledFamily } = require('../../../server/utils/exportFonts');

const root = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Exported text must use the font the editor showed. These lists are what the
// editor offers; each must resolve to its OWN bundled family, never a fallback.
describe('export fonts match the editor', () => {
  const studio = read('client/components/editor/views/TextMotionStudioView.tsx');
  const catalogue = studio.slice(studio.indexOf('const FONTS: FontEntry[] = ['));
  const offered = [...catalogue.matchAll(/name: '([^']+)',\s+family: ([^,]+(?:,[^w]+?)?),\s+weights: \[([\d, ]+)\]/g)];

  it('reads the font library', () => {
    expect(offered.length).toBeGreaterThanOrEqual(20);
  });

  it('every font-library font and weight renders with its own file', () => {
    const F = {
      F_INTER: 'var(--font-inter), "Inter", system-ui, sans-serif',
      F_PLAYFAIR: 'var(--font-playfair), "Playfair Display", Georgia, serif',
      F_CAVEAT: 'var(--font-caveat), "Caveat", "Comic Sans MS", cursive',
      F_JETBRAINS: 'var(--font-jetbrains), "JetBrains Mono", "Courier New", monospace',
      F_VT323: 'var(--font-vt323), "VT323", "Courier New", monospace',
    };
    for (const [, name, famExpr, weights] of offered) {
      const css = F[famExpr.trim()] || famExpr.trim().replace(/^'|'$/g, '');
      for (const w of weights.split(',').map(Number)) {
        const f = resolveExportFont({ family: css, weight: w }, 'Hello');
        expect({ name, family: f && f.family, weight: f && f.weight }).toEqual({ name, family: name, weight: w });
      }
    }
  });

  it('every Brand Kit font is bundled', () => {
    const kit = read('client/components/BrandKit.tsx');
    const list = kit.slice(kit.indexOf("'Inter', 'Roboto'"), kit.indexOf(']', kit.indexOf("'Inter', 'Roboto'")));
    const names = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(8);
    for (const n of names) expect(bundledFamily(`"${n}", sans-serif`)).toBe(n);
  });

  it('honours italic and falls back when the font lacks the characters', () => {
    expect(resolveExportFont({ family: '"Playfair Display", serif', weight: 700, italic: true }, 'Hi').italic).toBe(true);
    // Bebas Neue has no Cyrillic → closest bundled font that has it (never tofu).
    const bebas = resolveExportFont({ family: '"Bebas Neue"' }, 'Привет');
    expect(bebas).toMatchObject({ family: 'Inter', covers: true, substituted: true });
    expect(resolveExportFont({ family: '"Lora", serif' }, 'Привет').family).toBe('Lora');
    expect(resolveExportFont({ family: 'Inter' }, 'Tiếng Việt').covers).toBe(true);
    // No bundled CJK → covers:false so the renderer picks the Noto script font.
    expect(resolveExportFont({ family: 'Inter' }, 'こんにちは').covers).toBe(false);
  });

  it('maps system fonts to their open equivalents', () => {
    expect(bundledFamily('Impact, sans-serif')).toBe('Anton');
    expect(bundledFamily('"Comic Sans MS", cursive')).toBe('Comic Neue');
    expect(bundledFamily('Georgia, serif')).toBe('Gelasio');
    expect(bundledFamily('system-ui')).toBe('Inter');
  });

  it('prefers the editor-resolved font sent with the export', () => {
    expect(overlayFontSpec({ fontFamily: 'Inter', exportFont: { family: 'Lora', weight: 700, italic: false } }))
      .toEqual({ family: 'Lora', weight: 700, italic: false });
  });
});

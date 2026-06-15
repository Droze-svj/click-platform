// Unit tests for the PURE recipe helpers (no DB): the bound/whitelist logic
// that keeps a user-submitted recipe small and safe, plus request building.

const svc = require('../../../server/services/repurposeRecipeService');

describe('repurposeRecipeService.sanitizeRecipe', () => {
  it('keeps only supported target ratios and caps the count', () => {
    const c = svc.sanitizeRecipe({
      targets: ['9:16', 'bogus', { ratio: '1:1', platform: 'instagram' }, { ratio: 'nope' },
        '16:9', '4:5', '9:16', '1:1', '16:9', '4:5'],
    });
    expect(c.targets.length).toBeLessThanOrEqual(8);
    expect(c.targets).toContainEqual('9:16');
    expect(c.targets).toContainEqual({ ratio: '1:1', platform: 'instagram' });
    expect(c.targets).not.toContain('bogus');
    expect(c.targets.find((t) => t && t.ratio === 'nope')).toBeUndefined();
  });

  it('normalises niche and rejects an unknown quality', () => {
    const c = svc.sanitizeRecipe({ targets: ['9:16'], niche: '  FINANCE  ', quality: 'ultra' });
    expect(c.niche).toBe('finance');
    expect(c.quality).toBeUndefined();
  });

  it('accepts a whitelisted quality', () => {
    expect(svc.sanitizeRecipe({ targets: ['9:16'], quality: 'best' }).quality).toBe('best');
  });

  it('bounds videoFilters to primitives and drops nested/oversized junk', () => {
    const c = svc.sanitizeRecipe({
      targets: ['9:16'],
      videoFilters: { brightness: 110, label: 'x'.repeat(500), evil: { nested: true }, fn: () => 1 },
    });
    expect(c.videoFilters.brightness).toBe(110);
    expect(c.videoFilters.label.length).toBe(200);
    expect(c.videoFilters.evil).toBeUndefined();
    expect(c.videoFilters.fn).toBeUndefined();
  });

  it('reduces overlays to whitelisted primitive fields and drops text-less/oversized', () => {
    const c = svc.sanitizeRecipe({
      targets: ['9:16'],
      textOverlays: [
        { text: 'Hook!', style: 'bold', fontSize: 48, x: 10, evil: () => 1 },
        { style: 'noText' },
        { text: 'y'.repeat(999) },
      ],
    });
    expect(c.textOverlays).toHaveLength(2);              // text-less one dropped
    expect(c.textOverlays[0]).toEqual({ text: 'Hook!', style: 'bold', fontSize: 48, x: 10 });
    expect(c.textOverlays[1].text.length).toBe(200);     // capped
  });

  it('drops unknown top-level fields entirely', () => {
    const c = svc.sanitizeRecipe({ targets: ['9:16'], junk: 'nope', __proto__: { x: 1 } });
    expect(c.junk).toBeUndefined();
    expect(Object.keys(c).sort()).toEqual(['niche', 'quality', 'targets', 'textOverlays', 'videoFilters']);
  });
});

describe('repurposeRecipeService.recipeToRequest', () => {
  it('builds a repurpose tree from a recipe + fresh video', () => {
    const recipe = { targets: ['9:16', '1:1'], niche: 'finance', quality: 'high', videoFilters: { brightness: 110 }, textOverlays: [{ text: 'Hi' }] };
    const { tree, targets, niche } = svc.recipeToRequest(recipe, { videoUrl: '/uploads/videos/x.mp4', duration: 12, title: 'My clip' });
    expect(tree.videoUrl).toBe('/uploads/videos/x.mp4');
    expect(tree.duration).toBe(12);
    expect(tree.videoFilters).toEqual({ brightness: 110 });
    expect(tree.textOverlays).toEqual([{ text: 'Hi' }]);
    expect(tree.metadata.title).toBe('My clip');
    expect(targets).toEqual(['9:16', '1:1']);
    expect(niche).toBe('finance');
  });

  it('honours a niche override', () => {
    const { niche } = svc.recipeToRequest({ targets: ['9:16'], niche: 'finance' }, { videoUrl: '/x.mp4', nicheOverride: 'health' });
    expect(niche).toBe('health');
  });
});

describe('repurposeRecipeService.summarizeRecipe', () => {
  it('produces a gallery-safe summary with formats + ownership', () => {
    const doc = {
      _id: 'abc123', name: 'Finance Pack', description: 'd', niche: 'finance',
      createdBy: 'user-1', createdByName: 'Dee', isPublic: true, remixCount: 7,
      recipe: { targets: ['9:16', { ratio: '1:1' }], textOverlays: [{ text: 'a' }] },
      createdAt: new Date(0),
    };
    const mine = svc.summarizeRecipe(doc, 'user-1');
    expect(mine).toMatchObject({ id: 'abc123', name: 'Finance Pack', remixCount: 7, mine: true });
    expect(mine.formats).toEqual(['9:16', '1:1']);
    expect(mine.overlayCount).toBe(1);
    expect(svc.summarizeRecipe(doc, 'someone-else').mine).toBe(false);
    expect(mine.recipe).toBeUndefined(); // summary must not leak the full config
  });
});

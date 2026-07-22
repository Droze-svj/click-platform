const { itemText, dedupKey, buildAvoidBlock, filterExcluded } = require('../../../server/utils/promptDedup');

describe('promptDedup — cross-call output diversity', () => {
  describe('itemText / dedupKey', () => {
    it('extracts text from strings and shaped items, and normalizes the key', () => {
      expect(itemText('Hello There')).toBe('Hello There');
      expect(itemText({ text: 'A hook' })).toBe('A hook');
      expect(itemText({ hook: 'A hook' })).toBe('A hook');
      expect(itemText({ title: 'An idea' })).toBe('An idea');
      // case + whitespace insensitive key
      expect(dedupKey('  Hello   World ')).toBe(dedupKey('hello world'));
      expect(dedupKey({ text: 'Hello World' })).toBe('hello world');
    });
  });

  describe('buildAvoidBlock', () => {
    it('is a strict no-op for empty/absent exclude lists', () => {
      expect(buildAvoidBlock([])).toBe('');
      expect(buildAvoidBlock(undefined)).toBe('');
      expect(buildAvoidBlock(null)).toBe('');
    });

    it('lists the already-shown items as an avoid instruction', () => {
      const block = buildAvoidBlock(['Hook one', { text: 'Hook two' }], 'hooks');
      expect(block).toMatch(/do NOT repeat/i);
      expect(block).toMatch(/DIFFERENT hooks/);
      expect(block).toMatch(/1\. Hook one/);
      expect(block).toMatch(/2\. Hook two/);
    });

    it('dedups the avoid list and caps it so it can not blow the prompt', () => {
      const many = Array.from({ length: 100 }, (_, i) => `item ${i}`);
      const block = buildAvoidBlock([...many, 'item 0', 'ITEM 0'], 'x');
      // capped at 40 entries, and "item 0"/"ITEM 0" collapse to one
      expect((block.match(/^\d+\. /gm) || []).length).toBe(40);
    });
  });

  describe('filterExcluded', () => {
    it('removes items whose normalized key matches an excluded one', () => {
      const items = [{ text: 'Keep me' }, { text: 'Drop me' }, { text: 'drop ME' }];
      const out = filterExcluded(items, ['Drop me']);
      expect(out.map((i) => i.text)).toEqual(['Keep me']); // both "Drop me" and "drop ME" removed
    });

    it('returns items unchanged when nothing is excluded', () => {
      const items = [{ text: 'a' }, { text: 'b' }];
      expect(filterExcluded(items, [])).toEqual(items);
      expect(filterExcluded(items, undefined)).toEqual(items);
    });
  });
});

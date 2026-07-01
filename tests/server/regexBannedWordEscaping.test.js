// User-configured banned words must be regex-escaped before interpolation.
//
// `guidelines.contentRules.doNotUse` is a user-provided list. Building
// `new RegExp(`\\b${word}\\b`)` from a raw value throws when the word contains
// regex metacharacters (e.g. "C++" → "Nothing to repeat") — crashing the
// compliance/replace path or letting banned content slip through. Both call
// sites now wrap the word with escapeRegex().

const fs = require('fs');
const path = require('path');
const { applyClientGuidelines } = require('../../server/services/bulkCampaignService');

describe('banned-word regex escaping', () => {
  describe('bulkCampaignService.applyClientGuidelines (behavioral)', () => {
    it('does NOT throw when a banned word contains regex metacharacters', () => {
      const content = { text: 'we love C++ and (parens) and a+b' };
      const guidelines = { contentRules: { doNotUse: ['C++', '(parens)', 'a+b'] } };
      // Pre-fix this threw `SyntaxError: Invalid regular expression`.
      expect(() => applyClientGuidelines(content, guidelines, null)).not.toThrow();
    });

    it('still strips a normal banned word (no regression)', () => {
      const content = { text: 'this is spam content' };
      const guidelines = { contentRules: { doNotUse: ['spam'] } };
      const out = applyClientGuidelines(content, guidelines, null);
      expect(out.text).not.toMatch(/\bspam\b/);
    });

    it('treats a metacharacter banned word LITERALLY (not as a pattern)', () => {
      // Escaped, "a.b" matches only the literal "a.b" — not "axb" (which a raw
      // unescaped "." wildcard would have wrongly matched/removed).
      const content = { text: 'keep axb but drop a.b here' };
      const guidelines = { contentRules: { doNotUse: ['a.b'] } };
      const out = applyClientGuidelines(content, guidelines, null);
      expect(out.text).toContain('axb');
      expect(out.text).not.toContain('a.b');
    });
  });

  describe('client-guidelines route (static guard)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../server/routes/client-guidelines.js'),
      'utf8'
    );
    it('imports escapeRegex', () => {
      expect(src).toMatch(/require\(['"]\.\.\/utils\/escapeRegex['"]\)/);
    });
    it('escapes the banned word in the RegExp (no raw interpolation)', () => {
      expect(src).toMatch(/new RegExp\(`\\\\b\$\{escapeRegex\(word\)\}\\\\b`/);
      expect(src).not.toMatch(/new RegExp\(`\\\\b\$\{word\}\\\\b`/);
    });
  });
});

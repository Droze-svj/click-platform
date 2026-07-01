// Regression guard: user-supplied search terms must never flow RAW into
// `new RegExp(...)` — that's a ReDoS vector (catastrophic backtracking) and
// breaks searches on regex special chars. They must be wrapped in escapeRegex.
// Companion to regexSearchEscaping.test.js (which guards the `$regex:` form).

const { execSync } = require('child_process');
const path = require('path');

describe('new RegExp user-input escaping (ReDoS guard)', () => {
  it('no server file builds new RegExp() directly from a user-search identifier', () => {
    const root = path.join(__dirname, '../../server');
    // grep for new RegExp(<userVar> — excluding escapeRegex-wrapped forms.
    let out = '';
    try {
      out = execSync(
        `grep -rnE "new RegExp\\\\((search|q|query|searchQuery|phrase|req\\\\.query\\\\.search)[,)]" ${root} | grep -v escapeRegex || true`,
        { encoding: 'utf8' }
      ).trim();
    } catch (_) { out = ''; }
    if (out) {
      throw new Error('Raw new RegExp(userInput) found (wrap in escapeRegex):\n' + out);
    }
    expect(out).toBe('');
  });
});

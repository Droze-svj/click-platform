// Regression guard: search endpoints must escape user input before $regex, or a
// crafted query is a ReDoS/DoS vector (catastrophic backtracking) and special
// chars silently break the search. escapeRegex() (escapes + caps length) is the
// canonical helper. These files previously dropped raw req input into $regex.

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../../server');

const FILES = [
  'routes/portal-enhanced.js',
  'routes/content-ops-api.js',
  'routes/music-user-uploads.js',
  'routes/ai-music-templates.js',
  'routes/agency-campaigns.js',
  'routes/music.js',
  'services/templateMarketplaceService.js',
  'services/advancedAssetLibraryService.js',
  'services/proModeEnhancementService.js',
];

// Bare user-input identifiers that must never sit raw in a $regex value.
const RAW = /\$regex:\s*(search|q|value|searchQuery|req\.query\.search)\s*[,}]/;

describe('search $regex inputs are escaped (ReDoS / regex-injection guard)', () => {
  for (const rel of FILES) {
    it(`${rel} wraps user input in escapeRegex (no raw $regex)`, () => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).toContain("require('../utils/escapeRegex')");
      expect(src).not.toMatch(RAW);
      // every dynamic $regex value (not a /.../ literal) must call escapeRegex
      const dynamic = src.match(/\$regex:\s*(?!\/)[^,}]+/g) || [];
      for (const m of dynamic) {
        expect(m).toContain('escapeRegex(');
      }
    });
  }
});

// analyzeContentGaps honesty: a brand-new creator with NO content must NOT be told
// they're "under-posting" on every platform (a fabricated nudge derived from no data).
// Gaps are only real once they've actually posted somewhere.

jest.mock('../../server/models/Content', () => ({ find: jest.fn() }));
jest.mock('../../server/models/User', () => ({ findById: jest.fn() }));

const Content = require('../../server/models/Content');
const User = require('../../server/models/User');
const { analyzeContentGaps } = require('../../server/services/contentSuggestionsService');

function mockContents(arr) {
  Content.find.mockReturnValue({ sort: () => ({ limit: () => Promise.resolve(arr) }) });
}

describe('analyzeContentGaps — honest cold-start', () => {
  beforeEach(() => {
    Content.find.mockReset();
    User.findById.mockReset();
    User.findById.mockResolvedValue(null);
  });

  it('returns [] when the user has NO content (no false "under-posting" nudge)', async () => {
    mockContents([]);
    expect(await analyzeContentGaps('6a3500000000000000000aaa')).toEqual([]);
  });

  it('flags real gaps once the user has posted somewhere', async () => {
    mockContents([{ generatedContent: { socialPosts: [{ platform: 'tiktok' }] } }]);
    const gaps = await analyzeContentGaps('6a3500000000000000000bbb');
    expect(Array.isArray(gaps)).toBe(true);
    expect(gaps.length).toBeGreaterThan(0);                 // the other platforms are genuine gaps
    const tk = gaps.find((g) => g.platform === 'tiktok');
    if (tk) expect(tk.count).toBe(1);                        // tiktok counted truthfully, not 0
  });
});

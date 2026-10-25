// `const { includeX = true } = req.query` followed by `includeX === 'true'`
// is false whenever the param is absent (the default is the boolean true, not
// the string). The Suggestions tab sends no flags, so every source was switched
// off and it was always empty. Same class fixed in monitoring, export, library,
// playbooks, scheduling/advanced and translation.

jest.mock('../../../server/services/enhancedSuggestionsService', () => {
  const actual = jest.requireActual('../../../server/services/enhancedSuggestionsService');
  return { ...actual, getEnhancedSuggestions: jest.fn(async () => [{ title: 'x' }]) };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { getEnhancedSuggestions } = require('../../../server/services/enhancedSuggestionsService');

describe('boolean query defaults', () => {
  let token;
  beforeAll(async () => {
    await User.deleteMany({ email: 'qbd@example.com' });
    const u = await new User({ email: 'qbd@example.com', password: 'password123', name: 'Q', emailVerified: true }).save();
    token = jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });
  });
  beforeEach(() => getEnhancedSuggestions.mockClear());

  it('enhanced suggestions include every source by default', async () => {
    const res = await request(app).get('/api/suggestions/enhanced').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(getEnhancedSuggestions.mock.calls[0][1]).toMatchObject({ includeTrending: true, includeGaps: true, includeSeasonal: true });
  });

  it('an explicit false still switches a source off', async () => {
    await request(app).get('/api/suggestions/enhanced?includeGaps=false').set('Authorization', `Bearer ${token}`);
    expect(getEnhancedSuggestions.mock.calls[0][1]).toMatchObject({ includeTrending: true, includeGaps: false, includeSeasonal: true });
  });
});

// RevenueOracle polled GET /sovereign/insights every 15s and each call ran one
// Gemini request (free tier: ~20/day for everyone). Insights are now cached per
// user for 6h, and the per-insight "scores" (hardcoded 0.9/0.82/0.78) are gone.

jest.mock('../../../server/services/cognitiveLoopService', () => ({
  analyzeStrategicPivots: jest.fn(async () => ({
    status: 'active',
    analyzedVideos: 4,
    plan: {
      currentWins: 'Short tutorials',
      recommendedPivots: [{ pivot: 'More hooks', reason: 'retention', expectedImpact: 'higher' }],
      suggestedToneAdjustment: 'warmer',
    },
  })),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { analyzeStrategicPivots } = require('../../../server/services/cognitiveLoopService');

describe('GET /api/sovereign/insights', () => {
  let token;
  beforeAll(async () => {
    await User.deleteMany({ email: 'sic@example.com' });
    const u = await new User({ email: 'sic@example.com', password: 'password123', name: 'S', emailVerified: true }).save();
    token = jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const get = (qs = '') => request(app).get(`/api/sovereign/insights${qs}`).set('Authorization', `Bearer ${token}`);

  it('computes once, then serves the cache (refresh is throttled)', async () => {
    const first = await get();
    expect(first.status).toBe(200);
    expect(first.body.data.insights.length).toBe(3);
    expect(first.body.data.insights.every((i) => i.score === null)).toBe(true);

    const second = await get();
    const refreshed = await get('?refresh=1');
    expect(second.body.data.cached).toBe(true);
    expect(refreshed.body.data.cached).toBe(true); // < 10 min since the last compute
    expect(analyzeStrategicPivots).toHaveBeenCalledTimes(1);
  });
});

/**
 * POST /api/scripts/generate
 *
 * When the model produced nothing, scriptService swapped in a canned template
 * ("Hey everyone! Welcome back to the channel…", "Check out this amazing insight
 * about X! 🚀") and the route saved it as the user's completed script and counted
 * it as usage. It now answers 503 and saves nothing. The route also never passed
 * the caller's id, so no script was ever grounded in the creator's own history.
 */

const USER_ID = '507f1f77bcf86cd799439011';

const mockGenerators = {
  generateYouTubeScript: jest.fn(),
  generatePodcastScript: jest.fn(),
  generateSocialMediaScript: jest.fn(),
  generateBlogScript: jest.fn(),
  generateEmailScript: jest.fn(),
};
const mockScriptSave = jest.fn();
const mockUserUpdate = jest.fn();
const mockTrackAction = jest.fn();

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: USER_ID, niche: 'fitness' };
  next();
});
jest.mock('../../../server/middleware/subscriptionAccess', () => ({
  requireActiveSubscription: (req, res, next) => next(),
}));
jest.mock('../../../server/services/scriptService', () => mockGenerators);
jest.mock('../../../server/models/Script', () => jest.fn().mockImplementation(function Script(doc) {
  Object.assign(this, doc, { _id: 'script-1' });
  this.save = mockScriptSave;
}));
jest.mock('../../../server/models/User', () => ({
  findByIdAndUpdate: (...args) => mockUserUpdate(...args),
}));
jest.mock('../../../server/services/workflowService', () => ({
  trackAction: (...args) => mockTrackAction(...args),
}));
jest.mock('../../../server/services/engagementService', () => ({
  updateStreak: jest.fn(),
  checkAchievements: jest.fn(),
  createActivity: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/scripts');

const app = express();
app.use(express.json());
app.use('/api/scripts', router);

describe('POST /api/scripts/generate', () => {
  beforeEach(() => {
    Object.values(mockGenerators).forEach((m) => m.mockReset());
    [mockScriptSave, mockUserUpdate, mockTrackAction].forEach((m) => m.mockReset());
    mockScriptSave.mockResolvedValue();
    mockUserUpdate.mockResolvedValue();
    mockTrackAction.mockResolvedValue();
  });

  it('answers unavailable — saving and counting nothing — when no script was generated', async () => {
    mockGenerators.generateBlogScript.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/scripts/generate')
      .send({ topic: 'meal prep', type: 'blog' })
      .expect(503);

    expect(res.body).toEqual({
      success: false,
      error: 'Script generation is unavailable right now. Please try again shortly.',
    });
    expect(mockScriptSave).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockTrackAction).not.toHaveBeenCalled();
  });

  it("passes the caller's own id to the generator (a body-supplied userId cannot override it)", async () => {
    mockGenerators.generateYouTubeScript.mockResolvedValue({ title: 'T', script: 'A real script', duration: 5, wordCount: 3 });

    await request(app)
      .post('/api/scripts/generate')
      .send({ topic: 'squats', type: 'youtube', options: { userId: 'someone-else', tone: 'bold' } })
      .expect(200);

    expect(mockGenerators.generateYouTubeScript).toHaveBeenCalledWith(
      'squats', expect.objectContaining({ userId: USER_ID, tone: 'bold' })
    );
    expect(mockScriptSave).toHaveBeenCalledTimes(1);
  });
});

/**
 * POST /api/calendar/autofill
 *
 * When the model produced no ideas (AI unavailable or over quota) the route still
 * built an empty plan, answered 201 "Calendar drafts created", and billed the
 * user's AI budget for 1200 output tokens that were never produced. It now says
 * the ideas are unavailable, creates nothing, and records no usage (costGuard's
 * leak guard refunds the unsettled reservation).
 */

const mockGenerateViralIdeas = jest.fn();
const mockCreateCalendarDrafts = jest.fn();
const mockAssertBudget = jest.fn();
const mockRecordAiUsage = jest.fn();

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: 'user-1' };
  next();
});
jest.mock('../../../server/middleware/enhancedRateLimiter', () => ({
  aiLimiter: (req, res, next) => next(),
}));
jest.mock('../../../server/middleware/costGuard', () => ({
  costGuard: () => (req, res, next) => {
    req.assertBudget = mockAssertBudget;
    req.recordAiUsage = mockRecordAiUsage;
    next();
  },
}));
jest.mock('../../../server/models/User', () => ({
  findById: () => ({ select: () => ({ lean: () => Promise.resolve({ niche: 'fitness' }) }) }),
}));
jest.mock('../../../server/services/aiService', () => ({
  generateViralIdeas: (...args) => mockGenerateViralIdeas(...args),
}));
jest.mock('../../../server/services/calendarAutofillService', () => ({
  createCalendarDrafts: (...args) => mockCreateCalendarDrafts(...args),
  listCalendarDrafts: jest.fn(),
  approveCalendarPlan: jest.fn(),
  cancelCalendarPlan: jest.fn(),
}));
jest.mock('../../../server/services/optimalScheduleService', () => ({ computeOptimalSlots: jest.fn() }));
jest.mock('../../../server/routes/schedule-optimal', () => ({ scheduleDeps: jest.fn(() => ({})) }));

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/calendar-autofill');

const app = express();
app.use(express.json());
app.use('/api/calendar', router);

describe('POST /api/calendar/autofill', () => {
  beforeEach(() => {
    [mockGenerateViralIdeas, mockCreateCalendarDrafts, mockAssertBudget, mockRecordAiUsage].forEach((m) => m.mockReset());
    mockAssertBudget.mockResolvedValue();
    mockRecordAiUsage.mockResolvedValue();
  });

  it('says the ideas are unavailable — creating nothing and billing nothing — when none were generated', async () => {
    mockGenerateViralIdeas.mockResolvedValue([]);

    const res = await request(app).post('/api/calendar/autofill').send({ count: 5 }).expect(200);

    expect(res.body.message).toBe('Calendar ideas are unavailable right now');
    expect(res.body.data).toEqual({ planId: null, count: 0, posts: [], degraded: true });
    expect(mockCreateCalendarDrafts).not.toHaveBeenCalled();
    expect(mockRecordAiUsage).not.toHaveBeenCalled();
  });

  it('creates drafts and meters usage when ideas were generated', async () => {
    mockGenerateViralIdeas.mockResolvedValue([{ title: 'Idea', description: 'Do it', platform: 'tiktok' }]);
    mockCreateCalendarDrafts.mockResolvedValue({ planId: 'cal_ab12', count: 1, posts: [{}] });

    const res = await request(app).post('/api/calendar/autofill').send({ count: 1 }).expect(201);

    expect(res.body.message).toBe('Calendar drafts created');
    expect(res.body.data).toMatchObject({ planId: 'cal_ab12', count: 1 });
    expect(mockCreateCalendarDrafts).toHaveBeenCalledTimes(1);
    expect(mockRecordAiUsage).toHaveBeenCalledTimes(1);
  });
});

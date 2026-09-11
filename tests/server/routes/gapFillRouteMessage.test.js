/**
 * POST /api/clients/:clientWorkspaceId/gaps/fill
 *
 * The route answered "Gaps filled" whatever happened — including when every gap
 * was skipped or failed and nothing was created — so the message contradicted
 * the summary sent alongside it. The message now describes the outcome.
 */

const mockFillContentGaps = jest.fn();

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: 'user-1' };
  next();
});
jest.mock('../../../server/middleware/workspaceIsolation', () => ({
  requireWorkspaceAccess: () => (req, res, next) => next(),
}));
jest.mock('../../../server/services/gapFillingService', () => ({
  fillContentGaps: (...args) => mockFillContentGaps(...args),
  bulkFillGaps: jest.fn(),
}));
jest.mock('../../../server/services/templateAnalyticsService', () => ({
  getTemplatePerformance: jest.fn(),
  getTemplateSuggestions: jest.fn(),
}));
jest.mock('../../../server/services/contentHealthAlertService', () => ({
  getClientAlerts: jest.fn(),
  acknowledgeAlert: jest.fn(),
  resolveAlert: jest.fn(),
}));
jest.mock('../../../server/services/bulkTemplateService', () => ({ bulkApplyTemplate: jest.fn() }));
jest.mock('../../../server/services/contentHealthTrendsService', () => ({
  getHealthTrends: jest.fn(),
  getBenchmarkComparison: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/cross-client-enhanced');

const app = express();
app.use(express.json());
app.use('/api/clients', router);

const GAP_DATA = { gaps: [{ category: 'platform', description: 'Not posting on tiktok', priority: 8 }] };
const fill = () => request(app).post('/api/clients/ws-1/gaps/fill').send({ gapData: GAP_DATA });
const result = (summary) => ({ generated: [], skipped: [], errors: [], summary });

describe('POST /api/clients/:clientWorkspaceId/gaps/fill', () => {
  beforeEach(() => mockFillContentGaps.mockReset());

  it.each([
    [{ total: 3, successful: 0, skipped: 3, failed: 0 }, 'No gaps could be filled automatically (3 skipped, 0 failed)'],
    [{ total: 2, successful: 0, skipped: 1, failed: 1 }, 'No gaps could be filled automatically (1 skipped, 1 failed)'],
    [{ total: 0, successful: 0, skipped: 0, failed: 0 }, 'No gaps matched the requested priority'],
    [{ total: 3, successful: 2, skipped: 1, failed: 0 }, 'Filled 2 of 3 gaps'],
  ])('summary %j is reported as "%s"', async (summary, message) => {
    mockFillContentGaps.mockResolvedValue(result(summary));

    const res = await fill().expect(200);

    expect(res.body.message).toBe(message);
    expect(res.body.data.summary).toEqual(summary);
  });

  it('fills gaps on behalf of the signed-in user', async () => {
    mockFillContentGaps.mockResolvedValue(result({ total: 0 }));

    await fill().expect(200);

    expect(mockFillContentGaps).toHaveBeenCalledWith('ws-1', GAP_DATA, expect.objectContaining({ userId: 'user-1' }));
  });
});

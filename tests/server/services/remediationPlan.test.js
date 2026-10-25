// The remediation HUD renders `actionPlan`, but the service derived the plan
// and then dropped it from every response (SCHEDULED / EVOLVED), so "Planned
// fixes" never showed anything. It also saved status 'evolved' (not in the
// Content enum → every save threw) and an undeclared processedFile.

jest.mock('../../../server/services/enhancedVideoProcessingService', () => ({
  addAudioToVideo: jest.fn(),
  stabilizeVideo: jest.fn(async () => ({ resultUrl: '/uploads/videos/stable.mp4' })),
}));
jest.mock('../../../server/services/videoCommentService', () => ({ getCommentsByTimeRange: jest.fn() }));
jest.mock('../../../server/services/communityAgentService', () => ({ getStatus: jest.fn(async () => ({})) }));

const mongoose = require('mongoose');
const comments = require('../../../server/services/videoCommentService');
const Content = require('../../../server/models/Content');
const remediation = require('../../../server/services/remediationService');

describe('remediationService.processAutonomousRemediation', () => {
  const userId = new mongoose.Types.ObjectId();
  let windowSpy;

  afterEach(() => windowSpy && windowSpy.mockRestore());

  it('reports CLEAN with an empty plan when no comment asks for a fix', async () => {
    comments.getCommentsByTimeRange.mockResolvedValue([{ text: 'love it' }, {}]);
    const r = await remediation.processAutonomousRemediation(userId, 'c1');
    expect(r).toMatchObject({ success: true, status: 'CLEAN', actionPlan: [], commentsChecked: 2 });
  });

  it('returns the derived plan when the fix is scheduled for the window', async () => {
    windowSpy = jest.spyOn(remediation, 'isWithinEvolutionWindow').mockReturnValue(false);
    comments.getCommentsByTimeRange.mockResolvedValue([{ text: 'Music too loud' }, { text: 'captions too small!' }]);
    const r = await remediation.processAutonomousRemediation(userId, 'c1');
    expect(r.status).toBe('SCHEDULED');
    expect(r.actionPlan.map((a) => a.type)).toEqual(['ADJUST_VOLUME', 'ENLARGE_TEXT']);
  });

  it('saves an evolved render and reports which fixes were applied', async () => {
    const content = await Content.create({
      userId, title: 'Shaky', type: 'video', status: 'completed',
      originalFile: { url: '/uploads/videos/orig.mp4' },
    });
    comments.getCommentsByTimeRange.mockResolvedValue([{ text: 'way too shaky' }, { text: 'text too small' }]);
    const r = await remediation.processAutonomousRemediation(userId, String(content._id), true);
    expect(r).toMatchObject({ status: 'EVOLVED', applied: ['STABILIZE'], finalUrl: '/uploads/videos/stable.mp4' });
    expect(r.actionPlan.map((a) => a.type)).toEqual(['ENLARGE_TEXT', 'STABILIZE']);
    const saved = await Content.findById(content._id).lean();
    expect(saved.status).toBe('completed');
    expect(saved.metadata.remediation).toMatchObject({ finalUrl: '/uploads/videos/stable.mp4', applied: ['STABILIZE'] });
  });
});

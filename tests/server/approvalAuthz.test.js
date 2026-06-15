// Authorization guard on multi-step approval advancement: only an assigned
// approver for the current stage (or someone assigned to it, or the creator)
// may approve/reject/request_changes. Previously ANY authenticated caller could
// advance ANY approval by id (cross-tenant), flipping status + auto-scheduling.

jest.mock('../../server/models/ContentApproval');
jest.mock('../../server/models/Content');
jest.mock('../../server/models/ScheduledPost');

const ContentApproval = require('../../server/models/ContentApproval');
const Content = require('../../server/models/Content');
const ScheduledPost = require('../../server/models/ScheduledPost');
const { advanceToNextStage } = require('../../server/services/multiStepWorkflowService');

function makeApproval() {
  return {
    _id: 'APPROVAL1',
    contentId: 'CONTENT1',
    currentStage: 1,
    status: 'pending',
    stages: [
      { stageOrder: 0, status: 'completed' },
      { stageOrder: 1, status: 'pending', approvals: [{ approverId: 'U1', status: 'pending' }] },
    ],
    assignedTo: [{ userId: 'U1', stageOrder: 1 }],
    createdBy: 'CREATOR',
    history: [],
    save: jest.fn().mockResolvedValue(true),
  };
}

beforeEach(() => {
  Content.findById = jest.fn().mockResolvedValue(null);
  ScheduledPost.findOne = jest.fn().mockResolvedValue(null);
});

describe('advanceToNextStage authorization', () => {
  test('rejects a caller who is not an approver/assignee/creator (approve)', async () => {
    ContentApproval.findById = jest.fn().mockResolvedValue(makeApproval());
    await expect(advanceToNextStage('APPROVAL1', 'ATTACKER', 'approve')).rejects.toThrow(/not authorized/i);
  });

  test('rejects a non-approver on reject and request_changes too', async () => {
    ContentApproval.findById = jest.fn().mockResolvedValue(makeApproval());
    await expect(advanceToNextStage('APPROVAL1', 'ATTACKER', 'reject')).rejects.toThrow(/not authorized/i);
    ContentApproval.findById = jest.fn().mockResolvedValue(makeApproval());
    await expect(advanceToNextStage('APPROVAL1', 'ATTACKER', 'request_changes')).rejects.toThrow(/not authorized/i);
  });

  test('allows the assigned approver of the current stage', async () => {
    const approval = makeApproval();
    ContentApproval.findById = jest.fn().mockResolvedValue(approval);
    await expect(advanceToNextStage('APPROVAL1', 'U1', 'approve')).resolves.toBeTruthy();
    expect(approval.save).toHaveBeenCalled();
    expect(approval.status).toBe('approved'); // single remaining stage → completed
  });

  test('does not enforce on past-tense internal actions (trusted callers unaffected)', async () => {
    // workflowAutomationService / simpleClientPortalService pass 'approved'/'rejected'
    // (past tense). The guard must NOT block these — they keep their prior no-op path.
    ContentApproval.findById = jest.fn().mockResolvedValue(makeApproval());
    await expect(advanceToNextStage('APPROVAL1', 'ANYONE', 'approved')).resolves.toBeTruthy();
  });
});

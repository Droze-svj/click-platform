// Approving a 'script' ApprovalRequest moves that script out of draft (it is
// signed off and ready to record). The update is scoped to the requester's own
// script and is best-effort: a failed update never undoes the approval.

const mockFindById = jest.fn();
const mockScriptUpdate = jest.fn();

jest.mock('../../server/models/ApprovalRequest', () => ({ findById: (...a) => mockFindById(...a) }));
jest.mock('../../server/models/Script', () => ({ updateOne: (...a) => mockScriptUpdate(...a) }));
jest.mock('../../server/models/Team', () => ({}));
jest.mock('../../server/services/engagementService', () => ({ createActivity: jest.fn().mockResolvedValue() }));

const { approveRequest } = require('../../server/services/approvalService');

const USER = 'u1';
const pending = (entityType) => ({
  _id: 'r1', entityType, entityId: 's1', requestedBy: USER, requestedFrom: USER,
  status: 'pending', save: jest.fn().mockResolvedValue(),
});

beforeEach(() => {
  mockFindById.mockReset();
  mockScriptUpdate.mockReset().mockResolvedValue({ modifiedCount: 1 });
});

test('approving a script marks the requester\'s script completed', async () => {
  const req = pending('script');
  mockFindById.mockResolvedValue(req);
  const out = await approveRequest('r1', USER, 'ship it');
  expect(out.status).toBe('approved');
  expect(mockScriptUpdate).toHaveBeenCalledWith(
    { _id: 's1', userId: USER },
    { $set: expect.objectContaining({ status: 'completed' }) },
  );
});

test('other entity types do not touch scripts', async () => {
  mockFindById.mockResolvedValue(pending('content'));
  await approveRequest('r1', USER);
  expect(mockScriptUpdate).not.toHaveBeenCalled();
});

test('a failed script update does not fail the approval', async () => {
  mockFindById.mockResolvedValue(pending('script'));
  mockScriptUpdate.mockRejectedValue(new Error('db down'));
  await expect(approveRequest('r1', USER)).resolves.toMatchObject({ status: 'approved' });
});

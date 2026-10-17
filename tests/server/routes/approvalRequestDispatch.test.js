/**
 * /api/approvals — one-step ApprovalRequest sign-offs
 *
 * The dashboard approvals page lists ApprovalRequest documents, but approve /
 * reject / cancel only looked up ContentApproval (multi-step workflows), so
 * every button failed with "Approval not found", Reject 400'd on a missing
 * `rejectionReason` the page never sends, and the page's create form posted to
 * a route that did not exist. ApprovalRequest ids now dispatch to
 * approvalService; other ids still reach the multi-step workflow code.
 */

const mockExists = jest.fn();
const mockModelExists = jest.fn();
const mockUserExists = jest.fn();
const mockCreate = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockCancel = jest.fn();
const mockAdvance = jest.fn();
const mockRejectContent = jest.fn();
const mockCancelApproval = jest.fn();

const USER = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';
const ENTITY = '64b0000000000000000000aa';
const REQ_ID = '64b0000000000000000000bb';
const WF_ID = '64b0000000000000000000cc';

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: USER };
  next();
});
jest.mock('../../../server/models/ApprovalRequest', () => ({ exists: (...a) => mockExists(...a) }));
jest.mock('../../../server/models/Script', () => ({ exists: (...a) => mockModelExists('Script', ...a) }));
jest.mock('../../../server/models/Content', () => ({ exists: (...a) => mockModelExists('Content', ...a) }));
jest.mock('../../../server/models/ScheduledPost', () => ({ exists: (...a) => mockModelExists('ScheduledPost', ...a) }));
jest.mock('../../../server/models/User', () => ({ exists: (...a) => mockUserExists(...a) }));
jest.mock('../../../server/services/approvalService', () => ({
  createApprovalRequest: (...a) => mockCreate(...a),
  approveRequest: (...a) => mockApprove(...a),
  rejectRequest: (...a) => mockReject(...a),
  cancelRequest: (...a) => mockCancel(...a),
  getUserApprovalRequests: jest.fn().mockResolvedValue([]),
  getPendingApprovalsCount: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../../server/services/multiStepWorkflowService', () => ({
  advanceToNextStage: (...a) => mockAdvance(...a),
}));
jest.mock('../../../server/services/approvalWorkflowService', () => ({
  createWorkflow: jest.fn(),
  getWorkflows: jest.fn(),
  startApprovalProcess: jest.fn(),
  approveContent: jest.fn(),
  rejectContent: (...a) => mockRejectContent(...a),
  requestChanges: jest.fn(),
  resubmitContent: jest.fn(),
  getUserApprovals: jest.fn(),
  getApprovalDetails: jest.fn(),
  cancelApproval: (...a) => mockCancelApproval(...a),
}));

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/approvals');

const app = express();
app.use(express.json());
app.use('/api/approvals', router);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => res.status(500).json({ success: false, error: err.message }));

beforeEach(() => {
  [mockExists, mockModelExists, mockUserExists, mockCreate, mockApprove, mockReject, mockCancel,
    mockAdvance, mockRejectContent, mockCancelApproval].forEach((m) => m.mockReset());
});

describe('POST /api/approvals (create)', () => {
  it('creates a self sign-off on an owned script by default', async () => {
    mockModelExists.mockResolvedValue({ _id: ENTITY });
    mockCreate.mockResolvedValue({ _id: REQ_ID });
    const res = await request(app).post('/api/approvals')
      .send({ entityType: 'script', entityId: ENTITY, message: 'Script: don&#x27;t post &amp; pray', priority: 'bogus' })
      .expect(201);
    expect(mockModelExists).toHaveBeenCalledWith('Script', { _id: ENTITY, userId: USER });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'script', entityId: ENTITY, requestedBy: USER, requestedFrom: USER,
      priority: 'medium', message: "Script: don't post & pray",
    }));
    expect(res.body.data._id).toBe(REQ_ID);
  });

  it('404s when the entity is not the caller\'s (no approvals on other people\'s content)', async () => {
    mockModelExists.mockResolvedValue(null);
    await request(app).post('/api/approvals').send({ entityType: 'content', entityId: ENTITY }).expect(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    [{ entityType: 'video', entityId: ENTITY }],
    [{ entityType: 'script', entityId: 'nope' }],
    [{ entityType: 'script', entityId: { $ne: null } }],
  ])('400s on invalid input %j', async (body) => {
    await request(app).post('/api/approvals').send(body).expect(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('routes to a named approver only if that user exists', async () => {
    mockModelExists.mockResolvedValue({ _id: ENTITY });
    mockUserExists.mockResolvedValue(null);
    await request(app).post('/api/approvals').send({ entityType: 'script', entityId: ENTITY, requestedFrom: OTHER }).expect(404);
    mockUserExists.mockResolvedValue({ _id: OTHER });
    mockCreate.mockResolvedValue({ _id: REQ_ID });
    await request(app).post('/api/approvals').send({ entityType: 'script', entityId: ENTITY, requestedFrom: OTHER }).expect(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ requestedFrom: OTHER }));
  });

  it('maps a team-permission error to 403', async () => {
    mockModelExists.mockResolvedValue({ _id: ENTITY });
    mockCreate.mockRejectedValue(new Error('Insufficient permissions to request approval'));
    await request(app).post('/api/approvals').send({ entityType: 'script', entityId: ENTITY }).expect(403);
  });
});

describe('approve / reject / cancel dispatch', () => {
  it('approves an ApprovalRequest via approvalService with the page\'s `response` field', async () => {
    mockExists.mockResolvedValue({ _id: REQ_ID });
    mockApprove.mockResolvedValue({ _id: REQ_ID, status: 'approved' });
    await request(app).post(`/api/approvals/${REQ_ID}/approve`).send({ response: 'looks good' }).expect(200);
    expect(mockApprove).toHaveBeenCalledWith(REQ_ID, USER, 'looks good');
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it('rejects an ApprovalRequest without requiring rejectionReason', async () => {
    mockExists.mockResolvedValue({ _id: REQ_ID });
    mockReject.mockResolvedValue({ _id: REQ_ID, status: 'rejected' });
    await request(app).post(`/api/approvals/${REQ_ID}/reject`).send({ response: 'hook is weak' }).expect(200);
    expect(mockReject).toHaveBeenCalledWith(REQ_ID, USER, 'hook is weak');
  });

  it('cancels an ApprovalRequest via approvalService', async () => {
    mockExists.mockResolvedValue({ _id: REQ_ID });
    mockCancel.mockResolvedValue({ _id: REQ_ID, status: 'cancelled' });
    await request(app).post(`/api/approvals/${REQ_ID}/cancel`).send({}).expect(200);
    expect(mockCancel).toHaveBeenCalledWith(REQ_ID, USER);
    expect(mockCancelApproval).not.toHaveBeenCalled();
  });

  it.each([
    ['Unauthorized to approve this request', 403],
    ['Request is not pending', 409],
  ])('maps "%s" to %d', async (msg, status) => {
    mockExists.mockResolvedValue({ _id: REQ_ID });
    mockApprove.mockRejectedValue(new Error(msg));
    await request(app).post(`/api/approvals/${REQ_ID}/approve`).send({}).expect(status);
  });

  it('leaves multi-step workflow approvals on their existing path', async () => {
    mockExists.mockResolvedValue(null);
    mockAdvance.mockResolvedValue({ _id: WF_ID });
    await request(app).post(`/api/approvals/${WF_ID}/approve`).send({ comment: 'ok' }).expect(200);
    expect(mockAdvance).toHaveBeenCalledWith(WF_ID, USER, 'approve', 'ok');
    expect(mockApprove).not.toHaveBeenCalled();

    // Multi-step reject still requires its reason.
    await request(app).post(`/api/approvals/${WF_ID}/reject`).send({}).expect(400);
    mockCancelApproval.mockResolvedValue({ _id: WF_ID });
    await request(app).post(`/api/approvals/${WF_ID}/cancel`).send({}).expect(200);
    expect(mockCancelApproval).toHaveBeenCalledWith(WF_ID, USER);
  });
});

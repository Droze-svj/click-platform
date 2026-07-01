// Advanced Workflow Automation Service Tests

const Workflow = require('../../../server/models/Workflow');
const {
  createWorkflow,
  executeWorkflow,
  getWorkflowHistory,
  getWorkflowAnalytics,
  validateWorkflow
} = require('../../../server/services/advancedWorkflowService');

jest.mock('../../../server/models/Workflow');
jest.mock('../../../server/services/jobQueueService', () => ({
  addJob: jest.fn().mockResolvedValue({ id: 'job-123' })
}));

describe('Advanced Workflow Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A realistic fetch Response exposes BOTH text() and json(); callWebhook now
    // reads text() (so a plain-text webhook reply doesn't throw) then best-effort
    // JSON.parses it — the mock must provide text() to match real fetch.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ success: true, data: 'webhook_received' })),
      json: () => Promise.resolve({ success: true, data: 'webhook_received' })
    });
  });

  describe('validateWorkflow', () => {
    it('should validate a correct workflow definition', () => {
      const nodes = [
        { id: 'start-1', type: 'start' },
        { id: 'action-1', type: 'action' }
      ];
      const edges = [
        { source: 'start-1', target: 'action-1' }
      ];

      expect(() => validateWorkflow(nodes, edges)).not.toThrow();
    });

    it('should throw an error if there are no nodes', () => {
      expect(() => validateWorkflow([], [])).toThrow('Workflow must have at least one node');
    });

    it('should throw an error if start node is missing', () => {
      const nodes = [{ id: 'action-1', type: 'action' }];
      expect(() => validateWorkflow(nodes, [])).toThrow('Workflow must have a start node');
    });

    it('should throw an error if edge connects to a non-existent node', () => {
      const nodes = [
        { id: 'start-1', type: 'start' },
        { id: 'action-1', type: 'action' }
      ];
      const edges = [
        { source: 'start-1', target: 'non-existent' }
      ];

      expect(() => validateWorkflow(nodes, edges)).toThrow('Invalid edge: node not found');
    });
  });

  describe('createWorkflow', () => {
    it('should create and save a new workflow definition', async () => {
      const definition = {
        userId: 'user-123',
        name: 'Test Workflow',
        nodes: [{ id: 'start-1', type: 'start' }],
        edges: []
      };

      const mockSave = jest.fn().mockResolvedValue(definition);
      Workflow.mockImplementation(() => ({
        _id: 'mock-wf-123',
        save: mockSave,
        settings: {},
        status: 'active'
      }));

      const workflow = await createWorkflow(definition);
      expect(workflow).toBeDefined();
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a full workflow sequence', async () => {
      const workflowId = 'mock-wf-123';
      const mockWorkflowData = {
        _id: workflowId,
        name: 'Test Workflow',
        definition: {
          nodes: [
            { id: 'n-start', type: 'start' },
            { id: 'n-action', type: 'action', action: { type: 'generate_content' } },
            { id: 'n-delay', type: 'delay', duration: 1 },
            { id: 'n-webhook', type: 'webhook', url: 'https://mock.com/webhook' }
          ],
          edges: [
            { source: 'n-start', target: 'n-action' },
            { source: 'n-action', target: 'n-delay' },
            { source: 'n-delay', target: 'n-webhook' }
          ]
        }
      };

      Workflow.findById.mockResolvedValue(mockWorkflowData);

      const result = await executeWorkflow(workflowId, { originalInput: 'hello' });

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe(workflowId);
      expect(result.result).toHaveProperty('n-start');
      expect(result.result).toHaveProperty('n-action');
      expect(result.result).toHaveProperty('n-delay');
      expect(result.result).toHaveProperty('n-webhook');
      
      expect(global.fetch).toHaveBeenCalledWith('https://mock.com/webhook', expect.any(Object));
    });

    it('should fail if workflow is not found', async () => {
      Workflow.findById.mockResolvedValue(null);
      await expect(executeWorkflow('non-existent')).rejects.toThrow('Workflow not found');
    });
  });

  describe('getWorkflowHistory & getWorkflowAnalytics', () => {
    it('should track and return workflow history and metrics correctly', async () => {
      const workflowId = '507f1f77bcf86cd799439011';
      const mockWorkflowData = {
        _id: workflowId,
        name: 'Test Workflow',
        definition: {
          nodes: [{ id: 'n-start', type: 'start' }],
          edges: []
        }
      };

      Workflow.findById.mockResolvedValue(mockWorkflowData);

      // Run execution once to generate history
      await executeWorkflow(workflowId, { val: 1 });

      const history = getWorkflowHistory(workflowId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].step).toBe('start');

      const analytics = await getWorkflowAnalytics(workflowId);
      expect(analytics.totalExecutions).toBe(1);
      expect(analytics.successRate).toBe(100);
    });
  });
});

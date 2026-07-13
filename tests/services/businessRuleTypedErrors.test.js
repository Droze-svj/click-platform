// Guards the Category-C fix: business-rule violations that previously threw a
// plain Error (mapped to 500) now throw typed AppError subclasses so the API
// returns the right 4xx. validateWorkflow is pure + exported, so it's asserted
// directly here; the route-level guards for the empty-body 500s are covered by
// the live write-sweep.

const { validateWorkflow } = require('../../server/services/advancedWorkflowService');
const { ValidationError } = require('../../server/utils/errorHandler');

describe('advancedWorkflowService.validateWorkflow typed error', () => {
  it('throws a ValidationError (statusCode 400) for an empty node list', () => {
    expect(() => validateWorkflow([], [])).toThrow(ValidationError);
    try {
      validateWorkflow([], []);
    } catch (e) {
      expect(e.statusCode).toBe(400);
      expect(e.message).toMatch(/at least one node/i);
    }
  });

  it('throws ValidationError (400) when the start node is missing', () => {
    try {
      validateWorkflow([{ id: 'n1', type: 'action' }], []);
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.statusCode).toBe(400);
    }
  });

  it('does not throw for a valid workflow with a start node', () => {
    expect(() => validateWorkflow([{ id: 'n1', type: 'start' }], [])).not.toThrow();
  });
});

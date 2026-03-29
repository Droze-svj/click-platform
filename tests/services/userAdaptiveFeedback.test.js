const feedbackService = require('../../server/services/UserAdaptiveFeedbackService');

describe('UserAdaptiveFeedbackService Strategy Persistence', () => {
  const userId = 'user-strategy-test-123';

  test('should set and get the strategic goal for a user', async () => {
    await feedbackService.setStrategicGoal(userId, 'sales');
    const goal = feedbackService.getStrategicGoal(userId);
    expect(goal).toBe('sales');
  });

  test('should return default viral goal if none set', () => {
    const goal = feedbackService.getStrategicGoal('new-user-456');
    expect(goal).toBe('viral');
  });

  test('should persist goal across multiple calls', async () => {
    await feedbackService.setStrategicGoal(userId, 'education');
    expect(feedbackService.getStrategicGoal(userId)).toBe('education');
    
    await feedbackService.setStrategicGoal(userId, 'authority');
    expect(feedbackService.getStrategicGoal(userId)).toBe('authority');
  });
});

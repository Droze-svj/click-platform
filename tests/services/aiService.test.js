const aiService = require('../../server/services/aiService');
const googleAI = require('../../server/utils/googleAI');
const adaptiveFeedback = require('../../server/services/UserAdaptiveFeedbackService');

jest.mock('../../server/utils/googleAI');
jest.mock('../../server/services/UserAdaptiveFeedbackService');

describe('aiService Strategy Injection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    googleAI.isConfigured = true;
  });

  test('generateCaptions should incorporate strategicGoal from adaptiveFeedback', async () => {
    adaptiveFeedback.getStrategicGoal.mockReturnValue('sales');
    googleAI.generateContent.mockResolvedValue('Sales focused caption');

    const result = await aiService.generateCaptions('Sell this boat', 'Sales', { userId: 'user-123' });

    expect(adaptiveFeedback.getStrategicGoal).toHaveBeenCalledWith('user-123');
    const prompt = googleAI.generateContent.mock.calls[0][0];
    expect(prompt).toContain('Strategic Aim: Prioritize benefit-driven clarity over visual flair.');
    expect(result).toBe('Sales focused caption');
  });

  test('generateCaptions should default to viral goal if no userId provided', async () => {
    googleAI.generateContent.mockResolvedValue('Viral caption');

    await aiService.generateCaptions('Dance video', 'Entertainment');

    const prompt = googleAI.generateContent.mock.calls[0][0];
    expect(prompt).toContain('Strategic Aim: Maximize pattern-interrupts');
  });
});

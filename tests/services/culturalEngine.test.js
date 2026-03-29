const culturalEngine = require('../../server/services/CulturalIntelligenceService');

describe('CulturalIntelligenceService', () => {
  test('should return weighted context for viral goal', () => {
    const context = culturalEngine.getStrategicContext('viral');
    expect(context.humor).toBeGreaterThan(0.7);
    expect(context.boldness).toBeGreaterThan(0.7);
    expect(context.directives).toContain('Identify or create a high-impact pattern-interrupt in the first 1.5 seconds.');
  });

  test('should return stability-focused context for sales goal', () => {
    const context = culturalEngine.getStrategicContext('sales');
    expect(context.humor).toBeLessThan(0.6);
    expect(context.boldness).toBeLessThan(0.7);
    expect(context.directives).toContain('Prioritize benefit-driven clarity over visual flair.');
  });

  test('should return correct visual strategy for education', () => {
    const strategy = culturalEngine.getVisualStrategy('education');
    expect(strategy.effects).toContain('Ken Burns In');
    expect(strategy.brand.behavior).toBe('clarity-first');
  });

  test('should return appropriate niche keywords for Wealth Management', () => {
    const keywords = culturalEngine.getNicheAssetKeywords('Wealth Management');
    expect(keywords).toContain('minimalist architectural detail');
    expect(keywords).toContain('premium materials');
  });
});

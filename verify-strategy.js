const feedbackService = require('./server/services/UserAdaptiveFeedbackService');
const culturalEngine = require('./server/services/CulturalIntelligenceService');

async function verify() {
  console.log('--- VERIFYING STRATEGIC STEERING ---');
  
  const userId = 'verify-user-789';
  console.log('Setting goal to SALE...');
  await feedbackService.setStrategicGoal(userId, 'sales');
  
  const goal = feedbackService.getStrategicGoal(userId);
  console.log('Retrieved goal:', goal);
  
  const context = culturalEngine.getStrategicContext('Lifestyle', 'bold', goal);
  console.log('Context Strategic Aim:', context.strategy);
  
  const strategy = culturalEngine.getVisualStrategy(goal);
  console.log('Recommended Effects for SALES:', strategy.effects.join(', '));
  
  console.log('\n--- VERIFYING VIRAL GOAL ---');
  const viralContext = culturalEngine.getStrategicContext('Lifestyle', 'bold', 'viral');
  console.log('Context Strategic Aim:', viralContext.strategy);
  
  const viralStrategy = culturalEngine.getVisualStrategy('viral');
  console.log('Recommended Effects for VIRAL:', viralStrategy.effects.join(', '));
  
  console.log('\n--- VERIFYING NICHE EXPERTISE ---');
  const keywords = culturalEngine.getNicheAssetKeywords('Luxury Real Estate');
  console.log('Keywords for Luxury Real Estate:', keywords.join(', '));
}

verify().catch(console.error);

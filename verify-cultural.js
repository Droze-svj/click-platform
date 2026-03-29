const culturalEngine = require('./server/services/CulturalIntelligenceService');

async function verify() {
  console.log('--- VERIFYING CULTURAL INTELLIGENCE (FIXED) ---');
  
  const viralContext = await culturalEngine.getStrategicContext('Lifestyle', 'bold', 'viral');
  console.log('Viral Strategic Aim (Expect high-growth):', viralContext.strategy);
  
  const viralStrategy = culturalEngine.getVisualStrategy('viral');
  console.log('Viral Effects (Expect Jitter/Zoom):', viralStrategy.effects.join(', '));
  
  const keywords = culturalEngine.getAssetKeywords('Lifestyle', 'viral');
  console.log('Lifestyle Viral Keywords:', keywords.slice(0, 3).join(', '));
  
  const salesStrategy = culturalEngine.getVisualStrategy('sales');
  console.log('Sales Effects (Expect Vignette/Push):', salesStrategy.effects.join(', '));
}

verify().catch(console.error);

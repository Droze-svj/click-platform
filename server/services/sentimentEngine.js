const logger = require('../utils/logger');
const { generateContent } = require('../utils/googleAI');

/**
 * Phase 20: Sentiment Analysis Engine
 * High-fidelity community vibe detection using Spectral classification.
 */
class SentimentEngine {
  /**
   * Analyze the "Social Vibe" of a batch of comments
   * Categories: Equilibrium (Neutral), Resonance (Positive), Diffraction (Negative), Kinetic (Hype)
   */
  async analyzeVibe(comments, sensitivity = 'high') {
    if (!comments || comments.length === 0) {
      return { overallVibe: 'Equilibrium', potency: 0, categories: {} };
    }

    try {
      const commentBatch = comments.map(c => c.text).join('\n---\n');
      
      const prompt = `Analyze the sentiment and community "vibe" of these comments.
      Sensitivity Setting: ${sensitivity} (Hyper-Sensitive to minor shifts)
      
      Comments:
      ${commentBatch}
      
      Classify the overall community state into:
      - REACHING RESONANCE (High positivity, brand affinity)
      - STEADY EQUILIBRIUM (Balanced, neutral, informative)
      - DETECTING DIFFRACTION (Cynicism, doubt, minor negativity)
      - KINETIC PULSE (High hype, viral excitement)
      - TOXIC SATURATION (Significant negativity, burnout)
      
      Return a JSON object with:
      - overallVibe (the classification above)
      - potencyScore (0-100)
      - shiftDirection (one of: rising, falling, stable)
      - topArchetypes (array of themes like "Price Doubt", "Feature Hype", etc.)
      - diffractionDetected (boolean: true if cynicism/negativity is present even in small amounts)
      
      Return only valid JSON.`;

      const response = await generateContent(prompt, { maxTokens: 800 });
      const result = JSON.parse(response || '{}');

      logger.info('Phase 20: Community Vibe Synthesized', { 
        vibe: result.overallVibe, 
        potency: result.potencyScore,
        sensitivity 
      });

      return {
        overallVibe: result.overallVibe || 'Equilibrium',
        potency: result.potencyScore || 0,
        direction: result.shiftDirection || 'stable',
        archetypes: result.topArchetypes || [],
        diffractionDetected: result.diffractionDetected || false,
        analyzedAt: new Date()
      };
    } catch (error) {
      logger.error('Sentiment Analysis failed', { error: error.message });
      return { overallVibe: 'Equilibrium', potency: 50, direction: 'stable' };
    }
  }
}

module.exports = new SentimentEngine();

class CulturalIntelligenceService {
  getStrategicContext(nicheOrGoal, tone = null, goal = null) {
    // Handle overload where first param is goal
    const targetGoal = goal || (['viral', 'sales', 'education'].includes(nicheOrGoal) ? nicheOrGoal : 'viral');

    if (targetGoal === 'viral') {
      return {
        strategy: 'High energy growth content with high trend alignment',
        humor: 0.85,
        boldness: 0.9,
        directives: [
          'Identify or create a high-impact pattern-interrupt in the first 1.5 seconds.',
          'Inject dynamic pacing changes and high contrast graphics.'
        ]
      };
    } else if (targetGoal === 'sales') {
      return {
        strategy: 'Stability and clarity-focused high conversion content',
        humor: 0.4,
        boldness: 0.5,
        directives: [
          'Prioritize benefit-driven clarity over visual flair.',
          'State value proposition clearly in the first 3 seconds.'
        ]
      };
    } else {
      // education or other
      return {
        strategy: 'Information-dense clarity and structure',
        humor: 0.5,
        boldness: 0.4,
        directives: [
          'Break complex topics into simple steps.',
          'Maintain clean layout and typography.'
        ]
      };
    }
  }

  getVisualStrategy(goal) {
    if (goal === 'viral') {
      return {
        effects: ['Jitter', 'Zoom', 'Glitch', 'Flash'],
        brand: {
          behavior: 'dynamic'
        }
      };
    } else if (goal === 'sales') {
      return {
        effects: ['Vignette', 'Push', 'Slow Zoom'],
        brand: {
          behavior: 'professional'
        }
      };
    } else if (goal === 'education') {
      return {
        effects: ['Ken Burns In', 'Pan', 'Fade'],
        brand: {
          behavior: 'clarity-first'
        }
      };
    } else {
      return {
        effects: ['Fade'],
        brand: {
          behavior: 'clarity-first'
        }
      };
    }
  }

  getAssetKeywords(niche, _goal) {
    if (niche === 'Lifestyle') {
      return ['candid styling', 'natural lighting', 'vivid aesthetic'];
    }
    return ['premium product', 'lifestyle fit'];
  }

  getNicheAssetKeywords(niche) {
    if (niche === 'Wealth Management' || niche === 'Luxury Real Estate') {
      return [
        'minimalist architectural detail',
        'premium materials',
        'high end luxury space',
        'quiet wealth'
      ];
    }
    return ['clean layout', 'modern aesthetic'];
  }
}

module.exports = new CulturalIntelligenceService();

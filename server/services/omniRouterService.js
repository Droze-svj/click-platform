const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * OmniModelRouterService
 * Solves "Model Lock-in" by routing scenes to the best AI model per scene.
 * Includes a high-fidelity Simulator Mode for testing.
 */

const MODEL_REGISTRY = {
  'runway-gen4': {
    id: 'runway-gen4',
    label: 'Runway Gen-4',
    provider: 'RunwayML',
    specialty: 'cinematic_broll',
    strengths: ['high_consistency', 'lighting_precision', 'fluid_motion'],
    costPerSegment: 0.25,
    avgLatencyMs: 12000
  },
  'kling-v2': {
    id: 'kling-v2',
    label: 'Kling v2.0',
    provider: 'Kuaishou',
    specialty: 'character_performance',
    strengths: ['organic_physics', 'facial_expression', 'hand_render'],
    costPerSegment: 0.18,
    avgLatencyMs: 18000
  },
  'sora-v2': {
    id: 'sora-v2',
    label: 'OpenAI Sora v2',
    provider: 'OpenAI',
    specialty: 'complex_narrative',
    strengths: ['spatial_awareness', 'long_tracking', 'physics_accuracy'],
    costPerSegment: 0.45,
    avgLatencyMs: 45000
  },
  'elevenlabs-v3': {
    id: 'elevenlabs-v3',
    label: 'ElevenLabs v3 Mono',
    provider: 'ElevenLabs',
    specialty: 'human_voice',
    strengths: ['inflection_accuracy', 'emotional_range', 'multi_voice'],
    costPerSegment: 0.05,
    avgLatencyMs: 2500
  },
  'sovereign-native': {
    id: 'sovereign-native',
    label: 'Sovereign Native 1B',
    provider: 'Internal',
    specialty: 'rapid_variant',
    strengths: ['zero_latency', 'cost_effective', 'batch_safe'],
    costPerSegment: 0.01,
    avgLatencyMs: 500
  }
};

class OmniModelRouterService {
  /**
   * Get all available models for the router
   */
  getAvailableModels() {
    return Object.values(MODEL_REGISTRY);
  }

  /**
   * Route scenes to the best performing model based on semantics
   */
  async routeBatch(scenes) {
    logger.info('Omni-Router: Routing scene batch', { count: scenes.length });
    
    const manifest = {
      batchId: `batch_${crypto.randomBytes(4).toString('hex')}`,
      scenes: [],
      totalEstimatedCost: 0,
      totalEstimatedLatencyMs: 0
    };

    for (const scene of scenes) {
      const assignment = this.selectBestModel(scene);
      const model = MODEL_REGISTRY[assignment];
      
      manifest.scenes.push({
        originalScene: scene,
        assignedModel: assignment,
        modelLabel: model.label,
        sceneType: scene.type || 'general',
        confidence: this.scoreModelConfidence(scene, assignment),
        simulated: true
      });

      manifest.totalEstimatedCost += model.costPerSegment;
      manifest.totalEstimatedLatencyMs += model.avgLatencyMs;
    }

    return manifest;
  }

  /**
   * Internal heuristic for model selection
   */
  selectBestModel(scene) {
    const desc = (scene.description || '').toLowerCase();
    const type = scene.type?.toLowerCase();

    if (type === 'voice' || desc.includes('speaks') || desc.includes('narrates')) {
      return 'elevenlabs-v3';
    }
    
    if (type === 'character' || desc.includes('face') || desc.includes('human')) {
      return 'kling-v2';
    }

    if (desc.includes('city') || desc.includes('landscape') || desc.includes('b-roll')) {
      return 'runway-gen4';
    }

    if (desc.includes('complex') || desc.includes('tracking') || desc.includes('physics')) {
      return 'sora-v2';
    }

    return 'sovereign-native';
  }

  /**
   * Deterministic routing confidence derived from how the assignment was made:
   * an explicit scene.type match is the strongest signal, a description-keyword
   * match is moderate, and the catch-all fallback is the weakest. No randomness.
   */
  scoreModelConfidence(scene, assignment) {
    const desc = (scene.description || '').toLowerCase();
    const type = scene.type?.toLowerCase();
    if (assignment === 'sovereign-native') return 0.6; // catch-all fallback
    // Explicit type match (voice/character) is the strongest signal.
    if ((type === 'voice' && assignment === 'elevenlabs-v3') ||
        (type === 'character' && assignment === 'kling-v2')) {
      return 0.95;
    }
    // Count how many routing keywords for the assigned model appear — more
    // matches = higher confidence.
    const keywordSets = {
      'elevenlabs-v3': ['speaks', 'narrates', 'voice'],
      'kling-v2': ['face', 'human', 'character'],
      'runway-gen4': ['city', 'landscape', 'b-roll'],
      'sora-v2': ['complex', 'tracking', 'physics'],
    };
    const hits = (keywordSets[assignment] || []).filter(k => desc.includes(k) || type === k).length;
    return Math.min(0.92, 0.78 + hits * 0.05);
  }

  /**
   * Cost/latency PLANNER only — this router estimates which model to use; it does
   * NOT generate media. It returns an honest `unavailable` (no fabricated asset
   * URL — owner's #1 rule). Real generation goes through the provider-wired
   * services (textToVideoService, imageGenerationService, etc.).
   */
  async simulateGeneration(modelId, prompt) {
    const model = MODEL_REGISTRY[modelId];
    if (!model) throw new Error(`Model ${modelId} not found in registry`);

    logger.info(`Omni-Router: generation requested for ${modelId} (planner only)`, { prompt });

    return {
      success: false,
      status: 'unavailable',
      assetUrl: null,
      model: model.label,
      provider: model.provider,
      error: 'Omni-Router is a model planner; route generation to a provider-wired service (textToVideoService / imageGenerationService).',
      metrics: {
        estLatencyMs: model.avgLatencyMs,
        estCost: model.costPerSegment
      }
    };
  }
}

module.exports = new OmniModelRouterService();

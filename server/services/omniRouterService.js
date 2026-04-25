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
        confidence: 0.85 + Math.random() * 0.1,
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
    const desc = scene.description.toLowerCase();
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
   * Simulator: Mimic a real generation output
   */
  async simulateGeneration(modelId, prompt) {
    const model = MODEL_REGISTRY[modelId];
    if (!model) throw new Error(`Model ${modelId} not found in registry`);

    logger.info(`Omni-Router: Simulating generation for ${modelId}`, { prompt });

    // Artificial Latency
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    return {
      success: true,
      assetUrl: `https://simulator.sovereign.ai/assets/${crypto.randomBytes(8).toString('hex')}.mp4`,
      model: model.label,
      provider: model.provider,
      generationId: `gen_${crypto.randomBytes(8).toString('hex')}`,
      metrics: {
        latencyMs: model.avgLatencyMs + (Math.random() - 0.5) * 1000,
        cost: model.costPerSegment
      }
    };
  }
}

module.exports = new OmniModelRouterService();

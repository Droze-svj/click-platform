const logger = require('../utils/logger');
const swarmIntelligence = require('./swarmIntelligenceService');
const crypto = require('crypto');

/**
 * StyleDNAMiningService
 * Autonomous stylistic extraction engine for Phase 17.
 * Translates swarm tactics into reproducible Style DNA.
 */

class StyleDNAMiningService {
  constructor() {
    this.extractedPatterns = [];
    this.creativeRandomness = 0.2; // Default 20% randomness
  }

  /**
   * Set the Creative Randomness (0.0 to 1.0)
   */
  setCreativeRandomness(value) {
    this.creativeRandomness = Math.max(0, Math.min(1, value));
    logger.info(`StyleDNA: Creative Randomness adjusted to ${this.creativeRandomness * 100}%`);
  }

  /**
   * Mine the Swarm Intelligence ledger for Stylistic DNA
   */
  async mineExpertStyleDNA(userId, niche = 'general') {
    logger.info('StyleDNA: Mining swarm for tactical patterns', { niche });

    const pulse = await swarmIntelligence.getPulse(niche);
    const signals = pulse.snapshot.trendingSignals;

    // 1. Pattern Extraction Logic
    const rawDNA = signals.map(signal => {
      return {
        id: `dna_${crypto.randomBytes(4).toString('hex')}`,
        markerName: signal.tactic,
        strength: signal.viralScore,
        attributes: this.deriveAttributesFromTactic(signal.tactic, signal.description),
        timestamp: new Date()
      };
    });

    // 2. Genetic markers reflect the REAL swarm signal strengths. We do not
    // fabricate random "mutation" jitter on the returned strength values —
    // there is no real source for synthetic variance, so markers are emitted
    // at their true viral strength and flagged as un-mutated.
    const geneticMarkers = rawDNA.map(marker => ({
      ...marker,
      strength: Math.max(0.1, Math.min(0.99, marker.strength)),
      isMutated: false
    }));

    // 3. Consensus stability is a REAL computation: the mean strength across
    // the mined markers (how strongly the swarm agrees on these tactics).
    // With no markers there is nothing to agree on, so it is honestly 0.
    const consensusStability = geneticMarkers.length
      ? geneticMarkers.reduce((sum, m) => sum + m.strength, 0) / geneticMarkers.length
      : 0;

    return {
      niche,
      geneticMarkers,
      consensusStability,
      recommendation: `Stylistic mix derived from ${geneticMarkers.length} swarm marker(s) at ${this.creativeRandomness * 100}% configured creative variance.`
    };
  }

  /**
   * Deep analysis of tactic descriptions to extract visual markers
   */
  deriveAttributesFromTactic(name, description) {
    const attrs = {};
    const lower = (name + ' ' + description).toLowerCase();

    if (lower.includes('low-fi') || lower.includes('raw')) attrs.pacing = 'organic';
    if (lower.includes('speed-edit') || lower.includes('rapid')) attrs.pacing = 'aggressive';
    if (lower.includes('frame-sync')) attrs.sync = 'audio_reactive';
    if (lower.includes('spatial') || lower.includes('seamless')) attrs.transitions = 'complex';
    if (lower.includes('minimalist') || lower.includes('clean')) attrs.aesthetic = 'minimalist';

    return attrs;
  }
}

module.exports = new StyleDNAMiningService();

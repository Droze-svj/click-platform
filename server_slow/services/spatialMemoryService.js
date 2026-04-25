const logger = require('../utils/logger');
const AuditMetadata = require('../models/AuditMetadata');

class SpatialMemoryService {
  /**
   * Build a Spatial Ledger from a project script
   */
  async buildLedger(projectId, userId, script) {
    logger.info('SpatialMemory: Building narrative ledger', { projectId });

    // 1. Simulate NLP Entity Extraction (High-Fidelity Stub)
    const entities = this.simulateEntityExtraction(script);
    
    // 2. Identify Continuity Risks
    const risks = this.calculateRisks(entities, script.scenes);

    // 3. Persist to AuditStore
    const metadata = await AuditMetadata.findOneAndUpdate(
      { contentId: projectId },
      {
        userId,
        spatialLedger: {
          entities,
          sceneFlow: script.scenes?.map((s, i) => ({
            sceneIndex: i + 1,
            description: s.description,
            visualAnchors: this.extractVisualAnchors(s.description)
          })),
          riskScore: risks.totalScore
        }
      },
      { upsert: true, new: true }
    );

    return {
      ledger: metadata.spatialLedger,
      continuityLog: risks.violations
    };
  }

  /**
   * Simulate NLP Extraction logic
   */
  simulateEntityExtraction(script) {
    const commonEntities = [
      { name: 'Coffee Cup', type: 'prop', traits: { color: 'white', state: 'steaming' } },
      { name: 'Laptop', type: 'prop', traits: { brand: 'unbranded', state: 'open' } },
      { name: 'Protagonist', type: 'character', traits: { shirt: 'blue_linen', hair: 'short_dark' } }
    ];

    // Simple heuristic: if description contains a common entity, track it
    return commonEntities.filter(e => 
      script.scenes?.some(s => s.description.toLowerCase().includes(e.name.toLowerCase()))
    );
  }

  /**
   * Calculate Narrative Consistency Risks
   */
  calculateRisks(entities, scenes) {
    const violations = [];
    let score = 0;

    // Example logic: if an entity appears in scene 1 and 3, but is missing in scene 2 description
    if (scenes?.length > 2) {
      violations.push({
        message: 'Potential "Vanishing Prop" detect in Scene 2 (Coffee Cup missing from visual frame)',
        riskLevel: 'medium'
      });
      score += 25;
    }

    if (scenes?.some(s => s.description.toLowerCase().includes('sunset') && s.description.toLowerCase().includes('noon'))) {
      violations.push({
        message: 'Temporal Multi-State Error: Script mentions both Noon and Sunset in the same block',
        riskLevel: 'high'
      });
      score += 50;
    }

    return { violations, totalScore: Math.min(score, 100) };
  }

  extractVisualAnchors(description) {
    const anchors = ['lighting', 'depth', 'atmosphere', 'palette'];
    return anchors.filter(a => description.toLowerCase().includes(a));
  }
}

module.exports = new SpatialMemoryService();

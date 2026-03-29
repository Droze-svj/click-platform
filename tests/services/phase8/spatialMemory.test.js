const SpatialMemoryService = require('../../../server/services/SpatialMemoryService');

describe('SpatialMemoryService', () => {
    test('should build a spatial ledger from a script', async () => {
        const script = {
            id: 'video_123',
            scenes: [
                { id: 's1', description: 'Agent sits at laptop with coffee cup' },
                { id: 's2', description: 'Wide shot of agent at the desk' }
            ]
        };
        
        const result = await SpatialMemoryService.buildSpatialLedger(script, 'p_001');
        
        expect(result.success).toBe(true);
        expect(result.ledger.scenes.length).toBe(2);
        expect(result.ledger.globalEntities['coffee cup']).toBeDefined();
        expect(result.ledger.globalEntities['laptop']).toBeDefined();
    });

    test('should detect missing props in subsequent scenes', () => {
        const ledger = {
            projectId: 'p_001',
            globalEntities: {
                'coffee cup': { sceneIds: ['s1'], lastSeenIn: 's1', visualTraits: [], persistent: true }
            },
            scenes: [
                { id: 's1', entities: ['coffee cup'] },
                { id: 's2', entities: [] } // Missing coffee cup
            ]
        };

        const result = SpatialMemoryService.validateSceneAgainstLedger({ description: 'Agent speaks' }, ledger, 1);
        
        expect(result.riskScore).toBeGreaterThan(0);
        expect(result.continuityLog.some(log => log.message.includes('coffee cup'))).toBe(true);
    });

    test('should maintain character visual traits across scenes', () => {
        const ledger = {
            projectId: 'p_001',
            globalEntities: {
                'agent': { 
                    sceneIds: ['s1'], 
                    lastSeenIn: 's1', 
                    visualTraits: ['blue hoodie', 'shorthair'], 
                    persistent: true 
                }
            },
            scenes: [
                { id: 's1', entities: ['agent'] }
            ]
        };

        const result = SpatialMemoryService.validateSceneAgainstLedger({ description: 'Agent walks' }, ledger, 1);
        
        // Should suggest character consistency in the enriched description
        expect(result.enrichedDescription).toContain('blue hoodie');
        expect(result.enrichedDescription).toContain('shorthair');
    });
});

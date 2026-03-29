const OmniModelRouter = require('../../../server/services/OmniModelRouter');

describe('OmniModelRouter', () => {
    test('should return model registry', () => {
        const registry = OmniModelRouter.getModelRegistry();
        expect(registry.success).toBe(true);
        expect(Array.isArray(registry.models)).toBe(true);
        expect(registry.totalModels).toBeGreaterThan(0);
    });

    test('should route storyboard scenes to specialized models', async () => {
        const scenes = [
            { description: 'Cinematic B-roll of sunset', type: 'broll' },
            { description: 'Talking head interview', type: 'character' },
            { description: 'Calm narration', type: 'voice' }
        ];
        
        const result = await OmniModelRouter.routeStoryboard(scenes);
        
        expect(result.success).toBe(true);
        expect(result.manifest.scenes.length).toBe(3);
        
        // B-roll should go to high fidelity video model
        const brollScene = result.manifest.scenes.find(s => s.sceneType === 'broll');
        expect(['runway-gen4', 'kling-v2', 'sora-v2']).toContain(brollScene.assignedModel);
        
        // Voice should go to audio specialized model
        const voiceScene = result.manifest.scenes.find(s => s.sceneType === 'voice');
        expect(voiceScene.assignedModel).toBe('elevenlabs-v3');
    });

    test('should respect budget constraints during routing', async () => {
        const scenes = [{ description: 'High quality video', type: 'broll' }];
        const options = { budgetLimit: 0.01 }; // Very low budget
        
        const result = await OmniModelRouter.routeStoryboard(scenes, options);
        
        expect(result.success).toBe(true);
        expect(result.manifest.totalEstimatedCost).toBeLessThanOrEqual(0.01);
        expect(result.manifest.scenes[0].assignedModel).toBe('sovereign-native');
    });
});

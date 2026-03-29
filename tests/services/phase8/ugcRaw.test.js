const UGCRawSynthesizerService = require('../../../server/services/UGCRawSynthesizerService');

describe('UGCRawSynthesizerService', () => {
    test('should inject SSML fillers into scripts based on intensity', () => {
        const script = 'I love this product. It is great for growth.';
        
        const subtle = UGCRawSynthesizerService.injectAudioFillers(script, { intensity: 'subtle' });
        const heavy = UGCRawSynthesizerService.injectAudioFillers(script, { intensity: 'heavy' });
        
        expect(subtle).toContain('<speak>');
        expect(subtle).toContain('<prosody');
        expect(heavy.length).toBeGreaterThan(subtle.length); // Heavy should have more breaks/fillers
        
        // At least one filler should be present in heavy mode
        expect(heavy.includes('<break') || heavy.includes('<amazon:breath')).toBe(true);
    });

    test('should generate a valid video degradation manifest for raw testimonials', () => {
        const manifest = UGCRawSynthesizerService.generateVideoDegradationManifest('raw-testimonial', { intensity: 'heavy' });
        
        expect(manifest.profile).toBe('raw-testimonial');
        expect(manifest.video.stabilizationStrength).toBe(0); // Zero stabilization for authenticity
        expect(manifest.video.shakeAmplitudePx).toBeGreaterThan(0);
        expect(manifest.authenticityScore).toBeGreaterThanOrEqual(90); // Heavy intensity = high authenticity
        
        // Casing typos check
        expect(manifest.captionHumanization.occasionalTypos).toBe(true);
    });

    test('should generate a batch of variants for scale testing', () => {
        const script = 'Growth is hard but Click makes it easy.';
        const batch = UGCRawSynthesizerService.generateUGCVariantBatch(script, 5, 'on-the-go');
        
        expect(batch.success).toBe(true);
        expect(batch.variants.length).toBe(5);
        expect(batch.variants[0].humanizedScript).toContain('<speak>');
        expect(batch.variants[0].degradationManifest.pacing.baseCutFrequencySeconds).toBe(1.8); // on-the-go is faster
    });
});

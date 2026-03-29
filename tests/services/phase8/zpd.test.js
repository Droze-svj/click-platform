const ZeroPartyDataService = require('../../../server/services/ZeroPartyDataService');

describe('ZeroPartyDataService', () => {
    test('should generate an interactive overlay manifest for TikTok', async () => {
        const videoData = { targetPlatform: 'tiktok', niche: 'beauty', durationSeconds: 60 };
        const productData = { name: 'Mascara X', pricing: { price: '25', currency: 'USD' } };
        
        const result = await ZeroPartyDataService.generateOverlayManifest(videoData, { productData });
        
        expect(result.success).toBe(true);
        expect(result.manifest.targetPlatform).toBe('tiktok');
        expect(result.manifest.overlays.length).toBeGreaterThan(0);
        
        // Ensure a POLL is included as specified in auto-generation logic
        const poll = result.manifest.overlays.find(o => o.type === 'POLL');
        expect(poll).toBeDefined();
        expect(poll.content.question).toContain('Where are you');
        expect(poll.content.options.length).toBe(4);
    });

    test('should generate product hotspots for middle engagement', async () => {
        const videoData = { targetPlatform: 'instagram_reels', durationSeconds: 60 };
        const productData = { name: 'SaaS Tool', pricing: { price: '97' } };
        
        const result = await ZeroPartyDataService.generateOverlayManifest(videoData, { productData, overlayCount: 2 });
        
        const hotspot = result.manifest.overlays.find(o => o.type === 'HOTSPOT');
        expect(hotspot).toBeDefined();
        expect(hotspot.startTimeSeconds).toBe(24); // 60s * 0.4
        expect(hotspot.content.label).toBe('SaaS Tool');
    });

    test('should capture interaction events and trigger oracle feedback', async () => {
        const event = {
            overlayId: 'ov_123',
            videoId: 'vid_456',
            viewerId: 'user_789',
            response: 'yes',
            platform: 'tiktok',
            sessionData: { watchDuration: 45, watchPercentage: 75 }
        };
        
        const result = await ZeroPartyDataService.captureInteractionEvent(event);
        
        expect(result.success).toBe(true);
        expect(result.oracleFeedback).toBeDefined();
        expect(result.oracleFeedback.signalType).toBe('zero_party_interaction');
        expect(result.oracleFeedback.swarmConsensusWeight).toBe(1.8);
        expect(result.oracleFeedback.recommendedAction).toBe('reinforce_content_vector');
    });

    test('should project capture rates based on platform', () => {
        const platform = 'tiktok';
        const captureRate = ZeroPartyDataService._projectCaptureRate(platform, 1);
        expect(captureRate).toBe('12.0%');
        
        const multiple = ZeroPartyDataService._projectCaptureRate(platform, 3);
        expect(multiple).toBe('19.2%'); // 12% * (1 + 2*0.3) = 19.2%
    });
});

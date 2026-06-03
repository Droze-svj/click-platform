const ZeroPartyDataService = require('../../../server/services/ZeroPartyDataService');

describe('ZeroPartyDataService', () => {
    test('exposes the supported overlay-type catalog', () => {
        const result = ZeroPartyDataService.getOverlayTypes();
        expect(result.success).toBe(true);
        const ids = result.overlayTypes.map(t => t.id);
        expect(ids).toEqual(expect.arrayContaining(['POLL', 'SWIPE_CHOICE', 'HOTSPOT', 'RATING', 'QUIZ']));
        // Every type carries a label + description (UI renders both).
        result.overlayTypes.forEach(t => {
            expect(typeof t.label).toBe('string');
            expect(typeof t.description).toBe('string');
        });
    });

    test('generates an interactive overlay manifest for TikTok', async () => {
        const videoData = { targetPlatform: 'tiktok', niche: 'beauty', durationSeconds: 60 };
        const productData = { name: 'Mascara X', pricing: { price: '25', currency: 'USD' } };

        const result = await ZeroPartyDataService.generateOverlayManifest(videoData, { productData });

        expect(result.success).toBe(true);
        expect(result.manifest.targetPlatform).toBe('tiktok');
        expect(result.manifest.overlays.length).toBeGreaterThan(0);
        expect(typeof result.manifest.projectedCaptureRate).toBe('string');
        expect(result.manifest.projectedCaptureRate).toMatch(/%$/);

        // First overlay is a POLL with structured {id,text} options.
        const poll = result.manifest.overlays.find(o => o.type === 'POLL');
        expect(poll).toBeDefined();
        expect(typeof poll.content.question).toBe('string');
        expect(poll.content.options.length).toBeGreaterThan(0);
        poll.content.options.forEach(opt => {
            expect(opt).toHaveProperty('id');
            expect(opt).toHaveProperty('text');
        });
    });

    test('places overlays within the video timeline and respects overlayCount', async () => {
        const videoData = { targetPlatform: 'instagram_reels', durationSeconds: 60 };
        const productData = { name: 'SaaS Tool', pricing: { price: '97' } };

        const result = await ZeroPartyDataService.generateOverlayManifest(videoData, { productData, overlayCount: 2 });

        expect(result.manifest.overlays.length).toBe(2);
        // Overlays sit inside the usable window (avoiding first/last 10%).
        result.manifest.overlays.forEach(o => {
            expect(o.startTimeSeconds).toBeGreaterThanOrEqual(6);   // 10% of 60s
            expect(o.startTimeSeconds).toBeLessThanOrEqual(54);     // 90% of 60s
            expect(o.captureConfig.feedToRevenueOracle).toBe(true);
        });
    });

    test('projected capture rate is a deterministic percentage string', async () => {
        const a = await ZeroPartyDataService.generateOverlayManifest({ durationSeconds: 60 }, { overlayCount: 1 });
        const b = await ZeroPartyDataService.generateOverlayManifest({ durationSeconds: 60 }, { overlayCount: 1 });
        // Deterministic: identical inputs => identical projection (no randomness).
        expect(a.manifest.projectedCaptureRate).toBe(b.manifest.projectedCaptureRate);
        expect(a.manifest.projectedCaptureRate).toMatch(/^\d+%$/);
    });
});

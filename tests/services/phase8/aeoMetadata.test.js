const AEOMetadataService = require('../../../server/services/AEOMetadataService');

describe('AEOMetadataService', () => {
    test('should build a schema-compliant AEO payload', () => {
        const videoData = { title: 'How to Scale SaaS', targetPlatform: 'tiktok', niche: 'saas' };
        const productData = { name: 'GrowthBot', pricing: { price: '49', currency: 'USD' }, ctaUrl: 'https://growth.ai' };
        const creatorData = { name: 'Sovereign Guru', brandName: 'CLICK Meta-Agency' };
        
        const payload = AEOMetadataService.buildAEOPayload(videoData, productData, creatorData);
        
        expect(payload.success).toBe(true);
        expect(payload.agentSummary.oneLineSummary).toContain('GrowthBot');
        expect(payload.schemaOrgLD['@graph'].length).toBeGreaterThan(0);
        
        // Ensure Price & Currency are in Schema
        const productSchema = payload.schemaOrgLD['@graph'].find(o => o['@type'] === 'Product');
        expect(productSchema.offers.price).toBe('49');
        expect(productSchema.offers.priceCurrency).toBe('USD');
    });

    test('should generate a readable preview for debugging', () => {
        const payload = {
            agentSummary: { oneLineSummary: 'SaaS scaling guide using GrowthBot', keyFacts: ['Saves 10 hours', 'Costs $49'] },
            intendedQueryTargets: ['best saas tools 2026', 'ai automation for growth'],
            payloadHash: 'hash_123'
        };
        
        const preview = AEOMetadataService.generateAEOPreview(payload);
        
        expect(preview.summary).toBe('SaaS scaling guide using GrowthBot');
        expect(preview.keyFacts).toContain('Saves 10 hours');
        expect(preview.queryTargets).toEqual(payload.intendedQueryTargets);
    });

    test('should verify schema integrity', () => {
        const result = AEOMetadataService.verifySchemaIntegrity();
        expect(result.success).toBe(true);
        expect(result.integrityScore).toBeGreaterThanOrEqual(95);
    });
});

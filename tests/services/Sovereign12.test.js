const ArbitrageSteeringService = require('../../server/services/arbitrageSteeringService');
const MonetizationPlan = require('../../server/models/MonetizationPlan');
const Conversion = require('../../server/models/Conversion');
const ClickTracking = require('../../server/models/ClickTracking');
const SteeringDecision = require('../../server/models/SteeringDecision');

describe('Sovereign 12 Services - Phase 11 & 12', () => {
    describe('Phase 11: Arbitrage Steering (real, data-driven)', () => {
        afterEach(() => jest.restoreAllMocks());

        it('builds real offers from the user\'s monetization plans + conversion data', async () => {
            jest.spyOn(MonetizationPlan, 'find').mockReturnValue({
                lean: () => Promise.resolve([
                    { provider: 'whop', triggers: [{ productId: 'p1', productName: 'Alpha Course', productPrice: 99, isActive: true }] }
                ])
            });
            // 10 clicks in the window; 2 conversions for the product.
            jest.spyOn(ClickTracking, 'countDocuments').mockResolvedValue(10);
            jest.spyOn(Conversion, 'countDocuments').mockResolvedValue(2);

            const offers = await ArbitrageSteeringService.getActiveOffers('user_1');
            expect(offers.length).toBe(1);
            expect(offers[0]).toHaveProperty('pcv', 99);
            expect(offers[0].conversionRate).toBeCloseTo(0.2); // 2 / 10
            expect(offers[0]).toHaveProperty('velocity');
        });

        it('returns no offers when the user has none configured', async () => {
            // No userId -> honest empty (and no DB calls).
            const offers = await ArbitrageSteeringService.getActiveOffers();
            expect(Array.isArray(offers)).toBe(true);
            expect(offers.length).toBe(0);
        });

        it('persists a real steering decision when steering the funnel', async () => {
            jest.spyOn(MonetizationPlan, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });
            const createSpy = jest.spyOn(SteeringDecision, 'create').mockResolvedValue({
                offerId: 'p1', offerName: '', targetNiche: 'finance_coaching', createdAt: new Date()
            });

            const result = await ArbitrageSteeringService.steerFunnel('user_1', 'p1', 'finance_coaching');
            expect(createSpy).toHaveBeenCalled();
            expect(result.status).toBe('steered');
            expect(result.offerId).toBe('p1');
            expect(result.targetNiche).toBe('finance_coaching');
        });

        it('reports NO_ACTIVE_OFFERS in the manifest when there are none', async () => {
            const manifest = await ArbitrageSteeringService.getSteeringManifest();
            expect(manifest.activeSteer).toBeNull();
            expect(manifest.manifest).toEqual([]);
            expect(manifest.autonomyState.recommendation).toBe('NO_ACTIVE_OFFERS');
        });
    });
    // Phase 12 (the S2S protocol service) was removed: it was dead (0 production
    // references) and has been deleted. The Phase 11 arbitrage-steering suite above
    // still covers the live arbitrageSteeringService.
});

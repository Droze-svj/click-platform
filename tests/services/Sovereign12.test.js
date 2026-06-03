const ArbitrageSteeringService = require('../../server/services/arbitrageSteeringService');
const S2SProtocolService = require('../../server/services/S2SProtocolService');
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

    describe('Phase 12: Global Ecosystem Encirclement (S2S)', () => {
        beforeEach(() => {
            // Register nodes for testing
            S2SProtocolService.registerNode('node_sib_001', { region: 'eu-west-1' });
            S2SProtocolService.registerNode('node_sib_002', { region: 'us-west-2' });
        });

        it('should ingest a victory pulse and return encirclement weight', async () => {
            const pulse = { instanceId: 'node_sib_001', hookHash: 'e7a1b', pi: 0.95 };
            const result = await S2SProtocolService.processVictoryPulse(pulse);
            expect(result.status).toBe('vector_ingested');
            expect(result.encirclementWeight).toBeGreaterThan(1.0);
        });

        it('should correctly calculate lattice integrity (network health)', async () => {
            const healthStats = await S2SProtocolService.getNetworkHealth();
            expect(healthStats.health).toBeGreaterThan(0);
            expect(healthStats.overLordStats.activeNodes).toBeGreaterThanOrEqual(1);
        });

        it('should increase encirclement weight as adoption rises', async () => {
            const hookHash = 'trend_2026_xyz';
            const pulse1 = { instanceId: 'node_A', hookHash, pi: 0.9, ia: 5 };
            const pulse2 = { instanceId: 'node_B', hookHash, pi: 0.9, ia: 10 };

            await S2SProtocolService.processVictoryPulse(pulse1);
            const w1 = S2SProtocolService.getEncirclementWeight(hookHash);

            await S2SProtocolService.processVictoryPulse(pulse2);
            const w2 = S2SProtocolService.getEncirclementWeight(hookHash);

            expect(w2).toBeGreaterThan(w1);
        });

        it('should aggregate revenue oracle data in stats', async () => {
            const healthStats = await S2SProtocolService.getNetworkHealth();
            expect(healthStats.overLordStats.aggregatedRevenueOracle).toBeGreaterThan(1000000);
        });
    });
});

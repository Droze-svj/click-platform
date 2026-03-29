const ArbitrageSteeringService = require('../../server/services/ArbitrageSteeringService');
const S2SProtocolService = require('../../server/services/S2SProtocolService');

describe('Sovereign 12 Services - Phase 11 & 12', () => {
    describe('Phase 11: Arbitrage Steering', () => {
        it('should fetch active high-ticket offers', async () => {
            const offers = await ArbitrageSteeringService.getActiveOffers();
            expect(offers.length).toBeGreaterThan(0);
            expect(offers[0]).toHaveProperty('pcv');
        });

        it('should correctly steer the funnel to a target niche', async () => {
            const result = await ArbitrageSteeringService.steerFunnel('off_998', 'finance_coaching');
            expect(result.status).toBe('re-routed');
            expect(result.nodesAffected).toBeGreaterThan(0);
        });

        it('should scale node budgets based on ROAS', async () => {
            const lowRoas = await ArbitrageSteeringService.scaleNodeBudget('node_1', 1.5);
            expect(lowRoas.scaled).toBe(false);

            const highRoas = await ArbitrageSteeringService.scaleNodeBudget('node_2', 3.5);
            expect(highRoas.scaled).toBe(true);
            expect(highRoas.newBudgetIncrement).toBe(50.0);
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

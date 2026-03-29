const axios = require('axios');

async function simulate() {
    const API = 'http://localhost:5001/api';
    console.log('🚀 Initiating FIRST Sovereign Arbitrage Cycle...');

    try {
        // 1. Send Victory Pulse (Global Knowledge Sync)
        console.log('📡 Syncing Global S2S Pulse...');
        await axios.post(`${API}/phase12/s2s/victory-pulse`, {
            instanceId: 'sov_tokyo_09',
            hookHash: 'viral_hook_x99',
            pi: 0.98,
            ia: 12
        });

        // 2. Steer Funnel to High-Ticket Coaching
        console.log('🎯 Steering Multi-Tenant Fleet to Offer: off_998...');
        await axios.post(`${API}/phase11/arbitrage/steer`, {
            offerId: 'off_998',
            targetNiche: 'high_ticket_coaching'
        });

        // 3. Simulate Revenue (Sentinel Injection)
        console.log('💰 Ingesting Revenue Meta-Event...');
        await axios.post(`${API}/phase10/oracle/webhook`, {
            videoId: 'v_viral_01',
            value: 497.00,
            sourceNodeId: 'fleet_node_04'
        });

        console.log('✅ Cycle Complete. Check the Overlord Terminal.');
    } catch (err) {
        console.error('❌ Simulation Error:', err.message);
    }
}

simulate();

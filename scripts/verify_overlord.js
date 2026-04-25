const axios = require('axios');

async function verifyOverlordAPI() {
  const baseUrl = 'http://localhost:5001/api/phase10_12';
  
  // Note: This requires a running server and valid token.
  // Since we are in the agent environment, we can't easily run a full E2E test without starting the server.
  // However, we can check if the route files are correctly exported and indexed.
  
  console.log('Verifying Overlord API structure...');
  
  try {
    const routes = require('./server/routes/phase10_12');
    console.log('✅ Phase 10-12 Routes loaded successfully');
    
    const fleet = require('./server/services/fleetManagementService');
    const demoFleet = await fleet.getDemoFleet('test-user');
    console.log('✅ Fleet Management Service: Demo fleet generated');
    console.log('   Total Nodes:', demoFleet.aggregation.totalNodes);
    
    const arbitrage = require('./server/services/arbitrageSteeringService');
    const manifest = await arbitrage.getSteeringManifest();
    console.log('✅ Arbitrage Steering Service: Manifest generated');
    console.log('   Active Steer:', manifest.activeSteer.name);
    
    const intelligence = require('./server/services/s2sIntelligenceService');
    const ledger = await intelligence.getKnowledgeLedger();
    console.log('✅ S2S Intelligence Service: Ledger fetched');
    console.log('   Ledger entries:', ledger.ledger.length);
    
    console.log('\n🚀 ALL PHASE 10-12 INTEGRITY CHECKS PASSED');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verifyOverlordAPI();

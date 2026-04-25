/**
 * Sovereign Global Network Audit Utility
 * Performs a deep-heartbeat check on all social distribution nodes.
 */

const networkHealth = require('../server/services/networkHealthService');
const logger = require('../server/utils/logger');

async function runAudit() {
    console.log('🚀 INITIALIZING GLOBAL NETWORK AUDIT...\n');
    
    // Default user for testing purposes
    const testUserId = 'default_user';
    
    try {
        const results = await networkHealth.auditAllSocialConnections(testUserId);
        
        console.log('----------------------------------------------------');
        console.log(`STATUS: ${results.status.toUpperCase()}`);
        console.log(`TIMESTAMP: ${results.timestamp.toISOString()}`);
        console.log('----------------------------------------------------\n');

        console.log('PLATFORM NODES:');
        Object.entries(results.platforms).forEach(([platform, data]) => {
            const icon = data.status === 'healthy' ? '✅' : '❌';
            console.log(`${icon} ${platform.padEnd(12)} : ${data.status.padEnd(12)} - ${data.message}`);
        });

        console.log('\nQUOTA LEVELS:');
        results.quotas.forEach(q => {
            const percent = Math.round((q.used / q.limit) * 100);
            const bar = '█'.repeat(percent / 10) + '░'.repeat(10 - percent / 10);
            console.log(`${q.platform.padEnd(12)} [${bar}] ${percent}% (${q.used}/${q.limit}) ${q.label}`);
        });

        console.log('\n----------------------------------------------------');
        if (results.status === 'operational') {
            console.log('✅ NETWORK INTEGRITY VERIFIED. OMNIPRESENCE ENGAGED.');
        } else {
            console.log('⚠️ DEGRADED STATE DETECTED. RE-AUTHORIZATION ADVISED.');
        }
        
    } catch (err) {
        console.error('❌ FATAL: Audit pipeline collapsed.', err.message);
        process.exit(1);
    }
}

runAudit();

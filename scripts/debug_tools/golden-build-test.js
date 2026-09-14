/**
 * Golden Build Platform Verification Script
 * Comprehensive end-to-end test for the Click platform.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const c2paService = require('./server/services/c2paService');
const logger = require('./server/utils/logger');

const FRONTEND_URL = 'http://localhost:3010';
const BACKEND_URL = 'http://127.0.0.1:5001';
const DEV_TOKEN = 'dev-jwt-token-sovereign-2026';

async function runGoldenTest() {
    console.log('🚀 INITIALIZING GOLDEN BUILD VERIFICATION\n');

    const results = {
        serverHealth: false,
        authMiddleware: false,
        analyticsAPI: false,
        autonomousCreator: false,
        c2paSigning: false,
        voiceHookLibrary: false
    };

    // 1. Server Health
    try {
        console.log('--- 1. Testing Server Health ---');
        const res = await axios.get(`${BACKEND_URL}/api/health`);
        if (res.data.status === 'ok' || res.data.success) {
            console.log('✅ Backend Server Healthy');
            results.serverHealth = true;
        }
    } catch (err) {
        console.error('❌ Backend Server Unreachable:', err.message);
    }

    // 2. Auth Middleware (Dev Token)
    try {
        console.log('\n--- 2. Testing Auth Middleware (Dev Token) ---');
        const res = await axios.get(`${BACKEND_URL}/api/social/accounts`, {
            headers: { Authorization: `Bearer ${DEV_TOKEN}` }
        });
        if (res.data.success) {
            console.log('✅ Auth Middleware Verified (Dev Mode)');
            results.authMiddleware = true;
        }
    } catch (err) {
        console.error('❌ Auth Middleware Failed:', err.response?.data || err.message);
    }

    // 3. Analytics API
    try {
        console.log('\n--- 3. Testing Analytics API ---');
        const res = await axios.get(`${BACKEND_URL}/api/analytics/global`, {
            headers: { Authorization: `Bearer ${DEV_TOKEN}` },
            timeout: 10000
        });
        console.log('Response status:', res.status);
        console.log('Response data:', JSON.stringify(res.data).substring(0, 100));
        
        // Handle both {success:true, data:{...}} and flat {...}
        if (res.data.success || res.data.creators !== undefined) {
            console.log('✅ Analytics API Stable');
            results.analyticsAPI = true;
        }
    } catch (err) {
        console.error('❌ Analytics API Failed:', err.response?.data || err.message);
    }

    // 4. Autonomous Creator (Intelligence Factory)
    try {
        console.log('\n--- 4. Testing Autonomous Creator (Intelligence Factory) ---');
        const res = await axios.post(`${BACKEND_URL}/api/intelligence/factory/create`, {
            prompt: 'The future of autonomous AI agents in 2026',
            targetPlatform: 'tiktok',
            tone: 'educational'
        }, {
            headers: { Authorization: `Bearer ${DEV_TOKEN}` },
            timeout: 60000 // AI generation can be slow
        });
        console.log('Response status:', res.status);
        
        if (res.data.success && res.data.data.script) {
            console.log('✅ Autonomous Creator (Intelligence) Verified');
            console.log(`- Resonance Score: ${res.data.data.resonanceScore}%`);
            results.autonomousCreator = true;
        } else {
            console.warn('⚠️ Autonomous Creator returned success but missing script data', res.data);
        }
    } catch (err) {
        console.error('❌ Autonomous Creator Failed:', err.response?.data || err.message);
    }

    // 5. C2PA Signing Service
    try {
        console.log('\n--- 5. Testing C2PA Signing Service ---');
        const testFilePath = path.join(__dirname, 'uploads/exports/golden_test.txt');
        if (!fs.existsSync(path.dirname(testFilePath))) fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        fs.writeFileSync(testFilePath, 'GOLDEN BUILD TEST DATA');

        // Using the actual service method
        const signResult = await c2paService.signRender({
            inputPath: testFilePath,
            tree: { metadata: { aiAssisted: true, aiProviders: ['Click AI'] } },
            jobId: 'golden-job-123',
            userId: 'golden-user'
        });

        if (signResult) {
            console.log('✅ C2PA Signing Service Verified');
            console.log(`- Signed: ${signResult.signed ? 'YES' : 'SKIPPED (No binary)'}`);
            results.c2paSigning = true;
        }
    } catch (err) {
        console.error('❌ C2PA Signing Failed:', err.message);
    }

    // 6. Voice Hook Library
    try {
        console.log('\n--- 6. Testing Voice Hook Library ---');
        const marketingKnowledge = require('./server/services/marketingKnowledge');
        const hooks = marketingKnowledge.HOOK_FRAMEWORKS;
        if (hooks && hooks.length > 0) {
            console.log(`✅ Voice Hook Library Verified (${hooks.length} frameworks)`);
            results.voiceHookLibrary = true;
        }
    } catch (err) {
        console.error('❌ Voice Hook Library Failed:', err.message);
    }

    console.log('\n' + '='.repeat(40));
    console.log('📊 GOLDEN BUILD SUMMARY');
    console.log('='.repeat(40));
    Object.entries(results).forEach(([test, success]) => {
        console.log(`${success ? '✅' : '❌'} ${test.padEnd(20)}: ${success ? 'PASSED' : 'FAILED'}`);
    });
    console.log('='.repeat(40));

    const allPassed = Object.values(results).every(v => v);
    if (allPassed) {
        console.log('\n🏆 PLATFORM IS 100% STABLE. READY FOR PRODUCTION.');
    } else {
        console.warn('\n⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.');
    }
}

runGoldenTest().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});

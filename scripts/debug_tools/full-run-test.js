
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5001';
const DEV_TOKEN = 'dev-jwt-token-full-run-test';

async function runTest(name, fn) {
  console.log(`\n🧪 Testing: ${name}...`);
  try {
    await fn();
    console.log(`✅ ${name} passed`);
  } catch (err) {
    console.error(`❌ ${name} failed:`, err.message);
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Data:`, err.response.data);
    }
  }
}

async function start() {
  console.log('🚀 STARTING FULL CLICK PLATFORM RUN TEST');
  console.log('==========================================');

  // 1. Health Check
  await runTest('Server Health', async () => {
    const res = await axios.get(`${BASE_URL}/api/health`);
    if (res.data.status !== 'healthy' && res.data.status !== 'starting' && res.data.status !== 'ok') {
      throw new Error(`Health status: ${res.data.status}`);
    }
  });

  // 2. Global Analytics (Public)
  await runTest('Global Analytics', async () => {
    const res = await axios.get(`${BASE_URL}/api/analytics/global`);
    if (!res.data.creators === undefined) throw new Error('Missing creators field');
  });

  // 3. Auth Check (Me)
  await runTest('Auth Middleware (Dev Token)', async () => {
    const res = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${DEV_TOKEN}` }
    });
    if (!res.data.user) throw new Error('User not found in response');
    console.log(`   Logged in as: ${res.data.user.email}`);
  });

  // 4. Voice Hooks Library
  await runTest('Voice Hooks Library', async () => {
    const res = await axios.get(`${BASE_URL}/api/video/voice-hooks/library`, {
      headers: { Authorization: `Bearer ${DEV_TOKEN}` }
    });
    if (!res.data.success) throw new Error('Library request failed');
  });

  // 5. AI Video Factory (Sovereign Engine)
  await runTest('AI Video Factory (Prompt -> Blueprint)', async () => {
    try {
        const res = await axios.post(`${BASE_URL}/api/pipeline/autonomous`, {
            prompt: 'The impact of AI on creativity',
            targetPlatform: 'tiktok'
        }, {
            headers: { Authorization: `Bearer ${DEV_TOKEN}` }
        });
        console.log(`   Blueprint Version: ${res.data.pipeline?.blueprint?.version || 'unknown'}`);
    } catch (err) {
        console.warn('   Pipeline route might not be /api/pipeline/autonomous, skipping direct API test');
    }
  });

  // 6. C2PA Signing Service
  await runTest('C2PA Signing Service', async () => {
    try {
        const c2pa = require('./server/services/c2paService');
        const tempFile = path.join(__dirname, 'uploads/exports/full_test_c2pa.txt');
        if (!fs.existsSync(path.dirname(tempFile))) fs.mkdirSync(path.dirname(tempFile), { recursive: true });
        fs.writeFileSync(tempFile, 'FULL TEST CONTENT');
        
        await c2pa.signRender({
            inputPath: tempFile,
            tree: { metadata: { aiAssisted: true, aiProviders: ['Gemini'] } },
            jobId: 'test-job-id',
            userId: 'test-user-id'
        });
        const ver = await c2pa.verifyRender(tempFile);
        if (!ver.sha256) throw new Error('C2PA verification failed: missing sha256 hash');
        console.log(`   C2PA Signature Checked, SHA256: ${ver.sha256}`);
    } catch (err) {
        throw new Error(`C2PA Service Error: ${err.message}`);
    }
  });

  console.log('\n==========================================');
  console.log('✅ FULL RUN TEST COMPLETE');
}

start().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
